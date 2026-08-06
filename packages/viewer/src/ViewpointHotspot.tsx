import { useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import type { Viewpoint } from '@vm/shared'

interface Props {
  viewpoint: Viewpoint
  onClick: () => void
}

export function ViewpointHotspot({ viewpoint, onClick }: Props) {
  const [hovered, setHovered] = useState(false)
  const groupRef = useRef<THREE.Group>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const rippleRef = useRef<THREE.Mesh>(null)
  const diamondRef = useRef<THREE.Mesh>(null)
  const { invalidate } = useThree()

  // Frame loop for animations
  useFrame((state, delta) => {
    const camera = state.camera
    const vpPos = new THREE.Vector3(viewpoint.position.x, camera.position.y, viewpoint.position.z)
    const dist = camera.position.distanceTo(vpPos)

    const tooClose = dist < 0.8
    if (groupRef.current) {
      groupRef.current.visible = !tooClose
    }

    if (tooClose) return

    const clock = state.clock
    invalidate()

    // 1. Static outer ring pulse
    if (ringRef.current) {
      const mat = ringRef.current.material as THREE.MeshBasicMaterial
      const t = (Math.sin(clock.getElapsedTime() * 2) + 1) / 2
      mat.opacity = 0.2 + t * 0.3
    }

    // 2. Ripple sonar effect
    if (rippleRef.current) {
      const elapsed = clock.getElapsedTime() * 1.2
      const progress = elapsed % 1.0 // 0 to 1 cycle
      rippleRef.current.scale.setScalar(0.3 + progress * 1.3)
      const mat = rippleRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = (1.0 - progress) * 0.55
    }

    // 3. Rotating and bouncing diamond
    if (diamondRef.current) {
      diamondRef.current.rotation.y += delta * 1.5
      diamondRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 1.5) * 0.15
      diamondRef.current.position.y = 0.22 + Math.sin(clock.getElapsedTime() * 2.5) * 0.035
    }
  })

  const pos: [number, number, number] = [viewpoint.position.x, 0.016, viewpoint.position.z]
  
  // Calculate dynamic width of badge based on text length
  const labelText = viewpoint.name
  const charWidth = 0.065
  const badgeWidth = Math.max(0.5, labelText.length * charWidth + 0.16)

  return (
    <group ref={groupRef} position={pos}>
      {/* ── FLOOR projection group ── */}
      
      {/* Outer base ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.26, 0.32, 48]} />
        <meshBasicMaterial color="#c8a85a" transparent opacity={0.35} depthWrite={false} />
      </mesh>

      {/* Ripple ring (Sonar effect) */}
      <mesh ref={rippleRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.02, 0.32, 48]} />
        <meshBasicMaterial color="#f0d060" transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Core solid center ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.08, 24]} />
        <meshBasicMaterial color="#c8a85a" transparent opacity={0.8} depthWrite={false} />
      </mesh>

      {/* Click target (invisible but large enough for easy clicking) */}
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
          onClick()
        }}
      >
        <circleGeometry args={[0.45, 32]} />
        <meshBasicMaterial
          color={hovered ? '#f0d060' : '#c8a85a'}
          transparent
          opacity={hovered ? 0.22 : 0}
          depthWrite={false}
        />
      </mesh>

      {/* ── FLOATING 3D INDICATOR ── */}
      
      {/* Vertical connector line */}
      <mesh position={[0, 0.11, 0]}>
        <cylinderGeometry args={[0.004, 0.004, 0.22, 8]} />
        <meshBasicMaterial color="#c8a85a" transparent opacity={0.25} depthWrite={false} />
      </mesh>

      {/* Floating rotating diamond */}
      <mesh ref={diamondRef} position={[0, 0.22, 0]}>
        <octahedronGeometry args={[0.055, 0]} />
        <meshBasicMaterial color={hovered ? '#ffffff' : '#f0d060'} transparent opacity={0.9} depthWrite={false} />
      </mesh>

      {/* ── FLOATING BADGE (UI style card) ── */}
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <group position={[0, 0.44, 0]}>
          {/* Badge border */}
          <mesh position={[0, 0, -0.002]}>
            <planeGeometry args={[badgeWidth + 0.02, 0.18]} />
            <meshBasicMaterial color="#c8a85a" transparent opacity={0.65} depthWrite={false} />
          </mesh>
          
          {/* Badge background */}
          <mesh position={[0, 0, -0.001]}>
            <planeGeometry args={[badgeWidth, 0.16]} />
            <meshBasicMaterial color="#082f6d" transparent opacity={0.9} depthWrite={false} />
          </mesh>

          {/* Badge text */}
          <Text
            position={[0, 0, 0]}
            fontSize={0.095}
            color={hovered ? '#f0d060' : '#ffffff'}
            anchorX="center"
            anchorY="middle"
            fontWeight="bold"
          >
            {labelText}
          </Text>
        </group>
      </Billboard>
    </group>
  )
}
