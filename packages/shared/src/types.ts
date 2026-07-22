export type RoomTemplate = 'hall' | 'gallery' | 'corridor' | 'honor'
export type LightingPreset = 'warm' | 'neutral' | 'cool'
export type SlotType = 'image' | 'cluster' | 'poster' | 'video' | 'text'
export type FrameStyle = 'classic' | 'modern' | 'none'
export type DocumentMediaType = 'image' | 'youtube' | 'iframe' | 'external'
export type DocumentImageVariant = 'thumb' | 'wall' | 'full'
export type ViewerVariant = 'wall' | 'full'
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
  /**
   * Position/rotation/size in 3D space.
   * - Procedural rooms (no modelUrl): required, defined in JSON.
   * - GLB-driven rooms: omitted in JSON; derived at runtime from the
   *   corresponding VM_Slot_* mesh inside the .glb file.
   */
  transform?: SlotTransform
  frameStyle: FrameStyle
  /** Ordered document ids. Each document is one page in this slot detail. */
  documentIds: string[]
  visible: boolean
  /** Optional grouping label (physical zone) so the admin can bucket 100+ slots. */
  zone?: string
  /** Viewer texture variant for this slot; backdrop slots may use full instead of wall. */
  viewerVariant?: ViewerVariant
}

export interface RoomPortal {
  id: string
  targetRoomId: string
  label: string
  position: Vec3
  rotation: Vec3
}

/** Axis-aligned bounding rectangle on the XZ plane used for collision blocking. */
export interface ObstacleZone {
  minX: number; maxX: number
  minZ: number; maxZ: number
}

export interface Room {
  id: string
  periodId: string
  slug: string
  title: string
  order: number
  template: RoomTemplate
  /** Optional externally-authored room model, usually exported from Blender as GLB/GLTF. */
  modelUrl: string | null
  modelOffset?: [number, number, number]
  lightmapUrl?: string | null
  obstacles?: ObstacleZone[]
  wallTextureId: string | null
  floorTextureId: string | null
  ceilingTextureId: string | null
  lightingPreset: LightingPreset
  entryViewpointId: string
  viewpoints: Viewpoint[]
  slots: Slot[]
  portals: RoomPortal[]
}

export interface DocumentImage {
  id: string
  caption?: string
  alt?: string
  rawExt?: string
}

export interface DocumentIndexItem {
  id: string
  documentKey: string
  mediaType: DocumentMediaType
  viewerImageId: string
}

export interface DocumentItem {
  id: string
  documentKey: string
  title: string
  year?: string | number
  periodId: string
  summary: string
  body: string
  tags: string[]
  mediaType: DocumentMediaType
  thumbnailImageId: string
  viewerImageId: string
  detailImageIds: string[]
  images: DocumentImage[]
  /** YouTube URL or embed URL shown directly in the modal. */
  embedUrl?: string
  /** External page for this document, e.g. Drive dossier. */
  externalUrl?: string
  externalLabel?: string
  source: string
  priority: number
}

export interface TextureAsset {
  id: string
  name: string
  url: string
  type: 'wall' | 'floor' | 'ceiling' | 'decoration'
}

/** Public snapshot: slot positions + library documents. */
export interface Content {
  version: string
  updatedAt: string
  periods: Period[]
  rooms: Room[]
  documentIndex: DocumentIndexItem[]
  /** Admin/draft-only full documents. Public content.json omits this and lazy-loads /content/documents/{id}.json. */
  documents: DocumentItem[]
  textures: TextureAsset[]
}

// Split-content types (lazy per-room loading)
export interface RoomStub {
  id: string
  periodId: string
  slug: string
  title: string
  order: number
  template: RoomTemplate
  /** Path to the full per-room JSON file, e.g. /content/rooms/main.json */
  dataUrl: string
}

export interface ContentIndex {
  version: string
  updatedAt: string
  defaultRoomId: string
  totalItems: number
  periods: Period[]
  rooms: RoomStub[]
  documentIndex: DocumentIndexItem[]
  textures: TextureAsset[]
}

/** Per-room file loaded on demand when the user enters a room. */
export interface RoomData extends Room {
  documents: Record<string, DocumentIndexItem>
}
