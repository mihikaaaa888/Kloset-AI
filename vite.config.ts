import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  // Dev keeps its [shop]/[chat]-style debug logs; production bundles drop them.
  // console.error/warn are kept so real failures still show up.
  esbuild: { pure: ['console.log', 'console.debug', 'console.info'] },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
