//go:build windows

package main

import (
	"errors"
	"fmt"
	"os"
)

const helperSoportado = false

func rutaSocketElevado() string { return "" }

func comandoHelper(socket string, uid, gid int) (string, []string, error) {
	return "", nil, errors.New("la elevación global todavía no está disponible en Windows")
}

func ejecutarHelper(socket string, uid, gid int) {
	fmt.Fprintln(os.Stderr, "helper: no soportado en Windows")
	os.Exit(1)
}

func pedirHelper(socket string, pet peticionHelper) (respuestaHelper, error) {
	return respuestaHelper{}, errors.New("la elevación global no está disponible en Windows")
}
