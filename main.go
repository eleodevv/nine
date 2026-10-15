package main

import (
	"fmt"
	"os"
	"strconv"
	"text/tabwriter"
)

func main() {
	// Modo helper privilegiado (lo arranca nine con el diálogo del sistema).
	if len(os.Args) >= 2 && os.Args[1] == "--helper" {
		ejecutarHelperDesdeArgs(os.Args[2:])
		return
	}

	// Sin argumentos: abre el TUI.
	if len(os.Args) < 2 {
		ejecutarTUI()
		return
	}

	switch os.Args[1] {
	case "listar", "ls":
		comandoListar()
	case "matar", "kill":
		comandoMatar(os.Args[2:])
	case "ayuda", "-h", "--help":
		mostrarAyuda()
	default:
		fmt.Printf("comando desconocido: %s\n\n", os.Args[1])
		mostrarAyuda()
		os.Exit(1)
	}
}

func mostrarAyuda() {
	fmt.Println(`nine - administrador de puertos

Uso:
  nine                 abre el modo TUI (QR y código para emparejar)
  nine listar          muestra los puertos en escucha
  nine matar <puerto>  termina el proceso de ese puerto
  nine ayuda           muestra esta ayuda`)
}

func comandoListar() {
	lista, err := Listar()
	if err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}

	tw := tabwriter.NewWriter(os.Stdout, 0, 0, 3, ' ', 0)
	fmt.Fprintln(tw, "PUERTO\tPID\tPROCESO")
	for _, p := range lista {
		pid := "-"
		if p.PID > 0 {
			pid = strconv.Itoa(int(p.PID))
		}
		fmt.Fprintf(tw, "%d\t%s\t%s\n", p.Puerto, pid, p.Proceso)
	}
	tw.Flush()
}

func comandoMatar(args []string) {
	if len(args) != 1 {
		fmt.Println("uso: nine matar <puerto>")
		os.Exit(1)
	}

	numero, err := strconv.Atoi(args[0])
	if err != nil {
		fmt.Println("puerto inválido:", args[0])
		os.Exit(1)
	}

	if err := Matar(numero); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
	fmt.Printf("puerto %d terminado\n", numero)
}
