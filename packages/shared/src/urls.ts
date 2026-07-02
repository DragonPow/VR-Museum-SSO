const ABSOLUTE_URL_RE = /^(?:[a-z]+:)?\/\//i

interface ResolveAssetUrlOptions {
  assetBaseUrl?: string | null | undefined
  appBaseUrl?: string | null | undefined
}

export function resolveAssetUrl(
  url: string | null | undefined,
  options: ResolveAssetUrlOptions = {},
): string | null {
  if (!url) return null
  if (url.startsWith('blob:') || url.startsWith('data:')) return url
  if (ABSOLUTE_URL_RE.test(url)) return url

  const assetBase = trimTrailingSlash(options.assetBaseUrl)
  const appBase = trimTrailingSlash(options.appBaseUrl)

  if (assetBase) {
    return `${assetBase}/${url.replace(/^\/+/, '')}`
  }

  if (url.startsWith('/')) {
    return appBase ? `${appBase}${url}` : url
  }

  return appBase ? `${appBase}/${url}` : url
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
