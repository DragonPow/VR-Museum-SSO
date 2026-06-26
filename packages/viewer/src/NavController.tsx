import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Viewpoint } from '@vm/shared'

interface Props {
  viewpoints: Viewpoint[]
  activeViewpointId: string
}

function toVec3(v: { x: number; y: number; z: number }) {
  return new THREE.Vector3(v.x, v.y, v.z)
}

function computeYawPitch(from: THREE.Vector3, to: THREE.Vector3) {
  const dir = to.clone().sub(from).normalize()
  const yaw = Math.atan2(dir.x, -dir.z)
  const pitch = Math.asin(Math.max(-1, Math.min(1, dir.y)))
  return { yaw, pitch }
}

export function NavController({ viewpoints, activeViewpointId }: Props) {
  const { camera, gl } = useThree()

  // Camera position target (lerped)
  const targetPos = useRef(new THREE.Vector3(0, 1.6, 0))
  // Orientation — drag mutates these directly for instant feel
  const yaw = useRef(Math.PI)
  const pitch = useRef(0)
  // For smooth orientation transition on viewpoint change
  const targetYaw = useRef(Math.PI)
  const targetPitch = useRef(0)
  const transitioning = useRef(false)

  const isDragging = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })

  // Init and viewpoint change
  useEffect(() => {
    const vp = viewpoints.find((v) => v.id === activeViewpointId)
    if (!vp) return
    const pos = toVec3(vp.position)
    const lookAt = toVec3(vp.lookAt)
    targetPos.current.copy(pos)

    const { yaw: y, pitch: p } = computeYawPitch(pos, lookAt)
    targetYaw.current = y
    targetPitch.current = p
    transitioning.current = true

    // Snap position immediately on first load (no lerp delay at start)
    if (!isDragging.current) {
      camera.position.copy(pos)
      yaw.current = y
      pitch.current = p
    }
  }, [activeViewpointId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Pointer drag → look around
  useEffect(() => {
    const canvas = gl.domElement

    const onDown = (e: PointerEvent) => {
      isDragging.current = true
      lastMouse.current = { x: e.clientX, y: e.clientY }
      canvas.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (!isDragging.current) return
      const dx = e.clientX - lastMouse.current.x
      const dy = e.clientY - lastMouse.current.y
      yaw.current -= dx * 0.0035
      pitch.current = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, pitch.current - dy * 0.0035))
      lastMouse.current = { x: e.clientX, y: e.clientY }
      transitioning.current = false // cancel smooth transition while dragging
    }
    const onUp = () => { isDragging.current = false }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
    }
  }, [gl])

  useFrame((_, delta) => {
    const t = Math.min(1, 6 * delta)

    // Smooth position lerp
    camera.position.lerp(targetPos.current, t)

    // Smooth orientation transition on viewpoint change
    if (transitioning.current) {
      // Lerp yaw (handle wrap-around)
      let dyaw = targetYaw.current - yaw.current
      if (dyaw > Math.PI) dyaw -= 2 * Math.PI
      if (dyaw < -Math.PI) dyaw += 2 * Math.PI
      yaw.current += dyaw * t
      pitch.current += (targetPitch.current - pitch.current) * t
      if (Math.abs(dyaw) < 0.001 && Math.abs(targetPitch.current - pitch.current) < 0.001) {
        transitioning.current = false
      }
    }

    camera.quaternion.setFromEuler(new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ'))
  })

  return null
}

