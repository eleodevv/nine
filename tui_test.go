package main

import (
	"strings"
	"testing"
	"time"
)

func modeloDePrueba() *modelo {
	m := &modelo{
		gestor: NuevoGestor(),
		ip:     "192.168.1.10",
		ancho:  100,
		alto:   30,
	}
	m.puertos = []Puerto{
		{Puerto: 3000, PID: 1234, Proceso: "node"},
		{Puerto: 5432, PID: 987, Proceso: "postgres"},
		{Puerto: 9009, PID: 0, Proceso: "desconocido"},
	}
	return m
}

func TestVistasSinPanic(t *testing.T) {
	tamanos := []struct{ ancho, alto int }{
		{100, 30}, {80, 24}, {40, 12}, {20, 6},
	}
	vistas := []vista{vistaInicio, vistaEmparejar, vistaPuertos}

	for _, tam := range tamanos {
		for _, v := range vistas {
			m := modeloDePrueba()
			m.ancho, m.alto = tam.ancho, tam.alto
			m.vista = v

			if v == vistaEmparejar {
				s, _ := m.gestor.Nueva()
				m.sesion = s
				m.qr = "qr"
			}
			out := m.View()
			if out == "" {
				t.Fatalf("vista %d vacía en %dx%d", v, tam.ancho, tam.alto)
			}
		}
	}
}

func TestVistaEmparejarSinSesion(t *testing.T) {
	m := modeloDePrueba()
	m.vista = vistaEmparejar
	m.sesion = nil
	if out := m.View(); out == "" {
		t.Fatal("la vista de emparejamiento sin sesión no debería estar vacía")
	}
}

func TestRecortar(t *testing.T) {
	casos := []struct {
		in   string
		n    int
		want string
	}{
		{"node", 10, "node"},
		{"postgresql", 5, "post…"},
		{"hola", 1, "h"},
		{"", 3, ""},
	}
	for _, c := range casos {
		if got := recortar(c.in, c.n); got != c.want {
			t.Errorf("recortar(%q, %d) = %q, quiero %q", c.in, c.n, got, c.want)
		}
	}
}

func TestBarraTiempoLongitud(t *testing.T) {
	for _, ancho := range []int{1, 8, 24} {
		barra := barraTiempo(90*time.Second, TiempoVida, ancho)
		if n := len([]rune(stripANSI(barra))); n != ancho {
			t.Errorf("barra de ancho %d tiene %d caracteres", ancho, n)
		}
	}
}

func TestConsumirUnSoloUso(t *testing.T) {
	g := NuevoGestor()
	s, err := g.Nueva()
	if err != nil {
		t.Fatal(err)
	}
	if !g.Consumir(s.Codigo) {
		t.Fatal("el código correcto debería consumirse")
	}
	if g.Consumir(s.Codigo) {
		t.Fatal("un código ya consumido no debería validar de nuevo")
	}
}

func TestColumnasPuertos(t *testing.T) {
	wPuerto, wProceso, wPid, wEstado := columnasPuertos(100)
	total := 1 + wPuerto + wProceso + wPid + wEstado + 3
	if total != 100 {
		t.Fatalf("las columnas suman %d, quiero 100", total)
	}
	if wProceso < 10 {
		t.Fatalf("el ancho de PROCESO no puede ser menor que 10, es %d", wProceso)
	}
}

// stripANSI elimina secuencias de escape CSI para poder medir texto visible.
func stripANSI(s string) string {
	var b strings.Builder
	for i := 0; i < len(s); {
		if s[i] == 0x1b && i+1 < len(s) && s[i+1] == '[' {
			i += 2
			for i < len(s) && !(s[i] >= 0x40 && s[i] <= 0x7e) {
				i++
			}
			if i < len(s) {
				i++
			}
			continue
		}
		b.WriteByte(s[i])
		i++
	}
	return b.String()
}
