import { DEFAULT_CONTENT, parseContent } from '@vm/shared'

interface Env {
  MEDIA_BUCKET: R2Bucket
  ALLOWED_ORIGIN: string
  PUBLIC_R2_URL: string  // e.g. https://pub-xxx.r2.dev  (optional)
}

const DRAFT_KEY   = 'draft.json'
const CONTENT_KEY = 'content.json'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin') ?? ''

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return cors(new Response(null, { status: 204 }), origin, env.ALLOWED_ORIGIN)
    }

    try {
      const res = await route(request, url, env)
      return cors(res, origin, env.ALLOWED_ORIGIN)
    } catch (err) {
      return cors(
        new Response(JSON.stringify({ error: String(err) }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
        origin,
        env.ALLOWED_ORIGIN,
      )
    }
  },
}

async function route(request: Request, url: URL, env: Env): Promise<Response> {
  const { pathname } = url
  const method = request.method

  if (method === 'GET' && pathname === '/api/health') {
    return json({ ok: true })
  }

  // GET /api/content — public content endpoint used by the web app if R2 is empty/private.
  if (method === 'GET' && pathname === '/api/content') {
    const obj = await env.MEDIA_BUCKET.get(CONTENT_KEY)
    if (!obj) return seedDefaultContent(env)
    const body = await obj.text()
    return new Response(body, { headers: { 'Content-Type': 'application/json' } })
  }

  // GET /api/draft — return draft (fallback to published content.json; bootstrap R2 if empty)
  if (method === 'GET' && pathname === '/api/draft') {
    const obj = await env.MEDIA_BUCKET.get(DRAFT_KEY)
      ?? await env.MEDIA_BUCKET.get(CONTENT_KEY)
    if (!obj) return seedDefaultContent(env)
    const body = await obj.text()
    return new Response(body, { headers: { 'Content-Type': 'application/json' } })
  }

  // POST /api/draft — save draft
  if (method === 'POST' && pathname === '/api/draft') {
    const body = await request.text()
    await env.MEDIA_BUCKET.put(DRAFT_KEY, body, {
      httpMetadata: { contentType: 'application/json' },
    })
    return json({ ok: true })
  }

  // POST /api/upload — proxy file upload to R2
  if (method === 'POST' && pathname === '/api/upload') {
    const form = await request.formData()
    const file = form.get('file') as File | null
    const key  = form.get('key') as string | null

    if (!file || !key) return json({ error: 'Missing file or key' }, 400)
    if (!key.startsWith('media/')) return json({ error: 'Invalid key prefix' }, 400)

    await env.MEDIA_BUCKET.put(key, file.stream(), {
      httpMetadata: { contentType: file.type || 'application/octet-stream' },
    })

    const base = env.PUBLIC_R2_URL ? env.PUBLIC_R2_URL.replace(/\/$/, '') : ''
    return json({ publicUrl: base ? `${base}/${key}` : `/${key}` })
  }

  // POST /api/publish — validate draft then copy to content.json
  if (method === 'POST' && pathname === '/api/publish') {
    const body = await request.text()
    let data: unknown
    try {
      data = JSON.parse(body)
    } catch {
      return json({ error: 'Invalid JSON' }, 400)
    }

    try {
      parseContent(data)
    } catch (err) {
      return json({ error: `Validation failed: ${err}` }, 422)
    }

    await env.MEDIA_BUCKET.put(CONTENT_KEY, body, {
      httpMetadata: { contentType: 'application/json' },
    })
    await env.MEDIA_BUCKET.put(DRAFT_KEY, body, {
      httpMetadata: { contentType: 'application/json' },
    })
    return json({ ok: true, publishedAt: new Date().toISOString() })
  }

  return json({ error: 'Not found' }, 404)
}

async function seedDefaultContent(env: Env): Promise<Response> {
  const body = JSON.stringify(DEFAULT_CONTENT, null, 2)
  await env.MEDIA_BUCKET.put(DRAFT_KEY, body, {
    httpMetadata: { contentType: 'application/json' },
  })
  await env.MEDIA_BUCKET.put(CONTENT_KEY, body, {
    httpMetadata: { contentType: 'application/json' },
  })
  return new Response(body, { headers: { 'Content-Type': 'application/json' } })
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function cors(res: Response, requestOrigin: string, allowedOrigin: string): Response {
  const headers = new Headers(res.headers)
  headers.set('Access-Control-Allow-Origin', resolveAllowedOrigin(requestOrigin, allowedOrigin))
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  headers.set('Vary', 'Origin')
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
}

function resolveAllowedOrigin(requestOrigin: string, allowedOrigin: string): string {
  const origins = allowedOrigin
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  if (origins.length === 0 || origins.includes('*')) return '*'
  if (requestOrigin && origins.includes(requestOrigin)) return requestOrigin
  return origins[0]
}
