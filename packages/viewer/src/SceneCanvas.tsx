import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import * as THREE from 'three'
import { getPerfConfig } from './PerfGuard.js'

interface Props {
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
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
        gl.toneMappingExposure = 1
      }}
      gl={{
        antialias: perf.tier !== 'low',
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
        toneMapping: THREE.AgXToneMapping,
      }}
      camera={{ fov: 75, near: 0.1, far: 100 }}
      style={{ background: '#1a1410', ...style }}
      className={className}
    >
      <Suspense fallback={null}>
        {children}
      </Suspense>
    </Canvas>
  )
}
