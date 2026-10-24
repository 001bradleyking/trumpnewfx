import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  server: {
    allowedHosts: ['.ngrok-free.app', '.ngrok.app'],
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: false },
      '/auth/google': { target: 'http://127.0.0.1:8000', changeOrigin: false },
    },
  },
})
