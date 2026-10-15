package main

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"math/big"
	"sync"
	"time"
)

const (
	// TiempoVida es cuánto dura un código antes de expirar.
	TiempoVida = 2 * time.Minute
	// MaxIntentos es el máximo de intentos permitidos por sesión.
	MaxIntentos = 5
)

type Sesion struct {
	Codigo   string
	Token    string
	ExpiraEn time.Time
	Intentos int
}

type Gestor struct {
	mu     sync.Mutex
	actual *Sesion

	// AlNueva se llama cuando se genera un código nuevo (para invalidar
	// a los dispositivos ya emparejados).
	AlNueva func()
}

func NuevoGestor() *Gestor {
	return &Gestor{}
}

// Nueva genera un código de 6 digitos y un token para el QR
func (g *Gestor) Nueva() (*Sesion, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return nil, err
	}

	crudo := make([]byte, 32)
	if _, err := rand.Read(crudo); err != nil {
		return nil, err
	}

	s := &Sesion{
		Codigo:   fmt.Sprintf("%06d", n.Int64()),
		Token:    base64.RawURLEncoding.EncodeToString(crudo),
		ExpiraEn: time.Now().Add(TiempoVida),
	}

	g.mu.Lock()
	g.actual = s
	g.mu.Unlock()

	if g.AlNueva != nil {
		g.AlNueva()
	}

	return s, nil
}

// Consumir valida el código o el token y los quema si son correctos (un solo uso).
func (g *Gestor) Consumir(entrada string) bool {
	g.mu.Lock()
	defer g.mu.Unlock()

	s := g.actual
	if s == nil || time.Now().After(s.ExpiraEn) {
		return false
	}

	s.Intentos++
	if s.Intentos > MaxIntentos {
		g.actual = nil
		return false
	}

	if entrada == s.Codigo || entrada == s.Token {
		g.actual = nil
		return true
	}
	return false
}
