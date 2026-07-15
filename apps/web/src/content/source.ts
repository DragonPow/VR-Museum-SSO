type ContentMode = 'local' | 'github' | 'cloudflare' | 'static'

const BASE = import.meta.env.BASE_URL
const ASSET_BASE_URL = (import.meta.env['VITE_ASSET_BASE_URL'] ?? '').replace(/\/+$/, '')
const EXPLICIT_MODE = import.meta.env['VITE_CONTENT_MODE'] as ContentMode | undefined

function detectMode(): ContentMode {
  if (EXPLICIT_MODE) return EXPLICIT_MODE
  if (ASSET_BASE_URL) return 'cloudflare'
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1') return 'local'
    if (host.endsWith('github.io')) return 'github'
  }
  return 'static'
}

function joinBase(path: string): string {
  return `${BASE}${path.replace(/^\/+/, '')}`
}

export const CONTENT_SOURCE = (() => {
  const mode = detectMode()
  if (mode === 'cloudflare') {
    const base = ASSET_BASE_URL
    return {
      mode,
      assetBaseUrl: base,
      appBaseUrl: BASE,
      contentUrls: [`${base}/content.json`],
    }
  }

  if (mode === 'github') {
    return {
      mode,
      assetBaseUrl: '',
      appBaseUrl: BASE,
      contentUrls: [joinBase('content/content.json'), joinBase('content/content.sample.json')],
    }
  }

  if (mode === 'local') {
    return {
      mode,
      assetBaseUrl: '',
      appBaseUrl: BASE,
      // Local web should see the same published snapshot as admin/wrangler when it
      // exists. Fall back to committed files when the Worker is not running.
      contentUrls: ['/api/content', '/content/content.json', '/content/content.sample.json'],
    }
  }

  return {
    mode,
    assetBaseUrl: '',
    appBaseUrl: BASE,
    contentUrls: [joinBase('content/content.json'), joinBase('content/content.sample.json')],
  }
})()

export async function fetchFirstContentJson(): Promise<unknown> {
  let lastError: unknown = null
  for (const url of CONTENT_SOURCE.contentUrls) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
      return res.json()
    } catch (err) {
      lastError = err
    }
  }
  throw lastError ?? new Error('No content source configured')
}
