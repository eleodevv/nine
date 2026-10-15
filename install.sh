#!/usr/bin/env bash
#
# nine — instalador
#
# Instala el binario de nine en tu sistema.
#
# Uso:
#   ./install.sh                      instala en ~/.local/bin (usa el binario
#                                     precompilado de bin/ o compila con Go)
#   ./install.sh --system             instala en /usr/local/bin (pide sudo)
#   ./install.sh --build              fuerza compilar desde el código fuente
#   ./install.sh --prefix=DIR         instala en DIR
#
# Variables:
#   NINE_BASE_URL   base para descargar el binario si no hay copia local
#                   ni Go instalado (por defecto, los releases de GitHub).
#
set -euo pipefail

# Releases de GitHub. Cambia eleodevv/nine por tu repo si es otro.
NINE_BASE_URL="${NINE_BASE_URL:-https://github.com/eleodevv/nine/releases/latest/download}"

PREFIX="$HOME/.local/bin"
USAR_SUDO=0
DESDE_FUENTE=0

uso() {
  cat <<'AYUDA'
nine — instalador

Instala el binario de nine en tu sistema.

Uso:
  ./install.sh                  instala en ~/.local/bin
  ./install.sh --system         instala en /usr/local/bin (pide sudo)
  ./install.sh --build          fuerza compilar desde el código fuente
  ./install.sh --prefix=DIR     instala en DIR

Variables:
  NINE_BASE_URL   base para descargar el binario si no hay copia local
                  ni Go instalado (por defecto, los releases de GitHub).
AYUDA
}

for arg in "$@"; do
  case "$arg" in
    --system) PREFIX="/usr/local/bin"; USAR_SUDO=1 ;;
    --build) DESDE_FUENTE=1 ;;
    --prefix=*) PREFIX="${arg#--prefix=}" ;;
    -h | --help) uso; exit 0 ;;
    *) echo "error: opción desconocida: $arg (usa --help)" >&2; exit 1 ;;
  esac
done

case "${BASH_SOURCE-}" in
  '') SCRIPT="$0" ;;
  *) SCRIPT="${BASH_SOURCE[0]}" ;;
esac
REPO_DIR="$(cd "$(dirname "$SCRIPT")" 2>/dev/null && pwd || pwd)"

SO="$(uname -s)"
case "$SO" in
  Linux) SO="linux" ;;
  Darwin) SO="darwin" ;;
  MINGW* | MSYS* | CYGWIN*) SO="windows" ;;
  *)
    echo "error: sistema no soportado: $SO" >&2
    exit 1
    ;;
esac

ARQ="$(uname -m)"
case "$ARQ" in
  x86_64) ARQ="amd64" ;;
  aarch64 | arm64) ARQ="arm64" ;;
  *)
    echo "error: arquitectura no soportada: $ARQ" >&2
    exit 1
    ;;
esac

ACTIVO="nine-${SO}-${ARQ}"
NOMBRE="nine"
if [ "$SO" = "windows" ]; then
  ACTIVO="${ACTIVO}.exe"
  NOMBRE="nine.exe"
fi

TMPDIR="$(mktemp -d)"
limpiar() { rm -rf "$TMPDIR"; }
trap limpiar EXIT

FUENTE=""
if [ "$DESDE_FUENTE" -eq 0 ] && [ -f "$REPO_DIR/bin/$ACTIVO" ]; then
  echo "· usando binario precompilado: bin/$ACTIVO"
  FUENTE="$REPO_DIR/bin/$ACTIVO"
elif command -v go >/dev/null 2>&1 && [ -f "$REPO_DIR/go.mod" ]; then
  echo "· compilando nine desde el código fuente…"
  (cd "$REPO_DIR" && CGO_ENABLED=0 go build -ldflags="-s -w" -o "$TMPDIR/$NOMBRE" .)
  FUENTE="$TMPDIR/$NOMBRE"
elif command -v curl >/dev/null 2>&1 || command -v wget >/dev/null 2>&1; then
  URL="$NINE_BASE_URL/$ACTIVO"
  echo "· descargando $URL"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL -o "$TMPDIR/$NOMBRE" "$URL" || {
      echo "error: no se pudo descargar $URL" >&2
      echo "revisa NINE_BASE_URL o instala Go y usa --build" >&2
      exit 1
    }
  else
    wget -qO "$TMPDIR/$NOMBRE" "$URL" || {
      echo "error: no se pudo descargar $URL" >&2
      exit 1
    }
  fi
  FUENTE="$TMPDIR/$NOMBRE"
else
  echo "error: no hay binario para $SO/$ARQ en bin/, ni Go, ni curl/wget" >&2
  exit 1
fi

mkdir -p "$PREFIX"
if [ "$USAR_SUDO" -eq 1 ] && [ "$(id -u)" -ne 0 ]; then
  if ! command -v sudo >/dev/null 2>&1; then
    echo "error: --system necesita sudo" >&2
    exit 1
  fi
  sudo cp "$FUENTE" "$PREFIX/$NOMBRE"
  sudo chmod +x "$PREFIX/$NOMBRE"
else
  cp "$FUENTE" "$PREFIX/$NOMBRE"
  chmod +x "$PREFIX/$NOMBRE"
fi

"$PREFIX/$NOMBRE" ayuda >/dev/null
echo "✓ nine instalado en $PREFIX/$NOMBRE"

case ":$PATH:" in
  *":$PREFIX:"*) ;;
  *)
    echo ""
    echo "Añade $PREFIX a tu PATH:"
    case "$(basename "${SHELL:-sh}")" in
      zsh) echo "  echo 'export PATH=\"$PREFIX:\$PATH\"' >> ~/.zshrc && source ~/.zshrc" ;;
      fish) echo "  fish_add_path $PREFIX" ;;
      *) echo "  echo 'export PATH=\"$PREFIX:\$PATH\"' >> ~/.bashrc && source ~/.bashrc" ;;
    esac
    ;;
esac
