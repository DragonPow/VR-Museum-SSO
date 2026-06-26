export type RoomTemplate = 'hall' | 'gallery' | 'corridor' | 'honor'
export type LightingPreset = 'warm' | 'neutral' | 'cool'
export type SlotType = 'image' | 'cluster' | 'poster' | 'video' | 'text'
export type FrameStyle = 'classic' | 'modern' | 'none'
export type MediaType = 'image' | 'video' | 'audio'
export type ItemStatus = 'draft' | 'approved'
export type QualityTier = 'high' | 'medium' | 'low'

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface Vec2 {
  w: number
  h: number
}

export interface Period {
  id: string
  slug: string
  title: string
  yearStart: number
  yearEnd: number
  order: number
  description: string
  themeColor: string
}

export interface Viewpoint {
  id: string
  name: string
  position: Vec3
  lookAt: Vec3
}

export interface SlotTransform {
  position: Vec3
  rotation: Vec3
  size: Vec2
}

export interface Slot {
  id: string
  roomId: string
  name: string
  type: SlotType
  transform: SlotTransform
  frameStyle: FrameStyle
  itemId: string | null
  visible: boolean
}

export interface RoomPortal {
  id: string
  targetRoomId: string
  label: string
  position: Vec3
  rotation: Vec3
}

export interface Room {
  id: string
  periodId: string
  slug: string
  title: string
  order: number
  template: RoomTemplate
  wallTextureId: string | null
  floorTextureId: string | null
  ceilingTextureId: string | null
  lightingPreset: LightingPreset
  entryViewpointId: string
  viewpoints: Viewpoint[]
  slots: Slot[]
  portals: RoomPortal[]
}

export interface Item {
  id: string
  title: string
  year: number
  periodId: string
  shortDesc: string
  longDesc: string
  tags: string[]
  mediaType: MediaType
  thumbUrl: string
  wallTextureUrl: string
  fullUrl: string
  source: string
  approvedBy: string
  priority: number
  status: ItemStatus
}

export interface TextureAsset {
  id: string
  name: string
  url: string
  type: 'wall' | 'floor' | 'ceiling' | 'decoration'
}

/** Snapshot đã ghép (denormalized) — public site đọc 1 phát */
export interface Content {
  version: string
  updatedAt: string
  periods: Period[]
  rooms: Room[]
  items: Item[]
  textures: TextureAsset[]
}
