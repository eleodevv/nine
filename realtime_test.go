package main

import (
	"bufio"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func leerEvento(t *testing.T, br *bufio.Reader) string {
	t.Helper()
	evento := make(chan string, 1)
	fallo := make(chan error, 1)

	go func() {
		var datos string
		for {
			linea, err := br.ReadString('\n')
			if err != nil {
				fallo <- err
				return
			}
			linea = strings.TrimRight(linea, "\r\n")
			if strings.HasPrefix(linea, "data:") {
				datos = strings.TrimSpace(strings.TrimPrefix(linea, "data:"))
			}
			if linea == "" && datos != "" {
				evento <- datos
				return
			}
		}
	}()

	select {
	case d := <-evento:
		return d
	case err := <-fallo:
		t.Fatalf("error leyendo evento: %v", err)
		return ""
	case <-time.After(3 * time.Second):
		t.Fatal("tiempo agotado esperando un evento")
		return ""
	}
}

func TestSuscribirEntregaEstadoInicial(t *testing.T) {
	s := NuevoServidor(NuevoGestor())
	s.ultima = []Puerto{{Puerto: 1234, PID: 10, Proceso: "falso"}}

	canal, cancelar := s.SuscribirPuertos()
	defer cancelar()

	select {
	case ev := <-canal:
		if ev.Cerrar || len(ev.Puertos) != 1 || ev.Puertos[0].Proceso != "falso" {
			t.Fatalf("estado inicial inesperado: %+v", ev)
		}
	case <-time.After(time.Second):
		t.Fatal("no llegó el estado inicial al suscribirse")
	}
}

func TestEventosSSEDifundeCambios(t *testing.T) {
	s := NuevoServidor(NuevoGestor())
	s.dispositivos["token-test"] = true

	servidor := httptest.NewServer(s.Manejador())
	defer servidor.Close()

	peticion, err := http.NewRequest(http.MethodGet, servidor.URL+"/eventos", nil)
	if err != nil {
		t.Fatal(err)
	}
	peticion.Header.Set("Authorization", "Bearer token-test")

	respuesta, err := http.DefaultClient.Do(peticion)
	if err != nil {
		t.Fatal(err)
	}
	defer respuesta.Body.Close()

	if respuesta.StatusCode != http.StatusOK {
		t.Fatalf("estado %d, quiero 200", respuesta.StatusCode)
	}

	lector := bufio.NewReader(respuesta.Body)
	primero := leerEvento(t, lector)
	if primero == "" {
		t.Fatal("el evento inicial llegó vacío")
	}

	// Forzamos un cambio dejando un estado obsoleto y refrescando.
	s.mu.Lock()
	s.ultima = []Puerto{{Puerto: -1, PID: -1, Proceso: "obsoleto"}}
	s.mu.Unlock()
	s.refrescar()

	segundo := leerEvento(t, lector)
	if strings.Contains(segundo, "obsoleto") {
		t.Fatalf("no debería difundirse el estado obsoleto: %q", segundo)
	}

	var lista []Puerto
	if err := json.Unmarshal([]byte(segundo), &lista); err != nil {
		t.Fatalf("el evento no es JSON de puertos: %v", err)
	}
}

func TestEventosRequiereToken(t *testing.T) {
	s := NuevoServidor(NuevoGestor())
	servidor := httptest.NewServer(s.Manejador())
	defer servidor.Close()

	respuesta, err := http.Get(servidor.URL + "/eventos")
	if err != nil {
		t.Fatal(err)
	}
	defer respuesta.Body.Close()

	if respuesta.StatusCode != http.StatusUnauthorized {
		t.Fatalf("estado %d, quiero 401", respuesta.StatusCode)
	}
}

func TestMatarElevadoRequiereToken(t *testing.T) {
	s := NuevoServidor(NuevoGestor())
	servidor := httptest.NewServer(s.Manejador())
	defer servidor.Close()

	respuesta, err := http.Post(servidor.URL+"/puertos/3000/matar-elevado", "application/json", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer respuesta.Body.Close()

	if respuesta.StatusCode != http.StatusUnauthorized {
		t.Fatalf("estado %d, quiero 401", respuesta.StatusCode)
	}
}

func TestCerrarSesionesRevocaYNotifica(t *testing.T) {
	s := NuevoServidor(NuevoGestor())
	s.dispositivos["tok"] = true

	canal, cancelar := s.SuscribirPuertos()
	defer cancelar()

	s.CerrarSesiones()

	select {
	case ev := <-canal:
		if !ev.Cerrar {
			t.Fatalf("se esperaba un evento de cierre, llegó %+v", ev)
		}
	case <-time.After(time.Second):
		t.Fatal("no llegó el aviso de cierre a los suscriptores")
	}

	s.mu.Lock()
	_, sigue := s.dispositivos["tok"]
	s.mu.Unlock()
	if sigue {
		t.Fatal("el token del dispositivo debería haberse revocado")
	}
}

func TestEstadoRequiereTokenYDevuelveElevado(t *testing.T) {
	s := NuevoServidor(NuevoGestor())

	// Sin token: 401.
	servidor := httptest.NewServer(s.Manejador())
	defer servidor.Close()
	respuesta, err := http.Get(servidor.URL + "/estado")
	if err != nil {
		t.Fatal(err)
	}
	respuesta.Body.Close()
	if respuesta.StatusCode != http.StatusUnauthorized {
		t.Fatalf("estado %d, quiero 401", respuesta.StatusCode)
	}

	// Con token: 200 y elevado=false.
	s.dispositivos["tok"] = true
	peticion, _ := http.NewRequest(http.MethodGet, servidor.URL+"/estado", nil)
	peticion.Header.Set("Authorization", "Bearer tok")
	ok, err := http.DefaultClient.Do(peticion)
	if err != nil {
		t.Fatal(err)
	}
	defer ok.Body.Close()
	if ok.StatusCode != http.StatusOK {
		t.Fatalf("estado %d, quiero 200", ok.StatusCode)
	}
	var cuerpo struct {
		Elevado bool `json:"elevado"`
	}
	if err := json.NewDecoder(ok.Body).Decode(&cuerpo); err != nil {
		t.Fatal(err)
	}
	if cuerpo.Elevado {
		t.Fatal("no debería estar elevado")
	}
}
