import { useRef, useState, useEffect, useMemo } from 'react'
import { Text } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Slot, DocumentIndexItem } from '@vm/shared'
import { loadTexture, greyTexture } from './TextureManager.js'
import { HERO_SLOT_ID, isBackdropSlotId } from './slotIds.js'

interface Props {
  slot: Slot & { hasBlenderFrame?: boolean; mirrorTextureX?: boolean }
  documentItem: DocumentIndexItem | null
  viewerTextureUrl: string | null
  onSelect: (slotId: string) => void
  hideLabel?: boolean
}

const FRAME_THICKNESS = 0.04
const FRAME_DEPTH     = 0.05   // how far the frame protrudes from the wall
const FRAME_BASE      = 0.01   // gap between wall surface and back of frame (prevents z-fighting)
const FRAME_COLOR = { classic: '#8B6914', modern: '#333333', none: null }
const NAMEPLATE_PRIMARY_COLOR = '#1f2a33'
const NAMEPLATE_SECONDARY_COLOR = '#2f3a42'
const ACRYLIC_FACE_COLOR = '#edf5f7'
const ACRYLIC_PLATE_COLOR = '#f7fbfc'
const ACRYLIC_EDGE_COLOR = '#c7d0d4'
const ACRYLIC_PIN_COLOR = '#b8b1a4'

export function SlotFrame({ slot, documentItem, viewerTextureUrl, onSelect }: Props) {
  const [hovered, setHovered] = useState(false)
  const matRef  = useRef<THREE.MeshLambertMaterial | THREE.MeshBasicMaterial>(null)
  const groupRef = useRef<THREE.Group>(null)
  const { invalidate } = useThree()
  const clonedTexRef = useRef<THREE.Texture | null>(null)
  const [imageAspect, setImageAspect] = useState<number | null>(null)
  const { transform, frameStyle } = slot
  // Use safe defaults so hooks below always receive valid values.
  // The null guard before JSX (after all hooks) prevents any rendering.
  const position = transform?.position ?? { x: 0, y: 0, z: 0 }
  const rotation = transform?.rotation ?? { x: 0, y: 0, z: 0 }
  const size     = transform?.size     ?? { w: 1, h: 0.8 }
  const frameColor = FRAME_COLOR[frameStyle]
  // Fixed backdrop panel (the wide hero banner): show the full-res image exactly as-is
  // — unlit, uncropped, not clickable — so it reads like a real printed panel on the wall.
  const isBackdrop = isBackdropSlotId(slot.id)
  const isK5Portrait = /^VM_Slot_K5_CD_\d{2}$/i.test(slot.id)
  const mirrorTextureX = slot.mirrorTextureX === true
  const hasImage = Boolean(viewerTextureUrl)
  const hasBlenderFrame = slot.hasBlenderFrame || frameColor === null
  // K9 is mounted on the entrance wall whose room-facing side is local -Z.
  // GLB-authored frames already provide the canvas plane; keep live content nearly
  // coplanar instead of applying the procedural-frame offset.
  const canvasZ = slot.id === HERO_SLOT_ID ? -0.035 : (hasBlenderFrame ? 0.003 : FRAME_BASE + FRAME_DEPTH - 0.01)

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'auto'
    return () => { document.body.style.cursor = 'auto' }
  }, [hovered])

  // Clear texture immediately when item changes
  useEffect(() => {
    setImageAspect(null)
    if (matRef.current) {
      matRef.current.map = null
      matRef.current.color.set(isK5Portrait ? ACRYLIC_FACE_COLOR : '#d8cfbf')
      matRef.current.transparent = isK5Portrait && !hasImage
      matRef.current.opacity = isK5Portrait && !hasImage ? 0.34 : 1
      matRef.current.depthWrite = !(isK5Portrait && !hasImage)
      matRef.current.needsUpdate = true
      invalidate()
    }
  }, [documentItem?.id, hasImage, isK5Portrait, invalidate])

  // Load texture as soon as item is available.
  // Using useEffect instead of useFrame so textures load even in frameloop='demand'
  // mode where useFrame only fires on interaction-driven renders.
  useEffect(() => {
    // Backdrop uses the FULL-res original (no downscaling); normal slots use the
    // wall-optimised texture.
    const url = viewerTextureUrl
    if (!url || !matRef.current) return
    loadTexture(url, (tex) => {
      if (!matRef.current) return

      // Clean up previous cloned texture if any
      if (clonedTexRef.current) {
        clonedTexRef.current.dispose()
        clonedTexRef.current = null
      }

      // Always clone the texture so we can safely adjust properties (repeat, offset, colorSpace)
      // for this specific slot frame without affecting other slots sharing the same texture cache.
      const displayTex = tex.clone()
      displayTex.colorSpace = THREE.SRGBColorSpace

      // Set imageAspect from the loaded image (used for geometry containment scaling if fitMode is contain)
      if (displayTex.image && displayTex.image.width && displayTex.image.height) {
        setImageAspect(displayTex.image.width / displayTex.image.height)
      }

      if (mirrorTextureX) {
        displayTex.wrapS = THREE.RepeatWrapping
        displayTex.repeat.x = -1
        displayTex.offset.x = 1
      }

      if (isBackdrop) {
        displayTex.generateMipmaps = false
        displayTex.minFilter = THREE.LinearFilter
        displayTex.magFilter = THREE.LinearFilter
        displayTex.anisotropy = 8
        // Keep backdrop artwork orientation exactly as authored in content.
      } else if (slot.fitMode !== 'contain') {
        // Apply "Cover / Crop" fit mode for normal slots (default)
        if (displayTex.image && displayTex.image.width && displayTex.image.height) {
          const imageAspectVal = displayTex.image.width / displayTex.image.height
          const planeAspect = size.w / size.h

          if (imageAspectVal > planeAspect) {
            // Image is wider than slot: crop left/right
            displayTex.repeat.set(planeAspect / imageAspectVal, 1)
            displayTex.offset.set((1 - planeAspect / imageAspectVal) / 2, 0)
          } else {
            // Image is taller than slot: crop top/bottom
            displayTex.repeat.set(1, imageAspectVal / planeAspect)
            displayTex.offset.set(0, (1 - imageAspectVal / planeAspect) / 2)
          }
        }
      }

      displayTex.needsUpdate = true
      clonedTexRef.current = displayTex
      matRef.current.map = displayTex

      if (isBackdrop) {
        // Brighten the printed backdrop image itself instead of adding a translucent overlay.
        matRef.current.color.setRGB(1.12, 1.12, 1.12)
      } else {
        matRef.current.color.set('#ffffff')
        matRef.current.transparent = false
        matRef.current.opacity = 1
        matRef.current.depthWrite = true
      }
      matRef.current.needsUpdate = true
      invalidate()
    })
  }, [viewerTextureUrl, isBackdrop, mirrorTextureX, size.w, size.h, invalidate])

  useEffect(() => {
    return () => {
      if (clonedTexRef.current) {
        clonedTexRef.current.dispose()
        clonedTexRef.current = null
      }
    }
  }, [viewerTextureUrl])

  const nameplateWidth = Math.max(size.w * 1.14, 0.46)
  const nameplateHeight = 0.16
  const nameplatePinX = nameplateWidth / 2 - 0.045
  const nameplateTextZ = isK5Portrait ? -0.008 : (hasBlenderFrame ? 0.014 : 0.072)
  const k5NameplateFaceTexture = useMemo(() => {
    if (!isK5Portrait) return null
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 256
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const face = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
    face.addColorStop(0, '#fff0a8')
    face.addColorStop(0.18, '#f4d26a')
    face.addColorStop(0.52, '#d7aa35')
    face.addColorStop(0.78, '#f0cc64')
    face.addColorStop(1, '#fff2b8')
    ctx.fillStyle = face
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const softSheen = ctx.createLinearGradient(0, 0, 0, canvas.height)
    softSheen.addColorStop(0, 'rgba(255,255,255,0.34)')
    softSheen.addColorStop(0.34, 'rgba(255,255,255,0.05)')
    softSheen.addColorStop(0.72, 'rgba(86,56,10,0.10)')
    softSheen.addColorStop(1, 'rgba(255,255,255,0.16)')
    ctx.fillStyle = softSheen
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.globalAlpha = 0.07
    ctx.strokeStyle = '#fff7c8'
    ctx.lineWidth = 2
    for (let y = 14; y < canvas.height; y += 16) {
      ctx.beginPath()
      ctx.moveTo(32, y + 0.5)
      ctx.lineTo(canvas.width - 32, y + 0.5)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.strokeStyle = 'rgba(86, 61, 18, 0.46)'
    ctx.lineWidth = 5
    ctx.strokeRect(74, 54, 876, 148)
    ctx.strokeStyle = 'rgba(255, 249, 210, 0.74)'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(54, 28)
    ctx.lineTo(970, 28)
    ctx.moveTo(54, 228)
    ctx.lineTo(970, 228)
    ctx.stroke()

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.anisotropy = 8
    tex.needsUpdate = true
    return tex
  }, [isK5Portrait])

  const k5NameplateLabelTexture = useMemo(() => {
    if (!isK5Portrait || !slot.nameplate) return null
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 256
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
        const role = slot.nameplate.role ? slot.nameplate.role.trim().toUpperCase() : ''
    const name = slot.nameplate.primary ? slot.nameplate.primary.trim().toUpperCase() : ''
    const secondaryText = slot.nameplate.secondary ? slot.nameplate.secondary.trim() : ''

    if (role) {
      // 3-line layout: Role, Name, Year
      // Row 1: Role
      ctx.font = '650 36px system-ui, -apple-system, sans-serif'
      ctx.strokeStyle = 'rgba(255, 246, 199, 0.26)'
      ctx.lineWidth = 0.8
      ctx.strokeText(role, 512, 65)
      ctx.shadowColor = 'rgba(0, 0, 0, 0.10)'
      ctx.shadowBlur = 0.45
      ctx.shadowOffsetX = 0.3
      ctx.shadowOffsetY = 0.45
      ctx.fillStyle = '#4a3819'
      ctx.fillText(role, 512, 65)

      // Row 2: Name
      ctx.font = '700 66px system-ui, -apple-system, sans-serif'
      ctx.strokeStyle = 'rgba(255, 246, 199, 0.26)'
      ctx.lineWidth = 0.8
      ctx.strokeText(name, 512, 132)
      ctx.shadowColor = 'rgba(0, 0, 0, 0.12)'
      ctx.shadowBlur = 0.45
      ctx.shadowOffsetX = 0.35
      ctx.shadowOffsetY = 0.5
      ctx.fillStyle = '#3d3017'
      ctx.fillText(name, 512, 132)

      // Row 3: Year
      if (secondaryText) {
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 0
        ctx.font = '650 46px system-ui, -apple-system, sans-serif'
        ctx.strokeText(secondaryText, 512, 195)
        ctx.shadowColor = 'rgba(0, 0, 0, 0.10)'
        ctx.shadowBlur = 0.45
        ctx.shadowOffsetX = 0.3
        ctx.shadowOffsetY = 0.45
        ctx.fillStyle = '#4a3819'
        ctx.fillText(secondaryText, 512, 195)
      }
    } else {
      // Fallback 2-line layout: Name, Year
      // Row 1: Name
      ctx.font = '700 66px system-ui, -apple-system, sans-serif'
      ctx.strokeStyle = 'rgba(255, 246, 199, 0.26)'
      ctx.lineWidth = 0.8
      ctx.strokeText(name, 512, 102)
      ctx.shadowColor = 'rgba(0, 0, 0, 0.12)'
      ctx.shadowBlur = 0.45
      ctx.shadowOffsetX = 0.35
      ctx.shadowOffsetY = 0.5
      ctx.fillStyle = '#3d3017'
      ctx.fillText(name, 512, 102)

      // Row 2: Year
      if (secondaryText) {
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 0
        ctx.font = '650 46px system-ui, -apple-system, sans-serif'
        ctx.strokeText(secondaryText, 512, 156)
        ctx.shadowColor = 'rgba(0, 0, 0, 0.10)'
        ctx.shadowBlur = 0.45
        ctx.shadowOffsetX = 0.3
        ctx.shadowOffsetY = 0.45
        ctx.fillStyle = '#4a3819'
        ctx.fillText(secondaryText, 512, 156)
      }
    }

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.anisotropy = 8
    tex.needsUpdate = true
    return tex
  }, [isK5Portrait, slot.nameplate?.primary, slot.nameplate?.secondary, slot.nameplate?.role])

  useEffect(() => () => {
    k5NameplateFaceTexture?.dispose()
  }, [k5NameplateFaceTexture])

  useEffect(() => () => {
    k5NameplateLabelTexture?.dispose()
  }, [k5NameplateLabelTexture])

  // Guard after all hooks — slot has no transform yet (GLB not extracted)
  if (!transform) return null

  const isContainMode = slot.fitMode === 'contain'
  const planeAspect = size.w / size.h
  let renderW = size.w
  let renderH = size.h
  let isNearlyMatch = false

  if (isContainMode && imageAspect && !isBackdrop) {
    const aspectDiff = Math.abs(imageAspect - planeAspect) / planeAspect
    if (aspectDiff < 0.12) {
      isNearlyMatch = true
    } else {
      if (imageAspect > planeAspect) {
        // Image is wider than slot: shrink height
        renderH = size.w / imageAspect
      } else {
        // Image is taller than slot: shrink width
        renderW = size.h * imageAspect
      }
    }
  }

  const pos = [position.x, position.y, position.z] as [number, number, number]
  const rot = [rotation.x, rotation.y, rotation.z] as [number, number, number]

  return (
    <group ref={groupRef} position={pos} rotation={rot}>
      {/* White backing plane to fill the rest of the square slot if the image is fit/letterboxed */}
      {isContainMode && hasImage && !isNearlyMatch && (
        <mesh position={[0, 0, canvasZ - 0.001]}>
          <planeGeometry args={[size.w, size.h]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      )}

      {/* Canvas — position depends on whether Blender supplies the frame.
          'none' = Blender frame present: sit at canvas face depth (~2 cm).
          Otherwise: recessed 1 cm behind our R3F frame face. */}
      <mesh
        position={[0, 0, canvasZ]}
        renderOrder={isBackdrop ? 20 : 0}
        {...(documentItem && !isBackdrop ? {
          onPointerOver: (e) => { e.stopPropagation(); setHovered(true) },
          onPointerOut:  () => setHovered(false),
          onClick:       (e) => { e.stopPropagation(); onSelect(slot.id) },
        } : {})}
      >
        <planeGeometry args={[renderW, renderH]} />
        {isBackdrop ? (
          <meshBasicMaterial
            ref={matRef as never}
            map={documentItem ? greyTexture() : null}
            color={documentItem ? '#ffffff' : '#d8cfbf'}
            toneMapped={false}
            depthTest={true}
            depthWrite={!isBackdrop}
            side={THREE.DoubleSide}
          />
        ) : (
          // UNLIT like the room shell. A lit material here was the bug: the baked room
          // only has ambientLight 0.32, and three r155+ divides ambient irradiance by PI
          // (BRDF_Lambert), so every photo rendered at 0.32/PI ~= 10% albedo and then got
          // squashed again by the global AgX tone mapping -- while the walls/floor sit at
          // 100% (MeshBasicMaterial + toneMapped:false). Result: photos looked pitch black
          // next to a white wall. The hero slot was already on this path and looked right.
          <meshBasicMaterial
            ref={matRef as never}
            map={viewerTextureUrl ? greyTexture() : null}
            color={viewerTextureUrl ? '#ffffff' : (isK5Portrait ? ACRYLIC_FACE_COLOR : '#d8cfbf')}
            transparent={isK5Portrait && !viewerTextureUrl}
            opacity={isK5Portrait && !viewerTextureUrl ? 0.34 : 1}
            depthWrite={!(isK5Portrait && !viewerTextureUrl)}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        )}
      </mesh>

      {slot.nameplate && !isBackdrop && (
        <group position={[0, -size.h / 2 - 0.235, nameplateTextZ]}>
          {!isK5Portrait && (
            <>
              <mesh renderOrder={9}>
                <planeGeometry args={[nameplateWidth, nameplateHeight]} />
                <meshBasicMaterial
                  color={ACRYLIC_PLATE_COLOR}
                  transparent
                  opacity={0.58}
                  depthWrite={false}
                  toneMapped={false}
                  side={THREE.DoubleSide}
                />
              </mesh>
              <mesh position={[0, nameplateHeight / 2, 0.004]} renderOrder={10}>
                <planeGeometry args={[nameplateWidth, 0.008]} />
                <meshBasicMaterial color={ACRYLIC_EDGE_COLOR} transparent opacity={0.82} depthWrite={false} toneMapped={false} />
              </mesh>
              <mesh position={[0, -nameplateHeight / 2, 0.004]} renderOrder={10}>
                <planeGeometry args={[nameplateWidth, 0.008]} />
                <meshBasicMaterial color={ACRYLIC_EDGE_COLOR} transparent opacity={0.72} depthWrite={false} toneMapped={false} />
              </mesh>
              <mesh position={[-nameplatePinX, 0, 0.009]} renderOrder={11}>
                <circleGeometry args={[0.018, 24]} />
                <meshBasicMaterial color={ACRYLIC_PIN_COLOR} transparent opacity={0.9} depthWrite={false} toneMapped={false} />
              </mesh>
              <mesh position={[nameplatePinX, 0, 0.009]} renderOrder={11}>
                <circleGeometry args={[0.018, 24]} />
                <meshBasicMaterial color={ACRYLIC_PIN_COLOR} transparent opacity={0.9} depthWrite={false} toneMapped={false} />
              </mesh>
            </>
          )}
          {isK5Portrait && k5NameplateFaceTexture && (
            <mesh position={[0, -0.004, 0.011]} renderOrder={88}>
              <planeGeometry args={[nameplateWidth * 0.98, nameplateHeight * 1.04]} />
              <meshBasicMaterial
                map={k5NameplateFaceTexture}
                depthTest={true}
                depthWrite={false}
                polygonOffset
                polygonOffsetFactor={-1}
                polygonOffsetUnits={-1}
                toneMapped={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          )}
          {isK5Portrait && k5NameplateLabelTexture ? (
            <mesh position={[0, -0.002, 0.016]} renderOrder={90}>
              <planeGeometry args={[nameplateWidth * 0.82, nameplateHeight * 0.70]} />
              <meshBasicMaterial
                map={k5NameplateLabelTexture}
                transparent
                depthTest={true}
                depthWrite={false}
                toneMapped={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          ) : (
            <>
              <Text
                position={[0, 0.03, 0.014]}
                fontSize={0.032}
                maxWidth={Math.max(size.w * 0.86, 0.34)}
                textAlign="center"
                anchorX="center"
                anchorY="middle"
                color={NAMEPLATE_PRIMARY_COLOR}
                renderOrder={12}
                material-toneMapped={false}
                material-depthWrite={false}
              >
                {slot.nameplate.primary}
              </Text>
              {slot.nameplate.secondary && (
                <Text
                  position={[0, -0.034, 0.014]}
                  fontSize={0.03}
                  maxWidth={Math.max(size.w * 0.86, 0.34)}
                  textAlign="center"
                  anchorX="center"
                  anchorY="middle"
                  color={NAMEPLATE_SECONDARY_COLOR}
                  renderOrder={12}
                  material-toneMapped={false}
                  material-depthWrite={false}
                >
                  {slot.nameplate.secondary}
                </Text>
              )}
            </>
          )}
        </group>
      )}

      {/* Hover glow — behind frame base */}
      {hovered && (
        <mesh position={[0, 0, -0.005]}>
          <planeGeometry args={[size.w + FRAME_THICKNESS * 2 + 0.04, size.h + FRAME_THICKNESS * 2 + 0.04]} />
          <meshBasicMaterial color="#f0d060" transparent opacity={0.3} />
        </mesh>
      )}

      {/* Frame — 4 box beams that protrude FRAME_DEPTH from the wall */}
      {frameColor && (
        <>
          {/* Top */}
          <mesh position={[0, size.h / 2 + FRAME_THICKNESS / 2, FRAME_BASE + FRAME_DEPTH / 2]}>
            <boxGeometry args={[size.w + FRAME_THICKNESS * 2, FRAME_THICKNESS, FRAME_DEPTH]} />
            <meshLambertMaterial color={frameColor} />
          </mesh>
          {/* Bottom */}
          <mesh position={[0, -(size.h / 2 + FRAME_THICKNESS / 2), FRAME_BASE + FRAME_DEPTH / 2]}>
            <boxGeometry args={[size.w + FRAME_THICKNESS * 2, FRAME_THICKNESS, FRAME_DEPTH]} />
            <meshLambertMaterial color={frameColor} />
          </mesh>
          {/* Left */}
          <mesh position={[-(size.w / 2 + FRAME_THICKNESS / 2), 0, FRAME_BASE + FRAME_DEPTH / 2]}>
            <boxGeometry args={[FRAME_THICKNESS, size.h, FRAME_DEPTH]} />
            <meshLambertMaterial color={frameColor} />
          </mesh>
          {/* Right */}
          <mesh position={[size.w / 2 + FRAME_THICKNESS / 2, 0, FRAME_BASE + FRAME_DEPTH / 2]}>
            <boxGeometry args={[FRAME_THICKNESS, size.h, FRAME_DEPTH]} />
            <meshLambertMaterial color={frameColor} />
          </mesh>
        </>
      )}

    </group>
  )
}
