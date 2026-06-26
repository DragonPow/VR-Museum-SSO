import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
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
      gl={{
        antialias: perf.tier !== 'low',
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
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
