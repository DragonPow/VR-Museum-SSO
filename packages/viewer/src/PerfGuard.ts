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
    if (!ext) return 'medium'
    const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string
    const lower = renderer.toLowerCase()
    // Known low-end patterns
    if (/swiftshader|llvmpipe|softpipe|microsoft basic/.test(lower)) return 'low'
    if (/intel (hd|uhd) graphics [0-9]{3}[^0-9]/.test(lower)) return 'medium'
    if (/mali-[gt][0-9]+/.test(lower)) return 'medium'
    if (/adreno [0-9]{3}/.test(lower)) return 'medium'
    return 'high'
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
    frameloop: tier === 'low' ? 'demand' : 'always',
  }
  return _cached
}

export function shouldUseFallback(): boolean {
  return getPerfConfig().tier === 'low'
}
