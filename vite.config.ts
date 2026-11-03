import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vitest/config'

/** El panel nunca se indexa: el build deja un robots.txt que lo prohíbe. */
const noIndex = (): Plugin => ({
  name: 'panel-no-index',
  apply: 'build',
  closeBundle() {
    writeFileSync(fileURLToPath(new URL('./dist/robots.txt', import.meta.url)), 'User-agent: *\nDisallow: /\n')
  },
})

/**
 * Panel de administración de Woodland Perú: una aplicación aparte de la web pública, en la raíz de su dominio.
 * La API vive en el Worker de Cloudflare (repositorio woodlandsperu-main): en Vercel, vercel.json reenvía /api
 * hacia allá; en desarrollo, Vite lo reenvía a API_PROXY_TARGET (por defecto, el `npm run dev` de woodlandsperu-main).
 */
export default defineConfig({
  plugins: [react(), tailwindcss(), noIndex()],
  define: { 'import.meta.env.VITE_PANEL_BASE': JSON.stringify('/') },
  server: {
    port: 5174,
    proxy: { '/api': { target: process.env.API_PROXY_TARGET ?? 'http://localhost:5173', changeOrigin: true } },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'shared/**/*.test.ts'],
  },
})
