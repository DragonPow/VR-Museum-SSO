import { useEffect, useMemo, useRef, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { SlotTransform } from '@vm/shared'
import type { RoomBounds } from './NavController.js'

export const VM_SLOT_PREFIX = 'VM_Slot_'

/** Architecture meshes the visitor must not walk through. Matched by substring so
 *  three.js' `_1`/`_2` duplicate-name suffixes still hit. */
const COLLIDER_NAME_HINTS = ['CenterBlock']
/** Push walkable boundary this far (m) outside the mesh footprint — keeps the camera
 *  a comfortable distance from the wall instead of clipping right into it. */
const COLLIDER_MARGIN = 0.5
/** Small brightness lift on the baked atlas so the web reads as bright as the Blender
 *  (AgX) viewport instead of the slightly duller Reinhard bake. */
const ATLAS_BRIGHTEN = 1.08

/**
 * Floor material: the baked atlas carries the lighting, but its tile detail is
 * low-res and smeared. Overlay a crisp, world-axis-aligned grout grid (kept sharp
 * at any distance via fwidth anti-aliasing, so it never moires) plus a subtle
 * per-tile brightness variation, so the floor reads as clean square tiles that
 * line up with the (axis-aligned) walls. No re-bake needed -- pure shader work on
 * top of the already-baked colour.
 */
function makeTiledFloorMaterial(map: THREE.Texture, tint: THREE.Color): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({
    map, color: tint, side: THREE.DoubleSide, toneMapped: false,
  })
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTile = { value: 0.9 }        // tile size in metres (~1.8x, conference-tile feel)
    shader.uniforms.uGroutPx = { value: 0.7 }     // grout half-width in pixels (thinner line)
    shader.uniforms.uGroutDark = { value: 0.11 }  // grout darkening (soft grey, gentle)
    shader.uniforms.uSheen = { value: 0.18 }      // polished-floor grazing sheen (gloss)
    shader.uniforms.uClean = { value: 0.7 }       // desaturate the baked stone veins
    shader.uniforms.uMipBias = { value: 3.5 }     // sample atlas coarse -> blur fine veins
    shader.uniforms.uFlatten = { value: 0.55 }    // pull toward a uniform tone -> kills broad diagonal veins
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vVMWorld;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\n  vVMWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vVMWorld;\nuniform float uTile;\nuniform float uGroutPx;\nuniform float uGroutDark;\nuniform float uSheen;\nuniform float uClean;\nuniform float uMipBias;\nuniform float uFlatten;',
      )
      .replace(
        '#include <map_fragment>',
        [
          '#ifdef USE_MAP',
          '  diffuseColor *= texture2D( map, vMapUv, uMipBias );',
          '#endif',
          '{',
          '  float L = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));',
          '  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(L), uClean) * 1.07;',
          '  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62), uFlatten);',
          '  vec2 g = vVMWorld.xz / uTile;',
          '  vec2 fw = fwidth(g);',
          '  vec2 dist = (0.5 - abs(fract(g) - 0.5)) / max(fw, vec2(1e-5));',
          '  float line = min(dist.x, dist.y);',
          '  float grout = 1.0 - smoothstep(uGroutPx, uGroutPx + 1.0, line);',
          '  vec2 cell = floor(g);',
          '  float h = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);',
          '  diffuseColor.rgb *= (0.985 + 0.03 * h);',
          '  diffuseColor.rgb *= (1.0 - grout * uGroutDark);',
          '  vec3 V = normalize(cameraPosition - vVMWorld);',
          '  float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0);',
          '  diffuseColor.rgb += fres * uSheen;',
          '}',
        ].join('\n'),
      )
  }
  mat.customProgramCacheKey = () => 'vm-tiled-floor-v4'
  return mat
}

export interface ExtractedSlot {
  id: string
  transform: SlotTransform
  hasBlenderFrame: boolean
}

interface Props {
  url: string
  offset?: [number, number, number]
  onSlotsExtracted?: (slots: ExtractedSlot[]) => void
  /** Collision rectangles (XZ footprints) extracted from solid architecture meshes. */
  onObstaclesExtracted?: (obstacles: RoomBounds[]) => void
  /** Inner walkable rectangle derived from the room shell (perimeter walls). */
  onBoundsExtracted?: (bounds: RoomBounds) => void
  /** Slot ids declared in the room JSON, used to map GLB mesh names back to a
   *  canonical slot id (three.js appends _1/_2 suffixes to duplicate node names). */
  knownSlotIds?: string[]
  /** Baked lightmap URL (sampled through UV2 / TEXCOORD_1). */
  lightmapUrl?: string | null
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
  onObstaclesExtracted,
  onBoundsExtracted,
  knownSlotIds,
  lightmapUrl,
}: Props) {
  const gltf = useGLTF(url) as { scene: THREE.Group }
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene])
  const invalidate = useThree((s) => s.invalidate)

  const cbRef = useRef(onSlotsExtracted)
  cbRef.current = onSlotsExtracted
  const obstacleCbRef = useRef(onObstaclesExtracted)
  obstacleCbRef.current = onObstaclesExtracted
  const boundsCbRef = useRef(onBoundsExtracted)
  boundsCbRef.current = onBoundsExtracted

  const knownKey = (knownSlotIds ?? []).join('|')
  const knownIds = useMemo(() => knownSlotIds ?? [], [knownKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load the baked COMBINED atlas (full Blender render: albedo + light + GI +
  //    shadow, sampled through UV2). Shell meshes switch to MeshBasicMaterial and
  //    display this 1:1, so three.js does NO lighting of its own → pixel-identical
  //    to the Blender bake regardless of scene lights. ──────────────────────────
  const [bakedAtlas, setBakedAtlas] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    if (!lightmapUrl) {
      setBakedAtlas(null)
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
      tex.channel = 1 // read TEXCOORD_1 (the baked atlas UV set)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.needsUpdate = true
      setBakedAtlas(tex)
      invalidate()
    })
    return () => {
      cancelled = true
    }
  }, [lightmapUrl, invalidate])

  // ── Second baked atlas: the props (niche wood frames, plinth, display cases).
  //    Same idea as the shell atlas but its own UV2 packing, so it needs its own
  //    texture. Derived from lightmapUrl by filename convention. ────────────────
  const propsUrl = lightmapUrl ? lightmapUrl.replace('_combined', '_props') : null
  const [propsAtlas, setPropsAtlas] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    if (!propsUrl) {
      setPropsAtlas(null)
      return
    }
    let cancelled = false
    const loader = new THREE.TextureLoader()
    loader.load(
      propsUrl,
      (tex) => {
        if (cancelled) {
          tex.dispose()
          return
        }
        tex.flipY = false
        tex.channel = 1
        tex.colorSpace = THREE.SRGBColorSpace
        tex.needsUpdate = true
        setPropsAtlas(tex)
        invalidate()
      },
      undefined,
      () => {
        /* props atlas is optional — ignore if missing */
      },
    )
    return () => {
      cancelled = true
    }
  }, [propsUrl, invalidate])

  useEffect(() => {
    scene.updateMatrixWorld(true)

    const slotMap = new Map<string, {
      pos: THREE.Vector3
      w: number; h: number
      euler: THREE.Euler | null
      hasFrame: boolean
    }>()
    const obstacles: RoomBounds[] = []
    // Accumulate the room-shell footprint (perimeter walls) to derive walkable bounds.
    let archMinX = Infinity, archMaxX = -Infinity, archMinZ = Infinity, archMaxZ = -Infinity

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
        // Blue dado (skirting): render as a flat UNLIT colour so it matches the baked
        // walls and stays light like the Blender view, instead of a dark, lighting-
        // dependent PBR band. Colour comes from the mesh's own material.
        if (obj.name.startsWith('TT_Dado')) {
          // Capture the ORIGINAL base colour ONCE. This effect re-runs when the async
          // lightmap atlases arrive (and twice under <StrictMode> in dev), so reading
          // the LIVE material every time would re-soften an already-softened colour —
          // compounding the desaturation by a different amount in dev vs prod, which is
          // why the dado looked paler on localhost than on the deploys. Always derive
          // from the stored base colour so the result is identical everywhere (1 pass).
          const m0 = Array.isArray(obj.material) ? obj.material[0] : obj.material
          const base = (obj.userData.dadoBase as THREE.Color | undefined)
            ?? ((m0 as THREE.MeshStandardMaterial | undefined)?.color?.clone()
              ?? new THREE.Color('#7f97b5'))
          obj.userData.dadoBase = base
          const col = base.clone()
          // Soften the vivid PBR blue toward the pale Blender look: desaturate toward
          // its own luminance, then lift slightly so it's a soft powder blue.
          const lum = 0.2126 * col.r + 0.7152 * col.g + 0.0722 * col.b
          const SAT = 0.6, LIFT = 0.82
          col.setRGB(
            Math.min(1, (lum + (col.r - lum) * SAT) * LIFT),
            Math.min(1, (lum + (col.g - lum) * SAT) * LIFT),
            Math.min(1, (lum + (col.b - lum) * SAT) * LIFT),
          )
          obj.material = new THREE.MeshBasicMaterial({
            color: col, side: THREE.DoubleSide, toneMapped: false,
          })
          return
        }
        // Solid architecture (e.g. the freestanding center block) becomes a walkable
        // obstacle so the camera can't pass through it.
        if (COLLIDER_NAME_HINTS.some((h) => obj.name.includes(h))) {
          const box = new THREE.Box3().setFromObject(obj)
          if (isFinite(box.min.x) && isFinite(box.min.z)) {
            obstacles.push({
              minX: box.min.x - COLLIDER_MARGIN, maxX: box.max.x + COLLIDER_MARGIN,
              minZ: box.min.z - COLLIDER_MARGIN, maxZ: box.max.z + COLLIDER_MARGIN,
            })
          }
        }
        // The room shell (perimeter walls / floor / ceiling) defines how far the
        // visitor can walk. Grow the walkable footprint from its real extent so the
        // outer walls actually contain the camera (was derived from slot positions,
        // which could reach past the walls).
        if (obj.name.includes('Architecture')) {
          const abox = new THREE.Box3().setFromObject(obj)
          if (isFinite(abox.min.x) && isFinite(abox.min.z)) {
            if (abox.min.x < archMinX) archMinX = abox.min.x
            if (abox.max.x > archMaxX) archMaxX = abox.max.x
            if (abox.min.z < archMinZ) archMinZ = abox.min.z
            if (abox.max.z > archMaxZ) archMaxZ = abox.max.z
          }
        }
        // Free-standing dividers that form the U-bays (khu 1-4). A single mesh holds
        // all fins, so split it into one collision box per fin (gap-clustered along
        // its long axis) — a single AABB would wall off the whole bay strip and stop
        // the visitor entering the bays at all.
        if (obj.name.includes('AlcoveComb')) {
          const pos = obj.geometry.getAttribute('position')
          if (pos) {
            const p = new THREE.Vector3()
            const xs: number[] = [], zs: number[] = []
            let bxMin = Infinity, bxMax = -Infinity, bzMin = Infinity, bzMax = -Infinity
            for (let i = 0; i < pos.count; i++) {
              p.fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld)
              xs.push(p.x); zs.push(p.z)
              if (p.x < bxMin) bxMin = p.x; if (p.x > bxMax) bxMax = p.x
              if (p.z < bzMin) bzMin = p.z; if (p.z > bzMax) bzMax = p.z
            }
            // The fins are spread along the room's long axis and thin across it.
            const sepAlongZ = (bzMax - bzMin) >= (bxMax - bxMin)
            const sep = (sepAlongZ ? zs : xs).slice().sort((a, b) => a - b)
            const GAP = 0.6 // fin thickness < GAP < spacing between fins
            const groups: Array<[number, number]> = []
            let lo = sep[0] ?? 0
            let prev = lo
            for (const val of sep) {
              if (val - prev > GAP) { groups.push([lo, prev]); lo = val }
              prev = val
            }
            if (sep.length > 0) groups.push([lo, prev])
            for (const [g0, g1] of groups) {
              obstacles.push(
                sepAlongZ
                  ? { minX: bxMin - COLLIDER_MARGIN, maxX: bxMax + COLLIDER_MARGIN,
                      minZ: g0 - COLLIDER_MARGIN, maxZ: g1 + COLLIDER_MARGIN }
                  : { minX: g0 - COLLIDER_MARGIN, maxX: g1 + COLLIDER_MARGIN,
                      minZ: bzMin - COLLIDER_MARGIN, maxZ: bzMax + COLLIDER_MARGIN },
              )
            }
          }
        }
        // Architecture meshes carrying a 2nd UV set (uv1 = TEXCOORD_1) get the baked
        // Combined atlas as an unlit material — pixel-identical to the Blender render.
        const hasLightmapUv = obj.geometry.hasAttribute('uv1')
        // Two separate baked atlases, each with its OWN UV2 packing:
        //  · shell  → walls / floor / ceiling / fins / centre block / red niche
        //  · props  → niche wood frames, plinth, display cases
        // A mesh must sample the atlas its UV2 was packed into, so route by name.
        const isProp =
          obj.name.startsWith('TT_Niche_Frame') ||
          obj.name === 'TT_Niche_Plinth' ||
          obj.name.startsWith('TT_Display_Case_')
        const atlas = isProp ? propsAtlas : bakedAtlas

        if (atlas && hasLightmapUv) {
          // Unlit MeshBasicMaterial showing the baked atlas 1:1 (matches the Blender
          // render exactly). No scene light touches it — the atlas already contains
          // all lighting, shadows and GI.
          // Floor tiles read almost identical to the warm walls — give the tile plane a
          // slightly cooler + darker tint so it's distinguishable (kept subtle).
          // The baked atlas was already tone-mapped in Blender (Reinhard on the raw
          // Cycles bake), so keep toneMapped:false to avoid a second (AgX) pass.
          // Per material slot: the floor tile slot gets a crisp procedural grout grid;
          // walls / ceiling stay on the plain baked atlas.
          const wallTint = new THREE.Color(ATLAS_BRIGHTEN, ATLAS_BRIGHTEN, ATLAS_BRIGHTEN)
          const floorTint = new THREE.Color(ATLAS_BRIGHTEN * 0.88, ATLAS_BRIGHTEN * 0.91, ATLAS_BRIGHTEN * 0.97)
          const isTileMat = (m?: THREE.Material | null) =>
            m != null && m.name != null && /tile/i.test(m.name)
          const makeShell = (isTile: boolean) =>
            isTile
              ? makeTiledFloorMaterial(atlas, floorTint)
              : new THREE.MeshBasicMaterial({
                  map: atlas, color: wallTint, side: THREE.DoubleSide, toneMapped: false,
                })
          // This effect re-runs when each async atlas arrives, so the replacement
          // materials must KEEP the original slot name -- otherwise the /tile/ check
          // fails on the 2nd pass and the floor slot gets overwritten with the plain
          // wall material (which is exactly why the grid disappeared).
          const named = (mat: THREE.Material, src?: THREE.Material | null) => {
            mat.name = src?.name ?? ''
            return mat
          }
          obj.material = Array.isArray(obj.material)
            ? obj.material.map((m) => named(makeShell(isTileMat(m)), m))
            : named(makeShell(isTileMat(obj.material as THREE.Material)), obj.material as THREE.Material)
        } else {
          mats.forEach((mat) => {
            if (!mat) return
            mat.side = THREE.DoubleSide
            if (mat instanceof THREE.MeshStandardMaterial && mat.metalness > 0.1)
              mat.metalness = 0
            mat.needsUpdate = true
          })
        }
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
        // The wide hero banner shares CR_Frame with all 119 frames — give ITS frame a
        // dedicated dark, sleek material so the premium banner isn't boxed in a brown
        // picture frame, WITHOUT touching the other 118 frames.
        if (slotId === 'VM_Slot_TT_9000') {
          const base = (Array.isArray(obj.material) ? obj.material[0] : obj.material) as
            | THREE.MeshStandardMaterial
            | undefined
          if (base) {
            const m = base.clone()
            m.color = new THREE.Color(0.05, 0.05, 0.06)
            m.metalness = 0
            m.roughness = 0.5
            m.needsUpdate = true
            obj.material = m
          }
          return
        }
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
    obstacleCbRef.current?.(obstacles)
    if (isFinite(archMinX) && isFinite(archMinZ)) {
      boundsCbRef.current?.({ minX: archMinX, maxX: archMaxX, minZ: archMinZ, maxZ: archMaxZ })
    }
  }, [scene, knownIds, bakedAtlas, propsAtlas])

  return <primitive object={scene} position={offset ?? [0, 0, 0]} />
}
