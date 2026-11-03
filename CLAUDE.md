# Woodland Perú · Panel · guía para asistentes

Panel de administración de Woodland Perú (equipo WASD). Lee `README.md` antes de cambios grandes.

- Stack: React + Vite + TypeScript + Tailwind 4 + React Router (SPA). La API (Hono en Cloudflare Workers) y la base
  (Supabase) viven en el repositorio woodlandsperu-main: aquí no hay backend, migraciones ni secretos.
- `shared/` copia los contratos de la API de woodlandsperu-main; si cambian allá, se copian aquí en el mismo cambio.
- No inventar datos de la empresa (productos, precios, cifras, plazos). Sin pantallas simuladas: lo no implementado usa `PendingModule`.
- Lógica fuera de los componentes React. Importes, stock y pagos los calcula el backend.
- Nunca exponer secretos (`VITE_*` es público).
- Colores y fuentes solo con los tokens de `src/styles/index.css`.
- No desplegar sin autorización. Antes de entregar: `npm run check`.
