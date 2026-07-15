import type { Content, ContentIndex, DocumentIndexItem, DocumentItem, Room, RoomData } from './types.js'

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
  documentIndex: [],
  documents: [],
  textures: [],
}


export function documentIndexFromDocument(document: DocumentItem): DocumentIndexItem {
  return {
    id: document.id,
    documentKey: document.documentKey,
    mediaType: document.mediaType,
    viewerImageId: document.viewerImageId,
  }
}

export function getContentDocumentIndex(content: Content): DocumentIndexItem[] {
  if (content.documents.length === 0) return content.documentIndex
  const existing = new Map(content.documentIndex.map((document) => [document.id, document]))
  return content.documents.map((document) => ({
    ...documentIndexFromDocument(document),
    viewerImageId: existing.get(document.id)?.viewerImageId ?? document.viewerImageId,
  }))
}

export function roomDataFromContent(content: Content, room: Room): RoomData {
  const assignedDocumentIds = new Set(room.slots.flatMap((slot) => slot.documentIds ?? []))
  const documents = Object.fromEntries(
    getContentDocumentIndex(content)
      .filter((document) => assignedDocumentIds.has(document.id))
      .map((document) => [document.id, document]),
  )

  return { ...room, documents }
}

export function contentIndexFromContent(
  content: Content,
  dataUrlForRoom: (room: Room) => string,
): ContentIndex {
  return {
    version: content.version,
    updatedAt: content.updatedAt,
    defaultRoomId: content.rooms[0]?.id ?? '',
    totalItems: getContentDocumentIndex(content).length,
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
    documentIndex: getContentDocumentIndex(content),
    textures: content.textures,
  }
}


export function contentForPublicIndex(content: Content): Content {
  return {
    ...content,
    documentIndex: getContentDocumentIndex(content),
    documents: [],
  }
}

export function splitContentForPublish(content: Content): { content: Content; documents: Record<string, DocumentItem> } {
  return {
    content: contentForPublicIndex(content),
    documents: Object.fromEntries(content.documents.map((document) => [document.id, document])),
  }
}
