package main

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"
)

// suscripcion es lo que reciben los suscriptores en tiempo real.
type suscripcion struct {
	Puertos []Puerto
	Cerrar  bool
}

type Servidor struct {
	gestor       *Gestor
	mu           sync.Mutex
	dispositivos map[string]bool

	// AlEmparejar se llama cuando un dispositivo se empareja con éxito.
	AlEmparejar func()

	// Difusión de cambios de puertos en tiempo real.
	inicio       sync.Once
	suscriptores map[chan suscripcion]struct{}
	ultima       []Puerto

	// Elevación de privilegios (helper root).
	socketElevado  string
	elevado        bool
	procesoElevado *exec.Cmd
	stdinElevado   io.WriteCloser
}

func NuevoServidor(gestor *Gestor) *Servidor {
	return &Servidor{
		gestor:        gestor,
		dispositivos:  map[string]bool{},
		suscriptores:  map[chan suscripcion]struct{}{},
		socketElevado: rutaSocketElevado(),
	}
}

func (s *Servidor) Manejador() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /emparejar", s.manejarEmparejar)
	mux.HandleFunc("GET /puertos", s.autenticar(s.manejarPuertos))
	mux.HandleFunc("POST /puertos/{puerto}/matar", s.autenticar(s.manejarMatar))
	mux.HandleFunc("POST /puertos/{puerto}/matar-elevado", s.autenticar(s.manejarMatarElevado))
	mux.HandleFunc("GET /eventos", s.autenticar(s.manejarEventos))
	mux.HandleFunc("GET /estado", s.autenticar(s.manejarEstado))
	mux.HandleFunc("POST /elevar", s.autenticar(s.manejarElevar))
	mux.HandleFunc("POST /lanzar", s.autenticar(s.manejarLanzar))
	return mux
}

// Servir atiende peticiones sobre un listener ya abierto y arranca la
// vigilancia de puertos.
func (s *Servidor) Servir(ln net.Listener) error {
	s.inicio.Do(func() { go s.vigilar() })
	return http.Serve(ln, s.Manejador())
}

// ---------- difusión en tiempo real ----------

// SuscribirPuertos devuelve un canal que recibe eventos (lista de puertos o
// cierre de sesión) y el estado actual de inmediato. cancelar lo da de baja.
func (s *Servidor) SuscribirPuertos() (<-chan suscripcion, func()) {
	canal := make(chan suscripcion, 1)

	s.mu.Lock()
	s.suscriptores[canal] = struct{}{}
	if s.ultima != nil {
		select {
		case canal <- suscripcion{Puertos: s.ultima}:
		default:
		}
	}
	s.mu.Unlock()

	cancelar := func() {
		s.mu.Lock()
		if _, ok := s.suscriptores[canal]; ok {
			delete(s.suscriptores, canal)
			close(canal)
		}
		s.mu.Unlock()
	}
	return canal, cancelar
}

// CerrarSesiones revoca todos los dispositivos y avisa a los suscriptores
// (por ejemplo, al generar un código nuevo en la laptop).
func (s *Servidor) CerrarSesiones() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.dispositivos = map[string]bool{}
	for canal := range s.suscriptores {
		select { // vacía un evento pendiente para que el cierre no se pierda
		case <-canal:
		default:
		}
		select {
		case canal <- suscripcion{Cerrar: true}:
		default:
		}
	}
}

func (s *Servidor) vigilar() {
	t := time.NewTicker(time.Second)
	defer t.Stop()
	for range t.C {
		s.refrescar()
	}
}

// refrescar avisa a los suscriptores solo si la lista cambió.
func (s *Servidor) refrescar() {
	lista, err := s.listar()
	if err != nil {
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	if igualesPuertos(s.ultima, lista) {
		return
	}
	s.ultima = lista
	for canal := range s.suscriptores {
		select {
		case canal <- suscripcion{Puertos: lista}:
		default:
		}
	}
}

func igualesPuertos(a, b []Puerto) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

// ---------- puertos (con o sin privilegios) ----------

func (s *Servidor) estaElevado() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.elevado
}

// listar devuelve los puertos; si hay helper root, incluye los privilegiados.
func (s *Servidor) listar() ([]Puerto, error) {
	s.mu.Lock()
	elevado := s.elevado
	socket := s.socketElevado
	s.mu.Unlock()

	if elevado {
		if resp, err := pedirHelper(socket, peticionHelper{Accion: "puertos"}); err == nil && resp.Error == "" {
			return resp.Puertos, nil
		} else if err != nil {
			s.mu.Lock()
			s.elevado = false
			s.mu.Unlock()
		}
	}
	return Listar()
}

// matar termina el proceso del puerto; usa el helper si está elevado.
func (s *Servidor) matar(numero int) error {
	s.mu.Lock()
	elevado := s.elevado
	socket := s.socketElevado
	s.mu.Unlock()

	if elevado {
		if resp, err := pedirHelper(socket, peticionHelper{Accion: "matar", Puerto: numero}); err == nil {
			if resp.Error != "" {
				return errors.New(resp.Error)
			}
			return nil
		}
		s.mu.Lock()
		s.elevado = false
		s.mu.Unlock()
	}
	return Matar(numero)
}

// Elevar pide la contraseña con el diálogo del sistema y arranca el helper.
func (s *Servidor) Elevar() error {
	if !helperSoportado {
		return errors.New("la elevación de privilegios no está disponible en este sistema")
	}
	if s.estaElevado() {
		return nil
	}

	uid, gid := os.Getuid(), os.Getgid()
	nombre, args, err := comandoHelper(s.socketElevado, uid, gid)
	if err != nil {
		return err
	}

	_ = os.Remove(s.socketElevado)

	cmd := exec.Command(nombre, args...)
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return err
	}
	cmd.Stdout = nil
	cmd.Stderr = nil
	if err := cmd.Start(); err != nil {
		return err
	}

	limite := time.Now().Add(90 * time.Second)
	for time.Now().Before(limite) {
		if _, err := pedirHelper(s.socketElevado, peticionHelper{Accion: "estado"}); err == nil {
			s.mu.Lock()
			s.elevado = true
			s.procesoElevado = cmd
			s.stdinElevado = stdin
			s.mu.Unlock()
			s.refrescar()
			return nil
		}
		time.Sleep(500 * time.Millisecond)
	}

	_ = stdin.Close()
	_ = cmd.Process.Kill()
	return errors.New("no se completó la elevación (¿cancelaste el diálogo?)")
}

// ---------- utilidades ----------

func escribirJSON(w http.ResponseWriter, estado int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(estado)
	json.NewEncoder(w).Encode(v)
}

func nuevoTokenDispositivo() (string, error) {
	crudo := make([]byte, 32)
	if _, err := rand.Read(crudo); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(crudo), nil
}

// ---------- middleware ----------

func (s *Servidor) autenticar(siguiente http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")

		s.mu.Lock()
		valido := s.dispositivos[token]
		s.mu.Unlock()

		if token == "" || !valido {
			escribirJSON(w, http.StatusUnauthorized, map[string]string{"error": "no autorizado"})
			return
		}
		siguiente(w, r)
	}
}

// ---------- manejadores ----------

func (s *Servidor) manejarEmparejar(w http.ResponseWriter, r *http.Request) {
	var cuerpo struct {
		Codigo string `json:"codigo"`
	}
	if err := json.NewDecoder(r.Body).Decode(&cuerpo); err != nil {
		escribirJSON(w, http.StatusBadRequest, map[string]string{"error": "JSON inválido"})
		return
	}

	if !s.gestor.Consumir(cuerpo.Codigo) {
		escribirJSON(w, http.StatusUnauthorized, map[string]string{"error": "código inválido o expirado"})
		return
	}

	token, err := nuevoTokenDispositivo()
	if err != nil {
		escribirJSON(w, http.StatusInternalServerError, map[string]string{"error": "error interno"})
		return
	}

	s.mu.Lock()
	s.dispositivos[token] = true
	s.mu.Unlock()

	if s.AlEmparejar != nil {
		go s.AlEmparejar()
	}

	escribirJSON(w, http.StatusOK, map[string]string{"token_dispositivo": token})
}

func (s *Servidor) manejarPuertos(w http.ResponseWriter, r *http.Request) {
	lista, err := s.listar()
	if err != nil {
		escribirJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if lista == nil {
		lista = []Puerto{}
	}
	escribirJSON(w, http.StatusOK, lista)
}

func (s *Servidor) manejarMatar(w http.ResponseWriter, r *http.Request) {
	numero, err := strconv.Atoi(r.PathValue("puerto"))
	if err != nil {
		escribirJSON(w, http.StatusBadRequest, map[string]string{"error": "puerto inválido"})
		return
	}
	if err := s.matar(numero); err != nil {
		escribirJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	go func() {
		time.Sleep(150 * time.Millisecond)
		s.refrescar()
	}()

	escribirJSON(w, http.StatusOK, map[string]string{"estado": "terminado"})
}

// manejarMatarElevado termina un puerto pidiendo contraseña para esa acción
// concreta (sin helper). Útil cuando no se quiere elevar todo nine.
func (s *Servidor) manejarMatarElevado(w http.ResponseWriter, r *http.Request) {
	numero, err := strconv.Atoi(r.PathValue("puerto"))
	if err != nil {
		escribirJSON(w, http.StatusBadRequest, map[string]string{"error": "puerto inválido"})
		return
	}

	pid := int32(0)
	if lista, err := Listar(); err == nil {
		for _, p := range lista {
			if p.Puerto == numero {
				pid = p.PID
				break
			}
		}
	}

	if pid == int32(os.Getpid()) {
		escribirJSON(w, http.StatusBadRequest, map[string]string{"error": "el puerto lo usa nine mismo"})
		return
	}

	if err := MatarConPrivilegios(numero, pid); err != nil {
		escribirJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
		return
	}

	go func() {
		time.Sleep(150 * time.Millisecond)
		s.refrescar()
	}()

	escribirJSON(w, http.StatusOK, map[string]string{"estado": "terminado", "elevado": "true"})
}

func (s *Servidor) manejarEstado(w http.ResponseWriter, r *http.Request) {
	escribirJSON(w, http.StatusOK, map[string]any{
		"elevado":   s.estaElevado(),
		"soportado": helperSoportado,
	})
}

func (s *Servidor) manejarElevar(w http.ResponseWriter, r *http.Request) {
	if err := s.Elevar(); err != nil {
		escribirJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
		return
	}
	escribirJSON(w, http.StatusOK, map[string]any{"elevado": true})
}

func (s *Servidor) manejarLanzar(w http.ResponseWriter, r *http.Request) {
	var cuerpo struct {
		Tipo   string `json:"tipo"`
		Puerto int    `json:"puerto"`
	}
	if err := json.NewDecoder(r.Body).Decode(&cuerpo); err != nil {
		escribirJSON(w, http.StatusBadRequest, map[string]string{"error": "JSON inválido"})
		return
	}
	if !s.estaElevado() {
		escribirJSON(w, http.StatusForbidden, map[string]string{"error": "eleva privilegios primero"})
		return
	}

	resp, err := pedirHelper(s.socketElevado, peticionHelper{Accion: "lanzar", Tipo: cuerpo.Tipo, Puerto: cuerpo.Puerto})
	if err != nil {
		escribirJSON(w, http.StatusBadRequest, map[string]string{"error": "no se pudo contactar al helper"})
		return
	}
	if resp.Error != "" {
		escribirJSON(w, http.StatusBadRequest, map[string]string{"error": resp.Error})
		return
	}

	go func() {
		time.Sleep(700 * time.Millisecond)
		s.refrescar()
	}()

	escribirJSON(w, http.StatusOK, map[string]any{"pid": resp.PID})
}

// manejarEventos sirve los cambios como Server-Sent Events.
func (s *Servidor) manejarEventos(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		escribirJSON(w, http.StatusInternalServerError, map[string]string{"error": "streaming no soportado"})
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	canal, cancelar := s.SuscribirPuertos()
	defer cancelar()

	if lista, err := s.listar(); err == nil {
		escribirEvento(w, lista)
		flusher.Flush()
	}

	ping := time.NewTicker(20 * time.Second)
	defer ping.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case ev, abierto := <-canal:
			if !abierto {
				return
			}
			if ev.Cerrar {
				fmt.Fprint(w, "event: cerrar\ndata: {}\n\n")
			} else {
				escribirEvento(w, ev.Puertos)
			}
			flusher.Flush()
		case <-ping.C:
			fmt.Fprint(w, ": ping\n\n")
			flusher.Flush()
		}
	}
}

func escribirEvento(w io.Writer, lista []Puerto) {
	if lista == nil {
		lista = []Puerto{}
	}
	datos, err := json.Marshal(lista)
	if err != nil {
		return
	}
	fmt.Fprintf(w, "data: %s\n\n", datos)
}
