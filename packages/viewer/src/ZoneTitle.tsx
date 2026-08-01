import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * A single zone title, rendered in code to replace the pill+text that used to be
 * baked into the GLB.
 *
 * The gold face and its text are drawn together into a 2D <canvas> and placed on
 * a shallow 3D plaque. That keeps titles editable while avoiding the "floating
 * sticker" look of a bare plane.
 */

// Runtime title style mirrors the Blender brushed-gold title material.
const TEXT_CSS = '#1d1208'
const GOLD_EDGE_CSS = '#ad7a24'
const GOLD_BASE_CSS = '#d8a234'
const GOLD_LIGHT_CSS = '#ffe38a'

const PPM = 512 // canvas pixels per world metre (texture crispness)
const PILL_H_M = 0.42 // world height of the pill (m); baked was 0.448
const PLAQUE_DEPTH_M = 0.035
const PLAQUE_BEVEL_M = 0.012
const WALL_GAP_M = 0.003
const FACE_GAP_M = 0.014
const FONT_PX = Math.round(0.24 * PPM) // glyph height, matches baked 0.24 m
const PAD_X_PX = Math.round(0.3 * PPM) // horizontal padding each side of the text
const FONT_STACK = "'Segoe UI', system-ui, 'Arial', sans-serif"

function makeTitleTexture(text: string): { tex: THREE.CanvasTexture; aspect: number } {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const font = `600 ${FONT_PX}px ${FONT_STACK}`
  ctx.font = font
  const textW = Math.ceil(ctx.measureText(text).width)
  const h = Math.round(PILL_H_M * PPM)
  const w = textW + PAD_X_PX * 2
  canvas.width = w
  canvas.height = h

  // Rounded "stadium" pill; corners stay transparent so it floats on the wall.
  const r = h / 2
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.arcTo(w, 0, w, h, r)
  ctx.arcTo(w, h, 0, h, r)
  ctx.arcTo(0, h, 0, 0, r)
  ctx.arcTo(0, 0, w, 0, r)
  ctx.closePath()
  ctx.save()
  ctx.clip()

  const base = ctx.createLinearGradient(0, 0, w, 0)
  base.addColorStop(0, GOLD_EDGE_CSS)
  base.addColorStop(0.18, GOLD_BASE_CSS)
  base.addColorStop(0.52, '#e7b53d')
  base.addColorStop(0.82, GOLD_BASE_CSS)
  base.addColorStop(1, '#9c681e')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, w, h)

  ctx.globalAlpha = 0.34
  for (const x of [-w * 0.18, w * 0.06, w * 0.31, w * 0.57, w * 0.83]) {
    const sheen = ctx.createLinearGradient(x, h, x + w * 0.26, 0)
    sheen.addColorStop(0, 'rgba(255,255,255,0)')
    sheen.addColorStop(0.46, GOLD_LIGHT_CSS)
    sheen.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = sheen
    ctx.fillRect(0, 0, w, h)
  }

  ctx.globalAlpha = 0.11
  ctx.strokeStyle = '#6f4818'
  ctx.lineWidth = 1
  for (let y = 1; y < h; y += 5) {
    ctx.beginPath()
    ctx.moveTo(0, y + Math.sin(y * 0.18) * 0.8)
    ctx.lineTo(w, y + Math.sin(y * 0.18 + 1.7) * 0.8)
    ctx.stroke()
  }
  ctx.restore()

  // Centred title text.
  ctx.font = font
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = Math.max(2, Math.round(FONT_PX * 0.035))
  ctx.strokeStyle = 'rgba(255, 232, 154, 0.34)'
  ctx.strokeText(text, w / 2, h / 2 + FONT_PX * 0.04)
  ctx.fillStyle = TEXT_CSS
  ctx.fillText(text, w / 2, h / 2 + FONT_PX * 0.04)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  tex.needsUpdate = true
  return { tex, aspect: w / h }
}

function makePlaqueGeometry(width: number, height: number): THREE.ExtrudeGeometry {
  const hw = width / 2
  const hh = height / 2
  const r = hh
  const shape = new THREE.Shape()
  shape.moveTo(-hw + r, -hh)
  shape.lineTo(hw - r, -hh)
  shape.absarc(hw - r, 0, r, -Math.PI / 2, Math.PI / 2, false)
  shape.lineTo(-hw + r, hh)
  shape.absarc(-hw + r, 0, r, Math.PI / 2, Math.PI * 1.5, false)
  shape.closePath()

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: PLAQUE_DEPTH_M,
    bevelEnabled: true,
    bevelSize: PLAQUE_BEVEL_M,
    bevelThickness: PLAQUE_BEVEL_M * 0.5,
    bevelSegments: 4,
    curveSegments: 24,
  })
  geometry.computeVertexNormals()
  return geometry
}

interface Props {
  position: [number, number, number]
  rotation: [number, number, number]
  text: string
}

export function ZoneTitle({ position, rotation, text }: Props) {
  // frameloop is 'demand' (see PerfGuard); force one draw once the texture exists.
  const invalidate = useThree((s) => s.invalidate)
  const { tex, aspect } = useMemo(() => makeTitleTexture(text), [text])
  const worldW = PILL_H_M * aspect
  const plaqueGeometry = useMemo(() => makePlaqueGeometry(worldW, PILL_H_M), [worldW])

  useEffect(() => {
    invalidate()
    return () => {
      tex.dispose()
      plaqueGeometry.dispose()
    }
  }, [tex, plaqueGeometry, invalidate])

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, WALL_GAP_M]} renderOrder={1}>
        <primitive object={plaqueGeometry} attach="geometry" />
        <meshBasicMaterial color={GOLD_BASE_CSS} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, WALL_GAP_M + PLAQUE_DEPTH_M + FACE_GAP_M]} renderOrder={2}>
        <planeGeometry args={[worldW, PILL_H_M]} />
        <meshBasicMaterial
          map={tex}
          transparent
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}
