import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

interface Props {
  url: string
  offset?: [number, number, number]
}

/**
 * Loads an externally-authored room shell, usually a Blender export in GLB/GLTF.
 * The model is responsible for visual room details: walls, floor, ceiling, doors,
 * lights, decorations and static frames. Dynamic slots/hotspots are still rendered
 * by the web viewer so content can be changed from JSON.
 */
export function RoomModel({ url, offset }: Props) {
  const gltf = useGLTF(url) as { scene: THREE.Group }
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene])

  useEffect(() => {
    // SlotCanvas is a grey placeholder in the GLB that sits in front of the R3F image planes.
    // Hide it so textures from SlotFrame are visible. Keep Frame (gold borders) visible.
    const SLOT_MATERIALS = new Set(['SlotCanvas'])

    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      obj.castShadow = false
      obj.receiveShadow = false
      obj.frustumCulled = true

      const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
      const isSlotMesh = materials.some((m) => m && SLOT_MATERIALS.has(m.name))
      if (isSlotMesh) {
        obj.visible = false
        return
      }

      materials.forEach((material) => {
        if (!material) return
        // Render both sides — handles GLTF models where normals may face outward
        material.side = THREE.DoubleSide
        // GLTF metallicFactor defaults to 1.0 when not authored.
        // Fully metallic + no IBL/env-map = black walls. Force non-metallic so
        // ambient + directional lights illuminate the room correctly.
        if (material instanceof THREE.MeshStandardMaterial && material.metalness > 0.1) {
          material.metalness = 0
        }
        material.needsUpdate = true
      })
    })
  }, [scene])

  return <primitive object={scene} position={offset ?? [0, 0, 0]} />
}
