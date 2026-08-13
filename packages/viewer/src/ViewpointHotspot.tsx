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
  const glowRef = useRef<THREE.Mesh>(null)
  const { invalidate } = useThree()

  // Frame loop for animations + distance-adaptive scale
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

    // ── Distance-adaptive scale ──────────────────────────────────────────
    // When camera is far (>3m), scale the whole group up so the badge
    // remains readable. Clamp to 1.0–1.8× to avoid it becoming enormous.
    if (groupRef.current) {
      const minDist = 2.0
      const maxDist = 8.0
      const minScale = 1.0
      const maxScale = 1.8
      const t = Math.max(0, Math.min(1, (dist - minDist) / (maxDist - minDist)))
      const targetScale = minScale + t * (maxScale - minScale)
      // Smooth lerp toward target scale
      const current = groupRef.current.scale.x
      const newScale = current + (targetScale - current) * Math.min(1, 6 * delta)
      groupRef.current.scale.setScalar(newScale)
    }

    // 1. Outer ring pulse (white)
    if (ringRef.current) {
      const mat = ringRef.current.material as THREE.MeshBasicMaterial
      const t = (Math.sin(clock.getElapsedTime() * 2) + 1) / 2
      mat.opacity = 0.45 + t * 0.35
    }

    // 2. Glow ring pulse (subtle white aura)
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshBasicMaterial
      const t = (Math.sin(clock.getElapsedTime() * 1.5 + 0.5) + 1) / 2
      mat.opacity = 0.08 + t * 0.12
    }

    // 3. Ripple sonar effect (white)
    if (rippleRef.current) {
      const elapsed = clock.getElapsedTime() * 1.2
      const progress = elapsed % 1.0 // 0 to 1 cycle
      rippleRef.current.scale.setScalar(0.3 + progress * 1.3)
      const mat = rippleRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = (1.0 - progress) * 0.6
    }

    // 4. Rotating and bouncing diamond
    if (diamondRef.current) {
      diamondRef.current.rotation.y += delta * 1.5
      diamondRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 1.5) * 0.15
      diamondRef.current.position.y = 0.35 + Math.sin(clock.getElapsedTime() * 2.5) * 0.04
    }
  })

  const pos: [number, number, number] = [viewpoint.position.x, 0.016, viewpoint.position.z]
  
  // Calculate dynamic width of badge based on text length
  const labelText = viewpoint.name
  const charWidth = 0.075
  const badgeWidth = Math.max(0.6, labelText.length * charWidth + 0.2)

  return (
    <group ref={groupRef} position={pos}>
      {/* ── FLOOR projection group ── */}

      {/* Glow ring — large subtle white aura for visibility on any floor */}
      <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.05, 0.55, 48]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.12} depthWrite={false} />
      </mesh>
      
      {/* Outer base ring — white, high contrast */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.26, 0.34, 48]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.7} depthWrite={false} />
      </mesh>

      {/* Ripple ring (Sonar effect) — white */}
      <mesh ref={rippleRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.02, 0.34, 48]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Core solid center — brand blue, high contrast */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.1, 24]} />
        <meshBasicMaterial color="#1050a0" transparent opacity={0.95} depthWrite={false} />
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
        <circleGeometry args={[0.55, 32]} />
        <meshBasicMaterial
          color={hovered ? '#74a8df' : '#1050a0'}
          transparent
          opacity={hovered ? 0.25 : 0}
          depthWrite={false}
        />
      </mesh>

      {/* ── FLOATING 3D INDICATOR ── */}
      
      {/* Vertical connector line — white, taller */}
      <mesh position={[0, 0.17, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.5, 8]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.5} depthWrite={false} />
      </mesh>

      {/* Floating rotating diamond — white, larger */}
      <mesh ref={diamondRef} position={[0, 0.35, 0]}>
        <octahedronGeometry args={[0.075, 0]} />
        <meshBasicMaterial color={hovered ? '#74a8df' : '#ffffff'} transparent opacity={0.95} depthWrite={false} />
      </mesh>

      {/* ── FLOATING BADGE (UI style card) ── */}
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <group position={[0, 0.72, 0]}>
          {/* Shadow plane behind badge — subtle dark glow for readability on bright backgrounds */}
          <mesh position={[0, 0, -0.004]}>
            <planeGeometry args={[badgeWidth + 0.12, 0.32]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.2} depthWrite={false} />
          </mesh>

          {/* Badge outer border — white for contrast */}
          <mesh position={[0, 0, -0.003]}>
            <planeGeometry args={[badgeWidth + 0.04, 0.26]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.8} depthWrite={false} />
          </mesh>
          
          {/* Badge background — brand dark blue */}
          <mesh position={[0, 0, -0.002]}>
            <planeGeometry args={[badgeWidth, 0.22]} />
            <meshBasicMaterial color="#082f6d" transparent opacity={0.92} depthWrite={false} />
          </mesh>

          {/* Badge text — larger font */}
          <Text
            position={[0, 0, 0]}
            fontSize={0.13}
            color={hovered ? '#74a8df' : '#ffffff'}
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
