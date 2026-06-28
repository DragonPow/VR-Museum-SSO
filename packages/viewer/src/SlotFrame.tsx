import { useRef, useState, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
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
const FRAME_COLOR = { classic: '#8B6914', modern: '#333333', none: null }

export function SlotFrame({ slot, item, onSelect, hideLabel = false }: Props) {
  const [hovered, setHovered] = useState(false)
  const matRef = useRef<THREE.MeshLambertMaterial>(null)
  const { invalidate } = useThree()
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
        invalidate()
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
      {/* Image plane — offset 6cm in local +z (= toward camera) to avoid z-fighting with wall */}
      <mesh
        position={[0, 0, 0.06]}
        onPointerOver={item ? (e) => { e.stopPropagation(); setHovered(true) } : undefined}
        onPointerOut={item ? () => setHovered(false) : undefined}
        onClick={item ? (e) => { e.stopPropagation(); onSelect(slot.id, item) } : undefined}
      >
        <planeGeometry args={[size.w, size.h]} />
        <meshLambertMaterial
          ref={matRef}
          map={item?.wallTextureUrl ? greyTexture() : null}
          color={item ? '#ffffff' : '#d8cfbf'}
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

      {/* Nameplate below frame — hidden when modal is open to avoid Html overlay on top of dialog */}
      {item && !hideLabel && (
        <Html
          position={[0, -(size.h / 2 + FRAME_THICKNESS + 0.12), 0.07]}
          center
          distanceFactor={10}
          occlude
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          <div style={{
            background: 'rgba(10,7,3,0.82)',
            border: '1px solid rgba(200,168,90,0.5)',
            borderRadius: '4px',
            padding: '3px 10px',
            whiteSpace: 'nowrap',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '11px', color: '#c8a85a', fontWeight: 700, letterSpacing: '0.05em' }}>
              {item.year}
            </div>
            <div style={{ fontSize: '12px', color: '#f0e8d8', fontWeight: 600, marginTop: '1px' }}>
              {item.title}
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}
