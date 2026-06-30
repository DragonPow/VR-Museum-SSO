import { useRef, useState, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { Text } from '@react-three/drei'
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

export function SlotFrame({ slot, item, onSelect, hideLabel = false }: Props) {
  const [hovered, setHovered] = useState(false)
  const matRef  = useRef<THREE.MeshLambertMaterial>(null)
  const groupRef = useRef<THREE.Group>(null)
  const { invalidate } = useThree()
  const { transform, frameStyle } = slot
  // Use safe defaults so hooks below always receive valid values.
  // The null guard before JSX (after all hooks) prevents any rendering.
  const position = transform?.position ?? { x: 0, y: 0, z: 0 }
  const rotation = transform?.rotation ?? { x: 0, y: 0, z: 0 }
  const size     = transform?.size     ?? { w: 1, h: 0.8 }
  const frameColor = FRAME_COLOR[frameStyle]

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
    if (!item?.wallTextureUrl || !matRef.current) return
    loadTexture(item.wallTextureUrl, (tex) => {
      if (!matRef.current) return
      matRef.current.map = tex
      matRef.current.color.set('#ffffff')
      matRef.current.needsUpdate = true
      invalidate()
    })
  }, [item?.wallTextureUrl, invalidate])

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
        position={[0, 0, frameColor === null ? 0.02 : FRAME_BASE + FRAME_DEPTH - 0.01]}
        {...(item ? {
          onPointerOver: (e) => { e.stopPropagation(); setHovered(true) },
          onPointerOut:  () => setHovered(false),
          onClick:       (e) => { e.stopPropagation(); onSelect(slot.id, item) },
        } : {})}
      >
        <planeGeometry args={[size.w, size.h]} />
        <meshLambertMaterial
          ref={matRef}
          map={item?.wallTextureUrl ? greyTexture() : null}
          color={item ? '#d8cfbf' : '#d8cfbf'}
          emissive={hovered ? '#333300' : '#000000'}
          emissiveIntensity={hovered ? 0.15 : 0}
          side={THREE.DoubleSide}
        />
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

      {/* Nameplate below frame */}
      {item && !hideLabel && (
        <group position={[0, -(size.h / 2 + FRAME_THICKNESS + 0.13), frameColor === null ? 0.03 : FRAME_BASE + FRAME_DEPTH]}>
          {/* Gold border */}
          <mesh position={[0, 0, -0.003]}>
            <planeGeometry args={[Math.min(size.w + 0.04, 0.74), 0.28]} />
            <meshBasicMaterial color="#c8a85a" transparent opacity={0.4} />
          </mesh>
          {/* Dark fill */}
          <mesh>
            <planeGeometry args={[Math.min(size.w + 0.02, 0.72), 0.26]} />
            <meshBasicMaterial color="#080502" transparent opacity={0.85} />
          </mesh>
          {/* Year */}
          <Text
            position={[0, 0.06, 0.004]}
            fontSize={0.065}
            color="#c8a85a"
            anchorX="center"
            anchorY="middle"
            letterSpacing={0.05}
          >
            {String(item.year)}
          </Text>
          {/* Title */}
          <Text
            position={[0, -0.055, 0.004]}
            fontSize={0.072}
            color="#f0e8d8"
            anchorX="center"
            anchorY="middle"
            maxWidth={Math.min(size.w, 0.68)}
            textAlign="center"
          >
            {item.title}
          </Text>
        </group>
      )}
    </group>
  )
}
