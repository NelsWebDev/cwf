import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: "/manage",
  plugins: [react()],
  build: {
    outDir: "../frontend/dist/manage",
  },
  server: {
    port: 8080,
    proxy: {
      "/api": "http://localhost:3000"
    }
  }
})
