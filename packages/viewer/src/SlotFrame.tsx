import { useRef, useState, useEffect } from 'react'
import * as THREE from 'three'
import type { Slot, Item } from '@vm/shared'
import { loadTexture, greyTexture } from './TextureManager.js'

interface Props {
  slot: Slot
  item: Item | null
  onSelect: (slotId: string, item: Item | null) => void
}

const FRAME_THICKNESS = 0.04
const FRAME_COLOR = { classic: '#8B6914', modern: '#333333', none: null }

export function SlotFrame({ slot, item, onSelect }: Props) {
  const [hovered, setHovered] = useState(false)
  const matRef = useRef<THREE.MeshLambertMaterial>(null)
  const { transform, frameStyle } = slot
  const { position, rotation, size } = transform
  const frameColor = FRAME_COLOR[frameStyle]

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'auto'
    return () => { document.body.style.cursor = 'auto' }
  }, [hovered])

  useEffect(() => {
    if (!matRef.current) return
    const url = item?.wallTextureUrl
    if (url) {
      loadTexture(url, (tex) => {
        if (!matRef.current) return
        matRef.current.map = tex
        matRef.current.color.set('#ffffff')
        matRef.current.needsUpdate = true
      })
    } else {
      matRef.current.map = null
      matRef.current.color.set('#e8e0d0')
      matRef.current.needsUpdate = true
    }
  }, [item?.wallTextureUrl])

  const pos = [position.x, position.y, position.z] as [number, number, number]
  const rot = [rotation.x, rotation.y, rotation.z] as [number, number, number]

  return (
    <group position={pos} rotation={rot}>
      {/* Image plane */}
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
        onPointerOut={() => setHovered(false)}
        onClick={(e) => { e.stopPropagation(); onSelect(slot.id, item) }}
      >
        <planeGeometry args={[size.w, size.h]} />
        <meshLambertMaterial
          ref={matRef}
          map={item?.wallTextureUrl ? greyTexture() : null}
          color={item ? '#ffffff' : '#e8e0d0'}
          emissive={hovered ? '#333300' : '#000000'}
          emissiveIntensity={hovered ? 0.15 : 0}
        />
      </mesh>

      {/* Hover glow outline */}
      {hovered && (
        <mesh position={[0, 0, -0.005]}>
          <planeGeometry args={[size.w + 0.06, size.h + 0.06]} />
          <meshBasicMaterial color="#f0d060" transparent opacity={0.35} />
        </mesh>
      )}

      {/* Frame border */}
      {frameColor && (
        <>
          {/* Top */}
          <mesh position={[0, size.h / 2 + FRAME_THICKNESS / 2, 0.001]}>
            <planeGeometry args={[size.w + FRAME_THICKNESS * 2, FRAME_THICKNESS]} />
            <meshLambertMaterial color={frameColor} />
          </mesh>
          {/* Bottom */}
          <mesh position={[0, -(size.h / 2 + FRAME_THICKNESS / 2), 0.001]}>
            <planeGeometry args={[size.w + FRAME_THICKNESS * 2, FRAME_THICKNESS]} />
            <meshLambertMaterial color={frameColor} />
          </mesh>
          {/* Left */}
          <mesh position={[-(size.w / 2 + FRAME_THICKNESS / 2), 0, 0.001]}>
            <planeGeometry args={[FRAME_THICKNESS, size.h]} />
            <meshLambertMaterial color={frameColor} />
          </mesh>
          {/* Right */}
          <mesh position={[size.w / 2 + FRAME_THICKNESS / 2, 0, 0.001]}>
            <planeGeometry args={[FRAME_THICKNESS, size.h]} />
            <meshLambertMaterial color={frameColor} />
          </mesh>
        </>
      )}

      {/* Empty slot indicator */}
      {!item && (
        <mesh position={[0, 0, 0.001]}>
          <planeGeometry args={[size.w - 0.05, size.h - 0.05]} />
          <meshBasicMaterial color="#ccbbaa" transparent opacity={0.4} wireframe />
        </mesh>
      )}
    </group>
  )
}
