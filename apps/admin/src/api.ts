import type { Content } from '@vm/shared'

const BASE = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`${status}: ${body}`)
    this.name = 'ApiError'
  }

  tryParseJson(): unknown {
    try {
      return JSON.parse(this.body)
    } catch {
      return null
    }
  }
}

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, init)
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new ApiError(res.status, text)
  }
  return res
}

export async function getDraft(): Promise<Content> {
  const res = await apiFetch('/api/draft')
  return res.json()
}

export async function saveDraft(content: Content): Promise<void> {
  await apiFetch('/api/draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(content),
  })
}



function normalizeLocalPublicUrl(url: string): string {
  if (typeof window === 'undefined') return url
  if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) return url
  try {
    const parsed = new URL(url)
    if ((parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') && parsed.pathname.startsWith('/content/media/')) {
      return parsed.pathname
    }
    if ((parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') && parsed.pathname.startsWith('/media/')) {
      return `/content${parsed.pathname}`
    }
  } catch {
    if (url.startsWith('/media/')) return `/content${url}`
  }
  return url
}

async function mirrorLocalUpload(blob: Blob, key: string): Promise<void> {
  if (typeof window === 'undefined') return
  if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) return
  await fetch(`/__local-media?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': blob.type || 'application/octet-stream' },
    body: blob,
  }).catch(() => undefined)
}

/** Upload a file variant to the worker (which puts it to R2). Returns public URL. */
export async function uploadFile(blob: Blob, key: string): Promise<string> {
  const form = new FormData()
  form.append('file', blob)
  form.append('key', key)
  const res = await apiFetch('/api/upload', { method: 'POST', body: form })
  const { publicUrl } = (await res.json()) as { publicUrl: string }
  await mirrorLocalUpload(blob, key)
  return normalizeLocalPublicUrl(publicUrl)
}

export async function uploadModel(file: File, filename?: string): Promise<string> {
  const safeName = (filename ?? file.name)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')

  if (!safeName.endsWith('.glb') && !safeName.endsWith('.gltf')) {
    throw new Error('Model phải có đuôi .glb hoặc .gltf')
  }

  const key = `content/models/${safeName}`
  await uploadFile(file, key)
  return `/${key}`
}


export async function saveLocalContentFile(content: Content): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) return false
  const res = await fetch('/__local-content/content.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(content, null, 2),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(text)
  }
  return true
}

export async function publish(content: Content): Promise<void> {
  await apiFetch('/api/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(content),
  })
}

/** True if the worker API is reachable. */
export async function checkApi(): Promise<boolean> {
  try {
    await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(2000) })
    return true
  } catch {
    return false
  }
}
