import { useCallback, useMemo, useState } from 'react'
import { resolveAssetUrl, resolveDocumentImageVariantUrl } from '@vm/shared'
import type { Room, DocumentIndexItem, Slot, Vec3 } from '@vm/shared'
import { getRoomSurfaces, getRoomDimensions } from './templates.js'
import { RoomLighting } from './RoomLighting.js'
import { RoomSurface } from './RoomSurface.js'
import { RoomModel } from './RoomModel.js'
import type { ExtractedSlot } from './RoomModel.js'
import { SlotFrame } from './SlotFrame.js'
import { FloorPortal } from './FloorPortal.js'
import { NavController } from './NavController.js'
import type { RoomBounds } from './NavController.js'
import type { CameraState } from './NavController.js'

interface Props {
  room: Room
  documents: Record<string, DocumentIndexItem>
  textures: Record<string, string>
  activeViewpointId: string
  gyroEnabled?: boolean
  mobileMoveRef?: { current: { dx: number; dz: number } }
  hideLabels?: boolean
  onSlotSelect: (slotId: string, documents: DocumentIndexItem[]) => void
  onNavigate?: (roomId: string) => void
  /** Admin editor: receives live camera position+lookAt each frame */
  cameraStateRef?: React.MutableRefObject<CameraState | null>
  /** Admin editor: when true, floor clicks call onPortalPlace instead of walking */
  portalPlaceMode?: boolean
  onPortalPlace?: (pos: { x: number; z: number }) => void
  /** Admin editor: override walkable bounds (e.g. large plane for GLB rooms) */
  boundsOverride?: RoomBounds
  /** Optional asset host prefix, e.g. R2 public domain */
  assetBaseUrl?: string
}

export function RoomScene({
  room,
  documents,
  textures,
  activeViewpointId,
  gyroEnabled = false,
  mobileMoveRef,
  hideLabels = false,
  onSlotSelect,
  onNavigate,
  cameraStateRef,
  portalPlaceMode = false,
  onPortalPlace,
  boundsOverride,
  assetBaseUrl,
}: Props) {
  const surfaces = getRoomSurfaces(room.template)
  const wallUrl = resolveAssetUrl(
    room.wallTextureId ? (textures[room.wallTextureId] ?? null) : null,
    { assetBaseUrl },
  )
  const floorUrl = resolveAssetUrl(
    room.floorTextureId ? (textures[room.floorTextureId] ?? null) : null,
    { assetBaseUrl },
  )
  const ceilingUrl = resolveAssetUrl(
    room.ceilingTextureId ? (textures[room.ceilingTextureId] ?? null) : null,
    { assetBaseUrl },
  )
  const modelUrl = resolveAssetUrl(room.modelUrl, { assetBaseUrl })
  const lightmapUrl = resolveAssetUrl(room.lightmapUrl, { assetBaseUrl })

  // ── GLB slot extraction ──────────────────────────────────────────────────────
  // When the room has a GLB model, VM_Slot_* meshes are the source of truth for
  // slot positions. The JSON only provides metadata (documentIds, frameStyle, etc.).
  const [glbSlots, setGlbSlots] = useState<ExtractedSlot[]>([])
  const handleSlotsExtracted = useCallback((slots: ExtractedSlot[]) => {
    setGlbSlots(slots)
  }, [])
  const [glbObstacles, setGlbObstacles] = useState<RoomBounds[]>([])
  const handleObstaclesExtracted = useCallback((obs: RoomBounds[]) => {
    setGlbObstacles(obs)
  }, [])
  const [glbBounds, setGlbBounds] = useState<RoomBounds | null>(null)
  const handleBoundsExtracted = useCallback((b: RoomBounds) => {
    setGlbBounds(b)
  }, [])
  const knownSlotIds = useMemo(() => room.slots.map((s) => s.id), [room.slots])

  // ── Walkable bounds ──────────────────────────────────────────────────────────
  // Procedural rooms (no modelUrl) use the fixed template box. GLB rooms derive
  // walkable bounds from the real slot positions extracted from the model, since
  // custom room geometry rarely matches one of the small fixed template presets.
  const WALL_MARGIN = 0.28
  const bounds: RoomBounds = useMemo(() => {
    if (boundsOverride) return boundsOverride

    // Prefer the real room-shell footprint so the visitor can't walk out through
    // the perimeter walls. Outer shell walls need a firmer inset than interior
    // dividers so the camera cannot reveal the outside/back faces.
    if (modelUrl && glbBounds) {
      return {
        minX: glbBounds.minX + WALL_MARGIN,
        maxX: glbBounds.maxX - WALL_MARGIN,
        minZ: glbBounds.minZ + WALL_MARGIN,
        maxZ: glbBounds.maxZ - WALL_MARGIN,
      }
    }
    // Fallback until the shell bounds arrive: derive from slot positions.
    if (modelUrl && glbSlots.length > 0) {
      const xs = glbSlots.map((s) => s.transform.position.x)
      const zs = glbSlots.map((s) => s.transform.position.z)
      return {
        minX: Math.min(...xs) - 1.5,
        maxX: Math.max(...xs) + 1.5,
        minZ: Math.min(...zs) - 1.5,
        maxZ: Math.max(...zs) + 1.5,
      }
    }

    const dim = getRoomDimensions(room.template)
    return {
      minX: -(dim.width / 2 - WALL_MARGIN),
      maxX: dim.width / 2 - WALL_MARGIN,
      minZ: -(dim.depth / 2 - WALL_MARGIN),
      maxZ: dim.depth / 2 - WALL_MARGIN,
    }
  }, [boundsOverride, modelUrl, glbBounds, glbSlots, room.template])

  // ── Collision obstacles ──────────────────────────────────────────────────────
  const panelObstacles = useMemo(() => {
    const groups = new Map<string, (typeof room.slots)[0][]>()
    for (const slot of room.slots) {
      const m = slot.id.match(/^(.+PNL\d+)-[AB]$/i)
      if (m?.[1]) {
        if (!groups.has(m[1])) groups.set(m[1], [])
        groups.get(m[1])!.push(slot)
      }
    }
    const result: RoomBounds[] = []
    for (const slots of groups.values()) {
      if (slots.length < 2) continue
      const xs = slots.map((s) => s.transform?.position.x ?? 0)
      const zs = slots.map((s) => s.transform?.position.z ?? 0)
      const hw = Math.max(...slots.map((s) => (s.transform?.size.w ?? 1) / 2))
      result.push({
        minX: Math.min(...xs) - hw - 0.4,
        maxX: Math.max(...xs) + hw + 0.4,
        minZ: Math.min(...zs) - 0.4,
        maxZ: Math.max(...zs) + 0.4,
      })
    }
    return result
  }, [room.slots])

  const allObstacles = useMemo(
    () => [...panelObstacles, ...glbObstacles, ...(room.obstacles ?? [])],
    [panelObstacles, glbObstacles, room.obstacles],
  )

  // ── Resolve final slot list ──────────────────────────────────────────────────
  const resolvedSlots = useMemo((): (Slot & { hasBlenderFrame: boolean })[] => {
    if (glbSlots.length > 0) {
      // GLB-driven: merge extracted positions with JSON metadata
      const jsonById = new Map(room.slots.map((s) => [s.id, s]))
      return glbSlots
        .map((gs): Slot & { hasBlenderFrame: boolean } => {
          const json = jsonById.get(gs.id)
          return {
            id: gs.id,
            roomId: room.id,
            name: json?.name ?? gs.id,
            type: json?.type ?? 'image',
            // When Blender already provides a 3D Frame primitive, suppress R3F frame boxes
            frameStyle: gs.hasBlenderFrame ? 'none' : (json?.frameStyle ?? 'classic'),
            documentIds: json?.documentIds ?? [],
            visible: json?.visible ?? true,
            transform: gs.transform,
            hasBlenderFrame: gs.hasBlenderFrame,
          }
        })
        .filter((s) => s.visible)
    }

    // Procedural room or GLB not yet extracted: use JSON transforms directly
    return room.slots
      .filter((s) => s.visible && s.transform != null)
      .map((s) => ({ ...s, hasBlenderFrame: false }))
  }, [glbSlots, room.slots, room.id])

  return (
    <>
      <RoomLighting preset={room.lightingPreset} baked={!!lightmapUrl} />

      {modelUrl ? (
        <RoomModel
          url={modelUrl}
          {...(room.modelOffset != null ? { offset: room.modelOffset } : {})}
          knownSlotIds={knownSlotIds}
          {...(lightmapUrl ? { lightmapUrl } : {})}
          onSlotsExtracted={handleSlotsExtracted}
          onObstaclesExtracted={handleObstaclesExtracted}
          onBoundsExtracted={handleBoundsExtracted}
        />
      ) : (
        <>
          {surfaces.walls.map((wall) => (
            <RoomSurface key={wall.name} config={wall} textureUrl={wallUrl} color="#d4c9b8" />
          ))}
          <RoomSurface config={surfaces.floor} textureUrl={floorUrl} color="#8b7355" />
          <RoomSurface config={surfaces.ceiling} textureUrl={ceilingUrl} color="#f5f0e8" />
        </>
      )}

      {resolvedSlots.map((slot) => (
        <SlotFrame
          key={slot.id}
          slot={slot}
          documentItem={(slot.documentIds ?? [])[0] ? (documents[(slot.documentIds ?? [])[0]] ?? null) : null}
          viewerTextureUrl={(() => {
            const firstId = (slot.documentIds ?? [])[0]
            const document = firstId ? documents[firstId] : null
            const variant = (slot.id === 'VM_Slot_TT_9000' || slot.name === 'TT_9000') ? 'full' : (slot.viewerVariant ?? 'wall')
            return resolveDocumentImageVariantUrl(document?.documentKey ?? null, document?.viewerImageId ?? null, variant, { assetBaseUrl })
          })()}
          onSelect={(slotId) => onSlotSelect(slotId, (slot.documentIds ?? []).map((id) => documents[id]).filter((document): document is DocumentIndexItem => Boolean(document)))}
          hideLabel={hideLabels}
        />
      ))}

      {room.portals?.map((portal) => (
        <FloorPortal key={portal.id} portal={portal} onNavigate={onNavigate ?? (() => {})} />
      ))}

      <NavController
        viewpoints={room.viewpoints}
        activeViewpointId={activeViewpointId}
        gyroEnabled={gyroEnabled}
        bounds={bounds}
        obstacles={allObstacles}
        portalPlaceMode={portalPlaceMode}
        {...(cameraStateRef != null ? { cameraStateRef } : {})}
        {...(onPortalPlace != null ? { onPortalPlace } : {})}
        {...(mobileMoveRef != null ? { mobileMoveRef } : {})}
      />
    </>
  )
}
