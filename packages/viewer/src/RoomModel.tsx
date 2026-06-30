import { useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { SlotTransform } from '@vm/shared'

export const VM_SLOT_PREFIX = 'VM_Slot_'

export interface ExtractedSlot {
  id: string
  transform: SlotTransform
  hasBlenderFrame: boolean
}

interface Props {
  url: string
  offset?: [number, number, number]
  onSlotsExtracted?: (slots: ExtractedSlot[]) => void
}

export function RoomModel({ url, offset, onSlotsExtracted }: Props) {
  const gltf = useGLTF(url) as { scene: THREE.Group }
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene])

  const cbRef = useRef(onSlotsExtracted)
  cbRef.current = onSlotsExtracted

  useEffect(() => {
    scene.updateMatrixWorld(true)

    const slotMap = new Map<string, {
      pos: THREE.Vector3
      w: number; h: number
      yaw: number | null
      hasFrame: boolean
    }>()

    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      obj.castShadow    = false
      obj.receiveShadow = false
      obj.frustumCulled = true

      const mats     = Array.isArray(obj.material) ? obj.material : [obj.material]
      const isCanvas = mats.some((m) => m?.name === 'SlotCanvas')
      const isSlot   = obj.name.startsWith(VM_SLOT_PREFIX)

      if (!isSlot) {
        if (isCanvas) { obj.visible = false; return }
        mats.forEach((mat) => {
          if (!mat) return
          mat.side = THREE.DoubleSide
          if (mat instanceof THREE.MeshStandardMaterial && mat.metalness > 0.1)
            mat.metalness = 0
          mat.needsUpdate = true
        })
        return
      }

      const slotId = obj.name.replace(/_\d+$/, '')
      if (!slotMap.has(slotId)) {
        slotMap.set(slotId, { pos: new THREE.Vector3(), w: 1, h: 0.8, yaw: null, hasFrame: false })
      }
      const entry = slotMap.get(slotId)!

      if (isCanvas) {
        obj.visible = false
        obj.getWorldPosition(entry.pos)

        if (obj.geometry) {
          // Size from bounding box (two largest extents = width & height)
          obj.geometry.computeBoundingBox()
          const bb = obj.geometry.boundingBox!
          const sc = new THREE.Vector3()
          obj.getWorldScale(sc)
          const dims = [
            (bb.max.x - bb.min.x) * Math.abs(sc.x),
            (bb.max.y - bb.min.y) * Math.abs(sc.y),
            (bb.max.z - bb.min.z) * Math.abs(sc.z),
          ].sort((a, b) => b - a)
          entry.w = dims[0]!
          entry.h = dims[1]!

          // Yaw from Blender's vertex normals — already in world space since VM_Slot
          // nodes have identity rotation in the GLTF export.
          const normals = obj.geometry.getAttribute('normal')
          if (normals) {
            const nx = normals.getX(0)
            const nz = normals.getZ(0)
            entry.yaw = Math.atan2(nx, nz)
          }
        }
      } else {
        // Frame primitive: keep visible; fix PBR
        entry.hasFrame = true
        mats.forEach((mat) => {
          if (!mat) return
          if (mat instanceof THREE.MeshStandardMaterial && mat.metalness > 0.1)
            mat.metalness = 0
          mat.needsUpdate = true
        })
      }
    })

    const extracted: ExtractedSlot[] = []
    for (const [id, entry] of slotMap) {
      if (entry.yaw === null) continue  // canvas not found for this slot
      extracted.push({
        id,
        hasBlenderFrame: entry.hasFrame,
        transform: {
          position: { x: entry.pos.x, y: entry.pos.y, z: entry.pos.z },
          rotation: { x: 0, y: entry.yaw, z: 0 },
          size:     { w: entry.w, h: entry.h },
        },
      })
    }

    if (extracted.length > 0) cbRef.current?.(extracted)
  }, [scene])

  return <primitive object={scene} position={offset ?? [0, 0, 0]} />
}
