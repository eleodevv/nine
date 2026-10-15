//go:build !windows

package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"runtime"
	"strconv"
	"syscall"
	"time"
)

const helperSoportado = true

// rutaSocketElevado devuelve el socket local que usa el helper privilegiado.
// Solo el usuario actual puede acceder a él (permisos 0600).
func rutaSocketElevado() string {
	dir := os.Getenv("XDG_RUNTIME_DIR")
	if dir == "" {
		dir = os.TempDir()
	}
	return filepath.Join(dir, fmt.Sprintf("nine-elevado-%d.sock", os.Getuid()))
}

// comandoHelper arma el comando que pide la contraseña y arranca el helper.
func comandoHelper(socket string, uid, gid int) (string, []string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", nil, err
	}

	switch runtime.GOOS {
	case "darwin":
		orden := fmt.Sprintf("%q --helper --socket %q --uid %d --gid %d", exe, socket, uid, gid)
		return "osascript", []string{"-e", fmt.Sprintf("do shell script %q with administrator privileges", orden)}, nil
	default: // linux y demás unix
		if _, err := exec.LookPath("pkexec"); err != nil {
			return "", nil, errors.New("no se encontró pkexec; instala policykit para elevar privilegios")
		}
		return "pkexec", []string{exe, "--helper", "--socket", socket,
			"--uid", strconv.Itoa(uid), "--gid", strconv.Itoa(gid)}, nil
	}
}

// ejecutarHelper corre como root: escucha peticiones en un socket local y las
// resuelve. Termina cuando el nine que lo lanzó cierra su entrada estándar.
func ejecutarHelper(socket string, uid, gid int) {
	_ = os.Remove(socket)

	ln, err := net.Listen("unix", socket)
	if err != nil {
		fmt.Fprintln(os.Stderr, "helper:", err)
		os.Exit(1)
	}
	_ = os.Chown(socket, uid, gid)
	_ = os.Chmod(socket, 0o600)

	// Supervisión: si el nine que nos lanzó muere, esta copia de stdin termina.
	go func() {
		_, _ = io.Copy(io.Discard, os.Stdin)
		_ = ln.Close()
		_ = os.Remove(socket)
		os.Exit(0)
	}()

	for {
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		go atenderConexion(conn, uid, gid)
	}
}

func atenderConexion(conn net.Conn, uid, gid int) {
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(30 * time.Second))

	var pet peticionHelper
	if err := json.NewDecoder(conn).Decode(&pet); err != nil {
		return
	}
	_ = json.NewEncoder(conn).Encode(resolverPeticion(pet, uid, gid))
}

func resolverPeticion(pet peticionHelper, uid, gid int) respuestaHelper {
	switch pet.Accion {
	case "estado":
		return respuestaHelper{}
	case "puertos":
		lista, err := Listar()
		if err != nil {
			return respuestaHelper{Error: err.Error()}
		}
		return respuestaHelper{Puertos: lista}
	case "matar":
		if err := Matar(pet.Puerto); err != nil {
			return respuestaHelper{Error: err.Error()}
		}
		return respuestaHelper{}
	case "lanzar":
		pid, err := lanzarProceso(pet.Tipo, pet.Puerto, uid, gid)
		if err != nil {
			return respuestaHelper{Error: err.Error()}
		}
		return respuestaHelper{PID: pid}
	default:
		return respuestaHelper{Error: "acción desconocida"}
	}
}

// pedirHelper consulta al helper privilegiado por el socket local.
func pedirHelper(socket string, pet peticionHelper) (respuestaHelper, error) {
	conn, err := net.DialTimeout("unix", socket, 2*time.Second)
	if err != nil {
		return respuestaHelper{}, err
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(8 * time.Second))

	if err := json.NewEncoder(conn).Encode(pet); err != nil {
		return respuestaHelper{}, err
	}
	var resp respuestaHelper
	if err := json.NewDecoder(conn).Decode(&resp); err != nil {
		return respuestaHelper{}, err
	}
	return resp, nil
}

// lanzarProceso arranca un servidor de desarrollo como el usuario (no como
// root), desacoplado de nine, en el puerto indicado.
func lanzarProceso(tipo string, puerto, uid, gid int) (int, error) {
	if puerto < 1 || puerto > 65535 {
		return 0, errors.New("puerto inválido")
	}

	var nombre string
	var args []string
	switch tipo {
	case "python":
		nombre = "python3"
		args = []string{"-m", "http.server", strconv.Itoa(puerto)}
	case "node":
		nombre = "node"
		codigo := fmt.Sprintf("require('http').createServer((q,s)=>s.end('nine')).listen(%d)", puerto)
		args = []string{"-e", codigo}
	default:
		return 0, fmt.Errorf("tipo no soportado: %s", tipo)
	}

	ruta, err := exec.LookPath(nombre)
	if err != nil {
		return 0, fmt.Errorf("no se encontró %q instalado", nombre)
	}

	cmd := exec.Command(ruta, args...)
	cmd.Dir = homeDeUsuario(uid)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		Setsid:     true,
		Credential: &syscall.Credential{Uid: uint32(uid), Gid: uint32(gid)},
	}
	cmd.Stdout = nil
	cmd.Stderr = nil

	if err := cmd.Start(); err != nil {
		return 0, err
	}
	pid := cmd.Process.Pid
	_ = cmd.Process.Release()
	return pid, nil
}

func homeDeUsuario(uid int) string {
	if u, err := user.LookupId(strconv.Itoa(uid)); err == nil && u.HomeDir != "" {
		return u.HomeDir
	}
	return "/"
}
