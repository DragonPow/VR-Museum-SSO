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
    // The baked lightmap supplies all the room lighting. Keep only a dim white
    // ambient so props that AREN'T baked yet (frames, glass cases, photo canvases)
    // stay visible — no dynamic directional light, which would double-light the
    // lightmapped shell and blow out the bake.
    return <ambientLight color="#ffffff" intensity={0.4} />
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
