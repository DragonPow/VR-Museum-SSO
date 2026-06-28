export interface ResizedVariants {
  thumb: Blob   // 200px wide — library thumbnails
  wall: Blob    // 800px wide — 3D wall texture
  full: Blob    // 1200px wide — info modal
}

export async function resizeImage(file: File): Promise<ResizedVariants> {
  const img = await loadImage(file)
  const [thumb, wall, full] = await Promise.all([
    resizeTo(img, 200),
    resizeTo(img, 800),
    resizeTo(img, 1200),
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

async function resizeTo(img: HTMLImageElement, maxWidth: number): Promise<Blob> {
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
      0.85,
    )
  })
}

export function blobToObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob)
}
