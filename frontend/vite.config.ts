import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 8080,
    open: true,
    proxy: {
      '/api': "http://localhost:3000",
      "/socket.io": "http://localhost:3000",
    },
    allowedHosts: ['mbp.local', 'platypus-concise-simply.ngrok-free.app']
  },
  build: {
    outDir: "../backend/dist/public",
    emptyOutDir: true,
  },
})
