import { useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import type { RoomPortal } from '@vm/shared'

interface Props {
  portal: RoomPortal
  onNavigate: (roomId: string) => void
}

export function FloorPortal({ portal, onNavigate }: Props) {
  const [hovered, setHovered] = useState(false)
  const ringRef = useRef<THREE.Mesh>(null)
  const { invalidate } = useThree()

  // Pulse animation — continuously requests frames while portal is mounted
  useFrame(({ clock }) => {
    if (!ringRef.current) return
    const mat = ringRef.current.material as THREE.MeshBasicMaterial
    const t = (Math.sin(clock.elapsedTime * 2.5) + 1) / 2
    mat.opacity = 0.45 + t * 0.4
    invalidate()
  })

  const pos: [number, number, number] = [portal.position.x, 0.018, portal.position.z]

  return (
    <group position={pos}>
      {/* Outer pulsing ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.38, 0.52, 48]} />
        <meshBasicMaterial color="#1050a0" transparent opacity={0.6} depthWrite={false} />
      </mesh>

      {/* Inner clickable fill */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = 'auto'
        }}
        onClick={(e) => {
          e.stopPropagation()
          onNavigate(portal.targetRoomId)
        }}
      >
        <circleGeometry args={[0.52, 40]} />
        <meshBasicMaterial
          color={hovered ? '#74a8df' : '#1050a0'}
          transparent
          opacity={hovered ? 0.5 : 0.15}
          depthWrite={false}
        />
      </mesh>

      {/* Center dot */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.1, 24]} />
        <meshBasicMaterial color="#2f75c9" transparent opacity={0.9} depthWrite={false} />
      </mesh>

      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <Text
          position={[0, 0.38, 0]}
          fontSize={0.22}
          color={hovered ? '#ffffff' : '#1050a0'}
          anchorX="center"
          anchorY="middle"
        >
          ▲
        </Text>

        <Text
          position={[0, 0.65, 0]}
          fontSize={0.16}
          color={hovered ? '#d8e8f8' : '#1050a0'}
          anchorX="center"
          anchorY="middle"
        >
          {portal.label}
        </Text>
      </Billboard>
    </group>
  )
}
