import { useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { SlotTransform } from '@vm/shared'

export const VM_SLOT_PREFIX = 'VM_Slot_'

export interface ExtractedSlot {
  id: string
  transform: SlotTransform
  /** True when the GLB contains a real 3D Frame primitive for this slot.
   *  RoomScene uses this to suppress the R3F fallback frame boxes. */
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

    // Per-slot accumulator — keyed by canonical slot ID (strips Three.js _0/_1 suffix)
    const slotMap = new Map<string, {
      pos:   THREE.Vector3
      w:     number
      h:     number
      yaw:   number | null   // null = will be derived from pos.x (side-wall sentinel)
      hasCanvas: boolean
      hasFrame:  boolean
    }>()

    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      obj.castShadow    = false
      obj.receiveShadow = false
      obj.frustumCulled = true

      if (!obj.name.startsWith(VM_SLOT_PREFIX)) {
        // ── Non-slot mesh: fix PBR defaults ────────────────────────────────
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        if (mats.some((m) => m?.name === 'SlotCanvas')) {
          obj.visible = false
          return
        }
        mats.forEach((mat) => {
          if (!mat) return
          mat.side = THREE.DoubleSide
          if (mat instanceof THREE.MeshStandardMaterial && mat.metalness > 0.1)
            mat.metalness = 0
          mat.needsUpdate = true
        })
        return
      }

      // ── VM_Slot_* mesh ──────────────────────────────────────────────────
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      const isCanvas = mats.some((m) => m?.name === 'SlotCanvas')

      // Strip Three.js numeric suffix (_0, _1 …) that multi-primitive nodes get
      const slotId = obj.name.replace(/_\d+$/, '')
      if (!slotMap.has(slotId)) {
        slotMap.set(slotId, {
          pos: new THREE.Vector3(), w: 1, h: 0.8, yaw: null,
          hasCanvas: false, hasFrame: false,
        })
      }
      const entry = slotMap.get(slotId)!

      if (isCanvas) {
        // ── Canvas primitive: hide it; extract canvas size ──────────────
        obj.visible = false
        entry.hasCanvas = true

        obj.getWorldPosition(entry.pos)

        const wscale = new THREE.Vector3()
        obj.getWorldScale(wscale)
        if (obj.geometry) {
          obj.geometry.computeBoundingBox()
          const bb = obj.geometry.boundingBox!
          const eX = (bb.max.x - bb.min.x) * Math.abs(wscale.x)
          const eY = (bb.max.y - bb.min.y) * Math.abs(wscale.y)
          const eZ = (bb.max.z - bb.min.z) * Math.abs(wscale.z)
          const sorted = [eX, eY, eZ].sort((a, b) => b - a)
          entry.w = sorted[0]!
          entry.h = sorted[1]!

          // Yaw from canvas: only reliable for side walls (tiny-X sentinel)
          if (eX < eY && eX < eZ) {
            entry.yaw = null  // side wall → resolved later from pos.x
          }
          // For front/back, frame primitive gives more reliable yaw — leave for frame pass
        }
      } else {
        // ── Frame primitive: keep visible; fix PBR; use for yaw ─────────
        entry.hasFrame = true
        mats.forEach((mat) => {
          if (!mat) return
          if (mat instanceof THREE.MeshStandardMaterial && mat.metalness > 0.1)
            mat.metalness = 0
          mat.needsUpdate = true
        })

        const wscale = new THREE.Vector3()
        obj.getWorldScale(wscale)
        if (obj.geometry && entry.yaw === null) {
          // Frame has real Z-depth → bounding-box sign is reliable
          obj.geometry.computeBoundingBox()
          const bb = obj.geometry.boundingBox!
          const eX = (bb.max.x - bb.min.x) * Math.abs(wscale.x)
          const eY = (bb.max.y - bb.min.y) * Math.abs(wscale.y)
          const eZ = (bb.max.z - bb.min.z) * Math.abs(wscale.z)

          if (eX < eY && eX < eZ) {
            entry.yaw = null   // side wall — resolve from pos.x below
          } else {
            // Canvas faces +Z (yaw=0) when slot bulk is on -Z side of origin
            entry.yaw = Math.abs(bb.min.z) > Math.abs(bb.max.z) ? 0 : Math.PI
          }
        }
      }
    })

    // ── Build final ExtractedSlot list ────────────────────────────────────
    const extracted: ExtractedSlot[] = []
    for (const [slotId, entry] of slotMap) {
      // Resolve side-wall yaw from world position
      const yaw = entry.yaw !== null
        ? entry.yaw
        : (entry.pos.x > 0 ? -Math.PI / 2 : Math.PI / 2)

      extracted.push({
        id:  slotId,
        hasBlenderFrame: entry.hasFrame,
        transform: {
          position: { x: entry.pos.x, y: entry.pos.y, z: entry.pos.z },
          rotation: { x: 0, y: yaw, z: 0 },
          size:     { w: entry.w, h: entry.h },
        },
      })
    }

    if (extracted.length > 0) cbRef.current?.(extracted)
  }, [scene])

  return <primitive object={scene} position={offset ?? [0, 0, 0]} />
}
