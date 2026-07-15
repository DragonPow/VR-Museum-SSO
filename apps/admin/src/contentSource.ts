import { parseContent, parseDocumentItem } from '@vm/shared'
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

function documentUrlFor(contentUrl: string, id: string): string {
  const safeId = encodeURIComponent(id)
  if (contentUrl.endsWith('/api/draft')) return `${contentUrl.replace('/api/draft', '')}/api/documents/${safeId}`
  if (ADMIN_CONTENT_SOURCE.mode === 'cloudflare' && ADMIN_CONTENT_SOURCE.assetBaseUrl) {
    return `${ADMIN_CONTENT_SOURCE.assetBaseUrl}/content/documents/${safeId}/document.json`
  }
  const contentFileMatch = contentUrl.match(/^(.*\/content\/)content(?:\.sample)?\.json$/)
  if (contentFileMatch) return `${contentFileMatch[1]}documents/${safeId}/document.json`
  return `/content/documents/${safeId}/document.json`
}

async function hydrateSplitContent(content: Content, contentUrl: string): Promise<Content> {
  if (content.documents.length > 0 || content.documentIndex.length === 0) return content
  const settled = await Promise.allSettled(
    content.documentIndex.map(async (document) => {
      const res = await fetch(documentUrlFor(contentUrl, document.documentKey))
      if (!res.ok) throw new Error(`${document.id}: HTTP ${res.status}`)
      return parseDocumentItem(await res.json())
    }),
  )
  const documents = settled
    .filter((result): result is PromiseFulfilledResult<Content['documents'][number]> => result.status === 'fulfilled')
    .map((result) => result.value)
  return { ...content, documents }
}

async function fetchContent(url: string): Promise<Content | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const content = parseContent(await res.json())
    const hydrated = await hydrateSplitContent(content, url)
    if (url.endsWith('/api/draft')) {
      const totalSlots = content.rooms.reduce((sum, room) => sum + room.slots.length, 0)
      const splitDocumentsMissing = content.documentIndex.length > 0 && content.documents.length === 0 && hydrated.documents.length === 0
      if (totalSlots === 0 || splitDocumentsMissing) return null
    }
    return hydrated
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
