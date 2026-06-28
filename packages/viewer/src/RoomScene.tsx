import { useMemo } from 'react'
import type { Room, Item } from '@vm/shared'
import { getRoomSurfaces, getRoomDimensions } from './templates.js'
import { RoomLighting } from './RoomLighting.js'
import { RoomSurface } from './RoomSurface.js'
import { RoomModel } from './RoomModel.js'
import { SlotFrame } from './SlotFrame.js'
import { Portal } from './Portal.js'
import { NavController } from './NavController.js'
import type { RoomBounds } from './NavController.js'

interface Props {
  room: Room
  items: Record<string, Item>
  textures: Record<string, string> // textureId → url
  activeViewpointId: string
  gyroEnabled?: boolean
  mobileMoveRef?: { current: { dx: number; dz: number } }
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
  onSlotSelect,
  onNavigate,
}: Props) {
  const surfaces = getRoomSurfaces(room.template)
  const wallUrl = room.wallTextureId ? (textures[room.wallTextureId] ?? null) : null
  const floorUrl = room.floorTextureId ? (textures[room.floorTextureId] ?? null) : null
  const ceilingUrl = room.ceilingTextureId ? (textures[room.ceilingTextureId] ?? null) : null

  // Walkable bounds — 0.5 m inset from room walls so player can't clip through
  const dim = getRoomDimensions(room.template)
  const WALL_MARGIN = 0.5
  const bounds: RoomBounds = {
    minX: -(dim.width  / 2 - WALL_MARGIN),
    maxX:  (dim.width  / 2 - WALL_MARGIN),
    minZ: -(dim.depth  / 2 - WALL_MARGIN),
    maxZ:  (dim.depth  / 2 - WALL_MARGIN),
  }

  // Derive collision obstacles from freestanding panel slot pairs (PNL-A / PNL-B).
  // Each pair shares a base ID and is mounted on opposite sides of the same panel.
  const panelObstacles = useMemo((): RoomBounds[] => {
    const groups = new Map<string, typeof room.slots[0][]>()
    for (const slot of room.slots) {
      const m = slot.id.match(/^(.+PNL\d+)-[AB]$/i)
      if (m && m[1]) {
        const key = m[1]
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push(slot)
      }
    }
    const result: RoomBounds[] = []
    for (const slots of groups.values()) {
      if (slots.length < 2) continue
      const xs = slots.map((s) => s.transform.position.x)
      const zs = slots.map((s) => s.transform.position.z)
      const hw = Math.max(...slots.map((s) => s.transform.size.w)) / 2
      const MARGIN = 0.4
      result.push({
        minX: Math.min(...xs) - hw - MARGIN,
        maxX: Math.max(...xs) + hw + MARGIN,
        minZ: Math.min(...zs) - MARGIN,
        maxZ: Math.max(...zs) + MARGIN,
      })
    }
    return result
  }, [room.slots])

  const allObstacles = useMemo(
    () => [...panelObstacles, ...(room.obstacles ?? [])],
    [panelObstacles, room.obstacles],
  )

  return (
    <>
      <RoomLighting preset={room.lightingPreset} />

      {room.modelUrl ? (
        <RoomModel url={room.modelUrl} {...(room.modelOffset != null ? { offset: room.modelOffset } : {})} />
      ) : (
        <>
          {/* Walls */}
          {surfaces.walls.map((wall) => (
            <RoomSurface key={wall.name} config={wall} textureUrl={wallUrl} color="#d4c9b8" />
          ))}

          {/* Floor */}
          <RoomSurface config={surfaces.floor} textureUrl={floorUrl} color="#8b7355" />

          {/* Ceiling */}
          <RoomSurface config={surfaces.ceiling} textureUrl={ceilingUrl} color="#f5f0e8" />
        </>
      )}

      {/* Slots */}
      {room.slots
        .filter((s) => s.visible)
        .map((slot) => (
          <SlotFrame
            key={slot.id}
            slot={slot}
            item={slot.itemId ? (items[slot.itemId] ?? null) : null}
            onSelect={onSlotSelect}
          />
        ))}

      {/* Portals */}
      {onNavigate && room.portals?.map((portal) => (
        <Portal key={portal.id} portal={portal} onNavigate={onNavigate} />
      ))}

      {/* Navigation controller — includes keyboard + floor-click + mobile D-pad movement */}
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
