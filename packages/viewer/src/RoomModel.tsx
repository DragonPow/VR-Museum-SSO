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
        // Rotation: Blender bakes orientation into vertex positions, so GLTF node
        // rotation is always identity. We compute the face normal from the first
        // triangle of the mesh geometry and map it to a Y-rotation for the
        // replacement PlaneGeometry (default normal = +Z).
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

          // Compute face normal from first 3 vertices of the mesh
          const posAttr = obj.geometry.getAttribute('position')
          if (posAttr && posAttr.count >= 3) {
            const v0 = new THREE.Vector3(posAttr.getX(0), posAttr.getY(0), posAttr.getZ(0))
            const v1 = new THREE.Vector3(posAttr.getX(1), posAttr.getY(1), posAttr.getZ(1))
            const v2 = new THREE.Vector3(posAttr.getX(2), posAttr.getY(2), posAttr.getZ(2))
            const localNormal = v1.sub(v0).cross(v2.sub(v0)).normalize()

            // Apply world quaternion (node rotation; identity for all VM_Slot_* meshes
            // since Blender applied rotations into vertex positions, but kept for correctness)
            const quat = new THREE.Quaternion()
            obj.getWorldQuaternion(quat)
            localNormal.applyQuaternion(quat)

            if (Math.abs(localNormal.x) > 0.5) {
              // Side wall slot (thinAxis=X): normal along ±X
              // normal +X → face +X → Y = -π/2 ; normal -X → face -X → Y = +π/2
              yaw = localNormal.x > 0 ? -Math.PI / 2 : Math.PI / 2
            } else if (localNormal.z < -0.5) {
              // Faces -Z: column inner face / panel back face
              yaw = Math.PI
            } else {
              // Faces +Z: back wall, centerpiece, column outer face — already correct.
              // Exception: front/entry wall (z > 7) also has normal +Z in mesh but must
              // face inward (-Z) — use position to distinguish.
              yaw = pos.z > 7.0 ? Math.PI : 0
            }
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
