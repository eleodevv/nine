package main

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/shirou/gopsutil/v4/net"
	"github.com/shirou/gopsutil/v4/process"
)

type Puerto struct {
	Puerto  int    `json:"puerto"`
	PID     int32  `json:"pid"`
	Proceso string `json:"proceso"`
}

// limpiarNombre se queda solo con el nombre del ejecutable,
// sin ruta ni argumentos.
func limpiarNombre(n string) string {
	if i := strings.Index(n, " "); i > 0 {
		n = n[:i]
	}
	return filepath.Base(n)
}

// Listar devuelve los puertos TCP en escucha, sin repetidos y ordenados.
func Listar() ([]Puerto, error) {
	conexiones, err := net.Connections("tcp")
	if err != nil {
		return nil, err
	}

	vistos := map[int]bool{}
	var salida []Puerto

	for _, c := range conexiones {
		if c.Status != "LISTEN" {
			continue
		}
		numero := int(c.Laddr.Port)
		if vistos[numero] {
			continue
		}
		vistos[numero] = true

		nombre := "desconocido"
		if c.Pid > 0 {
			if proc, err := process.NewProcess(c.Pid); err == nil {
				if n, err := proc.Name(); err == nil {
					nombre = limpiarNombre(n)
				}
			}
		}
		salida = append(salida, Puerto{Puerto: numero, PID: c.Pid, Proceso: nombre})
	}

	sort.Slice(salida, func(i, j int) bool { return salida[i].Puerto < salida[j].Puerto })
	return salida, nil
}

// Matar termina el proceso que escucha en el puerto indicado.
func Matar(puerto int) error {
	lista, err := Listar()
	if err != nil {
		return err
	}
	for _, p := range lista {
		if p.Puerto == puerto {
			if p.PID <= 0 {
				return fmt.Errorf("no se pudo obtener el PID del puerto %d (prueba con sudo)", puerto)
			}
			if p.PID == int32(os.Getpid()) {
				return fmt.Errorf("el puerto %d lo usa nine mismo", puerto)
			}
			proc, err := process.NewProcess(p.PID)
			if err != nil {
				return err
			}
			return proc.Kill()
		}
	}
	return fmt.Errorf("no hay nada escuchando en el puerto %d", puerto)
}
