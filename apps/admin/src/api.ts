import type { Content } from '@vm/shared'

const BASE = import.meta.env.VITE_API_URL ?? ''

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, init)
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`${res.status}: ${text}`)
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

/** Upload a file variant to the worker (which puts it to R2). Returns public URL. */
export async function uploadFile(blob: Blob, key: string): Promise<string> {
  const form = new FormData()
  form.append('file', blob)
  form.append('key', key)
  const res = await apiFetch('/api/upload', { method: 'POST', body: form })
  const { publicUrl } = await res.json() as { publicUrl: string }
  return publicUrl
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
