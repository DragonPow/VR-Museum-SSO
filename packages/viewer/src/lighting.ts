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
    ambientIntensity: 2.2,
    lights: [
      { type: 'directional', color: '#ffe4b5', intensity: 1.8, position: [5, 8, 5] },
      { type: 'directional', color: '#ffddcc', intensity: 1.2, position: [-5, 6, -3] },
      { type: 'point', color: '#ffeecc', intensity: 2.0, position: [0, 3.0, 0] },
    ],
  },
  neutral: {
    ambientColor: '#f5f5f5',
    ambientIntensity: 2.5,
    lights: [
      { type: 'directional', color: '#ffffff', intensity: 1.5, position: [5, 8, 5] },
      { type: 'directional', color: '#f0f0ff', intensity: 1.0, position: [-5, 6, -3] },
      { type: 'point', color: '#ffffff', intensity: 1.8, position: [0, 3.0, 0] },
    ],
  },
  cool: {
    ambientColor: '#e8f0ff',
    ambientIntensity: 2.2,
    lights: [
      { type: 'directional', color: '#d0e4ff', intensity: 1.5, position: [5, 8, 5] },
      { type: 'directional', color: '#c8d8ff', intensity: 1.0, position: [-5, 6, -3] },
      { type: 'point', color: '#d8e8ff', intensity: 1.8, position: [0, 3.0, 0] },
    ],
  },
}

export function getLightConfig(preset: LightingPreset): LightConfig {
  return LIGHTING_CONFIGS[preset]
}
