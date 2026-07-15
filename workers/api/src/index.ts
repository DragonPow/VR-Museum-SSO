import { DEFAULT_CONTENT, parseContent, splitContentForPublish } from '@vm/shared'

interface Env {
  MEDIA_BUCKET: R2Bucket
  ALLOWED_ORIGIN: string
  PUBLIC_R2_URL: string // e.g. https://pub-xxx.r2.dev  (optional)
}

const DRAFT_KEY = 'draft.json'
const CONTENT_KEY = 'content.json'
const DOCUMENT_PREFIX = 'content/documents/'

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



  if (method === 'GET' && pathname.startsWith('/api/documents/')) {
    const id = decodeURIComponent(pathname.replace('/api/documents/', '')).replace(/\.json$/, '')
    if (!id || id.includes('/') || id.includes('..')) return json({ error: 'Invalid document id' }, 400)
    const obj = await env.MEDIA_BUCKET.get(`${DOCUMENT_PREFIX}${id}/document.json`)
    if (!obj) return json({ error: 'Not found' }, 404)
    const body = await obj.text()
    return new Response(body, { headers: { 'Content-Type': 'application/json' } })
  }

  // GET /api/draft — return draft (fallback to published content.json; bootstrap R2 if empty)
  if (method === 'GET' && pathname === '/api/draft') {
    const obj = (await env.MEDIA_BUCKET.get(DRAFT_KEY)) ?? (await env.MEDIA_BUCKET.get(CONTENT_KEY))
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

  // DELETE /api/draft — discard draft so admin/web can fall back to published content.json.
  if (method === 'DELETE' && pathname === '/api/draft') {
    await env.MEDIA_BUCKET.delete(DRAFT_KEY)
    return json({ ok: true })
  }

  // POST /api/upload — proxy file upload to R2
  if (method === 'POST' && pathname === '/api/upload') {
    const form = await request.formData()
    const file = form.get('file') as File | null
    const key = form.get('key') as string | null

    if (!file || !key) return json({ error: 'Missing file or key' }, 400)
    const isMediaAsset = key.startsWith('content/media/') || key.startsWith('content/documents/') || key.startsWith('media/')
    const isRoomModel = key.startsWith('content/models/')
    if (!isMediaAsset && !isRoomModel) {
      return json({ error: 'Invalid key prefix' }, 400)
    }

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

    const parsed = parseContent(data)
    const split = splitContentForPublish(parsed)
    await env.MEDIA_BUCKET.put(CONTENT_KEY, JSON.stringify(split.content, null, 2), {
      httpMetadata: { contentType: 'application/json' },
    })
    await Promise.all(Object.values(split.documents).map((document) => env.MEDIA_BUCKET.put(
      `${DOCUMENT_PREFIX}${document.documentKey}/document.json`,
      JSON.stringify(document, null, 2),
      { httpMetadata: { contentType: 'application/json' } },
    )))
    await env.MEDIA_BUCKET.put(DRAFT_KEY, body, {
      httpMetadata: { contentType: 'application/json' },
    })
    return json({ ok: true, publishedAt: new Date().toISOString() })
  }

  // GET content assets from R2. Needed for local dev (no public R2 URL) so uploads are
  // viewable; in production PUBLIC_R2_URL points at the bucket directly and this is a fallback.
  if (method === 'GET' && (pathname.startsWith('/content/media/') || pathname.startsWith('/content/documents/') || pathname.startsWith('/media/') || pathname.startsWith('/content/models/'))) {
    const key = pathname.replace(/^\/+/, '')
    const obj = await env.MEDIA_BUCKET.get(key)
    if (!obj) return json({ error: 'Not found' }, 404)
    const headers = new Headers()
    headers.set('Content-Type', obj.httpMetadata?.contentType ?? 'application/octet-stream')
    headers.set('Cache-Control', 'public, max-age=60')
    return new Response(obj.body, { headers })
  }

  return json({ error: 'Not found' }, 404)
}

async function seedDefaultContent(env: Env): Promise<Response> {
  const draftBody = JSON.stringify(DEFAULT_CONTENT, null, 2)
  const split = splitContentForPublish(DEFAULT_CONTENT)
  const publicBody = JSON.stringify(split.content, null, 2)
  await env.MEDIA_BUCKET.put(DRAFT_KEY, draftBody, {
    httpMetadata: { contentType: 'application/json' },
  })
  await env.MEDIA_BUCKET.put(CONTENT_KEY, publicBody, {
    httpMetadata: { contentType: 'application/json' },
  })
  return new Response(publicBody, { headers: { 'Content-Type': 'application/json' } })
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
  headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
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
  return origins[0] ?? '*'
}
