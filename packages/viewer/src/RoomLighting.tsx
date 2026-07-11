import type { LightingPreset } from '@vm/shared'
import { getLightConfig } from './lighting.js'

interface Props {
  preset: LightingPreset
  /** When the room has a baked lightmap, the lightmap supplies the main light; keep
   *  dynamic lighting to a dim fill so lightmapped walls aren't double-lit while
   *  non-lightmapped props (frames, glass cases, photos) stay visible. */
  baked?: boolean
}

export function RoomLighting({ preset, baked = false }: Props) {
  if (baked) {
    // The shell uses an unlit MeshBasicMaterial baked from Blender, so scene lights
    // do NOT affect it. This ambient only lights the props that aren't baked yet
    // (frames, cases, photo canvases) so they remain visible.
    return <ambientLight color="#ffffff" intensity={0.9} />
  }

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
