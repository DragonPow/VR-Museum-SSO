import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { createReadStream, existsSync, statSync } from 'fs'
import { join } from 'path'

const CONTENT_DIR = resolve(__dirname, '../../content')

export default defineConfig({
  plugins: [
    react(),
    // Serve the monorepo /content directory at /content in dev
    {
      name: 'serve-content',
      configureServer(server) {
        server.middlewares.use('/content', (req, res, next) => {
          const filePath = join(CONTENT_DIR, decodeURIComponent(req.url ?? ''))
          if (existsSync(filePath) && statSync(filePath).isFile()) {
            res.setHeader('Access-Control-Allow-Origin', '*')
            const ext = filePath.split('.').pop() ?? ''
            const mime: Record<string, string> = {
              json: 'application/json',
              jpg: 'image/jpeg',
              jpeg: 'image/jpeg',
              png: 'image/png',
              webp: 'image/webp',
            }
            res.setHeader('Content-Type', mime[ext] ?? 'application/octet-stream')
            createReadStream(filePath).pipe(res)
          } else {
            next()
          }
        })
      },
    },
  ],
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
  server: {
    port: Number(process.env['PORT']) || 5173,
  },
})
