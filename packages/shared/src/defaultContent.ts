import type { Content, ContentIndex, Room, RoomData } from './types.js'

/**
 * Minimal valid content used to bootstrap a fresh R2 bucket and to keep the UI usable
 * before the first real publish. This is intentionally tiny: one period, one room,
 * no media objects.
 */
export const DEFAULT_CONTENT: Content = {
  version: '1',
  updatedAt: '2026-01-01T00:00:00.000Z',
  periods: [
    {
      id: 'period-1',
      slug: 'giai-doan-mau',
      title: 'Giai đoạn mẫu',
      yearStart: 1975,
      yearEnd: 2025,
      order: 0,
      description: 'Nội dung khởi tạo ban đầu cho bảo tàng số. Hãy chỉnh sửa trong trang quản trị rồi Publish.',
      themeColor: '#2563EB',
    },
  ],
  rooms: [
    {
      id: 'room-1',
      periodId: 'period-1',
      slug: 'phong-mau',
      title: 'Phòng mẫu',
      order: 0,
      template: 'gallery',
      modelUrl: null,
      wallTextureId: null,
      floorTextureId: null,
      ceilingTextureId: null,
      lightingPreset: 'warm',
      entryViewpointId: 'view-1',
      viewpoints: [
        {
          id: 'view-1',
          name: 'Góc nhìn chính',
          position: { x: 0, y: 1.6, z: 6 },
          lookAt: { x: 0, y: 1.6, z: 0 },
        },
      ],
      slots: [],
      portals: [],
    },
  ],
  items: [],
  textures: [],
}

export function roomDataFromContent(content: Content, room: Room): RoomData {
  const assignedItemIds = new Set(
    room.slots
      .map((slot) => slot.itemId)
      .filter((itemId): itemId is string => typeof itemId === 'string'),
  )

  const items = Object.fromEntries(
    content.items
      .filter((item) => assignedItemIds.has(item.id))
      .map((item) => [item.id, item]),
  )

  return { ...room, items }
}

export function contentIndexFromContent(
  content: Content,
  dataUrlForRoom: (room: Room) => string,
): ContentIndex {
  return {
    version: content.version,
    updatedAt: content.updatedAt,
    defaultRoomId: content.rooms[0]?.id ?? '',
    totalItems: content.items.length,
    periods: content.periods,
    rooms: content.rooms.map((room) => ({
      id: room.id,
      periodId: room.periodId,
      slug: room.slug,
      title: room.title,
      order: room.order,
      template: room.template,
      dataUrl: dataUrlForRoom(room),
    })),
    textures: content.textures,
  }
}
