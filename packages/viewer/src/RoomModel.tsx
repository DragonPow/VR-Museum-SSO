import { useEffect, useMemo, useRef, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
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
  /** Slot ids declared in the room JSON, used to map GLB mesh names back to a
   *  canonical slot id (three.js appends _1/_2 suffixes to duplicate node names). */
  knownSlotIds?: string[]
  /** Baked lightmap URL (sampled through UV2 / TEXCOORD_1). */
  lightmapUrl?: string | null
  /** lightMap.intensity — 1.0 matches the Blender bake; drop to ~0.9 if too bright. */
  lightmapIntensity?: number
}

/**
 * A single Blender slot node holds two primitives (frame + canvas). glTF gives
 * them the same node name, but three.js `createUniqueName` renames duplicates to
 * `<name>_1`, `<name>_2`… so a runtime mesh is called e.g. `VM_Slot_TT_3000_2`.
 * Resolve it back to the JSON slot id (`VM_Slot_TT_3000`) by longest-prefix match.
 */
function resolveSlotId(meshName: string, knownIds: string[]): string | null {
  let best: string | null = null
  for (const id of knownIds) {
    if (meshName === id || meshName.startsWith(id + '_')) {
      if (best === null || id.length > best.length) best = id
    }
  }
  return best
}

export function RoomModel({
  url,
  offset,
  onSlotsExtracted,
  knownSlotIds,
  lightmapUrl,
  lightmapIntensity = 1.0,
}: Props) {
  const gltf = useGLTF(url) as { scene: THREE.Group }
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene])
  const invalidate = useThree((s) => s.invalidate)

  const cbRef = useRef(onSlotsExtracted)
  cbRef.current = onSlotsExtracted

  const knownKey = (knownSlotIds ?? []).join('|')
  const knownIds = useMemo(() => knownSlotIds ?? [], [knownKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load the baked lightmap (sampled through UV2). ───────────────────────────
  const [lightmap, setLightmap] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    if (!lightmapUrl) {
      setLightmap(null)
      return
    }
    let cancelled = false
    const loader = new THREE.TextureLoader()
    loader.load(lightmapUrl, (tex) => {
      if (cancelled) {
        tex.dispose()
        return
      }
      tex.flipY = false // glTF convention
      tex.channel = 1 // read TEXCOORD_1 (the lightmap UV set)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.needsUpdate = true
      setLightmap(tex)
      invalidate()
    })
    return () => {
      cancelled = true
    }
  }, [lightmapUrl, invalidate])

  useEffect(() => {
    scene.updateMatrixWorld(true)

    const slotMap = new Map<string, {
      pos: THREE.Vector3
      w: number; h: number
      euler: THREE.Euler | null
      hasFrame: boolean
    }>()

    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      obj.castShadow    = false
      obj.receiveShadow = false
      obj.frustumCulled = true

      const mats     = Array.isArray(obj.material) ? obj.material : [obj.material]
      const isCanvas = mats.some((m) => m?.name === 'SlotCanvas' || m?.name?.endsWith('_SlotCanvas'))
      const isSlot   = obj.name.startsWith(VM_SLOT_PREFIX)

      if (!isSlot) {
        if (isCanvas) { obj.visible = false; return }
        // Architecture meshes carrying a 2nd UV set (uv1 = TEXCOORD_1) receive the
        // baked lightmap so they show Blender's light pools + shadows.
        const hasLightmapUv = obj.geometry.hasAttribute('uv1')
        mats.forEach((mat) => {
          if (!mat) return
          mat.side = THREE.DoubleSide
          if (mat instanceof THREE.MeshStandardMaterial && mat.metalness > 0.1)
            mat.metalness = 0
          if (lightmap && hasLightmapUv && 'lightMap' in mat) {
            const stdMat = mat as THREE.MeshStandardMaterial
            stdMat.lightMap = lightmap
            stdMat.lightMapIntensity = lightmapIntensity
          }
          mat.needsUpdate = true
        })
        return
      }

      // Map the (possibly suffixed) mesh name back to the JSON slot id so that the
      // frame + canvas primitives of the same node land in one entry.
      const slotId = resolveSlotId(obj.name, knownIds) ?? obj.name
      if (!slotMap.has(slotId)) {
        slotMap.set(slotId, { pos: new THREE.Vector3(), w: 1, h: 0.8, euler: null, hasFrame: false })
      }
      const entry = slotMap.get(slotId)!

      if (isCanvas) {
        obj.visible = false

        const posAttr = obj.geometry?.getAttribute('position')
        const nrmAttr = obj.geometry?.getAttribute('normal')
        if (posAttr) {
          // The slot tilt (leaning against the wall) is baked into the mesh
          // VERTICES — VM_Slot nodes export with identity rotation — so we must
          // derive the canvas basis from geometry, not from the node transform.
          const normalMat = new THREE.Matrix3().getNormalMatrix(obj.matrixWorld)

          // Outward normal (world space).
          const zAxis = nrmAttr
            ? new THREE.Vector3(nrmAttr.getX(0), nrmAttr.getY(0), nrmAttr.getZ(0))
                .applyMatrix3(normalMat).normalize()
            : new THREE.Vector3(0, 0, 1)

          // In-plane "up" = world-up projected onto the plane. For a canvas leaning
          // back, this tilts back with it; for a flat wall picture it stays vertical.
          const worldUp = new THREE.Vector3(0, 1, 0)
          const yAxis = worldUp.clone().addScaledVector(zAxis, -worldUp.dot(zAxis))
          if (yAxis.lengthSq() < 1e-6) yAxis.set(0, 1, 0) // fallback (horizontal plane)
          yAxis.normalize()
          const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize()

          // Measure width/height + centroid by projecting the world-space vertices
          // onto the plane basis (correct for any tilt).
          const v = new THREE.Vector3()
          const centroid = new THREE.Vector3()
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
          for (let i = 0; i < posAttr.count; i++) {
            v.fromBufferAttribute(posAttr, i).applyMatrix4(obj.matrixWorld)
            centroid.add(v)
            const px = v.dot(xAxis), py = v.dot(yAxis)
            if (px < minX) minX = px; if (px > maxX) maxX = px
            if (py < minY) minY = py; if (py > maxY) maxY = py
          }
          centroid.divideScalar(posAttr.count)

          entry.pos.copy(centroid)
          entry.w = maxX - minX
          entry.h = maxY - minY
          const m = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis)
          entry.euler = new THREE.Euler().setFromRotationMatrix(m)
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
      if (entry.euler === null) continue  // canvas not found for this slot
      extracted.push({
        id,
        hasBlenderFrame: entry.hasFrame,
        transform: {
          position: { x: entry.pos.x, y: entry.pos.y, z: entry.pos.z },
          rotation: { x: entry.euler.x, y: entry.euler.y, z: entry.euler.z },
          size:     { w: entry.w, h: entry.h },
        },
      })
    }

    if (extracted.length > 0) cbRef.current?.(extracted)
  }, [scene, knownIds, lightmap, lightmapIntensity])

  return <primitive object={scene} position={offset ?? [0, 0, 0]} />
}
