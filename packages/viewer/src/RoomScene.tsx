import { useCallback, useMemo, useState } from 'react'
import type { Room, Item, Slot } from '@vm/shared'
import { getRoomSurfaces, getRoomDimensions } from './templates.js'
import { RoomLighting } from './RoomLighting.js'
import { RoomSurface } from './RoomSurface.js'
import { RoomModel } from './RoomModel.js'
import type { ExtractedSlot } from './RoomModel.js'
import { SlotFrame } from './SlotFrame.js'
import { Portal } from './Portal.js'
import { NavController } from './NavController.js'
import type { RoomBounds } from './NavController.js'

interface Props {
  room: Room
  items: Record<string, Item>
  textures: Record<string, string>
  activeViewpointId: string
  gyroEnabled?: boolean
  mobileMoveRef?: { current: { dx: number; dz: number } }
  hideLabels?: boolean
  onSlotSelect: (slotId: string, item: Item | null) => void
  onNavigate?: (roomId: string) => void
}

export function RoomScene({
  room,
  items,
  textures,
  activeViewpointId,
  gyroEnabled = false,
  mobileMoveRef,
  hideLabels = false,
  onSlotSelect,
  onNavigate,
}: Props) {
  const surfaces = getRoomSurfaces(room.template)
  const wallUrl    = room.wallTextureId    ? (textures[room.wallTextureId]    ?? null) : null
  const floorUrl   = room.floorTextureId   ? (textures[room.floorTextureId]   ?? null) : null
  const ceilingUrl = room.ceilingTextureId ? (textures[room.ceilingTextureId] ?? null) : null

  // ── Walkable bounds ──────────────────────────────────────────────────────────
  const dim = getRoomDimensions(room.template)
  const WALL_MARGIN = 0.5
  const bounds: RoomBounds = {
    minX: -(dim.width  / 2 - WALL_MARGIN),
    maxX:  (dim.width  / 2 - WALL_MARGIN),
    minZ: -(dim.depth  / 2 - WALL_MARGIN),
    maxZ:  (dim.depth  / 2 - WALL_MARGIN),
  }

  // ── Collision obstacles ──────────────────────────────────────────────────────
  const panelObstacles = useMemo(() => {
    const groups = new Map<string, typeof room.slots[0][]>()
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
      const xs  = slots.map((s) => s.transform?.position.x ?? 0)
      const zs  = slots.map((s) => s.transform?.position.z ?? 0)
      const hw  = Math.max(...slots.map((s) => (s.transform?.size.w ?? 1) / 2))
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
    () => [...panelObstacles, ...(room.obstacles ?? [])],
    [panelObstacles, room.obstacles],
  )

  // ── GLB slot extraction ──────────────────────────────────────────────────────
  // When the room has a GLB model, VM_Slot_* meshes are the source of truth for
  // slot positions. The JSON only provides metadata (itemId, frameStyle, etc.).
  const [glbSlots, setGlbSlots] = useState<ExtractedSlot[]>([])
  const handleSlotsExtracted = useCallback((slots: ExtractedSlot[]) => {
    setGlbSlots(slots)
  }, [])

  // ── Resolve final slot list ──────────────────────────────────────────────────
  const resolvedSlots = useMemo((): (Slot & { hasBlenderFrame: boolean })[] => {
    if (glbSlots.length > 0) {
      // GLB-driven: merge extracted positions with JSON metadata
      const jsonById = new Map(room.slots.map((s) => [s.id, s]))
      return glbSlots
        .map((gs): Slot & { hasBlenderFrame: boolean } => {
          const json = jsonById.get(gs.id)
          return {
            id:              gs.id,
            roomId:          room.id,
            name:            json?.name       ?? gs.id,
            type:            json?.type       ?? 'image',
            // When Blender already provides a 3D Frame primitive, suppress R3F frame boxes
            frameStyle:      gs.hasBlenderFrame ? 'none' : (json?.frameStyle ?? 'classic'),
            itemId:          json?.itemId     ?? null,
            visible:         json?.visible    ?? true,
            transform:       gs.transform,
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
      <RoomLighting preset={room.lightingPreset} />

      {room.modelUrl ? (
        <RoomModel
          url={room.modelUrl}
          {...(room.modelOffset != null ? { offset: room.modelOffset } : {})}
          onSlotsExtracted={handleSlotsExtracted}
        />
      ) : (
        <>
          {surfaces.walls.map((wall) => (
            <RoomSurface key={wall.name} config={wall} textureUrl={wallUrl} color="#d4c9b8" />
          ))}
          <RoomSurface config={surfaces.floor}   textureUrl={floorUrl}   color="#8b7355" />
          <RoomSurface config={surfaces.ceiling} textureUrl={ceilingUrl} color="#f5f0e8" />
        </>
      )}

      {resolvedSlots.map((slot) => (
        <SlotFrame
          key={slot.id}
          slot={slot}
          item={slot.itemId ? (items[slot.itemId] ?? null) : null}
          onSelect={onSlotSelect}
          hideLabel={hideLabels}
        />
      ))}

      {onNavigate && room.portals?.map((portal) => (
        <Portal key={portal.id} portal={portal} onNavigate={onNavigate} />
      ))}

      <NavController
        viewpoints={room.viewpoints}
        activeViewpointId={activeViewpointId}
        gyroEnabled={gyroEnabled}
        bounds={bounds}
        obstacles={allObstacles}
        {...(mobileMoveRef != null ? { mobileMoveRef } : {})}
      />
    </>
  )
}
