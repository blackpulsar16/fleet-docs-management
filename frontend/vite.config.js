import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/documents': 'http://localhost:8001',
      '/vehicles': 'http://localhost:8001',
      '/fleet': 'http://localhost:8001',
      '/ingest-documents': 'http://localhost:8001'
    }
  }
})