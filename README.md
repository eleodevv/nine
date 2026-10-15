# nine

Terminal Nine — administra los puertos de tu laptop desde la terminal o desde el móvil, en tiempo real y por WiFi local.

## Instalar

Solo vía remota: el instalador detecta tu sistema (Linux, macOS o Windows) y descarga el binario.

```bash
curl -fsSL https://raw.githubusercontent.com/eleodevv/nine/main/install.sh | bash
```

Opciones: `--system` (instala en `/usr/local/bin`), `--build` (compila desde fuente), `--prefix=DIR`.

## Desinstalar

```bash
curl -fsSL https://raw.githubusercontent.com/eleodevv/nine/main/uninstall.sh | bash
```

Opciones: `--system` (quita de `/usr/local/bin`), `--prefix=DIR`, `--datos` (borra también `~/.config/nine` y `~/.cache/nine`). Respeta instalaciones por enlace (p. ej. pipx).

## Uso

```bash
nine              # abre la terminal: empareja con QR o administra puertos
nine listar       # muestra los puertos TCP en escucha
nine matar 3000   # termina el proceso del puerto 3000
nine ayuda        # muestra la ayuda
```

Abre `nine`, pulsa Enter y escanea el QR (o escribe el código de 6 dígitos) para vincular tu móvil.

## App móvil

```bash
cd app && npx expo start
```

Tres pantallas: Inicio, Vincular (QR o código + IP) y Puertos (lista en vivo, matar con confirmación y elevación de privilegios). La sesión se guarda en el dispositivo.

## Página web

Abre [`web/index.html`](web/index.html) para la página del proyecto.

## Desarrollo

```bash
go build -o nine .   # binario local
go test ./...        # pruebas
gofmt -l .           # formato
```

Requiere Go 1.27+. La app requiere Node 22+ y la CLI de Expo.
