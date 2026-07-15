export interface ResizedVariants {
  thumb: Blob   // 360px wide  — library thumbnails
  wall: Blob    // 1200px wide — 3D wall texture / slot preview
  full: Blob    // up to 4096px wide — info modal + hi-res backdrop panels
}

export async function resizeImage(file: File): Promise<ResizedVariants> {
  const img = await loadImage(file)
  const [thumb, wall, full] = await Promise.all([
    resizeTo(img, 360, 0.86),
    resizeTo(img, 1200, 0.88),
    // "full" keeps near-original resolution (capped at 4096) so large backdrop
    // panels stay sharp up close and the info modal looks crisp.
    resizeTo(img, 4096, 0.9),
  ])
  return { thumb, wall, full }
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
