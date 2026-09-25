import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
   plugins: [react(), tailwindcss()],
   server: {
      port: 5173,
      // The API runs on :3001. Proxying keeps the browser on one origin, so no CORS in development.
      proxy: { '/api': 'http://localhost:3001' },
   },
   test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      globals: true,
   },
})
