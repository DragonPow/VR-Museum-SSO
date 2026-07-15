import { parseContent } from '@vm/shared'
import type { Content } from '@vm/shared'

type ContentMode = 'local' | 'github' | 'cloudflare' | 'static'

const API_BASE = import.meta.env.VITE_API_URL ?? ''
const ASSET_BASE_URL = (import.meta.env.VITE_ASSET_BASE_URL ?? '').replace(/\/+$/, '')
const EXPLICIT_MODE = import.meta.env.VITE_CONTENT_MODE as ContentMode | undefined

function detectMode(): ContentMode {
  if (EXPLICIT_MODE) return EXPLICIT_MODE
  if (ASSET_BASE_URL || (API_BASE && typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname))) {
    return 'cloudflare'
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1') return 'local'
    if (host.endsWith('github.io')) return 'github'
  }
  return 'static'
}

export const ADMIN_CONTENT_SOURCE = (() => {
  const mode = detectMode()
  if (mode === 'cloudflare') {
    return {
      mode,
      apiBaseUrl: API_BASE,
      assetBaseUrl: ASSET_BASE_URL,
      draftUrls: [`${API_BASE}/api/draft`],
      staticUrls: ASSET_BASE_URL ? [`${ASSET_BASE_URL}/content.json`] : ['/content/content.json'],
    }
  }

  if (mode === 'github') {
    const base = import.meta.env.BASE_URL
    return {
      mode,
      apiBaseUrl: '',
      assetBaseUrl: '',
      draftUrls: [],
      staticUrls: [`${base}content/content.json`, `${base}content/content.sample.json`],
    }
  }

  return {
    mode,
    apiBaseUrl: mode === 'local' ? '' : API_BASE,
    assetBaseUrl: '',
    // In local dev, Vite proxies /api to wrangler on :8787. Try the Worker draft first;
    // if wrangler is not running this quietly falls back to committed content files.
    draftUrls: mode === 'local' ? ['/api/draft'] : [],
    staticUrls: ['/content/content.json', '/content/content.sample.json'],
  }
})()

async function fetchContent(url: string): Promise<Content | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return parseContent(await res.json())
  } catch {
    return null
  }
}

export async function loadDraftContent(): Promise<Content | null> {
  for (const url of ADMIN_CONTENT_SOURCE.draftUrls) {
    const content = await fetchContent(url)
    if (content) return content
  }
  return null
}

export async function loadStaticContent(): Promise<Content | null> {
  for (const url of ADMIN_CONTENT_SOURCE.staticUrls) {
    const content = await fetchContent(url)
    if (content) return content
  }
  return null
}
