const ABSOLUTE_URL_RE = /^(?:[a-z]+:)?\/\//i

interface ResolveAssetUrlOptions {
  assetBaseUrl?: string | null | undefined
  appBaseUrl?: string | null | undefined
  assetVersion?: string | null | undefined
}

export function resolveAssetUrl(
  url: string | null | undefined,
  options: ResolveAssetUrlOptions = {},
): string | null {
  if (!url) return null
  if (url.startsWith('blob:') || url.startsWith('data:')) return url
  if (ABSOLUTE_URL_RE.test(url)) return appendAssetVersion(url, options.assetVersion)

  const assetBase = trimTrailingSlash(options.assetBaseUrl)
  const appBase = trimTrailingSlash(options.appBaseUrl)

  if (assetBase) {
    return appendAssetVersion(`${assetBase}/${url.replace(/^\/+/, '')}`, options.assetVersion)
  }

  if (url.startsWith('/')) {
    if (!appBase) return appendAssetVersion(url, options.assetVersion)
    // Idempotent: a URL already carrying the app base (e.g. rebased once in the
    // content index, then again in useRoom) must not get the prefix twice —
    // otherwise it breaks when deployed under a sub-path like /VR-Museum-SSO/.
    if (url === appBase || url.startsWith(`${appBase}/`)) return appendAssetVersion(url, options.assetVersion)
    return appendAssetVersion(`${appBase}${url}`, options.assetVersion)
  }

  return appendAssetVersion(appBase ? `${appBase}/${url}` : url, options.assetVersion)
}

export function resolveAssetBaseUrl(
  explicitBaseUrl?: string | null | undefined,
  contentUrl?: string | null | undefined,
): string {
  const explicitBase = trimTrailingSlash(explicitBaseUrl)
  if (explicitBase) return explicitBase

  const source = (contentUrl ?? '').trim()
  if (!source || !ABSOLUTE_URL_RE.test(source)) return ''

  try {
    return new URL(source).origin
  } catch {
    return ''
  }
}

export function rebaseAssetUrls<T>(value: T, options: ResolveAssetUrlOptions = {}): T {
  if (typeof value === 'string') {
    return shouldResolveAssetString(value) ? (resolveAssetUrl(value, options) as T) : value
  }

  if (Array.isArray(value)) {
    return value.map((item) => rebaseAssetUrls(item, options)) as T
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, rebaseAssetUrls(entry, options)]),
    ) as T
  }

  return value
}

function shouldResolveAssetString(value: string): boolean {
  return (
    ABSOLUTE_URL_RE.test(value) ||
    value.startsWith('/') ||
    value.startsWith('./') ||
    value.startsWith('../') ||
    value.startsWith('blob:') ||
    value.startsWith('data:')
  )
}

function trimTrailingSlash(value: string | null | undefined): string {
  return (value ?? '').replace(/\/+$/, '')
}

function appendAssetVersion(url: string, version: string | null | undefined): string {
  const safeVersion = (version ?? '').trim()
  if (!safeVersion) return url
  const hashIndex = url.indexOf('#')
  if (hashIndex >= 0) {
    return `${appendAssetVersion(url.slice(0, hashIndex), safeVersion)}${url.slice(hashIndex)}`
  }
  return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(safeVersion)}`
}


export type DocumentMediaVariant = 'thumb' | 'wall' | 'full' | 'raw'

interface ResolveDocumentMediaOptions extends ResolveAssetUrlOptions {
  contentRoot?: string | null | undefined
}

function cleanSegment(value: string): string {
  return value.replace(/^\/+|\/+$/g, '')
}

export function documentFolderPath(documentKey: string, contentRoot = '/content'): string {
  const root = `/${cleanSegment(contentRoot)}`
  return `${root}/documents/${cleanSegment(documentKey)}`
}

export function documentDetailPath(documentKey: string, contentRoot = '/content'): string {
  return `${documentFolderPath(documentKey, contentRoot)}/document.json`
}

export function documentImageVariantPath(
  documentKey: string,
  imageId: string,
  variant: DocumentMediaVariant,
  rawExt?: string | null,
  contentRoot = '/content',
): string {
  const folder = `${documentFolderPath(documentKey, contentRoot)}/images/${cleanSegment(imageId)}`
  if (variant === 'raw') return `${folder}/raw.${rawExt ?? 'bin'}`
  return `${folder}/${variant}.webp`
}

export function resolveDocumentDetailUrl(
  documentKey: string | null | undefined,
  options: ResolveDocumentMediaOptions = {},
): string | null {
  if (!documentKey) return null
  return resolveAssetUrl(documentDetailPath(documentKey, options.contentRoot ?? '/content'), options)
}

export function resolveDocumentImageVariantUrl(
  documentKey: string | null | undefined,
  imageId: string | null | undefined,
  variant: DocumentMediaVariant,
  options: ResolveDocumentMediaOptions = {},
  rawExt?: string | null,
): string | null {
  if (!documentKey || !imageId) return null
  return resolveAssetUrl(documentImageVariantPath(documentKey, imageId, variant, rawExt, options.contentRoot ?? '/content'), options)
}

// Backward-compatible aliases for older call sites while the app migrates.
export const documentMediaPath = documentImageVariantPath
export const documentImagePath = (documentKey: string, imageId: string, contentRoot = '/content') =>
  documentImageVariantPath(documentKey, imageId, 'full', null, contentRoot)
export const resolveDocumentMediaUrl = resolveDocumentImageVariantUrl
export const resolveDocumentImageUrl = (documentKey: string | null | undefined, imageId: string | null | undefined, options: ResolveDocumentMediaOptions = {}) =>
  resolveDocumentImageVariantUrl(documentKey, imageId, 'full', options)
