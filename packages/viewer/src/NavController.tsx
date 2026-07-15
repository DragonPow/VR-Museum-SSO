import { useEffect, useLayoutEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Viewpoint, Vec3 } from '@vm/shared'

export interface CameraState {
  position: Vec3
  groundPosition: Vec3
  lookAt: Vec3
}

export interface RoomBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
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
  /** Admin editor: updated every frame with current camera position + look-at */
  cameraStateRef?: React.MutableRefObject<CameraState | null>
  /** Admin editor: when true, floor clicks call onPortalPlace instead of walking */
  portalPlaceMode?: boolean
  onPortalPlace?: (pos: { x: number; z: number }) => void
}

const DEFAULT_BOUNDS: RoomBounds = { minX: -5.5, maxX: 5.5, minZ: -7.5, maxZ: 7.5 }
const MOVE_SPEED = 4.5 // m/s keyboard
const WALK_SPEED = 3.2 // m/s click-to-walk
const ACCEL_FACTOR = 10 // velocity ramp speed (higher = snappier)
const EYE_HEIGHT = 1.6
// Gyro look smoothing: eased toward the latest sensor reading via
// 1 - exp(-GYRO_LERP * delta) so it feels identical at any frame rate.
// Higher = snappier, lower = smoother/floatier.
const GYRO_LERP = 18
const PLAYER_RADIUS = 0.32
// The invisible floor hit target needs to reach slightly beyond the walkable
// clamp. Otherwise clicks near perimeter walls can hit the rendered floor/wall
// but miss navigation, creating a dead strip about half a tile wide.
const FLOOR_HIT_MARGIN = 1.8
const WALKABLE_EPSILON = 0.035

function toVec3(v: { x: number; y: number; z: number }) {
  return new THREE.Vector3(v.x, v.y, v.z)
}

function computeYawPitch(from: THREE.Vector3, to: THREE.Vector3) {
  const dir = to.clone().sub(from).normalize()
  // Camera forward is (-sin yaw, .., -cos yaw) (Euler 'YXZ'), so yaw must invert dir.x —
  // otherwise restored viewpoints come back mirrored across X (wrong facing).
  const yaw = Math.atan2(-dir.x, -dir.z)
  const pitch = Math.asin(Math.max(-1, Math.min(1, dir.y)))
  return { yaw, pitch }
}

function degToRad(deg: number) {
  return (deg * Math.PI) / 180
}
function clampPitch(v: number) {
  return Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, v))
}
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target instanceof HTMLElement ? target : null
  if (!el) return false
  const tag = el.tagName
  return el.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

function isBlocked(x: number, z: number, obstacles: RoomBounds[]): boolean {
  return obstacles.some((o) =>
    x > o.minX - PLAYER_RADIUS &&
    x < o.maxX + PLAYER_RADIUS &&
    z > o.minZ - PLAYER_RADIUS &&
    z < o.maxZ + PLAYER_RADIUS,
  )
}

function segmentIntersectsRect(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  rect: RoomBounds,
): boolean {
  const minX = rect.minX - PLAYER_RADIUS
  const maxX = rect.maxX + PLAYER_RADIUS
  const minZ = rect.minZ - PLAYER_RADIUS
  const maxZ = rect.maxZ + PLAYER_RADIUS
  const dx = bx - ax
  const dz = bz - az
  let t0 = 0
  let t1 = 1
  const clip = (p: number, q: number) => {
    if (Math.abs(p) < 1e-8) return q >= 0
    const r = q / p
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r }
    else { if (r < t0) return false; if (r < t1) t1 = r }
    return true
  }
  return (
    clip(-dx, ax - minX) &&
    clip(dx, maxX - ax) &&
    clip(-dz, az - minZ) &&
    clip(dz, maxZ - az) &&
    t1 >= t0
  )
}

function pathBlocked(from: THREE.Vector3, x: number, z: number, obstacles: RoomBounds[]): boolean {
  return obstacles.some((o) => {
    // If we are already touching an expanded obstacle edge, allow moving away from it.
    if (isBlocked(from.x, from.z, [o])) return false
    return segmentIntersectsRect(from.x, from.z, x, z, o)
  })
}

function resolveWalkTarget(
  x: number,
  z: number,
  bounds: RoomBounds,
  obstacles: RoomBounds[],
): { x: number; z: number } {
  let tx = clamp(x, bounds.minX, bounds.maxX)
  let tz = clamp(z, bounds.minZ, bounds.maxZ)

  for (let pass = 0; pass < 2; pass++) {
    for (const o of obstacles) {
      const minX = o.minX - PLAYER_RADIUS
      const maxX = o.maxX + PLAYER_RADIUS
      const minZ = o.minZ - PLAYER_RADIUS
      const maxZ = o.maxZ + PLAYER_RADIUS
      if (!(tx > minX && tx < maxX && tz > minZ && tz < maxZ)) continue

      const options = [
        { d: Math.abs(tx - minX), x: minX - WALKABLE_EPSILON, z: tz },
        { d: Math.abs(maxX - tx), x: maxX + WALKABLE_EPSILON, z: tz },
        { d: Math.abs(tz - minZ), x: tx, z: minZ - WALKABLE_EPSILON },
        { d: Math.abs(maxZ - tz), x: tx, z: maxZ + WALKABLE_EPSILON },
      ].sort((a, b) => a.d - b.d)

      for (const option of options) {
        const nx = clamp(option.x, bounds.minX, bounds.maxX)
        const nz = clamp(option.z, bounds.minZ, bounds.maxZ)
        if (!isBlocked(nx, nz, obstacles)) {
          tx = nx
          tz = nz
          break
        }
      }
    }
  }

  return { x: tx, z: tz }
}

/** Apply movement delta with outer-bounds clamping and obstacle sliding collision. */
function applyMove(
  pos: THREE.Vector3,
  dx: number,
  dz: number,
  bounds: RoomBounds,
  obstacles: RoomBounds[],
): { mx: boolean; mz: boolean } {
  const nx = clamp(pos.x + dx, bounds.minX, bounds.maxX)
  const nz = clamp(pos.z + dz, bounds.minZ, bounds.maxZ)

  if (!isBlocked(nx, nz, obstacles)) {
    pos.x = nx
    pos.z = nz
    return { mx: true, mz: true }
  } else if (!isBlocked(nx, pos.z, obstacles)) {
    pos.x = nx // slide along X only
    return { mx: true, mz: false }
  } else if (!isBlocked(pos.x, nz, obstacles)) {
    pos.z = nz // slide along Z only
    return { mx: false, mz: true }
  }
  // corner blocked, don't move
  return { mx: false, mz: false }
}

export function NavController({
  viewpoints,
  activeViewpointId,
  gyroEnabled = false,
  bounds = DEFAULT_BOUNDS,
  obstacles = [],
  eyeHeight = EYE_HEIGHT,
  mobileMoveRef,
  cameraStateRef,
  portalPlaceMode = false,
  onPortalPlace,
}: Props) {
  const { camera, gl, invalidate } = useThree()

  const targetPos = useRef(new THREE.Vector3(0, eyeHeight, 0))
  const yaw = useRef(Math.PI)
  const pitch = useRef(0)
  const targetYaw = useRef(Math.PI)
  const targetPitch = useRef(0)
  const transitioning = useRef(false)

  // Velocity for smooth keyboard acceleration/deceleration
  const velocity = useRef({ x: 0, z: 0 })
  // Target position set by floor-click; advanced each frame at WALK_SPEED
  const walkTarget = useRef<THREE.Vector3 | null>(null)

  const isDragging = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })
  const dragPx = useRef(0)
  // Gyro base: anchors device orientation to current camera orientation on first event
  const gyroBase = useRef<{ alpha: number; beta: number; yaw: number; pitch: number } | null>(null)
  // Latest RAW look target from the sensor. Smoothing happens in the frame loop
  // (not in the sensor event) so it's decoupled from the device's irregular event rate.
  const gyroTarget = useRef<{ yaw: number; pitch: number } | null>(null)
  const gyroSmooth = useRef<{ alpha: number; beta: number } | null>(null)

  const keys = useRef(new Set<string>())

  // ── Mount snap: set camera to entry viewpoint BEFORE first R3F frame ────────
  // Canvas is unmounted/remounted on each room change, so `camera` starts at
  // [0,0,0]. useLayoutEffect runs synchronously before paint/rAF, ensuring
  // the camera never passes through the center obstacle on arrival.
  useLayoutEffect(() => {
    const vp = viewpoints.find((v) => v.id === activeViewpointId) ?? viewpoints[0]
    if (!vp) return
    const pos = toVec3(vp.position)
    const lookAt = toVec3(vp.lookAt)
    const { yaw: initYaw, pitch: initPitch } = computeYawPitch(pos, lookAt)
    camera.position.copy(pos)
    targetPos.current.copy(pos)
    yaw.current = initYaw
    pitch.current = initPitch
    targetYaw.current = initYaw
    targetPitch.current = initPitch
    transitioning.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally empty: component unmounts/remounts on every room change

  // ── Viewpoint change ────────────────────────────────────────────────────────
  useEffect(() => {
    const vp = viewpoints.find((v) => v.id === activeViewpointId)
    if (!vp) return
    const pos = toVec3(vp.position)
    const lookAt = toVec3(vp.lookAt)
    const { yaw: y, pitch: p } = computeYawPitch(pos, lookAt)

    targetPos.current.copy(pos)
    targetYaw.current = y
    targetPitch.current = p
    // Always ease the FACING to the viewpoint's saved angle — even when already standing at
    // its position. (Previously the angle was applied only when travelling to a new spot, so
    // clicking a viewpoint at/near your position moved the body but kept the old facing →
    // "the view angle can't be selected".)
    transitioning.current = true

    // Move smoothly toward the new viewpoint. The previous hard snap caused a visible
    // hitch before movement started, especially for far viewpoints.
    walkTarget.current = null
    velocity.current.x = 0
    velocity.current.z = 0
    invalidate()
  }, [activeViewpointId, camera, viewpoints, invalidate])

  // ── Pointer drag → look around ──────────────────────────────────────────────
  useEffect(() => {
    const canvas = gl.domElement

    const onDown = (e: PointerEvent) => {
      isDragging.current = true
      dragPx.current = 0
      lastMouse.current = { x: e.clientX, y: e.clientY }
      canvas.setPointerCapture(e.pointerId)
      if (indicatorRef.current) indicatorRef.current.visible = false
      document.body.style.cursor = 'auto'
    }
    const onMove = (e: PointerEvent) => {
      if (!isDragging.current || gyroEnabled) return
      const dx = e.clientX - lastMouse.current.x
      const dy = e.clientY - lastMouse.current.y
      dragPx.current += Math.abs(dx) + Math.abs(dy)
      // Panorama convention: drag right → scene pans right (camera turns left → yaw increases).
      // Touch gets higher sensitivity because touch events tend to fire with smaller deltas.
      const sens = e.pointerType === 'touch' ? 0.011 : 0.003
      yaw.current += dx * sens
      pitch.current = clampPitch(pitch.current + dy * sens)
      lastMouse.current = { x: e.clientX, y: e.clientY }
      transitioning.current = false
      invalidate()
    }
    const onUp = () => {
      isDragging.current = false
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
    }
  }, [gl, gyroEnabled])

  // ── External wake (mobile D-pad) ────────────────────────────────────────────
  // frameloop is 'demand'; the D-pad lives outside the Canvas and only writes a ref,
  // so it dispatches `vm:wake` to boot the render loop (which then stays alive via
  // the velocity / mobileMove checks in stillActive).
  useEffect(() => {
    const wake = () => invalidate()
    window.addEventListener('vm:wake', wake)
    return () => window.removeEventListener('vm:wake', wake)
  }, [invalidate])

  // ── Keyboard ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const ARROW = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
    const onDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (!keys.current.has(e.code)) invalidate() // bootstrap movement loop on first press
      keys.current.add(e.code)
      if (ARROW.has(e.key)) e.preventDefault()
    }
    const onUp = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      keys.current.delete(e.code)
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [])

  // ── Gyroscope ───────────────────────────────────────────────────────────────
  // Uses RELATIVE orientation (delta from when gyro was enabled) so there is no
  // sudden jump when toggled. alpha=compass heading (increases clockwise), beta=tilt.
  // Low-pass smoothing (α=0.25) kills sensor jitter without adding visible lag.
  useEffect(() => {
    if (!gyroEnabled || typeof window === 'undefined') return
    gyroBase.current = null // reset anchor on each enable
    gyroTarget.current = null
    gyroSmooth.current = null

    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha == null || e.beta == null) return

      if (!gyroBase.current) {
        // First event: anchor device orientation to current camera look direction
        gyroBase.current = { alpha: e.alpha, beta: e.beta, yaw: yaw.current, pitch: pitch.current }
        gyroTarget.current = { yaw: yaw.current, pitch: pitch.current }
        gyroSmooth.current = { alpha: e.alpha, beta: e.beta }
        return
      }

      // Low-pass the raw sensor first — the magnetometer-derived `alpha` twitches even
      // when the phone is held still, which is what made the view jitter on tiny moves.
      const S = 0.25
      const sm = gyroSmooth.current!
      let sda = e.alpha - sm.alpha
      if (sda > 180) sda -= 360
      if (sda < -180) sda += 360
      sm.alpha += sda * S
      sm.beta += (e.beta - sm.beta) * S

      const base = gyroBase.current
      let dAlpha = sm.alpha - base.alpha
      if (dAlpha > 180) dAlpha -= 360 // wrap to [-180, 180]
      if (dAlpha < -180) dAlpha += 360

      // DeviceOrientation alpha increases COUNTER-clockwise, so turning the phone
      // right decreases alpha → yaw must move the same way as the phone (add dAlpha).
      const targetYaw = base.yaw + degToRad(dAlpha)
      // beta increases when tilting forward (looking down) → pitch decreases
      const targetPitch = clampPitch(base.pitch - degToRad(sm.beta - base.beta))

      // Record the RAW target only; the frame loop eases toward it at a fixed rate.
      // Smoothing here (per sensor event) stuttered because deviceorientation fires
      // at an irregular, device-dependent rate.
      gyroTarget.current = { yaw: targetYaw, pitch: targetPitch }
      transitioning.current = false
      invalidate()
    }

    window.addEventListener('deviceorientation', onOrientation, true)
    return () => {
      window.removeEventListener('deviceorientation', onOrientation, true)
      gyroBase.current = null
      gyroSmooth.current = null
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
      let wantX = 0,
        wantZ = 0
      if (keys.current.has('KeyW') || keys.current.has('ArrowUp')) {
        wantX -= sinY
        wantZ -= cosY
      }
      if (keys.current.has('KeyS') || keys.current.has('ArrowDown')) {
        wantX += sinY
        wantZ += cosY
      }
      if (keys.current.has('KeyA') || keys.current.has('ArrowLeft')) {
        wantX -= cosY
        wantZ += sinY
      }
      if (keys.current.has('KeyD') || keys.current.has('ArrowRight')) {
        wantX += cosY
        wantZ -= sinY
      }

      // Normalise diagonal input so diagonal isn't faster
      const len = Math.sqrt(wantX * wantX + wantZ * wantZ)
      if (len > 1) {
        wantX /= len
        wantZ /= len
      }

      const targetVX = wantX * MOVE_SPEED
      const targetVZ = wantZ * MOVE_SPEED

      // Ease velocity toward target (start/stop feel natural, not instant)
      const accel = Math.min(1, ACCEL_FACTOR * delta)
      velocity.current.x += (targetVX - velocity.current.x) * accel
      velocity.current.z += (targetVZ - velocity.current.z) * accel

      const dx = velocity.current.x * delta
      const dz = velocity.current.z * delta

      if (Math.abs(dx) > 0.0001 || Math.abs(dz) > 0.0001) {
        const r = applyMove(targetPos.current, dx, dz, bounds, obstacles)
        // Stop ramming a wall: zero the blocked component so we don't keep pushing
        // into the obstacle every frame (that continuous shove reads as jitter).
        if (!r.mx) velocity.current.x = 0
        if (!r.mz) velocity.current.z = 0
        walkTarget.current = null // keyboard input cancels floor-click walk
        transitioning.current = false
      }
    }

    // ── Mobile D-pad (same accel model) ─────────────────────────────────────────
    const mob = mobileMoveRef?.current
    if (mob && (mob.dx !== 0 || mob.dz !== 0)) {
      const sinY = Math.sin(yaw.current)
      const cosY = Math.cos(yaw.current)
      const wdx = -sinY * mob.dz + cosY * mob.dx
      const wdz = -cosY * mob.dz - sinY * mob.dx
      const accel = Math.min(1, ACCEL_FACTOR * delta)
      velocity.current.x += (wdx * MOVE_SPEED - velocity.current.x) * accel
      velocity.current.z += (wdz * MOVE_SPEED - velocity.current.z) * accel
      const rm = applyMove(
        targetPos.current,
        velocity.current.x * delta,
        velocity.current.z * delta,
        bounds,
        obstacles,
      )
      if (!rm.mx) velocity.current.x = 0
      if (!rm.mz) velocity.current.z = 0
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
        const rw = applyMove(targetPos.current, (dx / dist) * step, (dz / dist) * step, bounds, obstacles)
        // Fully wedged against an obstacle → abandon the target so we don't keep
        // shoving into it (avoids jitter when the clicked point is unreachable).
        if (!rw.mx && !rw.mz) walkTarget.current = null
        transitioning.current = false
      }
    }

    // Smooth position lerp
    camera.position.lerp(targetPos.current, t)

    // Smooth orientation transition on viewpoint snap
    if (transitioning.current && !gyroEnabled) {
      let dyaw = targetYaw.current - yaw.current
      if (dyaw > Math.PI) dyaw -= 2 * Math.PI
      if (dyaw < -Math.PI) dyaw += 2 * Math.PI
      yaw.current += dyaw * t
      pitch.current += (targetPitch.current - pitch.current) * t
      if (Math.abs(dyaw) < 0.001 && Math.abs(targetPitch.current - pitch.current) < 0.001) {
        transitioning.current = false
      }
    }

    // Gyro look: ease toward the latest sensor target at a frame-rate-independent
    // rate. This is what makes phone-tilt looking smooth instead of steppy/laggy.
    if (gyroEnabled && gyroTarget.current) {
      const k = 1 - Math.exp(-GYRO_LERP * delta)
      let gdyaw = gyroTarget.current.yaw - yaw.current
      while (gdyaw > Math.PI) gdyaw -= 2 * Math.PI
      while (gdyaw < -Math.PI) gdyaw += 2 * Math.PI
      yaw.current += gdyaw * k
      pitch.current += (gyroTarget.current.pitch - pitch.current) * k
    }

    camera.quaternion.setFromEuler(new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ'))

    // Update camera state for admin editor viewpoint capture
    if (cameraStateRef) {
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
      cameraStateRef.current = {
        position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        groundPosition: { x: targetPos.current.x, y: 0, z: targetPos.current.z },
        lookAt: {
          x: camera.position.x + dir.x * 5,
          y: camera.position.y + dir.y * 5,
          z: camera.position.z + dir.z * 5,
        },
      }
    }

    // Request next frame only while something is still animating
    const mobActive = !!mobileMoveRef?.current &&
      (mobileMoveRef.current.dx !== 0 || mobileMoveRef.current.dz !== 0)
    const stillActive =
      gyroEnabled ||
      mobActive ||
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
  const floorHitW = floorW + FLOOR_HIT_MARGIN * 2
  const floorHitD = floorD + FLOOR_HIT_MARGIN * 2

  // Walk-here indicator — updated via ref to avoid React re-renders on every mousemove
  const indicatorRef = useRef<THREE.Group>(null)

  const handleFloorClick = (e: { point: THREE.Vector3; stopPropagation: () => void }) => {
    if (dragPx.current > 6) return
    e.stopPropagation()
    const target = resolveWalkTarget(e.point.x, e.point.z, bounds, obstacles)
    const tx = target.x
    const tz = target.z
    if (portalPlaceMode && onPortalPlace) {
      onPortalPlace({ x: tx, z: tz })
      return
    }
    if (isBlocked(tx, tz, obstacles) || pathBlocked(targetPos.current, tx, tz, obstacles)) return
    walkTarget.current = new THREE.Vector3(tx, eyeHeight, tz)
    invalidate()
  }

  const handleFloorMove = (e: { point: THREE.Vector3; stopPropagation: () => void }) => {
    if (isDragging.current) return
    e.stopPropagation()
    const ind = indicatorRef.current
    if (ind) {
      const tx = e.point.x
      const tz = e.point.z
      const insideBounds =
        tx >= bounds.minX && tx <= bounds.maxX &&
        tz >= bounds.minZ && tz <= bounds.maxZ
      ind.position.set(tx, 0.018, tz)
      ind.visible = insideBounds && !isBlocked(tx, tz, obstacles) && !pathBlocked(targetPos.current, tx, tz, obstacles)
    }
    if (portalPlaceMode) document.body.style.cursor = 'cell'
    invalidate()
  }

  const handleFloorLeave = () => {
    if (indicatorRef.current) indicatorRef.current.visible = false
    document.body.style.cursor = 'auto'
    invalidate()
  }

  return (
    <>
      <mesh
        position={[floorCX, 0.015, floorCZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={handleFloorClick}
        onPointerMove={handleFloorMove}
        onPointerLeave={handleFloorLeave}
      >
        <planeGeometry args={[floorHitW, floorHitD]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* Walk-here indicator: ring + inner dot, appears at cursor position on floor */}
      <group ref={indicatorRef} visible={false}>
        {/* Outer ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.18, 0.26, 40]} />
          <meshBasicMaterial color="#f0d060" transparent opacity={0.85} depthWrite={false} />
        </mesh>
        {/* Inner filled circle */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.12, 32]} />
          <meshBasicMaterial color="#f0d060" transparent opacity={0.25} depthWrite={false} />
        </mesh>
        {/* Crosshair lines */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.28, 0.03]} />
          <meshBasicMaterial color="#f0d060" transparent opacity={0.6} depthWrite={false} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.03, 0.28]} />
          <meshBasicMaterial color="#f0d060" transparent opacity={0.6} depthWrite={false} />
        </mesh>
      </group>
    </>
  )
}
