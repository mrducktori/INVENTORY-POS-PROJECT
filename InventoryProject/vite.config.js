import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  envDir: path.resolve(__dirname, 'server'),
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
