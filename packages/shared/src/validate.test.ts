import { describe, it, expect } from 'vitest'
import { parseContent, parseAndValidateContent, ContentValidationError } from './validate.js'

const VALID_CONTENT = {
  version: '1',
  updatedAt: '2026-06-26T00:00:00.000Z',
  periods: [
    {
      id: 'p1',
      slug: 'giai-doan-1',
      title: 'Giai đoạn 1975–1985',
      yearStart: 1975,
      yearEnd: 1985,
      order: 1,
      description: 'Giai đoạn thành lập',
      themeColor: '#8B4513',
    },
  ],
  rooms: [
    {
      id: 'r1',
      periodId: 'p1',
      slug: 'phong-thanh-lap',
      title: 'Phòng thành lập',
      order: 1,
      template: 'gallery',
      wallTextureId: null,
      floorTextureId: null,
      ceilingTextureId: null,
      lightingPreset: 'warm',
      entryViewpointId: 'vp1',
      viewpoints: [
        {
          id: 'vp1',
          name: 'Trung tâm',
          position: { x: 0, y: 1.6, z: 0 },
          lookAt: { x: 0, y: 1.6, z: -5 },
        },
      ],
      slots: [
        {
          id: 's1',
          roomId: 'r1',
          name: 'Ảnh khai trương',
          type: 'image',
          transform: {
            position: { x: -4, y: 2, z: -7.9 },
            rotation: { x: 0, y: 0, z: 0 },
            size: { w: 1.5, h: 1.2 },
          },
          frameStyle: 'classic',
          itemId: 'item1',
          visible: true,
        },
      ],
    },
  ],
  items: [
    {
      id: 'item1',
      title: 'Lễ khai trương 1975',
      year: 1975,
      periodId: 'p1',
      shortDesc: 'Lễ khai trương thành lập công ty',
      longDesc: 'Mô tả chi tiết về lễ khai trương...',
      tags: ['khai-truong', 'thanh-lap'],
      mediaType: 'image',
      thumbUrl: '/content/images/item1-thumb.jpg',
      wallTextureUrl: '/content/images/item1-wall.jpg',
      fullUrl: '/content/images/item1-full.jpg',
      source: 'Lưu trữ công ty',
      approvedBy: 'Ban lãnh đạo',
      priority: 1,
      status: 'approved',
    },
  ],
  textures: [],
}

describe('parseContent', () => {
  it('parses valid content', () => {
    const result = parseContent(VALID_CONTENT)
    expect(result.version).toBe('1')
    expect(result.periods).toHaveLength(1)
    expect(result.rooms[0]?.slots).toHaveLength(1)
  })

  it('throws ContentValidationError on missing required field', () => {
    const bad = { ...VALID_CONTENT, version: undefined }
    expect(() => parseContent(bad)).toThrow(ContentValidationError)
  })

  it('throws on wrong version', () => {
    const bad = { ...VALID_CONTENT, version: '99' }
    expect(() => parseContent(bad)).toThrow(ContentValidationError)
  })

  it('throws on invalid themeColor', () => {
    const bad = {
      ...VALID_CONTENT,
      periods: [{ ...VALID_CONTENT.periods[0], themeColor: 'red' }],
    }
    expect(() => parseContent(bad)).toThrow(ContentValidationError)
  })

  it('throws on empty periods array', () => {
    const bad = { ...VALID_CONTENT, periods: [] }
    expect(() => parseContent(bad)).toThrow(ContentValidationError)
  })
})

describe('parseAndValidateContent', () => {
  it('passes integrity check on valid content', () => {
    expect(() => parseAndValidateContent(VALID_CONTENT)).not.toThrow()
  })

  it('throws when room references unknown period', () => {
    const bad = {
      ...VALID_CONTENT,
      rooms: [{ ...VALID_CONTENT.rooms[0], periodId: 'NONEXISTENT' }],
    }
    expect(() => parseAndValidateContent(bad)).toThrow(/unknown period/)
  })

  it('throws when entryViewpointId not in viewpoints', () => {
    const bad = {
      ...VALID_CONTENT,
      rooms: [{ ...VALID_CONTENT.rooms[0], entryViewpointId: 'MISSING' }],
    }
    expect(() => parseAndValidateContent(bad)).toThrow(/entryViewpointId/)
  })

  it('throws when slot references unknown item', () => {
    const bad = {
      ...VALID_CONTENT,
      rooms: [
        {
          ...VALID_CONTENT.rooms[0],
          slots: [{ ...VALID_CONTENT.rooms[0]!.slots[0]!, itemId: 'GHOST' }],
        },
      ],
    }
    expect(() => parseAndValidateContent(bad)).toThrow(/unknown item/)
  })
})
