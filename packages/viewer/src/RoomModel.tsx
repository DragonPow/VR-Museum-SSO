import { useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { SlotTransform } from '@vm/shared'

/** Naming convention: any Blender object whose name starts with this prefix
 *  is treated as a slot placeholder. The mesh is hidden at runtime; its world
 *  transform + bounding box are used to position the R3F SlotFrame. */
export const VM_SLOT_PREFIX = 'VM_Slot_'

/** Slot data extracted from a VM_Slot_* mesh in the GLB. */
export interface ExtractedSlot {
  /** Mesh name from Blender, e.g. "VM_Slot_001". Used as slot.id. */
  id: string
  transform: SlotTransform
}

interface Props {
  url: string
  offset?: [number, number, number]
  /** Called once after the GLB loads and VM_Slot_* meshes are found. */
  onSlotsExtracted?: (slots: ExtractedSlot[]) => void
}

export function RoomModel({ url, offset, onSlotsExtracted }: Props) {
  const gltf = useGLTF(url) as { scene: THREE.Group }
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene])

  // Keep callback ref so the effect dep array stays stable
  const cbRef = useRef(onSlotsExtracted)
  cbRef.current = onSlotsExtracted

  useEffect(() => {
    // Ensure all world matrices are up-to-date before reading positions
    scene.updateMatrixWorld(true)

    const extracted: ExtractedSlot[] = []

    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      obj.castShadow = false
      obj.receiveShadow = false
      obj.frustumCulled = true

      // ── VM_Slot_* → extract transform, then hide ───────────────────────────
      if (obj.name.startsWith(VM_SLOT_PREFIX)) {
        const pos  = new THREE.Vector3()
        const quat = new THREE.Quaternion()
        const wscale = new THREE.Vector3()
        const euler = new THREE.Euler()

        obj.getWorldPosition(pos)
        obj.getWorldQuaternion(quat)
        obj.getWorldScale(wscale)
        euler.setFromQuaternion(quat, 'YXZ')

        // Size: sort all 3 world-space extents and take the two largest.
        // This handles both front/back-wall slots (thin in local Z after GLTF export)
        // and side-wall slots (thin in local X), without needing to know thinAxis.
        let w = 1, h = 0.8
        if (obj.geometry) {
          obj.geometry.computeBoundingBox()
          const bb = obj.geometry.boundingBox!
          const extents = [
            (bb.max.x - bb.min.x) * Math.abs(wscale.x),
            (bb.max.y - bb.min.y) * Math.abs(wscale.y),
            (bb.max.z - bb.min.z) * Math.abs(wscale.z),
          ].sort((a, b) => b - a)   // descending
          w = extents[0]!   // largest  = face width
          h = extents[1]!   // second   = face height
        }

        extracted.push({
          id: obj.name,
          transform: {
            position: { x: pos.x,     y: pos.y,     z: pos.z     },
            rotation: { x: euler.x,   y: euler.y,   z: euler.z   },
            size:     { w,             h                           },
          },
        })

        obj.visible = false
        return
      }

      // ── Legacy SlotCanvas material → hide ─────────────────────────────────
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
      if (materials.some((m) => m?.name === 'SlotCanvas')) {
        obj.visible = false
        return
      }

      // ── Fix PBR defaults so room is lit correctly ──────────────────────────
      materials.forEach((mat) => {
        if (!mat) return
        mat.side = THREE.DoubleSide
        if (mat instanceof THREE.MeshStandardMaterial && mat.metalness > 0.1) {
          mat.metalness = 0
        }
        mat.needsUpdate = true
      })
    })

    if (extracted.length > 0) {
      cbRef.current?.(extracted)
    }
  }, [scene])

  return <primitive object={scene} position={offset ?? [0, 0, 0]} />
}
