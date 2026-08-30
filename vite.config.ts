/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

/**
 * `base` apunta a la subruta del sitio estático en producción y a la raíz en
 * desarrollo.
 *
 * La carpeta NO puede llamarse igual que el repositorio: GitHub reserva
 * `<usuario>.github.io/<nombre-de-repo>/` para la página de proyecto de ese
 * repositorio, y esa ruta tapa a la carpeta del sitio de usuario aunque el
 * repositorio no tenga Pages activado. Con `frontpaneldesigner/` el sitio
 * devolvía 404 mientras la misma construcción servida con otro nombre daba 200.
 *
 * Se discrimina por `mode` y no por `command`: `vite preview` es un `serve`,
 * pero sirve la construcción de producción. Usando `command` el preview
 * quedaba en la raíz mientras el HTML pedía la subruta, y la página salía en
 * blanco sin que fallara nada de la construcción real.
 *
 * `BASE_PATH` permite desplegarlo en otro sitio sin tocar el fichero.
 */
const PROD_BASE = process.env.BASE_PATH ?? '/front-panel-designer/'

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? PROD_BASE : '/',
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
  },
}))
