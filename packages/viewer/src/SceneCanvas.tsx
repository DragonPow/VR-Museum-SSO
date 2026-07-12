import { Canvas, useThree } from '@react-three/fiber'
import { Suspense, useEffect } from 'react'
import * as THREE from 'three'
import { getPerfConfig } from './PerfGuard.js'

interface Props {
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

/**
 * Adaptive vertical FOV. three.js `fov` is VERTICAL, so on a tall portrait phone a
 * fixed 75° vertical FOV squeezes the HORIZONTAL field to ~40° — it feels like
 * looking through a tube. This widens the vertical FOV only when the view is narrow
 * (portrait), so the horizontal field never drops below `minHFov`. Desktop/landscape
 * is left untouched.
 */
function AdaptiveFov({ baseFov = 75, minHFov = 62, maxVFov = 92 }) {
  const camera = useThree((s) => s.camera)
  const width = useThree((s) => s.size.width)
  const height = useThree((s) => s.size.height)
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    if (!cam.isPerspectiveCamera) return
    const aspect = width / Math.max(height, 1)
    const d2r = Math.PI / 180
    const r2d = 180 / Math.PI
    let vfov = baseFov
    const hfov = 2 * Math.atan(Math.tan((baseFov * d2r) / 2) * aspect) * r2d
    if (hfov < minHFov) {
      vfov = Math.min(maxVFov, 2 * Math.atan(Math.tan((minHFov * d2r) / 2) / aspect) * r2d)
    }
    if (Math.abs(cam.fov - vfov) > 0.05) {
      cam.fov = vfov
      cam.updateProjectionMatrix()
    }
  }, [camera, width, height, baseFov, minHFov, maxVFov])
  return null
}

export function SceneCanvas({ children, style, className }: Props) {
  const perf = getPerfConfig()

  return (
    <Canvas
      dpr={perf.dpr}
      frameloop={perf.frameloop}
      shadows={false}
      // Match Blender 5.x default "AgX" view transform: desaturates highlights and
      // pulls colors toward neutral, so PBR textures read the same as in the Blender
      // viewport (instead of the over-saturated look of NoToneMapping / flat).
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.AgXToneMapping
        gl.toneMappingExposure = 1.0
      }}
      gl={{
        antialias: perf.tier !== 'low',
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
        toneMapping: THREE.AgXToneMapping,
      }}
      camera={{ fov: 75, near: 0.1, far: 100 }}
      style={{ background: '#1a1410', ...style }}
      className={className}
    >
      <AdaptiveFov />
      <Suspense fallback={null}>
        {children}
      </Suspense>
    </Canvas>
  )
}
