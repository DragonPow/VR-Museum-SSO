import { useEffect, useLayoutEffect, useRef } from 'react'
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
const MOVE_SPEED      = 4.5   // m/s keyboard
const WALK_SPEED      = 3.2   // m/s click-to-walk
const ACCEL_FACTOR    = 10    // velocity ramp speed (higher = snappier)
const EYE_HEIGHT      = 1.6

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
  const { camera, gl, invalidate } = useThree()

  const targetPos   = useRef(new THREE.Vector3(0, eyeHeight, 0))
  const yaw         = useRef(Math.PI)
  const pitch       = useRef(0)
  const targetYaw   = useRef(Math.PI)
  const targetPitch = useRef(0)
  const transitioning = useRef(false)

  // Velocity for smooth keyboard acceleration/deceleration
  const velocity    = useRef({ x: 0, z: 0 })
  // Target position set by floor-click; advanced each frame at WALK_SPEED
  const walkTarget  = useRef<THREE.Vector3 | null>(null)

  const isDragging  = useRef(false)
  const lastMouse   = useRef({ x: 0, y: 0 })
  const dragPx      = useRef(0)
  // Gyro base: anchors device orientation to current camera orientation on first event
  const gyroBase    = useRef<{ alpha: number; beta: number; yaw: number; pitch: number } | null>(null)
  const gyroSmooth  = useRef({ yaw: 0, pitch: 0 })

  const keys = useRef(new Set<string>())

  // ── Mount snap: set camera to entry viewpoint BEFORE first R3F frame ────────
  // Canvas is unmounted/remounted on each room change, so `camera` starts at
  // [0,0,0]. useLayoutEffect runs synchronously before paint/rAF, ensuring
  // the camera never passes through the center obstacle on arrival.
  useLayoutEffect(() => {
    const vp = viewpoints.find((v) => v.id === activeViewpointId) ?? viewpoints[0]
    if (!vp) return
    const pos    = toVec3(vp.position)
    const lookAt = toVec3(vp.lookAt)
    const { yaw: initYaw, pitch: initPitch } = computeYawPitch(pos, lookAt)
    camera.position.copy(pos)
    targetPos.current.copy(pos)
    yaw.current          = initYaw
    pitch.current        = initPitch
    targetYaw.current    = initYaw
    targetPitch.current  = initPitch
    transitioning.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally empty: component unmounts/remounts on every room change

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
    invalidate()  // kick off transition animation
  }, [activeViewpointId, camera, viewpoints, invalidate])

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
      // Panorama convention: drag right → scene pans right (camera turns left → yaw increases).
      // Touch gets higher sensitivity because touch events tend to fire with smaller deltas.
      const sens = e.pointerType === 'touch' ? 0.005 : 0.003
      yaw.current    += dx * sens
      pitch.current   = clampPitch(pitch.current + dy * sens)
      lastMouse.current  = { x: e.clientX, y: e.clientY }
      transitioning.current = false
      invalidate()
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
      if (!keys.current.has(e.code)) invalidate()  // bootstrap movement loop on first press
      keys.current.add(e.code)
      if (ARROW.has(e.key)) e.preventDefault()
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
  // Uses RELATIVE orientation (delta from when gyro was enabled) so there is no
  // sudden jump when toggled. alpha=compass heading (increases clockwise), beta=tilt.
  // Low-pass smoothing (α=0.25) kills sensor jitter without adding visible lag.
  useEffect(() => {
    if (!gyroEnabled || typeof window === 'undefined') return
    gyroBase.current   = null  // reset anchor on each enable
    gyroSmooth.current = { yaw: yaw.current, pitch: pitch.current }

    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha == null || e.beta == null) return

      if (!gyroBase.current) {
        // First event: anchor device orientation to current camera look direction
        gyroBase.current = { alpha: e.alpha, beta: e.beta, yaw: yaw.current, pitch: pitch.current }
        gyroSmooth.current = { yaw: yaw.current, pitch: pitch.current }
        return
      }

      const base = gyroBase.current
      let dAlpha = e.alpha - base.alpha
      if (dAlpha >  180) dAlpha -= 360   // wrap to [-180, 180]
      if (dAlpha < -180) dAlpha += 360

      // alpha increases clockwise (turning right) → camera turns right → yaw decreases
      const targetYaw   = base.yaw   - degToRad(dAlpha)
      // beta increases when tilting forward (looking down) → pitch decreases
      const targetPitch = clampPitch(base.pitch - degToRad(e.beta - base.beta))

      // Exponential moving average to smooth sensor noise
      const a = 0.25
      gyroSmooth.current.yaw   += (targetYaw   - gyroSmooth.current.yaw)   * a
      gyroSmooth.current.pitch += (targetPitch - gyroSmooth.current.pitch) * a

      yaw.current   = gyroSmooth.current.yaw
      pitch.current = gyroSmooth.current.pitch
      transitioning.current = false
      invalidate()
    }

    window.addEventListener('deviceorientation', onOrientation, true)
    return () => {
      window.removeEventListener('deviceorientation', onOrientation, true)
      gyroBase.current = null
    }
  }, [gyroEnabled])

  // ── Frame loop ──────────────────────────────────────────────────────────────
  useFrame((_, delta) => {
    const t = Math.min(1, 8 * delta)

    // ── Keyboard: velocity-based movement with smooth acceleration ──────────────
    {
      const sinY = Math.sin(yaw.current)
      const cosY = Math.cos(yaw.current)

      // Desired direction from held keys (unit vector, world space)
      let wantX = 0, wantZ = 0
      if (keys.current.has('KeyW') || keys.current.has('ArrowUp'))    { wantX -= sinY; wantZ -= cosY }
      if (keys.current.has('KeyS') || keys.current.has('ArrowDown'))  { wantX += sinY; wantZ += cosY }
      if (keys.current.has('KeyA') || keys.current.has('ArrowLeft'))  { wantX -= cosY; wantZ += sinY }
      if (keys.current.has('KeyD') || keys.current.has('ArrowRight')) { wantX += cosY; wantZ -= sinY }

      // Normalise diagonal input so diagonal isn't faster
      const len = Math.sqrt(wantX * wantX + wantZ * wantZ)
      if (len > 1) { wantX /= len; wantZ /= len }

      const targetVX = wantX * MOVE_SPEED
      const targetVZ = wantZ * MOVE_SPEED

      // Ease velocity toward target (start/stop feel natural, not instant)
      const accel = Math.min(1, ACCEL_FACTOR * delta)
      velocity.current.x += (targetVX - velocity.current.x) * accel
      velocity.current.z += (targetVZ - velocity.current.z) * accel

      const dx = velocity.current.x * delta
      const dz = velocity.current.z * delta

      if (Math.abs(dx) > 0.0001 || Math.abs(dz) > 0.0001) {
        applyMove(targetPos.current, dx, dz, bounds, obstacles)
        walkTarget.current = null   // keyboard input cancels floor-click walk
        transitioning.current = false
      }
    }

    // ── Mobile D-pad (same accel model) ─────────────────────────────────────────
    const mob = mobileMoveRef?.current
    if (mob && (mob.dx !== 0 || mob.dz !== 0)) {
      const sinY = Math.sin(yaw.current)
      const cosY = Math.cos(yaw.current)
      const wdx = (-sinY * mob.dz + cosY * mob.dx)
      const wdz = (-cosY * mob.dz - sinY * mob.dx)
      const accel = Math.min(1, ACCEL_FACTOR * delta)
      velocity.current.x += (wdx * MOVE_SPEED - velocity.current.x) * accel
      velocity.current.z += (wdz * MOVE_SPEED - velocity.current.z) * accel
      applyMove(targetPos.current, velocity.current.x * delta, velocity.current.z * delta, bounds, obstacles)
      walkTarget.current = null
      transitioning.current = false
    }

    // ── Floor-click walk-to: advance targetPos at constant walking speed ─────────
    if (walkTarget.current) {
      const wt = walkTarget.current
      const dx = wt.x - targetPos.current.x
      const dz = wt.z - targetPos.current.z
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist < 0.06) {
        walkTarget.current = null
      } else {
        const step = Math.min(dist, WALK_SPEED * delta)
        applyMove(targetPos.current, (dx / dist) * step, (dz / dist) * step, bounds, obstacles)
        transitioning.current = false
      }
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

    // Request next frame only while something is still animating
    const stillActive =
      keys.current.size > 0 ||
      walkTarget.current !== null ||
      transitioning.current ||
      Math.abs(velocity.current.x) > 0.001 ||
      Math.abs(velocity.current.z) > 0.001 ||
      camera.position.distanceTo(targetPos.current) > 0.001
    if (stillActive) invalidate()
  })

  // ── Floor click → walk ──────────────────────────────────────────────────────
  const floorW = bounds.maxX - bounds.minX
  const floorD = bounds.maxZ - bounds.minZ
  const floorCX = (bounds.minX + bounds.maxX) / 2
  const floorCZ = (bounds.minZ + bounds.maxZ) / 2

  const handleFloorClick = (e: { point: THREE.Vector3; stopPropagation: () => void }) => {
    if (dragPx.current > 6) return
    e.stopPropagation()
    const tx = clamp(e.point.x, bounds.minX, bounds.maxX)
    const tz = clamp(e.point.z, bounds.minZ, bounds.maxZ)
    if (isBlocked(tx, tz, obstacles)) return
    walkTarget.current = new THREE.Vector3(tx, eyeHeight, tz)
    invalidate()  // bootstrap walk-to loop
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
