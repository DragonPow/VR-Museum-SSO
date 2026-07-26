import type { ImageRescaleSettings } from '@vm/shared'

export interface ResizedVariants {
  thumb?: Blob   // 360px wide  — library thumbnails
  wall?: Blob    // 1200px wide — 3D wall texture / slot preview
  full?: Blob    // up to 4096px wide — info modal + hi-res backdrop panels
}

export async function resizeImage(
  file: File,
  settings?: ImageRescaleSettings,
  options?: { thumb?: boolean; wall?: boolean; full?: boolean }
): Promise<ResizedVariants> {
  const config = settings ?? { thumb: 360, wall: 1200, full: 4096 }
  const img = await loadImage(file)

  const doThumb = options ? !!options.thumb : true
  const doWall = options ? !!options.wall : true
  const doFull = options ? !!options.full : true

  const [thumb, wall, full] = await Promise.all([
    doThumb ? resizeTo(img, config.thumb, 0.86) : Promise.resolve(null),
    doWall ? resizeTo(img, config.wall, 0.88) : Promise.resolve(null),
    doFull ? resizeTo(img, config.full, 0.9) : Promise.resolve(null),
  ])

  const result: ResizedVariants = {}
  if (thumb) result.thumb = thumb
  if (wall) result.wall = wall
  if (full) result.full = full

  return result
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')) }
    img.src = url
  })
}

async function resizeTo(img: HTMLImageElement, maxWidth: number, quality = 0.85): Promise<Blob> {
  const scale = Math.min(1, maxWidth / img.naturalWidth)
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
      'image/webp',
      quality,
    )
  })
}

export function blobToObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob)
}
