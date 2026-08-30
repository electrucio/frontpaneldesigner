/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

/**
 * `base` apunta a la subruta de GitHub Pages en producción y a la raíz en
 * desarrollo. La raíz de electrucio.github.io ya la ocupa otro sitio, así que
 * esto se publica como página de proyecto.
 *
 * Se discrimina por `mode` y no por `command`: `vite preview` es un `serve`,
 * pero sirve la construcción de producción. Usando `command` el preview
 * quedaba en la raíz mientras el HTML pedía la subruta, y la página salía en
 * blanco sin que fallara nada de la construcción real.
 *
 * `BASE_PATH` permite desplegarlo en otro sitio sin tocar el fichero.
 */
const PROD_BASE = process.env.BASE_PATH ?? '/frontpaneldesigner/'

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
