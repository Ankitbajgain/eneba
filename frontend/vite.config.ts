import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = Number(process.env.DEV_SERVER_PORT ?? env.DEV_SERVER_PORT ?? 5173)
  const target = process.env.API_PROXY_TARGET ?? env.API_PROXY_TARGET ?? 'http://nginx:8081'
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('DEV_SERVER_PORT must be a valid TCP port.')

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: '0.0.0.0',
      port,
      strictPort: true,
      watch: { usePolling: process.env.VITE_USE_POLLING === 'true', interval: 350 },
      proxy: {
        '/api': { target, changeOrigin: false },
        '/sanctum': { target, changeOrigin: false },
      },
    },
  }
})
