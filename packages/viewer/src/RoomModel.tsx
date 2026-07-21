import { useEffect, useMemo, useRef, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { SlotTransform } from '@vm/shared'
import type { RoomBounds } from './NavController.js'

export const VM_SLOT_PREFIX = 'VM_Slot_'

/** Zone-title pill meshes baked into the GLB (`TT_TitlePill_K*` + `TT_TitlePill_Text_K*`).
 *  Hidden at runtime and re-rendered as crisp code text — see ZoneTitle / zoneTitles. */
export const TITLE_PILL_PREFIX = 'TT_TitlePill_'

/** Architecture meshes the visitor must not walk through. Matched by substring so
 *  three.js' `_1`/`_2` duplicate-name suffixes still hit. */
const COLLIDER_NAME_HINTS = ['CenterBlock', 'Display_Case', 'VM_Display', 'Niche_Plinth', 'Hero_Cabinet', 'TT_Right_Alcove']
/** Push walkable boundary this far (m) outside the mesh footprint â€” keeps the camera
 *  a comfortable distance from the wall instead of clipping right into it. */
const COLLIDER_MARGIN = 0.5
// NavController expands obstacles by PLAYER_RADIUS (0.32m). Wall-like interior
// dividers use this shared margin to stay readable up close while keeping the
// camera from clipping through thin walls and exposing their outside faces.
const INTERIOR_WALL_COLLIDER_MARGIN = 0.08
/** Small brightness lift on the baked atlas so the web reads as bright as the Blender
 *  (AgX) viewport instead of the slightly duller Reinhard bake. */
const ATLAS_BRIGHTEN = 1.08

/**
 * Atlas luminance that counts as "fully lit" for the floor: `light = clamp(L / FLOOR_ATLAS_REF, 0.74, 1.04)`.
 *
 * This is a NORMALISER, not a dimmer -- it must match the actual bright end of the floor
 * island in the lightmap atlas, otherwise the floor can never reach its true tile colour.
 * Derived from the p97 of the floor island in `truyenthong_combined.webp`.
 *
 * The previous value (0.72) was tuned for an older atlas: against the current bake the floor
 * peaks at L=0.686, so every floor pixel came out 7-13% dark and the 1.04 headroom was
 * unreachable (0.00% of pixels). Dimming is `floorTint`'s job, not this constant's.
 *
 * !! RE-MEASURE AFTER EVERY REBAKE: p97 of the floor island's luminance (0.2126/0.7152/0.0722),
 * measured on the atlas core with the black UV gutters excluded.
 */
const FLOOR_ATLAS_REF = 0.675
// Toggle for the experimental clean-wall shader. Keep this false for the current
// room so the baked lightmap shadows/ceiling gradients stay visible like cloud.
const USE_CLEAN_WALL_SHADER = false

/**
 * Floor material: Marble021 projected from world X/Z, with a crisp grout grid. Using
 * world projection keeps the tile lines square to the room even if the Blender UV0
 * gets skewed during modelling/export.
 */
function makeTiledFloorMaterial(
  map: THREE.Texture,
  tileDiff: THREE.Texture | null,
  tileNor: THREE.Texture | null,
  tint: THREE.Color,
): THREE.MeshBasicMaterial {
  if (!tileDiff) {
    return new THREE.MeshBasicMaterial({ map, color: tint, side: THREE.DoubleSide, toneMapped: false })
  }
  const mat = new THREE.MeshBasicMaterial({ map, color: tint, side: THREE.DoubleSide, toneMapped: false })
  const hasNor = !!tileNor
  mat.onBeforeCompile = (shader) => {
    // Sample Marble021 in world space so tile seams stay perpendicular to the walls.
    // The baked atlas still supplies the room's soft light/shadow.
    shader.uniforms.uTileDiff = { value: tileDiff }
    shader.uniforms.uMipBias = { value: 2.0 }
    shader.uniforms.uRef = { value: FLOOR_ATLAS_REF }
    shader.uniforms.uSheen = { value: 0.045 }
    shader.uniforms.uTileSize = { value: 1.42 }
    shader.uniforms.uGroutWidth = { value: 0.006 }
    shader.uniforms.uGroutColor = { value: new THREE.Color(0.55, 0.52, 0.47) }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vVMWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vVMWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    const commonLines = [
      '#include <common>',
      'varying vec3 vVMWorld;',
      'uniform sampler2D uTileDiff;',
      'uniform float uMipBias;',
      'uniform float uRef;',
      'uniform float uSheen;',
      'uniform float uTileSize;',
      'uniform float uGroutWidth;',
      'uniform vec3 uGroutColor;',
    ]
    const body = [
      '#ifdef USE_MAP',
      '  vec4 lit = texture2D( map, vMapUv, uMipBias );',
      '#else',
      '  vec4 lit = vec4(0.7);',
      '#endif',
      '{',
      '  vec2 floorUv = vVMWorld.xz / uTileSize;',
      '  vec3 tileCol = texture2D(uTileDiff, floorUv).rgb;',
      '  vec2 cell = fract(floorUv);',
      '  vec2 edge2 = min(cell, 1.0 - cell);',
      '  float edge = min(edge2.x, edge2.y);',
      '  float aa = max(fwidth(floorUv.x), fwidth(floorUv.y));',
      '  float grout = 1.0 - smoothstep(uGroutWidth, uGroutWidth + aa * 1.6, edge);',
      '  float L = dot(lit.rgb, vec3(0.2126, 0.7152, 0.0722));',
      '  float light = clamp(L / uRef, 0.74, 1.04);',
      '  vec3 col = tileCol * light * diffuse;',
      '  col = mix(col, uGroutColor * light, grout * 0.35);',
    ]
    if (hasNor) {
      shader.uniforms.uTileNor = { value: tileNor }
      shader.uniforms.uBumpStrength = { value: 0.7 }
      shader.uniforms.uLightDir = { value: new THREE.Vector2(-0.45, 0.7) }
      commonLines.push('uniform sampler2D uTileNor;', 'uniform float uBumpStrength;', 'uniform vec2 uLightDir;')
      body.push(
        '  vec3 tn = texture2D(uTileNor, floorUv).xyz * 2.0 - 1.0;',
        '  float shade = 1.0 + (tn.x * uLightDir.x + tn.y * uLightDir.y) * uBumpStrength;',
        '  col *= clamp(shade, 0.78, 1.22);',
      )
    }
    body.push(
      '  vec3 V = normalize(cameraPosition - vVMWorld);',
      '  float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0);',
      '  col += fres * uSheen * 0.55;',
      '  diffuseColor.rgb = col;',
      '}',
    )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', commonLines.join('\n'))
      .replace('#include <map_fragment>', body.join('\n'))
  }
  mat.customProgramCacheKey = () => (hasNor ? 'vm-tilefloor-world-v2' : 'vm-tilefloor-world-nonor-v2')
  return mat
}

/**
 * Wall/ceiling material: shows the baked atlas but LIFTS the shadows toward white so
 * the shell reads bright & fresh like the Blender (Eevee) view, instead of the duller
 * grey of the raw Reinhard-tonemapped Cycles bake. Pure shader, no re-bake.
 */

function makeWallMaterial(
  map: THREE.Texture,
  tint: THREE.Color,
  normalTex?: THREE.Texture | null,
): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({ map, color: tint, side: THREE.DoubleSide, toneMapped: false })
  const hasBump = !!normalTex
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uLift = { value: 0.3 }
    shader.uniforms.uCream = { value: new THREE.Color(1.0, 0.955, 0.875) }
    const commonLines = ['#include <common>', 'uniform float uLift;', 'uniform vec3 uCream;']
    const mapLines = [
      '#include <map_fragment>',
      '  diffuseColor.rgb = uCream - (uCream - diffuseColor.rgb) * (1.0 - uLift);',
    ]
    if (hasBump) {
      // Real wall relief: sample the Blender wall normal map (beige_wall_001) at the
      // model's original UV0 and shade it against a fixed light dir -> the plaster
      // "nham" the low-res baked atlas cannot hold. Multiply averages ~1.0 (keeps colour).
      shader.uniforms.uWallNor = { value: normalTex }
      shader.uniforms.uBumpStrength = { value: 0.78 }
      shader.uniforms.uLightDir = { value: new THREE.Vector2(-0.45, 0.7) }
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vWallUv0;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\n  vWallUv0 = uv;')
      commonLines.push(
        'varying vec2 vWallUv0;',
        'uniform sampler2D uWallNor;',
        'uniform float uBumpStrength;',
        'uniform vec2 uLightDir;',
      )
      mapLines.push(
        '  {',
        '    vec3 wn = texture2D(uWallNor, vWallUv0).xyz * 2.0 - 1.0;',
        '    float shade = 1.0 + (wn.x * uLightDir.x + wn.y * uLightDir.y) * uBumpStrength;',
        '    diffuseColor.rgb *= clamp(shade, 0.78, 1.22);',
        '  }',
      )
    }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', commonLines.join('\n'))
      .replace('#include <map_fragment>', mapLines.join('\n'))
  }
  mat.customProgramCacheKey = () => (hasBump ? 'vm-wall-bump-v1' : 'vm-wall-lift-v7')
  return mat
}


function getMaterialColor(mat: THREE.Material | null | undefined): THREE.Color {
  const maybeColor = (mat as THREE.Material & { color?: THREE.Color })?.color
  return maybeColor instanceof THREE.Color ? maybeColor.clone() : new THREE.Color(1, 1, 1)
}

function getMaterialMap(mat: THREE.Material | null | undefined): THREE.Texture | null {
  const maybeMap = (mat as THREE.Material & { map?: THREE.Texture | null })?.map
  return maybeMap ?? null
}

function makeOriginalUnlitMaterial(mat: THREE.Material | null | undefined): THREE.MeshBasicMaterial {
  const original = mat as (THREE.Material & {
    color?: THREE.Color
    map?: THREE.Texture | null
    opacity?: number
  }) | null | undefined
  const opacity = original?.opacity ?? 1
  const result = new THREE.MeshBasicMaterial({
    color: getMaterialColor(original),
    map: getMaterialMap(original),
    side: THREE.DoubleSide,
    transparent: original?.transparent === true || opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
    toneMapped: false,
  })
  result.name = original?.name ?? ''
  return result
}

function originalMaterialsFor(obj: THREE.Mesh): THREE.Material[] {
  const existing = obj.userData.vmOriginalMaterials as THREE.Material[] | undefined
  if (existing) return existing

  const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
  const originals = mats
    .filter((mat): mat is THREE.Material => Boolean(mat))
    .map((mat) => mat.clone())
  obj.userData.vmOriginalMaterials = originals
  return originals
}

function applyOriginalUnlitMaterial(obj: THREE.Mesh): void {
  const originals = originalMaterialsFor(obj)
  obj.material = Array.isArray(obj.material)
    ? obj.material.map((_mat, index) => makeOriginalUnlitMaterial(originals[index] ?? originals[0]))
    : makeOriginalUnlitMaterial(originals[0])
}


const HONOR_DARK_WOOD_COLOR = new THREE.Color('#6b2c17')
const HONOR_RED_COLOR = new THREE.Color('#9f241b')

function makeWarmWoodMaterial(mat: THREE.Material | null | undefined, fallback = HONOR_DARK_WOOD_COLOR): THREE.MeshBasicMaterial {
  const original = mat as (THREE.Material & {
    color?: THREE.Color
    map?: THREE.Texture | null
    opacity?: number
  }) | null | undefined
  const opacity = original?.opacity ?? 1
  const map = getMaterialMap(original)
  const result = new THREE.MeshBasicMaterial({
    color: map ? new THREE.Color(1, 1, 1) : fallback.clone(),
    map,
    side: THREE.DoubleSide,
    transparent: original?.transparent === true || opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
    toneMapped: false,
  })
  result.name = original?.name ?? ''
  return result
}

function applyWarmWoodMaterial(obj: THREE.Mesh): void {
  const originals = originalMaterialsFor(obj)
  const materialFor = (original: THREE.Material | undefined) => {
    const name = original?.name ?? ''
    const fallback = HONOR_DARK_WOOD_COLOR
    return makeWarmWoodMaterial(original, fallback)
  }

  obj.material = Array.isArray(obj.material)
    ? obj.material.map((_mat, index) => materialFor(originals[index] ?? originals[0]))
    : materialFor(originals[0])
}

function applyPolygonOffset(obj: THREE.Mesh, factor: number, units: number): void {
  const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
  materials.forEach((mat) => {
    if (!mat) return
    mat.polygonOffset = true
    mat.polygonOffsetFactor = factor
    mat.polygonOffsetUnits = units
    mat.needsUpdate = true
  })
}


function makeInvisibleMaterial(name = ''): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    colorWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  })
  mat.name = name
  return mat
}

function applyOriginalSlotMaterials(obj: THREE.Mesh): void {
  const originals = originalMaterialsFor(obj)
  const materialFor = (original: THREE.Material | undefined) => {
    const name = original?.name ?? ''
    if (name === 'SlotCanvas' || name.endsWith('_SlotCanvas')) return makeInvisibleMaterial(name)
    return makeOriginalUnlitMaterial(original)
  }

  obj.material = Array.isArray(obj.material)
    ? obj.material.map((_mat, index) => materialFor(originals[index] ?? originals[0]))
    : materialFor(originals[0])
}


function applyInvisibleMaterials(obj: THREE.Mesh): void {
  obj.material = Array.isArray(obj.material)
    ? obj.material.map((mat) => makeInvisibleMaterial(mat?.name ?? ''))
    : makeInvisibleMaterial((obj.material as THREE.Material | undefined)?.name ?? '')
}


function slotCanvasVertexIndices(obj: THREE.Mesh, originals: THREE.Material[]): number[] | null {
  const geometry = obj.geometry
  const posAttr = geometry.getAttribute('position')
  if (!posAttr) return null

  const indexAttr = geometry.index
  const result: number[] = []
  for (const group of geometry.groups) {
    const matName = originals[group.materialIndex ?? 0]?.name ?? ''
    if (matName !== 'SlotCanvas' && !matName.endsWith('_SlotCanvas')) continue

    for (let i = group.start; i < group.start + group.count; i++) {
      const vertexIndex = indexAttr ? indexAttr.getX(i) : i
      result.push(vertexIndex)
    }
  }

  return result.length > 0 ? Array.from(new Set(result)) : null
}

export interface ExtractedSlot {
  id: string
  transform: SlotTransform
  hasBlenderFrame: boolean
}

/** Anchor for a code-rendered zone title, extracted from the baked pill mesh. */
export interface TitleAnchor {
  zoneKey: string
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  pillWidth: number
}

interface Props {
  url: string
  offset?: [number, number, number]
  onSlotsExtracted?: (slots: ExtractedSlot[]) => void
  /** Zone-title pill anchors (position + wall-facing orientation) extracted from
   *  the GLB so titles can be re-rendered as crisp code text. */
  onTitleAnchorsExtracted?: (anchors: TitleAnchor[]) => void
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
 * `<name>_1`, `<name>_2`â€¦ so a runtime mesh is called e.g. `VM_Slot_K8_CD_01_2`.
 * Resolve it back to the JSON slot id (`VM_Slot_K8_CD_01`) by longest-prefix match.
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
  onTitleAnchorsExtracted,
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
  const titleCbRef = useRef(onTitleAnchorsExtracted)
  titleCbRef.current = onTitleAnchorsExtracted

  const knownKey = (knownSlotIds ?? []).join('|')
  const knownIds = useMemo(() => knownSlotIds ?? [], [knownKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // â”€â”€ Load the baked COMBINED atlas (full Blender render: albedo + light + GI +
  //    shadow, sampled through UV2). Shell meshes switch to MeshBasicMaterial and
  //    display this 1:1, so three.js does NO lighting of its own â†’ pixel-identical
  //    to the Blender bake regardless of scene lights. â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Second baked atlas: the props (niche wood frames, plinth, display cases).
  //    Same idea as the shell atlas but its own UV2 packing, so it needs its own
  //    texture. Derived from lightmapUrl by filename convention. â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        /* props atlas is optional â€” ignore if missing */
      },
    )
    return () => {
      cancelled = true
    }
  }, [propsUrl, invalidate])

  // â”€â”€ Floor marble tile texture (Marble021) â€” tiled per 0.8 m in the floor shader. â”€â”€
  const floorTileUrl = lightmapUrl ? lightmapUrl.replace('_combined', '_floortile') : null
  const [floorTileTex, setFloorTileTex] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    if (!floorTileUrl) {
      setFloorTileTex(null)
      return
    }
    let cancelled = false
    new THREE.TextureLoader().load(
      floorTileUrl,
      (tex) => {
        if (cancelled) {
          tex.dispose()
          return
        }
        tex.wrapS = THREE.RepeatWrapping
        tex.wrapT = THREE.RepeatWrapping
        tex.colorSpace = THREE.SRGBColorSpace
        tex.anisotropy = 8
        tex.needsUpdate = true
        setFloorTileTex(tex)
        invalidate()
      },
      undefined,
      () => {
        /* floor tile texture is optional */
      },
    )
    return () => {
      cancelled = true
    }
  }, [floorTileUrl, invalidate])

  const wallNorUrl = lightmapUrl ? lightmapUrl.replace('_combined', '_wall_nor') : null
  const [wallNorTex, setWallNorTex] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    if (!wallNorUrl) {
      setWallNorTex(null)
      return
    }
    let cancelled = false
    new THREE.TextureLoader().load(
      wallNorUrl,
      (tex) => {
        if (cancelled) {
          tex.dispose()
          return
        }
        tex.wrapS = THREE.RepeatWrapping
        tex.wrapT = THREE.RepeatWrapping
        tex.colorSpace = THREE.NoColorSpace
        tex.anisotropy = 8
        tex.needsUpdate = true
        setWallNorTex(tex)
        invalidate()
      },
      undefined,
      () => {
        /* wall normal texture is optional */
      },
    )
    return () => {
      cancelled = true
    }
  }, [wallNorUrl, invalidate])

  const floorNorUrl = lightmapUrl ? lightmapUrl.replace('_combined', '_floor_nor') : null
  const [floorNorTex, setFloorNorTex] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    if (!floorNorUrl) {
      setFloorNorTex(null)
      return
    }
    let cancelled = false
    new THREE.TextureLoader().load(
      floorNorUrl,
      (tex) => {
        if (cancelled) {
          tex.dispose()
          return
        }
        tex.wrapS = THREE.RepeatWrapping
        tex.wrapT = THREE.RepeatWrapping
        tex.colorSpace = THREE.NoColorSpace
        tex.anisotropy = 8
        tex.needsUpdate = true
        setFloorNorTex(tex)
        invalidate()
      },
      undefined,
      () => {
        /* floor normal texture is optional */
      },
    )
    return () => {
      cancelled = true
    }
  }, [floorNorUrl, invalidate])

  useEffect(() => {
    scene.updateMatrixWorld(true)

    const slotMap = new Map<string, {
      pos: THREE.Vector3
      w: number; h: number
      euler: THREE.Euler | null
      hasFrame: boolean
    }>()
    const obstacles: RoomBounds[] = []
    const titleAnchors: TitleAnchor[] = []
    const titleRaw: Array<{
      zoneKey: string
      centroid: THREE.Vector3
      xAxis: THREE.Vector3
      yAxis: THREE.Vector3
      zAxis: THREE.Vector3
      pillWidth: number
    }> = []
    // Accumulate the room-shell footprint (perimeter walls) to derive walkable bounds.
    let archMinX = Infinity, archMaxX = -Infinity, archMinZ = Infinity, archMaxZ = -Infinity
    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      obj.castShadow = false
      obj.receiveShadow = false
      obj.frustumCulled = true
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      const isCanvas = mats.some((m) => m?.name === 'SlotCanvas' || m?.name?.endsWith('_SlotCanvas'))
      const isSlot = obj.name.startsWith(VM_SLOT_PREFIX)

      if (!isSlot) {
        if (isCanvas) { obj.visible = false; return }

        // Zone-title pills (TT_TitlePill_K*, TT_TitlePill_Text_K*) are baked into the
        // GLB. Hide them and re-render each title in code (crisp <Text> + auto-sizing
        // pill) so titles are editable without a Blender re-export. From the pill
        // BACKGROUND mesh, extract its centre + wall-facing basis as the code anchor.
        if (obj.name.startsWith(TITLE_PILL_PREFIX)) {
          obj.visible = false
          const m = obj.name.startsWith(TITLE_PILL_PREFIX + 'Text') ? null : obj.name.match(/_K(\d+)/)
          const posAttr = (obj as THREE.Mesh).geometry?.getAttribute('position')
          if (m && posAttr) {
            const nrmAttr = (obj as THREE.Mesh).geometry?.getAttribute('normal')
            const normalMat = new THREE.Matrix3().getNormalMatrix(obj.matrixWorld)
            const zAxis = nrmAttr
              ? new THREE.Vector3(nrmAttr.getX(0), nrmAttr.getY(0), nrmAttr.getZ(0)).applyMatrix3(normalMat).normalize()
              : new THREE.Vector3(0, 0, 1)
            const worldUp = new THREE.Vector3(0, 1, 0)
            const yAxis = worldUp.clone().addScaledVector(zAxis, -worldUp.dot(zAxis))
            if (yAxis.lengthSq() < 1e-6) yAxis.set(0, 1, 0)
            yAxis.normalize()
            const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize()
            const v = new THREE.Vector3()
            const centroid = new THREE.Vector3()
            let minPx = Infinity, maxPx = -Infinity
            for (let i = 0; i < posAttr.count; i++) {
              v.fromBufferAttribute(posAttr, i).applyMatrix4(obj.matrixWorld)
              centroid.add(v)
              const px = v.dot(xAxis)
              if (px < minPx) minPx = px
              if (px > maxPx) maxPx = px
            }
            centroid.divideScalar(posAttr.count)
            // Facing is finalised AFTER the traverse, once the room-shell bounds are
            // known: the pill mesh normal is unreliable (some point into the wall).
            titleRaw.push({
              zoneKey: 'K' + m[1],
              centroid: centroid.clone(),
              xAxis: xAxis.clone(),
              yAxis: yAxis.clone(),
              zAxis: zAxis.clone(),
              pillWidth: maxPx - minPx,
            })
          }
          return
        }
        // Blue dado (skirting): render as a flat UNLIT colour so it matches the baked
        // walls and stays light like the Blender view, instead of a dark, lighting-
        // dependent PBR band. Colour comes from the mesh's own material.
        if (obj.name.startsWith('TT_Dado')) {
          // Capture the ORIGINAL base colour ONCE. This effect re-runs when the async
          // lightmap atlases arrive (and twice under <StrictMode> in dev), so reading
          // the LIVE material every time would re-soften an already-softened colour â€”
          // compounding the desaturation by a different amount in dev vs prod, which is
          // why the dado looked paler on localhost than on the deploys. Always derive
          // from the stored base colour so the result is identical everywhere (1 pass).
          // Rich royal-blue skirting to match the reference render (raw NSMO_Blue_Dado
          // reads pale and the earlier desaturation washed it out further). Flat UNLIT
          // colour so it is identical everywhere in one pass.
          const DADO_BLUE = new THREE.Color('#0057a8')
          obj.material = new THREE.MeshBasicMaterial({
            color: DADO_BLUE, side: THREE.DoubleSide, toneMapped: false,
          })
          return
        }
        // Solid architecture (e.g. the freestanding center block) becomes a walkable
        // obstacle so the camera can't pass through it.
        if (COLLIDER_NAME_HINTS.some((h) => obj.name.includes(h))) {
          const box = new THREE.Box3().setFromObject(obj)
          const margin = obj.name.includes('CenterBlock')
            ? INTERIOR_WALL_COLLIDER_MARGIN
            : COLLIDER_MARGIN
          if (isFinite(box.min.x) && isFinite(box.min.z)) {
            obstacles.push({
              minX: box.min.x - margin, maxX: box.max.x + margin,
              minZ: box.min.z - margin, maxZ: box.max.z + margin,
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
        // its long axis) â€” a single AABB would wall off the whole bay strip and stop
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
                  ? {
                    minX: bxMin - INTERIOR_WALL_COLLIDER_MARGIN, maxX: bxMax + INTERIOR_WALL_COLLIDER_MARGIN,
                    minZ: g0 - INTERIOR_WALL_COLLIDER_MARGIN, maxZ: g1 + INTERIOR_WALL_COLLIDER_MARGIN
                  }
                  : {
                    minX: g0 - INTERIOR_WALL_COLLIDER_MARGIN, maxX: g1 + INTERIOR_WALL_COLLIDER_MARGIN,
                    minZ: bzMin - INTERIOR_WALL_COLLIDER_MARGIN, maxZ: bzMax + INTERIOR_WALL_COLLIDER_MARGIN
                  },
              )
            }
          }
        }
        if (obj.name.startsWith('TT_Niche_Frame') || obj.name === 'TT_Niche_Plinth') {
          applyWarmWoodMaterial(obj)
          if (obj.name.startsWith('TT_Niche_Frame')) applyPolygonOffset(obj, -1, -1)
          return
        }
        if (obj.name.startsWith('TT_Niche_Red_')) {
          const redMat = new THREE.MeshBasicMaterial({
            color: HONOR_RED_COLOR,
            side: THREE.DoubleSide,
            toneMapped: false,
          })
          redMat.polygonOffset = true
          redMat.polygonOffsetFactor = 1
          redMat.polygonOffsetUnits = 1
          obj.material = redMat
          return
        }
        if (obj.name === 'TT_Niche_Glass') {
          obj.visible = false
          return
        }
        if (obj.name.startsWith('TT_Display_Case_') && obj.name.endsWith('_Glass')) {
          const glassMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color('#d7e8ee'),
            transparent: true,
            opacity: 0.18,
            depthWrite: false,
            side: THREE.FrontSide,
            toneMapped: false,
          })
          glassMat.polygonOffset = true
          glassMat.polygonOffsetFactor = -1
          glassMat.polygonOffsetUnits = -1
          obj.material = glassMat
          obj.renderOrder = 10
          return
        }
        if (obj.name.startsWith('TT_Display_Case_')) {
          applyOriginalUnlitMaterial(obj)
          applyPolygonOffset(obj, 1, 1)
          return
        }

        // Architecture meshes carrying a 2nd UV set (uv1 = TEXCOORD_1) get the baked
        // Combined atlas as an unlit material â€” pixel-identical to the Blender render.
        const hasLightmapUv = obj.geometry.hasAttribute('uv1')
        // Two separate baked atlases, each with its OWN UV2 packing:
        //  Â· shell  â†’ walls / floor / ceiling / fins / centre block / red niche
        //  Â· props  â†’ niche wood frames, plinth, display cases
        // A mesh must sample the atlas its UV2 was packed into, so route by name.
        const isProp = false
        const atlas = isProp ? propsAtlas : bakedAtlas

        if (atlas && hasLightmapUv) {
          // Unlit MeshBasicMaterial showing the baked atlas 1:1 (matches the Blender
          // render exactly). No scene light touches it â€” the atlas already contains
          // all lighting, shadows and GI.
          // Floor tiles read almost identical to the warm walls â€” give the tile plane a
          // slightly cooler + darker tint so it's distinguishable (kept subtle).
          // The baked atlas was already tone-mapped in Blender (Reinhard on the raw
          // Cycles bake), so keep toneMapped:false to avoid a second (AgX) pass.
          // Per material slot: the floor tile slot gets a crisp procedural grout grid;
          // walls / ceiling stay on the plain baked atlas.
          // Brighter + subtle warm-cream tint so walls read white & fresh like the Blender
          // (Eevee) view instead of the duller grey of the raw Reinhard bake.
          // Calibrated to the Blender wall texture avg (sRGB ~0.88/0.87/0.86) â€” a soft warm
          // off-white, not stark white. Gentle brighten + faint warm, keep the grain.
          // Boss preference: brighter/whiter than the Blender taupe â€” fresh warm-cream white.
          const wallTint = new THREE.Color(0.72, 0.71, 0.69)
          const floorTint = new THREE.Color(0.92, 0.90, 0.84)
          const isTileMat = (m?: THREE.Material | null) =>
            m != null && m.name != null && /tile/i.test(m.name)
          // Coloured accent surfaces (red niche, accent walls, gold/red titles) must NOT
          // get the warm-cream wall lift -- that washes the deep red niche to faded pink.
          // Show their baked atlas colour true (only a gentle brighten).
          const isAccentMat = (m?: THREE.Material | null) =>
            m != null && m.name != null && /accent|niche|red|gold|title|wood|trim|cabinet|plinth|desk|podium|case/i.test(m.name)
          const accentTint = new THREE.Color(1.06, 1.05, 1.03)
          const makeCleanWall = (m?: THREE.Material | null) => {
            const sourceName = m?.name ?? ''
            const baseColor = /top|ceiling/i.test(sourceName)
              ? new THREE.Color('#d5cec0')
              : /ew/i.test(sourceName)
                ? new THREE.Color('#dfd7c8')
                : new THREE.Color('#e8dfcf')
            const mat = new THREE.MeshBasicMaterial({
              map: atlas,
              color: baseColor,
              side: THREE.DoubleSide,
              toneMapped: false,
            })
            const hasBump = !!wallNorTex
            mat.onBeforeCompile = (shader) => {
              shader.uniforms.uBaseCream = { value: baseColor }
              shader.uniforms.uBakeBias = { value: /top|ceiling/i.test(sourceName) ? 5.5 : 4.5 }
              const commonLines = ['#include <common>', 'uniform vec3 uBaseCream;', 'uniform float uBakeBias;']
              const mapLines = [
                '#ifdef USE_MAP',
                '  vec3 bake = texture2D(map, vMapUv, uBakeBias).rgb;',
                '  float lum = dot(bake, vec3(0.2126, 0.7152, 0.0722));',
                '  float shade = clamp((lum - 0.62) * 1.15 + 0.9, 0.74, 1.14);',
                '  diffuseColor.rgb = uBaseCream * shade;',
                '#else',
                '  diffuseColor.rgb = uBaseCream;',
                '#endif',
              ]
              if (hasBump) {
                shader.uniforms.uWallNor = { value: wallNorTex }
                shader.uniforms.uBumpStrength = { value: 0.9 }
                shader.uniforms.uLightDir = { value: new THREE.Vector2(-0.45, 0.7) }
                shader.vertexShader = shader.vertexShader
                  .replace('#include <common>', '#include <common>\nvarying vec2 vWallUv0;')
                  .replace('#include <uv_vertex>', '#include <uv_vertex>\n  vWallUv0 = uv;')
                commonLines.push(
                  'varying vec2 vWallUv0;',
                  'uniform sampler2D uWallNor;',
                  'uniform float uBumpStrength;',
                  'uniform vec2 uLightDir;',
                )
                mapLines.push(
                  '{',
                  '  vec3 wn = texture2D(uWallNor, vWallUv0).xyz * 2.0 - 1.0;',
                  '  float b = 1.0 + (wn.x * uLightDir.x + wn.y * uLightDir.y) * uBumpStrength;',
                  '  diffuseColor.rgb *= clamp(b, 0.78, 1.22);',
                  '}',
                )
              }
              shader.fragmentShader = shader.fragmentShader
                .replace('#include <common>', commonLines.join('\n'))
                .replace('#include <map_fragment>', mapLines.join('\n'))
            }
            mat.customProgramCacheKey = () => `vm-clean-wall-bump-${sourceName}-${hasBump}`
            mat.name = sourceName
            return mat
          }
          // Keep the baked atlas visible on walls/ceilings so the room preserves
          // the cloud render's soft shadow and ceiling light gradients. Flip
          // USE_CLEAN_WALL_SHADER to true later to use the experimental clean-wall look.
          const makeShell = (m?: THREE.Material | null) =>
            isTileMat(m)
              ? makeTiledFloorMaterial(atlas, floorTileTex, floorNorTex, floorTint)
              : isAccentMat(m)
                ? new THREE.MeshBasicMaterial({ map: atlas, color: accentTint, side: THREE.DoubleSide, toneMapped: false })
                : USE_CLEAN_WALL_SHADER
                  ? makeCleanWall(m)
                  : makeWallMaterial(atlas, wallTint, wallNorTex)
          // This effect re-runs when each async atlas arrives, so the replacement
          // materials must KEEP the original slot name -- otherwise the /tile/ check
          // fails on the 2nd pass and the floor slot gets overwritten with the plain
          // wall material (which is exactly why the grid disappeared).
          const named = (mat: THREE.Material, src?: THREE.Material | null) => {
            mat.name = src?.name ?? ''
            return mat
          }
          obj.material = Array.isArray(obj.material)
            ? obj.material.map((m) => named(makeShell(m), m))
            : named(makeShell(obj.material as THREE.Material), obj.material as THREE.Material)
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
        // Blender exports each slot as one multi-material mesh: CR_Frame + CR_SlotCanvas.
        // Keep authored frames visible. The slot canvas material itself is hidden so
        // SlotFrame can place the live image without the pale GLB placeholder washing
        // over it.
        entry.hasFrame = true
        applyOriginalSlotMaterials(obj)

        const posAttr = obj.geometry?.getAttribute('position')
        const nrmAttr = obj.geometry?.getAttribute('normal')
        const canvasVertexIndices = slotCanvasVertexIndices(obj, originalMaterialsFor(obj))
        if (posAttr) {
          // The slot tilt (leaning against the wall) is baked into the mesh
          // VERTICES â€” VM_Slot nodes export with identity rotation â€” so we must
          // derive the canvas basis from geometry, not from the node transform.
          const normalMat = new THREE.Matrix3().getNormalMatrix(obj.matrixWorld)

          // Outward normal (world space).
          const normalIndex = canvasVertexIndices?.[0] ?? 0
          const zAxis = nrmAttr
            ? new THREE.Vector3(nrmAttr.getX(normalIndex), nrmAttr.getY(normalIndex), nrmAttr.getZ(normalIndex))
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
          const measureIndices = canvasVertexIndices ?? Array.from({ length: posAttr.count }, (_v, i) => i)
          for (const i of measureIndices) {
            v.fromBufferAttribute(posAttr, i).applyMatrix4(obj.matrixWorld)
            centroid.add(v)
            const px = v.dot(xAxis), py = v.dot(yAxis)
            if (px < minX) minX = px; if (px > maxX) maxX = px
            if (py < minY) minY = py; if (py > maxY) maxY = py
          }
          centroid.divideScalar(measureIndices.length)

          entry.pos.copy(centroid)
          entry.w = maxX - minX
          entry.h = maxY - minY
          const m = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis)
          entry.euler = new THREE.Euler().setFromRotationMatrix(m)
        }
      } else {
        // Frame primitive: keep visible and render with the original GLB colour/texture.
        // Use an unlit material so baked-mode ambient light cannot shift it away from
        // the Blender-authored frame colour.
        entry.hasFrame = true
        applyOriginalUnlitMaterial(obj)
      }
    })

    // K6 runtime glass overlay disabled: the generated transparent plane caused
    // overdraw artifacts. The GLB currently does not include a stable TT_Niche_Glass
    // mesh, so keep K6 stable until the glass is fixed at export/Blender level.

    const extracted: ExtractedSlot[] = []
    for (const [id, entry] of slotMap) {
      if (entry.euler === null) continue  // canvas not found for this slot
      extracted.push({
        id,
        hasBlenderFrame: entry.hasFrame,
        transform: {
          position: { x: entry.pos.x, y: entry.pos.y, z: entry.pos.z },
          rotation: { x: entry.euler.x, y: entry.euler.y, z: entry.euler.z },
          size: { w: entry.w, h: entry.h },
        },
      })
    }

    if (extracted.length > 0) cbRef.current?.(extracted)
    obstacleCbRef.current?.(obstacles)
    // Orient each title so its +Z faces INTO the room. The pill mesh normal can point
    // either way, so decide by the room centre (from the shell bounds): if +Z points
    // away from the centre, turn it 180° about up (negate X and Z) — that flips the
    // facing WITHOUT mirroring the text.
    {
      const haveCenter = isFinite(archMinX) && isFinite(archMinZ)
      const cx = haveCenter ? (archMinX + archMaxX) / 2 : 0
      const cz = haveCenter ? (archMinZ + archMaxZ) / 2 : 0
      for (const t of titleRaw) {
        let xAxis = t.xAxis
        let zAxis = t.zAxis
        if (haveCenter && zAxis.x * (t.centroid.x - cx) + zAxis.z * (t.centroid.z - cz) > 0) {
          xAxis = xAxis.clone().negate()
          zAxis = zAxis.clone().negate()
        }
        const basis = new THREE.Matrix4().makeBasis(xAxis, t.yAxis, zAxis)
        const euler = new THREE.Euler().setFromRotationMatrix(basis)
        titleAnchors.push({
          zoneKey: t.zoneKey,
          position: { x: t.centroid.x, y: t.centroid.y, z: t.centroid.z },
          rotation: { x: euler.x, y: euler.y, z: euler.z },
          pillWidth: t.pillWidth,
        })
      }
    }
    titleCbRef.current?.(titleAnchors)
    if (isFinite(archMinX) && isFinite(archMinZ)) {
      boundsCbRef.current?.({ minX: archMinX, maxX: archMaxX, minZ: archMinZ, maxZ: archMaxZ })
    }
  }, [scene, knownIds, bakedAtlas, propsAtlas, floorTileTex, wallNorTex, floorNorTex])

  return <primitive object={scene} position={offset ?? [0, 0, 0]} />
}
