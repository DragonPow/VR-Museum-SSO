import { useState } from 'react'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import type { RoomPortal } from '@vm/shared'

interface Props {
  portal: RoomPortal
  onNavigate: (roomId: string) => void
}

const ARCH_W = 2.0
const ARCH_H = 2.5
const BORDER = 0.055

export function Portal({ portal, onNavigate }: Props) {
  const [hovered, setHovered] = useState(false)

  const color = hovered ? '#f0d060' : '#c8a85a'
  const bgOpacity = hovered ? 0.28 : 0.12

  const pos: [number, number, number] = [portal.position.x, portal.position.y, portal.position.z]
  const rot: [number, number, number] = [portal.rotation.x, portal.rotation.y, portal.rotation.z]

  const handlers = {
    onPointerOver: (e: THREE.Event) => { (e as any).stopPropagation(); setHovered(true) },
    onPointerOut: () => setHovered(false),
    onClick: (e: THREE.Event) => { (e as any).stopPropagation(); onNavigate(portal.targetRoomId) },
  }

  return (
    <group position={pos} rotation={rot as unknown as THREE.Euler}>
      {/* Background panel */}
      <mesh {...handlers}>
        <planeGeometry args={[ARCH_W, ARCH_H]} />
        <meshBasicMaterial color="#0d0820" transparent opacity={bgOpacity} side={THREE.DoubleSide} />
      </mesh>

      {/* Frame — top */}
      <mesh position={[0, ARCH_H / 2 - BORDER / 2, 0.008]} {...handlers}>
        <planeGeometry args={[ARCH_W, BORDER]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {/* Frame — bottom */}
      <mesh position={[0, -(ARCH_H / 2 - BORDER / 2), 0.008]} {...handlers}>
        <planeGeometry args={[ARCH_W, BORDER]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {/* Frame — left */}
      <mesh position={[-(ARCH_W / 2 - BORDER / 2), 0, 0.008]} {...handlers}>
        <planeGeometry args={[BORDER, ARCH_H]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {/* Frame — right */}
      <mesh position={[ARCH_W / 2 - BORDER / 2, 0, 0.008]} {...handlers}>
        <planeGeometry args={[BORDER, ARCH_H]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Arrow */}
      <Text
        position={[0, 0.25, 0.012]}
        fontSize={0.45}
        color={hovered ? '#ffffff' : '#c8a85a'}
        anchorX="center"
        anchorY="middle"
        {...handlers}
      >
        →
      </Text>

      {/* Label */}
      <Text
        position={[0, -0.3, 0.012]}
        fontSize={0.14}
        color={hovered ? '#ffe8a0' : '#a89060'}
        anchorX="center"
        anchorY="middle"
        maxWidth={ARCH_W - 0.2}
        {...handlers}
      >
        {portal.label}
      </Text>
    </group>
  )
}
