package main

import (
	"fmt"
	"os"
	"strconv"
)

// Protocolo entre el servidor de nine (usuario) y el helper privilegiado (root).
type peticionHelper struct {
	Accion string `json:"accion"`
	Puerto int    `json:"puerto,omitempty"`
	Tipo   string `json:"tipo,omitempty"`
}

type respuestaHelper struct {
	Error   string   `json:"error,omitempty"`
	Puertos []Puerto `json:"puertos,omitempty"`
	PID     int      `json:"pid,omitempty"`
}

// ejecutarHelperDesdeArgs interpreta los argumentos de `nine --helper`.
func ejecutarHelperDesdeArgs(args []string) {
	socket := ""
	uid := os.Getuid()
	gid := os.Getgid()

	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "--socket":
			if i+1 < len(args) {
				i++
				socket = args[i]
			}
		case "--uid":
			if i+1 < len(args) {
				i++
				if n, err := strconv.Atoi(args[i]); err == nil {
					uid = n
				}
			}
		case "--gid":
			if i+1 < len(args) {
				i++
				if n, err := strconv.Atoi(args[i]); err == nil {
					gid = n
				}
			}
		}
	}

	if socket == "" {
		fmt.Fprintln(os.Stderr, "helper: falta --socket")
		os.Exit(1)
	}
	ejecutarHelper(socket, uid, gid)
}
