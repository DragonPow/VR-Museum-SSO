import { getContentDocumentIndex } from '@vm/shared'
import type { Content, Room, DocumentIndexItem, RoomData, TextureAsset } from '@vm/shared'

export function buildRoomDataProps(
  roomData: RoomData,
  textures: TextureAsset[],
): { room: Room; documents: Record<string, DocumentIndexItem>; textures: Record<string, string> } {
  const textureMap = Object.fromEntries(textures.map((t) => [t.id, t.url]))
  return { room: roomData, documents: roomData.documents, textures: textureMap }
}

export function buildRoomProps(
  content: Content,
  roomId: string,
): { room: Room; documents: Record<string, DocumentIndexItem>; textures: Record<string, string> } | null {
  const room = content.rooms.find((r) => r.id === roomId)
  if (!room) return null

  const documents: Record<string, DocumentIndexItem> = {}
  getContentDocumentIndex(content).forEach((document) => { documents[document.id] = document })
  const textures = Object.fromEntries(content.textures.map((t) => [t.id, t.url]))

  return { room, documents, textures }
}
