# Woodland Perú · Panel de administración

Sistema interno del equipo de Woodland Perú (pedidos, cotizaciones, conversaciones, citas, inventario, producción y
reportes). Hackathon Transforma+ MIPYME 2026, equipo WASD.

Antes vivía dentro de [woodlandsperu-main](https://github.com/W-A-S-D-2-0/woodlandsperu-main), junto a la web pública.
Ahora es su propio repositorio; la **API** (Cloudflare Worker), la **base de datos** (Supabase y sus migraciones) y la
**web pública** siguen en woodlandsperu-main.

## Cómo funciona

- React + Vite + TypeScript + Tailwind 4 + React Router. Se despliega en Vercel (proyecto `woodland-peru-panel`).
- Toda la información viene de la API: `vercel.json` reenvía `/api/*` al Worker
  (`https://woodland-peru-api.woodland-peru.workers.dev`). El panel no decide permisos: el Worker y la RLS de Supabase lo hacen.
- Inicio de sesión con Supabase Auth; `GET /api/admin/me` confirma que la persona es del equipo.
- `shared/` es una copia de los contratos de la API de woodlandsperu-main: **si cambian allá, hay que copiarlos aquí**.

## Desarrollo

```bash
npm install
cp .env.example .env.local   # completar las variables VITE_*
npm run dev                  # http://localhost:5174
```

En desarrollo, `/api` se reenvía a `http://localhost:5173` (el `npm run dev` de woodlandsperu-main, que levanta el
Worker). Para usar otra API: `API_PROXY_TARGET=https://… npm run dev`.

Antes de entregar: `npm run check` (lint, tipos, pruebas y build).
