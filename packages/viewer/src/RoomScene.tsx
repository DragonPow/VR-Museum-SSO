import type { Room, Item } from '@vm/shared'
import { getRoomSurfaces } from './templates.js'
import { RoomLighting } from './RoomLighting.js'
import { RoomSurface } from './RoomSurface.js'
import { SlotFrame } from './SlotFrame.js'
import { Portal } from './Portal.js'
import { NavController } from './NavController.js'

interface Props {
  room: Room
  items: Record<string, Item>
  textures: Record<string, string> // textureId → url
  activeViewpointId: string
  onSlotSelect: (slotId: string, item: Item | null) => void
  onNavigate?: (roomId: string) => void
}

export function RoomScene({
  room,
  items,
  textures,
  activeViewpointId,
  onSlotSelect,
  onNavigate,
}: Props) {
  const surfaces = getRoomSurfaces(room.template)
  const wallUrl = room.wallTextureId ? (textures[room.wallTextureId] ?? null) : null
  const floorUrl = room.floorTextureId ? (textures[room.floorTextureId] ?? null) : null
  const ceilingUrl = room.ceilingTextureId ? (textures[room.ceilingTextureId] ?? null) : null

  return (
    <>
      <RoomLighting preset={room.lightingPreset} />

      {/* Walls */}
      {surfaces.walls.map((wall) => (
        <RoomSurface key={wall.name} config={wall} textureUrl={wallUrl} color="#d4c9b8" />
      ))}

      {/* Floor */}
      <RoomSurface config={surfaces.floor} textureUrl={floorUrl} color="#8b7355" />

      {/* Ceiling */}
      <RoomSurface config={surfaces.ceiling} textureUrl={ceilingUrl} color="#f5f0e8" />

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

      {/* Navigation controller */}
      <NavController
        viewpoints={room.viewpoints}
        activeViewpointId={activeViewpointId}
      />
    </>
  )
}

