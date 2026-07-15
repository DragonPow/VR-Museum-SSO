import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, cpSync } from 'fs'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { extname, resolve } from 'path'

function localContentPlugin() {
  const contentRoot = resolve(__dirname, '../../content')
  const contentTypes: Record<string, string> = {
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
  }

  return {
    name: 'local-content-files',
    configureServer(server: any) {
      server.middlewares.use('/__local-content/content.json', async (req: any, res: any, next: any) => {
        if (req.method !== 'POST') return next()
        try {
          let body = ''
          req.setEncoding('utf8')
          for await (const chunk of req) body += chunk
          JSON.parse(body)
          await writeFile(resolve(contentRoot, 'content.json'), `${body}
`, 'utf-8')
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ ok: true }))
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ ok: false, error: String(err) }))
        }
      })


      server.middlewares.use('/__local-content/documents', async (req: any, res: any, next: any) => {
        if (req.method !== 'POST') return next()
        try {
          const pathname = (req.url ?? '').split('?')[0] ?? ''
          const parts = pathname.replace(/^\/+/, '').split('/').filter(Boolean)
          const keyPart = parts[0] ?? ''
          const filename = parts[1] ?? ''
          const id = decodeURIComponent(keyPart)
          if (!id || id.includes('/') || id.includes('..') || filename !== 'document.json') {
            res.statusCode = 400
            res.end(JSON.stringify({ ok: false, error: 'Invalid document path' }))
            return
          }
          let body = ''
          req.setEncoding('utf8')
          for await (const chunk of req) body += chunk
          JSON.parse(body)
          const filePath = resolve(contentRoot, 'documents', id, 'document.json')
          await mkdir(resolve(filePath, '..'), { recursive: true })
          await writeFile(filePath, `${body}
`, 'utf-8')
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ ok: true }))
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ ok: false, error: String(err) }))
        }
      })

      server.middlewares.use('/__local-media', async (req: any, res: any, next: any) => {
        if (req.method !== 'POST') return next()
        try {
          const rawUrl = new URL(req.url ?? '/', 'http://localhost')
          const key = rawUrl.searchParams.get('key') ?? ''
          if (!(key.startsWith('content/media/') || key.startsWith('content/documents/')) || key.includes('..')) {
            res.statusCode = 400
            res.end(JSON.stringify({ ok: false, error: 'Invalid media key' }))
            return
          }
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
          const relativeKey = key.replace(/^content\/+/, '')
          const filePath = resolve(contentRoot, relativeKey)
          if (!filePath.startsWith(contentRoot)) {
            res.statusCode = 403
            res.end(JSON.stringify({ ok: false, error: 'Forbidden' }))
            return
          }
          await mkdir(resolve(filePath, '..'), { recursive: true })
          await writeFile(filePath, Buffer.concat(chunks))
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ ok: true, path: `/${key}` }))
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ ok: false, error: String(err) }))
        }
      })

      server.middlewares.use('/content', async (req: any, res: any, next: any) => {
        try {
          const pathname = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/')
          const filePath = resolve(contentRoot, `.${pathname}`)
          if (!filePath.startsWith(contentRoot)) {
            res.statusCode = 403
            res.end('Forbidden')
            return
          }
          const data = await readFile(filePath)
          res.setHeader('Content-Type', contentTypes[extname(filePath).toLowerCase()] ?? 'application/octet-stream')
          res.end(data)
        } catch {
          next()
        }
      })
    },
  }
}

function copyContentPlugin() {
  const contentRoot = resolve(__dirname, '../../content')
  return {
    name: 'copy-content',
    apply: 'build' as const,
    closeBundle() {
      const dest = resolve(__dirname, 'dist/content')
      if (existsSync(contentRoot)) {
        cpSync(contentRoot, dest, { recursive: true })
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), localContentPlugin(), copyContentPlugin()],
  server: {
    port: 5174,
    proxy: {
      // Worker API (wrangler dev runs on 8787 by default)
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
      // Uploaded media served back from the Worker's R2 (local upload test loop)
      '/media': { target: 'http://localhost:8787', changeOrigin: true },
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
