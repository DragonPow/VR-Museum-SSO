import { useEffect, useRef, useState, useCallback } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Viewpoint } from '@vm/shared'

interface Props {
  viewpoints: Viewpoint[]
  activeViewpointId: string
  onViewpointChange?: (id: string) => void
}

const LERP_SPEED = 5

function toVec3(v: { x: number; y: number; z: number }): THREE.Vector3 {
  return new THREE.Vector3(v.x, v.y, v.z)
}

export function NavController({ viewpoints, activeViewpointId, onViewpointChange }: Props) {
  const { camera } = useThree()
  const targetPos = useRef(new THREE.Vector3())
  const targetLookAt = useRef(new THREE.Vector3())
  const currentLookAt = useRef(new THREE.Vector3())
  const [gyroEnabled, setGyroEnabled] = useState(false)
  const gyroRef = useRef<{ alpha: number; beta: number; gamma: number } | null>(null)

  // Sync target when viewpoint changes
  useEffect(() => {
    const vp = viewpoints.find((v) => v.id === activeViewpointId)
    if (!vp) return
    targetPos.current.copy(toVec3(vp.position))
    targetLookAt.current.copy(toVec3(vp.lookAt))
  }, [activeViewpointId, viewpoints])

  // Jump to first viewpoint immediately on mount
  useEffect(() => {
    const vp = viewpoints.find((v) => v.id === activeViewpointId)
    if (!vp) return
    camera.position.copy(toVec3(vp.position))
    currentLookAt.current.copy(toVec3(vp.lookAt))
    camera.lookAt(currentLookAt.current)
    targetPos.current.copy(toVec3(vp.position))
    targetLookAt.current.copy(toVec3(vp.lookAt))
  }, []) // intentionally only on mount

  // Smooth lerp each frame
  useFrame((_, delta) => {
    const t = Math.min(1, LERP_SPEED * delta)
    camera.position.lerp(targetPos.current, t)
    currentLookAt.current.lerp(targetLookAt.current, t)
    if (gyroRef.current) {
      // gyro handled by orientation event — don't interfere with lookAt
    }
  })

  // DeviceOrientation (gyro) handler
  const handleOrientation = useCallback((e: DeviceOrientationEvent) => {
    if (e.beta == null || e.gamma == null) return
    gyroRef.current = { alpha: e.alpha ?? 0, beta: e.beta, gamma: e.gamma }
    // Map beta/gamma to camera look direction
    const euler = new THREE.Euler(
      THREE.MathUtils.degToRad(Math.max(-60, Math.min(60, e.beta - 90))),
      THREE.MathUtils.degToRad(-(e.gamma ?? 0)),
      0,
      'YXZ',
    )
    camera.quaternion.setFromEuler(euler)
  }, [camera])

  useEffect(() => {
    if (!gyroEnabled) {
      window.removeEventListener('deviceorientation', handleOrientation)
      gyroRef.current = null
      return
    }
    window.addEventListener('deviceorientation', handleOrientation)
    return () => window.removeEventListener('deviceorientation', handleOrientation)
  }, [gyroEnabled, handleOrientation])

  return (
    <>
      {!gyroEnabled && (
        <OrbitControls
          makeDefault
          enablePan={false}
          enableZoom={false}
          rotateSpeed={0.4}
          minPolarAngle={Math.PI * 0.15}
          maxPolarAngle={Math.PI * 0.85}
          target={currentLookAt.current}
        />
      )}
    </>
  )
}

/** Hook to request + toggle gyro permission (iOS 13+) */
export function useGyroToggle() {
  const [enabled, setEnabled] = useState(false)

  const toggle = useCallback(async () => {
    if (enabled) { setEnabled(false); return }
    // iOS requires explicit permission request
    const dor = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<string>
    }
    if (typeof dor.requestPermission === 'function') {
      const perm = await dor.requestPermission()
      if (perm !== 'granted') return
    }
    setEnabled(true)
  }, [enabled])

  return { gyroEnabled: enabled, toggleGyro: toggle }
}
