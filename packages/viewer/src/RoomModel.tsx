import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

interface Props {
  url: string
}

/**
 * Loads an externally-authored room shell, usually a Blender export in GLB/GLTF.
 * The model is responsible for visual room details: walls, floor, ceiling, doors,
 * lights, decorations and static frames. Dynamic slots/hotspots are still rendered
 * by the web viewer so content can be changed from JSON.
 */
export function RoomModel({ url }: Props) {
  const gltf = useGLTF(url) as { scene: THREE.Group }
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene])

  useEffect(() => {
    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      obj.castShadow = false
      obj.receiveShadow = false
      obj.frustumCulled = true

      const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
      materials.forEach((material) => {
        if (!material) return
        material.needsUpdate = true
      })
    })
  }, [scene])

  return <primitive object={scene} />
}
