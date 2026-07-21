import { useRef, useState, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Slot, DocumentIndexItem } from '@vm/shared'
import { loadTexture, greyTexture } from './TextureManager.js'
import { HERO_SLOT_ID } from './slotIds.js'

interface Props {
  slot: Slot
  documentItem: DocumentIndexItem | null
  viewerTextureUrl: string | null
  onSelect: (slotId: string) => void
  hideLabel?: boolean
}

const FRAME_THICKNESS = 0.04
const FRAME_DEPTH     = 0.05   // how far the frame protrudes from the wall
const FRAME_BASE      = 0.01   // gap between wall surface and back of frame (prevents z-fighting)
const FRAME_COLOR = { classic: '#8B6914', modern: '#333333', none: null }
export function SlotFrame({ slot, documentItem, viewerTextureUrl, onSelect }: Props) {
  const [hovered, setHovered] = useState(false)
  const matRef  = useRef<THREE.MeshLambertMaterial | THREE.MeshBasicMaterial>(null)
  const groupRef = useRef<THREE.Group>(null)
  const { invalidate } = useThree()
  const { transform, frameStyle } = slot
  // Use safe defaults so hooks below always receive valid values.
  // The null guard before JSX (after all hooks) prevents any rendering.
  const position = transform?.position ?? { x: 0, y: 0, z: 0 }
  const rotation = transform?.rotation ?? { x: 0, y: 0, z: 0 }
  const size     = transform?.size     ?? { w: 1, h: 0.8 }
  const frameColor = FRAME_COLOR[frameStyle]
  // Fixed backdrop panel (the wide hero banner): show the full-res image exactly as-is
  // — unlit, uncropped, not clickable — so it reads like a real printed panel on the wall.
  const isBackdrop = slot.id === HERO_SLOT_ID
  // K9 is mounted on the entrance wall whose room-facing side is local -Z.
  // Keep the live backdrop slightly in front of the wall to avoid z-fighting haze.
  const canvasZ = isBackdrop ? -0.035 : (frameColor === null ? 0 : FRAME_BASE + FRAME_DEPTH - 0.01)

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'auto'
    return () => { document.body.style.cursor = 'auto' }
  }, [hovered])

  // Clear texture immediately when item changes
  useEffect(() => {
    if (matRef.current) {
      matRef.current.map = null
      matRef.current.color.set('#d8cfbf')
      matRef.current.needsUpdate = true
      invalidate()
    }
  }, [documentItem?.id, invalidate])

  // Load texture as soon as item is available.
  // Using useEffect instead of useFrame so textures load even in frameloop='demand'
  // mode where useFrame only fires on interaction-driven renders.
  useEffect(() => {
    // Backdrop uses the FULL-res original (no downscaling); normal slots use the
    // wall-optimised texture.
    const url = viewerTextureUrl
    if (!url || !matRef.current) return
    loadTexture(url, (tex) => {
      if (!matRef.current) return
      // EVERY slot texture must be tagged sRGB, not just the backdrop -- otherwise the
      // bytes are read as linear and the photo's gamma is wrong.
      tex.colorSpace = THREE.SRGBColorSpace
      if (isBackdrop) {
        tex.generateMipmaps = false
        tex.minFilter = THREE.LinearFilter
        tex.magFilter = THREE.LinearFilter
        tex.anisotropy = 8
      }
      tex.needsUpdate = true
      matRef.current.map = tex
      if (isBackdrop) {
        // Brighten the K9 image itself instead of adding a translucent overlay; this
        // keeps the backdrop fresh without the white, cloudy glass look.
        matRef.current.color.setRGB(1.18, 1.18, 1.18)
      } else {
        matRef.current.color.set('#ffffff')
      }
      matRef.current.needsUpdate = true
      invalidate()
    })
  }, [viewerTextureUrl, isBackdrop, invalidate])

  // Guard after all hooks — slot has no transform yet (GLB not extracted)
  if (!transform) return null

  const pos = [position.x, position.y, position.z] as [number, number, number]
  const rot = [rotation.x, rotation.y, rotation.z] as [number, number, number]

  return (
    <group ref={groupRef} position={pos} rotation={rot}>
      {/* Canvas — position depends on whether Blender supplies the frame.
          'none' = Blender frame present: sit at canvas face depth (~2 cm).
          Otherwise: recessed 1 cm behind our R3F frame face. */}
      <mesh
        position={[0, 0, canvasZ]}
        renderOrder={isBackdrop ? 20 : 0}
        {...(documentItem && !isBackdrop ? {
          onPointerOver: (e) => { e.stopPropagation(); setHovered(true) },
          onPointerOut:  () => setHovered(false),
          onClick:       (e) => { e.stopPropagation(); onSelect(slot.id) },
        } : {})}
      >
        <planeGeometry args={[size.w, size.h]} />
        {isBackdrop ? (
          <meshBasicMaterial
            ref={matRef as never}
            map={documentItem ? greyTexture() : null}
            color={documentItem ? '#ffffff' : '#d8cfbf'}
            toneMapped={false}
            depthTest={true}
            depthWrite={!isBackdrop}
            side={THREE.DoubleSide}
          />
        ) : (
          // UNLIT like the room shell. A lit material here was the bug: the baked room
          // only has ambientLight 0.32, and three r155+ divides ambient irradiance by PI
          // (BRDF_Lambert), so every photo rendered at 0.32/PI ~= 10% albedo and then got
          // squashed again by the global AgX tone mapping -- while the walls/floor sit at
          // 100% (MeshBasicMaterial + toneMapped:false). Result: photos looked pitch black
          // next to a white wall. The hero slot was already on this path and looked right.
          <meshBasicMaterial
            ref={matRef as never}
            map={viewerTextureUrl ? greyTexture() : null}
            color={viewerTextureUrl ? '#ffffff' : '#d8cfbf'}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        )}
      </mesh>

      {/* Hover glow — behind frame base */}
      {hovered && (
        <mesh position={[0, 0, -0.005]}>
          <planeGeometry args={[size.w + FRAME_THICKNESS * 2 + 0.04, size.h + FRAME_THICKNESS * 2 + 0.04]} />
          <meshBasicMaterial color="#f0d060" transparent opacity={0.3} />
        </mesh>
      )}

      {/* Frame — 4 box beams that protrude FRAME_DEPTH from the wall */}
      {frameColor && (
        <>
          {/* Top */}
          <mesh position={[0, size.h / 2 + FRAME_THICKNESS / 2, FRAME_BASE + FRAME_DEPTH / 2]}>
            <boxGeometry args={[size.w + FRAME_THICKNESS * 2, FRAME_THICKNESS, FRAME_DEPTH]} />
            <meshLambertMaterial color={frameColor} />
          </mesh>
          {/* Bottom */}
          <mesh position={[0, -(size.h / 2 + FRAME_THICKNESS / 2), FRAME_BASE + FRAME_DEPTH / 2]}>
            <boxGeometry args={[size.w + FRAME_THICKNESS * 2, FRAME_THICKNESS, FRAME_DEPTH]} />
            <meshLambertMaterial color={frameColor} />
          </mesh>
          {/* Left */}
          <mesh position={[-(size.w / 2 + FRAME_THICKNESS / 2), 0, FRAME_BASE + FRAME_DEPTH / 2]}>
            <boxGeometry args={[FRAME_THICKNESS, size.h, FRAME_DEPTH]} />
            <meshLambertMaterial color={frameColor} />
          </mesh>
          {/* Right */}
          <mesh position={[size.w / 2 + FRAME_THICKNESS / 2, 0, FRAME_BASE + FRAME_DEPTH / 2]}>
            <boxGeometry args={[FRAME_THICKNESS, size.h, FRAME_DEPTH]} />
            <meshLambertMaterial color={frameColor} />
          </mesh>
        </>
      )}

    </group>
  )
}
