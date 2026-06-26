import type { Content, Room, Item } from '@vm/shared'

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
