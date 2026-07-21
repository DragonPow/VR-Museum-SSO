import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * A single zone title, rendered in code to replace the pill+text that used to be
 * baked into the GLB.
 *
 * The pill AND its text are drawn together into a 2D <canvas> and shown as an unlit
 * textured plane — the same proven MeshBasicMaterial path the walls and photos use.
 * This deliberately avoids troika/drei <Text>: under this Vite build troika produced
 * no glyphs at all (blank pill). Canvas 2D uses the browser's own font rendering, so
 * Vietnamese diacritics are guaranteed with no external font / CDN / web worker.
 *
 * The plane AUTO-SIZES to the text (canvas width = measured text + padding), and is
 * placed at the baked pill's centre with the wall-facing basis extracted from the GLB.
 */

// On-screen pill colour (sRGB) == baked emission (0,0.34,0.66 linear); cream text.
const PILL_CSS = '#009ed4'
const TEXT_CSS = '#faf5e6'

const PPM = 512 // canvas pixels per world metre (texture crispness)
const PILL_H_M = 0.42 // world height of the pill (m); baked was 0.448
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
  ctx.fillStyle = PILL_CSS
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.arcTo(w, 0, w, h, r)
  ctx.arcTo(w, h, 0, h, r)
  ctx.arcTo(0, h, 0, 0, r)
  ctx.arcTo(0, 0, w, 0, r)
  ctx.closePath()
  ctx.fill()

  // Centred title text.
  ctx.font = font
  ctx.fillStyle = TEXT_CSS
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, w / 2, h / 2 + FONT_PX * 0.04)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  tex.needsUpdate = true
  return { tex, aspect: w / h }
}

interface Props {
  position: [number, number, number]
  rotation: [number, number, number]
  text: string
}

export function ZoneTitle({ position, rotation, text }: Props) {
  // frameloop is 'demand' (see PerfGuard) — force one draw once the texture exists.
  const invalidate = useThree((s) => s.invalidate)
  const { tex, aspect } = useMemo(() => makeTitleTexture(text), [text])
  useEffect(() => {
    invalidate()
    return () => tex.dispose()
  }, [tex, invalidate])

  const worldW = PILL_H_M * aspect

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[worldW, PILL_H_M]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
