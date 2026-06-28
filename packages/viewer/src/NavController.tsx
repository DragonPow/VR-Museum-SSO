import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Viewpoint } from '@vm/shared'

export interface RoomBounds {
  minX: number; maxX: number
  minZ: number; maxZ: number
}

interface Props {
  viewpoints: Viewpoint[]
  activeViewpointId: string
  gyroEnabled?: boolean
  bounds?: RoomBounds
  /** Axis-aligned rectangular zones the player cannot enter (freestanding walls, panels, etc.) */
  obstacles?: RoomBounds[]
  eyeHeight?: number
  /** Written by MobileControls D-pad; read each frame. dx = right(-1..1), dz = forward(-1..1) */
  mobileMoveRef?: { current: { dx: number; dz: number } }
}

const DEFAULT_BOUNDS: RoomBounds = { minX: -5.5, maxX: 5.5, minZ: -7.5, maxZ: 7.5 }
const MOVE_SPEED = 3.5   // m/s
const EYE_HEIGHT = 1.6

function toVec3(v: { x: number; y: number; z: number }) {
  return new THREE.Vector3(v.x, v.y, v.z)
}

function computeYawPitch(from: THREE.Vector3, to: THREE.Vector3) {
  const dir = to.clone().sub(from).normalize()
  const yaw = Math.atan2(dir.x, -dir.z)
  const pitch = Math.asin(Math.max(-1, Math.min(1, dir.y)))
  return { yaw, pitch }
}

function degToRad(deg: number) { return (deg * Math.PI) / 180 }
function clampPitch(v: number) { return Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, v)) }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

function isBlocked(x: number, z: number, obstacles: RoomBounds[]): boolean {
  return obstacles.some((o) => x > o.minX && x < o.maxX && z > o.minZ && z < o.maxZ)
}

/** Apply movement delta with outer-bounds clamping and obstacle sliding collision. */
function applyMove(
  pos: THREE.Vector3,
  dx: number, dz: number,
  bounds: RoomBounds,
  obstacles: RoomBounds[],
) {
  const nx = clamp(pos.x + dx, bounds.minX, bounds.maxX)
  const nz = clamp(pos.z + dz, bounds.minZ, bounds.maxZ)

  if (!isBlocked(nx, nz, obstacles)) {
    pos.x = nx
    pos.z = nz
  } else if (!isBlocked(nx, pos.z, obstacles)) {
    pos.x = nx  // slide along X only
  } else if (!isBlocked(pos.x, nz, obstacles)) {
    pos.z = nz  // slide along Z only
  }
  // else: corner blocked, don't move
}

export function NavController({
  viewpoints,
  activeViewpointId,
  gyroEnabled = false,
  bounds = DEFAULT_BOUNDS,
  obstacles = [],
  eyeHeight = EYE_HEIGHT,
  mobileMoveRef,
}: Props) {
  const { camera, gl } = useThree()

  const targetPos  = useRef(new THREE.Vector3(0, eyeHeight, 0))
  const yaw        = useRef(Math.PI)
  const pitch      = useRef(0)
  const targetYaw  = useRef(Math.PI)
  const targetPitch = useRef(0)
  const transitioning = useRef(false)

  const isDragging  = useRef(false)
  const lastMouse   = useRef({ x: 0, y: 0 })
  // track pointer travel distance to distinguish click vs drag
  const dragPx      = useRef(0)

  const keys = useRef(new Set<string>())

  // ── Viewpoint change ────────────────────────────────────────────────────────
  useEffect(() => {
    const vp = viewpoints.find((v) => v.id === activeViewpointId)
    if (!vp) return
    const pos    = toVec3(vp.position)
    const lookAt = toVec3(vp.lookAt)
    targetPos.current.copy(pos)

    const { yaw: y, pitch: p } = computeYawPitch(pos, lookAt)
    targetYaw.current   = y
    targetPitch.current = p
    transitioning.current = true

    if (!isDragging.current) {
      camera.position.copy(pos)
      yaw.current   = y
      pitch.current = p
    }
  }, [activeViewpointId, camera, viewpoints])

  // ── Pointer drag → look around ──────────────────────────────────────────────
  useEffect(() => {
    const canvas = gl.domElement

    const onDown = (e: PointerEvent) => {
      isDragging.current = true
      dragPx.current     = 0
      lastMouse.current  = { x: e.clientX, y: e.clientY }
      canvas.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (!isDragging.current || gyroEnabled) return
      const dx = e.clientX - lastMouse.current.x
      const dy = e.clientY - lastMouse.current.y
      dragPx.current += Math.abs(dx) + Math.abs(dy)
      yaw.current    -= dx * 0.0035
      pitch.current   = clampPitch(pitch.current - dy * 0.0035)
      lastMouse.current  = { x: e.clientX, y: e.clientY }
      transitioning.current = false
    }
    const onUp = () => { isDragging.current = false }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup',   onUp)
    canvas.addEventListener('pointercancel', onUp)
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup',   onUp)
      canvas.removeEventListener('pointercancel', onUp)
    }
  }, [gl, gyroEnabled])

  // ── Keyboard ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const ARROW = new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'])
    const onDown = (e: KeyboardEvent) => {
      keys.current.add(e.code)
      if (ARROW.has(e.key)) e.preventDefault() // stop page scroll
    }
    const onUp = (e: KeyboardEvent) => { keys.current.delete(e.code) }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup',   onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup',   onUp)
    }
  }, [])

  // ── Gyroscope ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!gyroEnabled || typeof window === 'undefined') return
    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha == null && e.beta == null) return
      if (e.alpha != null) yaw.current   = -degToRad(e.alpha)
      if (e.beta  != null) pitch.current  = clampPitch(degToRad(e.beta - 90))
      transitioning.current = false
    }
    window.addEventListener('deviceorientation', onOrientation, true)
    return () => window.removeEventListener('deviceorientation', onOrientation, true)
  }, [gyroEnabled])

  // ── Frame loop ──────────────────────────────────────────────────────────────
  useFrame((_, delta) => {
    const t = Math.min(1, 6 * delta)

    // Keyboard movement
    // Camera world-forward = (-sin yaw, 0, -cos yaw)
    // Camera world-right   = ( cos yaw, 0, -sin yaw)  [= forward × world-up]
    if (keys.current.size > 0) {
      const spd  = MOVE_SPEED * delta
      const sinY = Math.sin(yaw.current)
      const cosY = Math.cos(yaw.current)

      let dx = 0, dz = 0
      if (keys.current.has('KeyW') || keys.current.has('ArrowUp'))    { dx -= sinY * spd;  dz -= cosY * spd }
      if (keys.current.has('KeyS') || keys.current.has('ArrowDown'))  { dx += sinY * spd;  dz += cosY * spd }
      if (keys.current.has('KeyA') || keys.current.has('ArrowLeft'))  { dx -= cosY * spd;  dz += sinY * spd }
      if (keys.current.has('KeyD') || keys.current.has('ArrowRight')) { dx += cosY * spd;  dz -= sinY * spd }

      if (dx !== 0 || dz !== 0) {
        applyMove(targetPos.current, dx, dz, bounds, obstacles)
        transitioning.current = false
      }
    }

    // Mobile D-pad input: dz = forward(+1)/back(-1), dx = right(+1)/left(-1)
    const mob = mobileMoveRef?.current
    if (mob && (mob.dx !== 0 || mob.dz !== 0)) {
      const spd  = MOVE_SPEED * delta
      const sinY = Math.sin(yaw.current)
      const cosY = Math.cos(yaw.current)
      // forward = (-sinY, 0, -cosY),  right = (cosY, 0, -sinY)
      const wdx = (-sinY * mob.dz + cosY * mob.dx) * spd
      const wdz = (-cosY * mob.dz - sinY * mob.dx) * spd
      applyMove(targetPos.current, wdx, wdz, bounds, obstacles)
      transitioning.current = false
    }

    // Smooth position lerp
    camera.position.lerp(targetPos.current, t)

    // Smooth orientation transition on viewpoint snap
    if (transitioning.current && !gyroEnabled) {
      let dyaw = targetYaw.current - yaw.current
      if (dyaw >  Math.PI) dyaw -= 2 * Math.PI
      if (dyaw < -Math.PI) dyaw += 2 * Math.PI
      yaw.current   += dyaw * t
      pitch.current += (targetPitch.current - pitch.current) * t
      if (Math.abs(dyaw) < 0.001 && Math.abs(targetPitch.current - pitch.current) < 0.001) {
        transitioning.current = false
      }
    }

    camera.quaternion.setFromEuler(new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ'))
  })

  // ── Floor click → walk ──────────────────────────────────────────────────────
  const floorW = bounds.maxX - bounds.minX
  const floorD = bounds.maxZ - bounds.minZ
  const floorCX = (bounds.minX + bounds.maxX) / 2
  const floorCZ = (bounds.minZ + bounds.maxZ) / 2

  const handleFloorClick = (e: { point: THREE.Vector3; stopPropagation: () => void }) => {
    // Ignore if this was actually a drag (threshold: 6px travel)
    if (dragPx.current > 6) return
    e.stopPropagation()
    const tx = clamp(e.point.x, bounds.minX, bounds.maxX)
    const tz = clamp(e.point.z, bounds.minZ, bounds.maxZ)
    if (isBlocked(tx, tz, obstacles)) return
    targetPos.current.set(tx, eyeHeight, tz)
    transitioning.current = false
  }

  return (
    <mesh
      position={[floorCX, 0.015, floorCZ]}
      rotation={[-Math.PI / 2, 0, 0]}
      onClick={handleFloorClick}
    >
      <planeGeometry args={[floorW, floorD]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  )
}
