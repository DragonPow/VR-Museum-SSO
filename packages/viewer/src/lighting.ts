import type { LightingPreset } from '@vm/shared'

export interface LightConfig {
  ambientColor: string
  ambientIntensity: number
  lights: Array<{
    type: 'directional' | 'point'
    color: string
    intensity: number
    position: [number, number, number]
  }>
}

export const LIGHTING_CONFIGS: Record<LightingPreset, LightConfig> = {
  warm: {
    ambientColor: '#fff5e0',
    ambientIntensity: 0.7,
    lights: [
      { type: 'directional', color: '#ffe4b5', intensity: 0.6, position: [5, 8, 5] },
      { type: 'point', color: '#ffddaa', intensity: 0.4, position: [0, 3.5, 0] },
    ],
  },
  neutral: {
    ambientColor: '#f0f0f0',
    ambientIntensity: 0.75,
    lights: [
      { type: 'directional', color: '#ffffff', intensity: 0.5, position: [5, 8, 5] },
      { type: 'point', color: '#f8f8f8', intensity: 0.35, position: [0, 3.5, 0] },
    ],
  },
  cool: {
    ambientColor: '#e8f0ff',
    ambientIntensity: 0.7,
    lights: [
      { type: 'directional', color: '#d0e4ff', intensity: 0.55, position: [5, 8, 5] },
      { type: 'point', color: '#c8d8ff', intensity: 0.4, position: [0, 3.5, 0] },
    ],
  },
}

export function getLightConfig(preset: LightingPreset): LightConfig {
  return LIGHTING_CONFIGS[preset]
}
