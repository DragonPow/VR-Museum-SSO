import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { loadTexture, greyTexture } from './TextureManager.js'
import type { WallConfig } from './templates.js'

interface Props {
  config: WallConfig
  textureUrl: string | null
  color?: string
}

export function RoomSurface({ config, textureUrl, color = '#d4c9b8' }: Props) {
  const matRef = useRef<THREE.MeshLambertMaterial>(null)

  useEffect(() => {
    if (!matRef.current) return
    if (textureUrl) {
      loadTexture(textureUrl, (tex) => {
        if (!matRef.current) return
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping
        tex.repeat.set(
          Math.max(1, config.size[0] / 3),
          Math.max(1, config.size[1] / 3),
        )
        matRef.current.map = tex
        matRef.current.needsUpdate = true
      })
    } else {
      matRef.current.map = null
      matRef.current.color.set(color)
      matRef.current.needsUpdate = true
    }
  }, [textureUrl, color, config.size])

  return (
    <mesh
      position={config.position}
      rotation={config.rotation as unknown as THREE.Euler}
      receiveShadow={false}
    >
      <planeGeometry args={config.size} />
      <meshLambertMaterial
        ref={matRef}
        map={textureUrl ? greyTexture() : null}
        color={textureUrl ? '#ffffff' : color}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
