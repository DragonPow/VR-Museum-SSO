import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      // Worker API (wrangler dev runs on 8787 by default)
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
      // Seed content files from the public web app
      '/content': { target: 'http://localhost:5173', changeOrigin: true },
    },
  },
  resolve: {
    alias: {
      '@vm/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@vm/viewer': resolve(__dirname, '../../packages/viewer/src/index.ts'),
    },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          'three-vendor': ['three', '@react-three/fiber', '@react-three/drei'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['three', '@react-three/fiber', '@react-three/drei'],
  },
})
