import * as THREE from 'three'

const MAX_CACHED = 40
const cache = new Map<string, THREE.Texture>()
const lruOrder: string[] = []

function evictLru() {
  while (lruOrder.length > MAX_CACHED) {
    const oldest = lruOrder.shift()!
    const tex = cache.get(oldest)
    if (tex) {
      tex.dispose()
      cache.delete(oldest)
    }
  }
}

const loader = new THREE.TextureLoader()

export function loadTexture(
  url: string,
  onLoad?: (tex: THREE.Texture) => void,
): THREE.Texture {
  const hit = cache.get(url)
  if (hit) {
    // promote in LRU
    const idx = lruOrder.indexOf(url)
    if (idx !== -1) lruOrder.splice(idx, 1)
    lruOrder.push(url)
    onLoad?.(hit)
    return hit
  }

  const tex = loader.load(url, (t) => {
    t.colorSpace = THREE.SRGBColorSpace
    t.generateMipmaps = true
    t.minFilter = THREE.LinearMipmapLinearFilter
    t.magFilter = THREE.LinearFilter
    onLoad?.(t)
  })

  cache.set(url, tex)
  lruOrder.push(url)
  evictLru()
  return tex
}

export function preloadUrls(urls: string[]): void {
  urls.forEach((u) => loadTexture(u))
}

export function disposeRoom(urls: string[]): void {
  urls.forEach((u) => {
    const tex = cache.get(u)
    if (tex) {
      tex.dispose()
      cache.delete(u)
      const idx = lruOrder.indexOf(u)
      if (idx !== -1) lruOrder.splice(idx, 1)
    }
  })
}

/** A plain 1×1 grey texture used as placeholder while real texture loads. */
let _grey: THREE.Texture | null = null
export function greyTexture(): THREE.Texture {
  if (!_grey) {
    const data = new Uint8Array([180, 180, 180, 255])
    _grey = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat)
    _grey.colorSpace = THREE.SRGBColorSpace
    _grey.needsUpdate = true
  }
  return _grey
}
