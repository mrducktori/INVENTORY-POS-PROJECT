import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'

// Prioritize root .env if present, otherwise load from server/.env
const envDir = fs.existsSync(path.resolve(__dirname, '.env'))
  ? __dirname
  : path.resolve(__dirname, 'server');

// https://vite.dev/config/
export default defineConfig({
  envDir,
  server: {
    proxy: {
      '/api': 'http://localhost:5000'
    },
    watch: {
      ignored: ['**/*.zip']
    }
  },
  plugins: [tailwindcss(), react()],
  optimizeDeps: {
    include: ['react-is']
  }
})
