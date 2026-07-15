import { useRef, useState, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Slot, Item } from '@vm/shared'
import { loadTexture, greyTexture } from './TextureManager.js'

interface Props {
  slot: Slot
  item: Item | null
  onSelect: (slotId: string, item: Item | null) => void
  hideLabel?: boolean
}

const FRAME_THICKNESS = 0.04
const FRAME_DEPTH     = 0.05   // how far the frame protrudes from the wall
const FRAME_BASE      = 0.01   // gap between wall surface and back of frame (prevents z-fighting)
const FRAME_COLOR = { classic: '#8B6914', modern: '#333333', none: null }
export function SlotFrame({ slot, item, onSelect }: Props) {
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
  const isBackdrop = slot.id === 'VM_Slot_TT_9000' || slot.name === 'TT_9000'
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
  }, [item?.id, invalidate])

  // Load texture as soon as item is available.
  // Using useEffect instead of useFrame so textures load even in frameloop='demand'
  // mode where useFrame only fires on interaction-driven renders.
  useEffect(() => {
    // Backdrop uses the FULL-res original (no downscaling); normal slots use the
    // wall-optimised texture.
    const url = isBackdrop ? (item?.fullUrl ?? item?.wallTextureUrl) : item?.wallTextureUrl
    if (!url || !matRef.current) return
    loadTexture(url, (tex) => {
      if (!matRef.current) return
      if (isBackdrop) tex.colorSpace = THREE.SRGBColorSpace
      matRef.current.map = tex
      matRef.current.color.set('#ffffff')
      matRef.current.needsUpdate = true
      invalidate()
    })
  }, [item?.wallTextureUrl, item?.fullUrl, isBackdrop, invalidate])

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
        {...(item && !isBackdrop ? {
          onPointerOver: (e) => { e.stopPropagation(); setHovered(true) },
          onPointerOut:  () => setHovered(false),
          onClick:       (e) => { e.stopPropagation(); onSelect(slot.id, item) },
        } : {})}
      >
        <planeGeometry args={[size.w, size.h]} />
        {isBackdrop ? (
          <meshBasicMaterial
            ref={matRef as never}
            map={item ? greyTexture() : null}
            color={item ? '#ffffff' : '#d8cfbf'}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        ) : (
          <meshLambertMaterial
            ref={matRef as never}
            map={item?.wallTextureUrl ? greyTexture() : null}
            color={item ? '#d8cfbf' : '#d8cfbf'}
            emissive={hovered ? '#333300' : '#000000'}
            emissiveIntensity={hovered ? 0.15 : 0}
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
