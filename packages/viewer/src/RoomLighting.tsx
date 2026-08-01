import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { LightingPreset } from '@vm/shared'
import { getLightConfig } from './lighting.js'

interface Props {
  preset: LightingPreset
  /** When the room has a baked lightmap, the lightmap supplies the main light; keep
   *  dynamic lighting to a dim fill so lightmapped walls aren't double-lit while
   *  non-lightmapped props (frames, glass cases, photos) stay visible. */
  baked?: boolean
}

function PbrReflectionEnvironment() {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)

  useEffect(() => {
    const previousEnvironment = scene.environment
    const pmrem = new THREE.PMREMGenerator(gl)
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

    scene.environment = environment

    return () => {
      scene.environment = previousEnvironment
      environment.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])

  return null
}

export function RoomLighting({ preset, baked = false }: Props) {
  if (baked) {
    // The shell is unlit/baked, so this only gives non-baked authored props
    // enough directional response for metal/normal detail to read like Blender.
    return (
      <>
        <PbrReflectionEnvironment />
        <ambientLight color="#fff1df" intensity={0.42} />
        <directionalLight color="#fff4d8" intensity={1.15} position={[-3.5, 4.2, 2.8]} castShadow={false} />
        <directionalLight color="#dbeafe" intensity={0.25} position={[3.0, 2.4, -2.0]} castShadow={false} />
      </>
    )
  }

  const cfg = getLightConfig(preset)
  return (
    <>
      <PbrReflectionEnvironment />
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
