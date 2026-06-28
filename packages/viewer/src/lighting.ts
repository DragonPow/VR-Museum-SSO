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
    ambientIntensity: 0.6,
    lights: [
      { type: 'directional', color: '#ffe4b5', intensity: 0.9, position: [5, 8, 5] },
      { type: 'directional', color: '#ffddcc', intensity: 0.5, position: [-5, 6, -3] },
      { type: 'point', color: '#ffeecc', intensity: 0.8, position: [0, 3.5, 0] },
    ],
  },
  neutral: {
    ambientColor: '#f5f5f5',
    ambientIntensity: 0.7,
    lights: [
      { type: 'directional', color: '#ffffff', intensity: 0.9, position: [5, 8, 5] },
      { type: 'directional', color: '#f0f0ff', intensity: 0.5, position: [-5, 6, -3] },
      { type: 'point', color: '#ffffff', intensity: 0.7, position: [0, 3.0, 0] },
    ],
  },
  cool: {
    ambientColor: '#e8f0ff',
    ambientIntensity: 0.6,
    lights: [
      { type: 'directional', color: '#d0e4ff', intensity: 0.8, position: [5, 8, 5] },
      { type: 'directional', color: '#c8d8ff', intensity: 0.5, position: [-5, 6, -3] },
      { type: 'point', color: '#d8e8ff', intensity: 0.7, position: [0, 3.0, 0] },
    ],
  },
}

export function getLightConfig(preset: LightingPreset): LightConfig {
  return LIGHTING_CONFIGS[preset]
}
