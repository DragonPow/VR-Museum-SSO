import { DEFAULT_CONTENT, parseContent, splitContentForPublish } from '../../../packages/shared/src/index.ts'

interface Env {
  MEDIA_BUCKET: R2Bucket
  DB: D1Database
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

  // DELETE /api/upload — delete single file or entire prefix folder from R2
  if (method === 'DELETE' && pathname === '/api/upload') {
    const key = url.searchParams.get('key')
    const prefix = url.searchParams.get('prefix')

    if (key) {
      const isMediaAsset = key.startsWith('content/media/') || key.startsWith('content/documents/') || key.startsWith('media/') || key.startsWith('content/models/')
      if (!isMediaAsset || key.includes('..')) return json({ error: 'Invalid key' }, 400)
      await env.MEDIA_BUCKET.delete(key)
      return json({ ok: true })
    }

    if (prefix) {
      const isMediaAsset = prefix.startsWith('content/media/') || prefix.startsWith('content/documents/') || prefix.startsWith('media/') || prefix.startsWith('content/models/')
      if (!isMediaAsset || prefix.includes('..')) return json({ error: 'Invalid prefix' }, 400)
      let truncated = true
      let cursor: string | undefined
      let deletedCount = 0
      while (truncated) {
        const listed = await env.MEDIA_BUCKET.list(cursor ? { prefix, cursor } : { prefix })
        if (listed.objects.length > 0) {
          const keys = listed.objects.map((o) => o.key)
          await env.MEDIA_BUCKET.delete(keys)
          deletedCount += keys.length
        }
        truncated = listed.truncated
        cursor = listed.truncated ? listed.cursor : undefined
      }
      return json({ ok: true, deletedCount })
    }

    return json({ error: 'Missing key or prefix' }, 400)
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

  // GET /api/visitor-count — public count for the landing page
  if (method === 'GET' && pathname === '/api/visitor-count') {
    try {
      const stats = await getVisitorStats(env.DB)
      return json({ count: stats.totalPv })
    } catch (err) {
      return json({ error: `D1 query failed: ${err}` }, 500)
    }
  }

  // GET /api/stats — Get visitor count & analytics
  if (method === 'GET' && pathname === '/api/stats') {
    try {
      return json(await getVisitorStats(env.DB))
    } catch (err) {
      return json({ error: `D1 query failed: ${err}` }, 500)
    }
  }

  // POST /api/visit — Record page visit with visitorId
  if (method === 'POST' && pathname === '/api/visit') {
    try {
      let visitorId = ''
      try {
        const body = await request.json() as { visitorId?: string }
        visitorId = body.visitorId || ''
      } catch {
        return json({ error: 'Invalid JSON body' }, 400)
      }

      if (!/^[a-zA-Z0-9_-]{8,80}$/.test(visitorId)) {
        return json({ error: 'visitorId is invalid' }, 400)
      }

      await env.DB.prepare(
        "INSERT INTO visitor_logs (visitor_id) VALUES (?)"
      ).bind(visitorId).run()

      return json({ ok: true })
    } catch (err) {
      return json({ error: `D1 log failed: ${err}` }, 500)
    }
  }

  // GET /api/guestbook — Fetch guestbook notes (public approved + visible with pagination, or all for admin)
  if (method === 'GET' && pathname === '/api/guestbook') {
    try {
      const all = url.searchParams.get('all') === 'true'
      const statusParam = url.searchParams.get('status')
      const eventParam = url.searchParams.get('event')
      const sortParam = url.searchParams.get('sort') || 'priority'
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || (all ? '200' : '12'), 10)))
      const offset = (page - 1) * limit
      
      let whereClause = "WHERE 1=1"
      const params: (string | number)[] = []

      if (statusParam) {
        whereClause += " AND status = ?"
        params.push(statusParam)
      } else if (!all) {
        whereClause += " AND status = 'approved' AND (is_visible = 1 OR is_visible IS NULL)"
      }

      if (eventParam) {
        whereClause += " AND event_tag = ?"
        params.push(eventParam)
      }

      // Count total matching
      const countRes = await env.DB.prepare(
        `SELECT COUNT(*) as total FROM guestbook_notes ${whereClause}`
      ).bind(...params).first<{ total: number }>()
      const total = countRes?.total ?? 0

      // Sorting strategy:
      let orderBy = "ORDER BY is_pinned DESC, priority DESC, created_at DESC"
      if (all) {
        orderBy = "ORDER BY created_at DESC"
      } else if (sortParam === 'newest') {
        orderBy = "ORDER BY created_at DESC"
      } else if (sortParam === 'oldest') {
        orderBy = "ORDER BY created_at ASC"
      } else if (sortParam === 'random') {
        orderBy = "ORDER BY is_pinned DESC, priority DESC, RANDOM()"
      }

      const query = `SELECT id, content, signature, color_preset as colorPreset, rotation, status, (CASE WHEN is_pinned = 1 THEN 1 ELSE 0 END) as isPinned, (CASE WHEN is_visible = 0 THEN 0 ELSE 1 END) as isVisible, COALESCE(priority, 0) as priority, event_tag as eventTag, author_id as authorId, created_at as createdAt FROM guestbook_notes ${whereClause} ${orderBy} LIMIT ? OFFSET ?`

      const stmt = env.DB.prepare(query)
      const res = await stmt.bind(...params, limit, offset).all()
      const notes = (res.results ?? []).map((row: any) => ({
        ...row,
        isPinned: Boolean(row.isPinned),
        isVisible: Boolean(row.isVisible),
        priority: Number(row.priority || 0),
        eventTag: row.eventTag ?? null,
      }))

      const headers = (!all && !statusParam && sortParam !== 'random' && !eventParam) ? { 'Cache-Control': 'public, max-age=15, s-maxage=30' } : undefined
      return json({
        notes,
        total,
        page,
        limit,
        hasMore: offset + notes.length < total,
      }, 200, headers)
    } catch (err) {
      return json({ error: `D1 query failed: ${err}` }, 500)
    }
  }

  // GET /api/guestbook/events — List all custom admin events
  if (method === 'GET' && pathname === '/api/guestbook/events') {
    try {
      const res = await env.DB.prepare("SELECT id, name, color, description, (CASE WHEN is_active = 0 THEN 0 ELSE 1 END) as isActive, created_at as createdAt FROM guestbook_events ORDER BY created_at ASC").all()
      const events = (res.results ?? []).map((row: any) => ({
        ...row,
        isActive: Boolean(row.isActive),
      }))
      return json({ events })
    } catch (err) {
      return json({ error: `D1 events query failed: ${err}` }, 500)
    }
  }

  // POST /api/guestbook/events — Create or update custom admin event
  if (method === 'POST' && pathname === '/api/guestbook/events') {
    try {
      const body = await request.json() as { id?: string; name?: string; color?: string; description?: string; isActive?: boolean }
      const { id, name, color, description, isActive } = body
      if (!name || !name.trim()) {
        return json({ error: 'Tên sự kiện không được trống' }, 400)
      }
      const eventId = id || `event_${Date.now()}`
      const activeVal = isActive === false ? 0 : 1

      await env.DB.prepare(`
        INSERT INTO guestbook_events (id, name, color, description, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          color = excluded.color,
          description = excluded.description,
          is_active = excluded.is_active
      `).bind(eventId, name.trim(), color || '#c8a85a', description || '', activeVal).run()

      return json({ ok: true, eventId })
    } catch (err) {
      return json({ error: `D1 event save failed: ${err}` }, 500)
    }
  }

  // DELETE /api/guestbook/events — Delete event
  if (method === 'DELETE' && pathname === '/api/guestbook/events') {
    try {
      const id = url.searchParams.get('id')
      if (!id) return json({ error: 'Missing event id' }, 400)

      await env.DB.prepare("DELETE FROM guestbook_events WHERE id = ?").bind(id).run()
      // Optional: unlink from notes
      await env.DB.prepare("UPDATE guestbook_notes SET event_tag = NULL WHERE event_tag = ?").bind(id).run()

      return json({ ok: true })
    } catch (err) {
      return json({ error: `D1 event delete failed: ${err}` }, 500)
    }
  }

  // POST /api/guestbook — Public user submit note
  if (method === 'POST' && pathname === '/api/guestbook') {
    try {
      const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown'

      // Rate limit check: max 5 notes per hour per IP
      if (clientIp !== 'unknown') {
        const rateCheck = await env.DB.prepare(
          "SELECT COUNT(*) as count FROM guestbook_notes WHERE ip = ? AND created_at >= datetime('now', '-1 hour')"
        ).bind(clientIp).first<{ count: number }>()

        if ((rateCheck?.count ?? 0) >= 5) {
          return json({ error: 'Bạn đã gửi nhiều lời nhắn. Vui lòng thử lại sau 1 giờ!' }, 429)
        }
      }

      let body: { content?: string; signature?: string; visitorId?: string; eventTag?: string } = {}
      try {
        body = await request.json()
      } catch {
        return json({ error: 'Invalid JSON body' }, 400)
      }

      const content = (body.content ?? '').trim()
      const signature = (body.signature ?? '').trim()
      const visitorId = (body.visitorId ?? '').trim() || null
      const eventTag = (body.eventTag ?? '').trim() || null

      if (!content || content.length < 2) {
        return json({ error: 'Nội dung tối thiểu 2 ký tự' }, 400)
      }
      if (content.length > 500) {
        return json({ error: 'Nội dung tối đa 500 ký tự' }, 400)
      }
      if (signature.length > 100) {
        return json({ error: 'Chữ ký tối đa 100 ký tự' }, 400)
      }

      const colorPresets = ['yellow', 'pink', 'green', 'blue', 'white']
      const randomColor = colorPresets[Math.floor(Math.random() * colorPresets.length)]
      // Random rotation between -5 and 5 degrees (rounded to 1 decimal place)
      const randomRotation = Math.round((Math.random() * 10 - 5) * 10) / 10
      const noteId = `gb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      const nowIso = new Date().toISOString()

      await env.DB.prepare(
        "INSERT INTO guestbook_notes (id, content, signature, color_preset, rotation, status, is_pinned, is_visible, event_tag, author_id, created_at, ip) VALUES (?, ?, ?, ?, ?, 'pending', 0, 1, ?, ?, ?, ?)"
      ).bind(noteId, content, signature || null, randomColor, randomRotation, eventTag, visitorId, nowIso, clientIp).run()


      return json({
        ok: true,
        message: 'Lời nhắn của bạn đã được gửi và đang chờ ban quản trị duyệt!',
        noteId,
      })
    } catch (err) {
      return json({ error: `D1 submit failed: ${err}` }, 500)
    }
  }

  // POST /api/guestbook/moderate — Admin approve/reject note
  if (method === 'POST' && pathname === '/api/guestbook/moderate') {
    try {
      const body = await request.json() as { id?: string; status?: string }
      const { id, status } = body

      if (!id || !['approved', 'rejected', 'pending'].includes(status ?? '')) {
        return json({ error: 'Invalid note id or status' }, 400)
      }

      await env.DB.prepare(
        "UPDATE guestbook_notes SET status = ? WHERE id = ?"
      ).bind(status, id).run()

      return json({ ok: true })
    } catch (err) {
      return json({ error: `D1 moderate failed: ${err}` }, 500)
    }
  }

  // POST /api/guestbook/toggle — Admin pin/unpin or show/hide or set priority/event/content of a note
  if (method === 'POST' && pathname === '/api/guestbook/toggle') {
    try {
      const body = await request.json() as {
        id?: string
        isPinned?: boolean
        isVisible?: boolean
        priority?: number
        eventTag?: string | null
        content?: string
        signature?: string | null
      }
      const { id, isPinned, isVisible, priority, eventTag, content, signature } = body

      if (!id) return json({ error: 'Missing note id' }, 400)

      if (typeof isPinned === 'boolean') {
        await env.DB.prepare(
          "UPDATE guestbook_notes SET is_pinned = ? WHERE id = ?"
        ).bind(isPinned ? 1 : 0, id).run()
      }

      if (typeof isVisible === 'boolean') {
        await env.DB.prepare(
          "UPDATE guestbook_notes SET is_visible = ? WHERE id = ?"
        ).bind(isVisible ? 1 : 0, id).run()
      }

      if (typeof priority === 'number') {
        await env.DB.prepare(
          "UPDATE guestbook_notes SET priority = ? WHERE id = ?"
        ).bind(priority, id).run()
      }

      if (eventTag !== undefined) {
        await env.DB.prepare(
          "UPDATE guestbook_notes SET event_tag = ? WHERE id = ?"
        ).bind(eventTag || null, id).run()
      }

      if (typeof content === 'string') {
        await env.DB.prepare(
          "UPDATE guestbook_notes SET content = ? WHERE id = ?"
        ).bind(content.trim(), id).run()
      }

      if (signature !== undefined) {
        await env.DB.prepare(
          "UPDATE guestbook_notes SET signature = ? WHERE id = ?"
        ).bind(signature ? signature.trim() : null, id).run()
      }

      return json({ ok: true })
    } catch (err) {
      return json({ error: `D1 toggle/update failed: ${err}` }, 500)
    }
  }


  // POST /api/guestbook/bulk — Admin bulk actions (approve, reject, hide, show, pin, unpin, priority, delete, set_event)
  if (method === 'POST' && pathname === '/api/guestbook/bulk') {
    try {
      const body = await request.json() as { ids?: string[]; action?: string; priority?: number; eventTag?: string | null }
      const { ids, action, priority, eventTag } = body

      if (!ids || !Array.isArray(ids) || ids.length === 0 || !action) {
        return json({ error: 'Invalid ids or action' }, 400)
      }

      const placeholders = ids.map(() => '?').join(',')

      if (action === 'approve') {
        await env.DB.prepare(`UPDATE guestbook_notes SET status = 'approved' WHERE id IN (${placeholders})`).bind(...ids).run()
      } else if (action === 'reject') {
        await env.DB.prepare(`UPDATE guestbook_notes SET status = 'rejected' WHERE id IN (${placeholders})`).bind(...ids).run()
      } else if (action === 'hide') {
        await env.DB.prepare(`UPDATE guestbook_notes SET is_visible = 0 WHERE id IN (${placeholders})`).bind(...ids).run()
      } else if (action === 'show') {
        await env.DB.prepare(`UPDATE guestbook_notes SET is_visible = 1 WHERE id IN (${placeholders})`).bind(...ids).run()
      } else if (action === 'pin') {
        await env.DB.prepare(`UPDATE guestbook_notes SET is_pinned = 1 WHERE id IN (${placeholders})`).bind(...ids).run()
      } else if (action === 'unpin') {
        await env.DB.prepare(`UPDATE guestbook_notes SET is_pinned = 0 WHERE id IN (${placeholders})`).bind(...ids).run()
      } else if (action === 'priority' && typeof priority === 'number') {
        await env.DB.prepare(`UPDATE guestbook_notes SET priority = ? WHERE id IN (${placeholders})`).bind(priority, ...ids).run()
      } else if (action === 'set_event') {
        await env.DB.prepare(`UPDATE guestbook_notes SET event_tag = ? WHERE id IN (${placeholders})`).bind(eventTag || null, ...ids).run()
      } else if (action === 'delete') {
        await env.DB.prepare(`DELETE FROM guestbook_notes WHERE id IN (${placeholders})`).bind(...ids).run()
      } else {
        return json({ error: 'Unsupported action' }, 400)
      }

      return json({ ok: true, count: ids.length })
    } catch (err) {
      return json({ error: `D1 bulk action failed: ${err}` }, 500)
    }
  }

  // POST /api/guestbook/reorder — Admin save drag-and-drop order batch
  if (method === 'POST' && pathname === '/api/guestbook/reorder') {
    try {
      const body = await request.json() as { items?: { id: string; priority: number }[] }
      const { items } = body

      if (!items || !Array.isArray(items) || items.length === 0) {
        return json({ error: 'Invalid items array' }, 400)
      }

      const stmts = items.map((item) =>
        env.DB.prepare("UPDATE guestbook_notes SET priority = ? WHERE id = ?").bind(item.priority, item.id)
      )

      await env.DB.batch(stmts)
      return json({ ok: true, updated: items.length })
    } catch (err) {
      return json({ error: `D1 batch reorder failed: ${err}` }, 500)
    }
  }



  // DELETE /api/guestbook — Admin delete note
  if (method === 'DELETE' && pathname === '/api/guestbook') {
    try {
      const id = url.searchParams.get('id')
      if (!id) return json({ error: 'Missing note id' }, 400)

      await env.DB.prepare(
        "DELETE FROM guestbook_notes WHERE id = ?"
      ).bind(id).run()

      return json({ ok: true })
    } catch (err) {
      return json({ error: `D1 delete failed: ${err}` }, 500)
    }
  }


  return json({ error: 'Not found' }, 404)
}

async function getVisitorStats(db: D1Database) {
  const pvRes = await db.prepare(
    "SELECT COUNT(*) as count FROM visitor_logs"
  ).first<{ count: number }>()
  const initTotal = 1028
  const totalPv = (pvRes?.count ?? 0) + initTotal

  const uvRes = await db.prepare(
    "SELECT COUNT(DISTINCT visitor_id) as count FROM visitor_logs"
  ).first<{ count: number }>()
  const totalUv = uvRes?.count ?? 0

  const peakDayRes = await db.prepare(
    "SELECT strftime('%Y-%m-%d', timestamp) as day, COUNT(DISTINCT visitor_id) as count FROM visitor_logs GROUP BY day ORDER BY count DESC LIMIT 1"
  ).first<{ day: string; count: number }>()

  const peakHourRes = await db.prepare(
    "SELECT strftime('%H:00', timestamp) as hour, COUNT(DISTINCT visitor_id) as count FROM visitor_logs GROUP BY hour ORDER BY count DESC LIMIT 1"
  ).first<{ hour: string; count: number }>()

  const dailyRes = await db.prepare(
    `SELECT
       strftime('%Y-%m-%d', timestamp) as day,
       COUNT(DISTINCT visitor_id) as unique_count,
       COUNT(*) as total_count
     FROM visitor_logs
     WHERE timestamp >= datetime('now', '-7 days')
     GROUP BY day
     ORDER BY day ASC`
  ).all<{ day: string; unique_count: number; total_count: number }>()

  return {
    count: totalUv,
    totalUv,
    totalPv,
    peakDay: peakDayRes ? { day: peakDayRes.day, count: peakDayRes.count } : null,
    peakHour: peakHourRes ? { hour: peakHourRes.hour, count: peakHourRes.count } : null,
    dailyHistory: dailyRes.results ?? [],
  }
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

function json(data: unknown, status = 200, customHeaders?: Record<string, string>): Response {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (customHeaders) {
    for (const [key, value] of Object.entries(customHeaders)) {
      headers.set(key, value)
    }
  }
  return new Response(JSON.stringify(data), {
    status,
    headers,
  })
}


function cors(res: Response, requestOrigin: string, allowedOrigin: string): Response {
  const headers = new Headers(res.headers)
  headers.set('Access-Control-Allow-Origin', resolveAllowedOrigin(requestOrigin, allowedOrigin))
  headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type')
  headers.set('Access-Control-Allow-Credentials', 'true')
  headers.set('Vary', 'Origin')
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
}

function resolveAllowedOrigin(requestOrigin: string, allowedOrigin: string): string {
  const origins = allowedOrigin
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  if (origins.length === 0 || origins.includes('*')) return requestOrigin || '*'
  if (requestOrigin && origins.includes(requestOrigin)) return requestOrigin
  return origins[0] ?? '*'
}
