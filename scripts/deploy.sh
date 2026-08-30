#!/usr/bin/env bash
#
# Publica la aplicación en el repositorio de ficheros estáticos, que es donde
# vive el sitio de GitHub Pages:
#
#   https://electrucio.github.io/front-panel-designer/
#
# Es el mismo esquema que usa ltspice-kicad-mapper: una carpeta por aplicación
# dentro de electrucio.github.io, con la construcción de Vite dentro. No se usa
# el despliegue de Pages desde este repositorio porque el sitio ya lo sirve
# aquel, y montar un segundo dominio de Pages para lo mismo sobra.
#
# OJO con el nombre de la carpeta: no puede coincidir con el del repositorio.
# GitHub reserva `<usuario>.github.io/<nombre-de-repo>/` para la página de
# proyecto de ese repositorio, y esa ruta tapa a la carpeta del sitio de usuario
# aunque aquel no tenga Pages activado.
#
#   npm run deploy
#
set -euo pipefail

PAGES_REMOTE="git@github-electrucio:electrucio/electrucio.github.io.git"
TARGET="front-panel-designer"
WORKTREE=".deploy/electrucio.github.io"

cd "$(dirname "$0")/.."

echo "==> Construyendo"
npm run build

echo "==> Sincronizando el repositorio de Pages"
mkdir -p .deploy
if [ -d "$WORKTREE/.git" ]; then
  git -C "$WORKTREE" fetch --quiet origin main
  git -C "$WORKTREE" checkout --quiet main
  git -C "$WORKTREE" reset --hard --quiet origin/main
else
  rm -rf "$WORKTREE"
  git clone --quiet --depth 1 "$PAGES_REMOTE" "$WORKTREE"
fi

# Se reemplaza solo la carpeta de esta aplicación: el resto del sitio no se toca.
echo "==> Copiando la construcción en $TARGET/"
rm -rf "${WORKTREE:?}/${TARGET:?}"
mkdir -p "$WORKTREE/$TARGET"
cp -R dist/. "$WORKTREE/$TARGET/"

git -C "$WORKTREE" add -- "$TARGET"

if git -C "$WORKTREE" diff --cached --quiet; then
  echo "==> Sin cambios: lo publicado ya coincide con esta construcción."
  exit 0
fi

SOURCE_COMMIT="$(git rev-parse --short HEAD)"
SOURCE_DIRTY=""
if ! git diff --quiet || ! git diff --cached --quiet; then
  SOURCE_DIRTY=" (con cambios sin confirmar)"
fi

git -C "$WORKTREE" commit --quiet -m "frontpaneldesigner: ${SOURCE_COMMIT}${SOURCE_DIRTY}"
git -C "$WORKTREE" push --quiet origin main

echo "==> Publicado: https://electrucio.github.io/$TARGET/"
