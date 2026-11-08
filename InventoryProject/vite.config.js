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
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react';
            }
            if (id.includes('recharts') || id.includes('d3')) {
              return 'vendor-charts';
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
          }
        }
      }
    }
  }
})
