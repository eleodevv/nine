package main

import (
	"context"
	"errors"
	"fmt"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

// tiempoElevacion es lo máximo que esperamos a que el usuario escriba la
// contraseña en el diálogo del sistema.
const tiempoElevacion = 120 * time.Second

// MatarConPrivilegios termina el proceso que escucha en el puerto usando el
// diálogo de elevación nativo: polkit (pkexec) en Linux, osascript en macOS y
// UAC (Start-Process -Verb RunAs) en Windows.
//
// pid puede ser 0 si no tenemos permiso para leerlo; en ese caso se localiza
// el proceso por el puerto.
func MatarConPrivilegios(puerto int, pid int32) error {
	nombre, args, err := comandoElevado(puerto, pid)
	if err != nil {
		return err
	}

	ctx, cancelar := context.WithTimeout(context.Background(), tiempoElevacion)
	defer cancelar()

	cmd := exec.CommandContext(ctx, nombre, args...)
	salida, err := cmd.CombinedOutput()

	if ctx.Err() == context.DeadlineExceeded {
		return errors.New("se agotó el tiempo esperando la contraseña")
	}
	if err != nil {
		if esCancelacion(salida, err) {
			return errors.New("cancelaste la elevación de privilegios")
		}
		return fmt.Errorf("no se pudo elevar privilegios: %s", detalleSalida(salida, err))
	}
	return nil
}

// comandoElevado arma el comando según el sistema operativo.
func comandoElevado(puerto int, pid int32) (string, []string, error) {
	switch runtime.GOOS {
	case "linux":
		if _, err := exec.LookPath("pkexec"); err != nil {
			return "", nil, errors.New("no se encontró pkexec; instala policykit para elevar privilegios")
		}
		if pid > 0 {
			return "pkexec", []string{"kill", "-TERM", fmt.Sprint(pid)}, nil
		}
		// Sin PID: localizamos el proceso por el puerto y lo terminamos.
		script := fmt.Sprintf(
			"fuser -k -TERM %d/tcp 2>/dev/null || lsof -ti tcp:%d | xargs -r kill",
			puerto, puerto,
		)
		return "pkexec", []string{"sh", "-c", script}, nil

	case "darwin":
		if pid > 0 {
			script := fmt.Sprintf("do shell script \"kill -TERM %d\" with administrator privileges", pid)
			return "osascript", []string{"-e", script}, nil
		}
		script := fmt.Sprintf("do shell script \"lsof -ti tcp:%d | xargs kill\" with administrator privileges", puerto)
		return "osascript", []string{"-e", script}, nil

	case "windows":
		var orden string
		if pid > 0 {
			orden = fmt.Sprintf(
				"Start-Process -FilePath taskkill -ArgumentList '/PID','%d','/F' -Verb RunAs",
				pid,
			)
		} else {
			orden = fmt.Sprintf(
				"$c = Get-NetTCPConnection -LocalPort %d -State Listen -ErrorAction SilentlyContinue; "+
					"if ($c) { Start-Process -FilePath taskkill -ArgumentList '/PID',$c.OwningProcess,'/F' -Verb RunAs } else { exit 1 }",
				puerto,
			)
		}
		return "powershell", []string{"-NoProfile", "-Command", orden}, nil

	default:
		return "", nil, fmt.Errorf("elevación de privilegios no soportada en %s", runtime.GOOS)
	}
}

func esCancelacion(salida []byte, err error) bool {
	var salidaErr *exec.ExitError
	if errors.As(err, &salidaErr) && salidaErr.ExitCode() == 126 {
		// pkexec: el usuario cerró el diálogo sin autenticarse.
		return true
	}
	return strings.Contains(strings.ToLower(string(salida)), "cancel")
}

func detalleSalida(salida []byte, err error) string {
	texto := strings.TrimSpace(string(salida))
	if texto == "" {
		return err.Error()
	}
	if len(texto) > 200 {
		texto = texto[:200]
	}
	return texto
}
