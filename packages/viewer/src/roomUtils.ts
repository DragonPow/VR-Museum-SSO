import type { Content, Room, Item, RoomData, TextureAsset } from '@vm/shared'

/** Build props for RoomScene from a lazily-loaded RoomData (preferred). */
export function buildRoomDataProps(
  roomData: RoomData,
  textures: TextureAsset[],
): { room: Room; items: Record<string, Item>; textures: Record<string, string> } {
  const textureMap: Record<string, string> = {}
  textures.forEach((t) => { textureMap[t.id] = t.url })
  return { room: roomData, items: roomData.items, textures: textureMap }
}

/** Legacy: build props from the monolithic Content snapshot (kept for admin preview). */
export function buildRoomProps(
  content: Content,
  roomId: string,
): { room: Room; items: Record<string, Item>; textures: Record<string, string> } | null {
  const room = content.rooms.find((r) => r.id === roomId)
  if (!room) return null

  const items: Record<string, Item> = {}
  content.items.forEach((item) => { items[item.id] = item })

  const textures: Record<string, string> = {}
  content.textures.forEach((t) => { textures[t.id] = t.url })

  return { room, items, textures }
}
