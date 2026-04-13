// ─── Configuración de APIs ────────────────────────────────────────────────────
// En desarrollo (npm run dev): usa las variables de .env o los valores por defecto.
// En producción (Docker): Nginx actúa como reverse proxy y redirige /api, /sol, /ai
// al backend correspondiente, por lo que las URLs son rutas relativas.
// ──────────────────────────────────────────────────────────────────────────────

const isDev = import.meta.env.DEV;

// En producción el nginx del contenedor maneja el proxy, así que usamos rutas relativas.
// En desarrollo apuntamos a los servicios directamente.
export const FLEET_API  = isDev ? (import.meta.env.VITE_FLEET_API_URL  || 'http://localhost:8001') : '';
export const SOL_API    = isDev ? (import.meta.env.VITE_SOL_API_URL    || 'http://localhost:8002') : '';
export const AI_API     = isDev ? (import.meta.env.VITE_AI_API_URL     || 'http://localhost:8003') : '';
