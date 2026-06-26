import { useState } from 'react'
import type { Viewpoint } from '@vm/shared'

interface Props {
  position: [number, number, number]
  label: string
  targetRoomId: string
  onNavigate: (roomId: string) => void
}

export function Portal({ position, label, targetRoomId, onNavigate }: Props) {
  const [hovered, setHovered] = useState(false)

  return (
    <group position={position}>
      {/* Arrow disc */}
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
        onPointerOut={() => setHovered(false)}
        onClick={(e) => { e.stopPropagation(); onNavigate(targetRoomId) }}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
      >
        <circleGeometry args={[0.3, 32]} />
        <meshBasicMaterial color={hovered ? '#f0d060' : '#ffffff'} transparent opacity={0.85} />
      </mesh>

      {/* Pulsing ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.32, 0.38, 32]} />
        <meshBasicMaterial color={hovered ? '#f0d060' : '#aaaaaa'} transparent opacity={0.6} />
      </mesh>

      {/* Arrow up indicator */}
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.08, 0.2, 8]} />
        <meshBasicMaterial color={hovered ? '#ffcc00' : '#555555'} />
      </mesh>
    </group>
  )
}
