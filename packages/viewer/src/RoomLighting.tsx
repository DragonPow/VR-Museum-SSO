import type { LightingPreset } from '@vm/shared'
import { getLightConfig } from './lighting.js'

interface Props {
  preset: LightingPreset
}

export function RoomLighting({ preset }: Props) {
  const cfg = getLightConfig(preset)
  return (
    <>
      <ambientLight color={cfg.ambientColor} intensity={cfg.ambientIntensity} />
      {cfg.lights.map((l, i) =>
        l.type === 'directional' ? (
          <directionalLight
            key={i}
            color={l.color}
            intensity={l.intensity}
            position={l.position}
            castShadow={false}
          />
        ) : (
          <pointLight
            key={i}
            color={l.color}
            intensity={l.intensity}
            position={l.position}
            castShadow={false}
          />
        ),
      )}
    </>
  )
}
