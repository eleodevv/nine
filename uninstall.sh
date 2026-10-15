#!/usr/bin/env bash
#
# nine — desinstalador
#
# Quita el binario de nine de tu sistema.
#
# Uso:
#   ./uninstall.sh                    desinstala de ~/.local/bin
#   ./uninstall.sh --system           desinstala de /usr/local/bin (pide sudo)
#   ./uninstall.sh --prefix=DIR       desinstala de DIR
#   ./uninstall.sh --datos            borra también los datos de nine
#
# Variables:
#   NINE_DATOS   directorios de datos a borrar con --datos
#                (por defecto ~/.config/nine ~/.cache/nine)
#
set -euo pipefail

PREFIX="$HOME/.local/bin"
USAR_SUDO=0
BORRAR_DATOS=0

uso() {
  cat <<'AYUDA'
nine — desinstalador

Quita el binario de nine de tu sistema.

Uso:
  ./uninstall.sh                desinstala de ~/.local/bin
  ./uninstall.sh --system       desinstala de /usr/local/bin (pide sudo)
  ./uninstall.sh --prefix=DIR   desinstala de DIR
  ./uninstall.sh --datos        borra también los datos de nine

Variables:
  NINE_DATOS   directorios de datos a borrar con --datos
               (por defecto ~/.config/nine ~/.cache/nine)
AYUDA
}

for arg in "$@"; do
  case "$arg" in
    --system) PREFIX="/usr/local/bin"; USAR_SUDO=1 ;;
    --prefix=*) PREFIX="${arg#--prefix=}" ;;
    --datos | --purge) BORRAR_DATOS=1 ;;
    -h | --help) uso; exit 0 ;;
    *) echo "error: opción desconocida: $arg (usa --help)" >&2; exit 1 ;;
  esac
done

# En Windows (Git Bash / MSYS) el binario lleva .exe.
NOMBRE="nine"
case "$(uname -s)" in
  MINGW* | MSYS* | CYGWIN*) NOMBRE="nine.exe" ;;
esac

OBJETIVO="$PREFIX/$NOMBRE"

usar_sudo() {
  if [ "$USAR_SUDO" -eq 1 ] && [ "$(id -u)" -ne 0 ]; then
    return 0
  fi
  return 1
}

borrar() {
  if usar_sudo && command -v sudo >/dev/null 2>&1; then
    sudo rm -f "$@"
  else
    rm -f "$@"
  fi
}

eliminado_algo=0

if [ -L "$OBJETIVO" ]; then
  # Es un enlace (p. ej. una instalación vía pipx): quitamos el enlace y,
  # si apunta a un binario de nine, también el destino.
  REAL="$(readlink -f "$OBJETIVO" 2>/dev/null || true)"
  borrar "$OBJETIVO"
  echo "· enlace eliminado: $OBJETIVO"
  eliminado_algo=1
  if [ -n "$REAL" ] && [ -f "$REAL" ]; then
    case "$REAL" in
      */venvs/nine/bin/nine* | */pipx/venvs/nine/* | */nine/bin/nine)
        borrar "$REAL"
        echo "· binario eliminado: $REAL"
        ;;
      *)
        echo "· nota: el enlace apuntaba a $REAL (no se tocó)"
        ;;
    esac
  fi
elif [ -e "$OBJETIVO" ]; then
  borrar "$OBJETIVO"
  echo "· binario eliminado: $OBJETIVO"
  eliminado_algo=1
else
  echo "· no se encontró nine en $OBJETIVO"
fi

if [ "$BORRAR_DATOS" -eq 1 ]; then
  DATOS="${NINE_DATOS:-$HOME/.config/nine $HOME/.cache/nine}"
  for d in $DATOS; do
    if [ -e "$d" ]; then
      if usar_sudo; then sudo rm -rf "$d"; else rm -rf "$d"; fi
      echo "· datos eliminados: $d"
      eliminado_algo=1
    fi
  done
fi

if [ "$eliminado_algo" -eq 0 ]; then
  echo ""
  echo "No había nada que desinstalar."
  echo "Si lo instalaste en otro sitio, prueba con --prefix=DIR."
  exit 0
fi

if command -v nine >/dev/null 2>&1; then
  echo ""
  echo "aviso: todavía hay un nine en el PATH ($(command -v nine))."
  echo "revisa otros prefijos o abre una terminal nueva."
fi

echo ""
echo "✓ nine desinstalado"
