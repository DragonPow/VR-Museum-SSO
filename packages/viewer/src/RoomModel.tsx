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
        const pos    = new THREE.Vector3()
        const wscale = new THREE.Vector3()

        obj.getWorldPosition(pos)
        obj.getWorldScale(wscale)

        // Size: two largest world-space extents (handles side-wall thinAxis=X correctly).
        // Rotation: derived from bounding box only — no vertex normal reading.
        // Slot meshes now have real 3D depth, so reading the first triangle's normal is
        // unreliable (the back face touching the wall often appears first in the accessor).
        //
        // Key invariant (set by Blender): the canvas always sits on the SMALLER-magnitude
        // side of the thin axis. For Z-thin slots:
        //   |bb.min.z| > bb.max.z  →  slot bulk is on -Z side, canvas faces +Z  → yaw=0
        //   bb.max.z  > |bb.min.z| →  slot bulk is on +Z side, canvas faces -Z  → yaw=π
        // For X-thin (side wall) slots: use world position to decide ±X, same as before.
        let w = 1, h = 0.8, yaw = 0
        if (obj.geometry) {
          obj.geometry.computeBoundingBox()
          const bb = obj.geometry.boundingBox!
          const extentX = (bb.max.x - bb.min.x) * Math.abs(wscale.x)
          const extentY = (bb.max.y - bb.min.y) * Math.abs(wscale.y)
          const extentZ = (bb.max.z - bb.min.z) * Math.abs(wscale.z)

          const extents = [extentX, extentY, extentZ].sort((a, b) => b - a)
          w = extents[0]!
          h = extents[1]!

          if (extentX < extentY && extentX < extentZ) {
            // Side wall slot (thin axis = X)
            // right wall (pos.x > 0): canvas faces -X into room → yaw = -π/2
            // left wall  (pos.x < 0): canvas faces +X into room → yaw = +π/2
            yaw = pos.x > 0 ? -Math.PI / 2 : Math.PI / 2
          } else {
            // Front/back/column slot (thin axis = Z)
            // Canvas is on the side with the smaller |Z| bound
            yaw = Math.abs(bb.min.z) > Math.abs(bb.max.z) ? 0 : Math.PI
          }
        }

        extracted.push({
          id: obj.name,
          transform: {
            position: { x: pos.x, y: pos.y, z: pos.z },
            rotation: { x: 0,     y: yaw,   z: 0     },
            size:     { w,        h                   },
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
