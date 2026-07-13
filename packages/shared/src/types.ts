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
  /**
   * Position/rotation/size in 3D space.
   * - Procedural rooms (no modelUrl): required, defined in JSON.
   * - GLB-driven rooms: omitted in JSON; derived at runtime from the
   *   corresponding VM_Slot_* mesh inside the .glb file.
   */
  transform?: SlotTransform
  frameStyle: FrameStyle
  itemId: string | null
  visible: boolean
  /** Optional grouping label (physical zone) so the admin can bucket 100+ slots. */
  zone?: string
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
  /**
   * Optional externally-authored room model, usually exported from Blender as GLB/GLTF.
   * When present, the viewer uses this as the room shell and keeps slots/hotspots dynamic.
   * When null, the viewer falls back to the built-in procedural room templates.
   */
  modelUrl: string | null
  /**
   * XYZ offset applied to the GLB model in Three.js world space.
   * Needed when the Blender scene has the room at a non-origin world position.
   * Example: side room at Blender x=40 → modelOffset: [-40, 0, 0]
   */
  modelOffset?: [number, number, number]
  /**
   * Baked lighting texture (Blender lightmap) sampled through the model's 2nd UV set
   * (TEXCOORD_1). Applied as `material.lightMap` to the architecture surfaces so the
   * room shows baked light pools + shadows while keeping the tiled base textures sharp.
   * When null/absent the room is lit only by the dynamic lighting preset.
   */
  lightmapUrl?: string | null
  /**
   * Static collision zones for interior walls, pillars, and props in the GLB model
   * that the outer-wall bounds alone cannot cover.
   */
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
  /** Untouched original upload — kept so resize variants can be regenerated later. */
  rawUrl?: string
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

// ─── Split-content types (lazy per-room loading) ───────────────────────────────

/** Lightweight room descriptor stored in the index file — no slots or items. */
export interface RoomStub {
  id: string
  periodId: string
  slug: string
  title: string
  order: number
  template: RoomTemplate
  /** Path to the full per-room JSON file, e.g. "/content/room-hall.sample.json" */
  dataUrl: string
}

/**
 * Lightweight index file loaded on startup.
 * Contains everything needed to render Landing + navigate rooms, but NOT
 * the heavy slot/item data (that lives in per-room files).
 */
export interface ContentIndex {
  version: string
  updatedAt: string
  defaultRoomId: string
  totalItems: number
  periods: Period[]
  rooms: RoomStub[]
  textures: TextureAsset[]
}

/**
 * Per-room file loaded on demand when the user enters a room.
 * Extends Room with the items that appear in that room's slots.
 */
export interface RoomData extends Room {
  items: Record<string, Item>
}
