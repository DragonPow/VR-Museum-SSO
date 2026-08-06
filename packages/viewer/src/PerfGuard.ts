import { PERF_BUDGET, QUALITY_TIERS } from '@vm/shared'
import type { QualityTier } from '@vm/shared'

function getGpuTier(): QualityTier {
  try {
    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl2') ??
      (canvas.getContext('webgl') as WebGLRenderingContext | null)
    if (!gl) return 'low'
    
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    let tier: QualityTier = 'high'
    if (ext) {
      const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string
      const lower = renderer.toLowerCase()
      if (/swiftshader|llvmpipe|softpipe|microsoft basic/.test(lower)) {
        tier = 'low'
      } else if (/intel (hd|uhd) graphics [0-9]{3}[^0-9]/.test(lower)) {
        tier = 'medium'
      } else if (/mali-[gt][0-9]+/.test(lower)) {
        tier = 'medium'
      } else if (/adreno [0-9]{3}/.test(lower)) {
        tier = 'medium'
      }
    }

    // Force release WebGL resources immediately
    const loseExt = gl.getExtension('WEBGL_lose_context')
    if (loseExt) loseExt.loseContext()

    return tier
  } catch {
    return 'medium'
  }
}

export interface PerfConfig {
  tier: QualityTier
  dpr: [number, number]
  fxaa: boolean
  shadows: boolean
  frameloop: 'always' | 'demand' | 'never'
}

let _cached: PerfConfig | null = null
let _fallbackCached: boolean | null = null

export function getPerfConfig(): PerfConfig {
  if (_cached) return _cached
  const tier = getGpuTier()
  const cfg = QUALITY_TIERS[tier]
  const isMobile = /Mobi|Android|iPhone|iPad/.test(navigator.userAgent)
  const [dprMin, dprMax] = isMobile
    ? PERF_BUDGET.dpr.mobile
    : [1, cfg.dprMax]
  _cached = {
    tier,
    dpr: [dprMin, dprMax] as [number, number],
    fxaa: cfg.fxaa,
    shadows: false, // always false — baked only
    frameloop: 'demand',  // NavController drives frames via invalidate(); idle GPU = 0 draw calls
  }
  return _cached
}

export function shouldUseFallback(): boolean {
  if (_fallbackCached !== null) return _fallbackCached
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    const hasWebGL = !!gl
    if (gl) {
      const loseExt = gl.getExtension('WEBGL_lose_context')
      if (loseExt) loseExt.loseContext()
    }
    _fallbackCached = !hasWebGL
    return _fallbackCached
  } catch {
    _fallbackCached = true
    return true
  }
}
