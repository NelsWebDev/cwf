import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path' // 💡 Import path resolution

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/cwf/",
  build: {
    // 💡 Forces the output directory to always be inside apps/web/dist
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
  }
})
