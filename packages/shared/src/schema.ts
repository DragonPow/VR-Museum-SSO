import { z } from 'zod'
import {
  ROOM_TEMPLATES,
  LIGHTING_PRESETS,
  SLOT_TYPES,
  FRAME_STYLES,
  MEDIA_TYPES,
  ITEM_STATUSES,
  TEXTURE_TYPES,
  CONTENT_VERSION,
} from './constants.js'

// ─── Primitives ───────────────────────────────────────────────────────────────
const Vec3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
})

const Vec2Schema = z.object({
  w: z.number().positive(),
  h: z.number().positive(),
})

const NonEmptyString = z.string().min(1)
const UrlString = z.string().url().or(z.string().startsWith('/'))
const HexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a hex color like #FF0000')

// ─── Schemas ──────────────────────────────────────────────────────────────────
export const PeriodSchema = z.object({
  id: NonEmptyString,
  slug: z.string().regex(/^[a-z0-9-]+$/, 'slug must be lowercase-kebab'),
  title: NonEmptyString,
  yearStart: z.number().int().min(1900).max(2100),
  yearEnd: z.number().int().min(1900).max(2100),
  order: z.number().int().nonnegative(),
  description: z.string(),
  themeColor: HexColor,
})

export const ViewpointSchema = z.object({
  id: NonEmptyString,
  name: NonEmptyString,
  position: Vec3Schema,
  lookAt: Vec3Schema,
})

export const SlotTransformSchema = z.object({
  position: Vec3Schema,
  rotation: Vec3Schema,
  size: Vec2Schema,
})

export const SlotSchema = z.object({
  id: NonEmptyString,
  roomId: NonEmptyString,
  name: NonEmptyString,
  type: z.enum(SLOT_TYPES),
  transform: SlotTransformSchema,
  frameStyle: z.enum(FRAME_STYLES),
  itemId: NonEmptyString.nullable(),
  visible: z.boolean(),
})

export const RoomPortalSchema = z.object({
  id: NonEmptyString,
  targetRoomId: NonEmptyString,
  label: NonEmptyString,
  position: Vec3Schema,
  rotation: Vec3Schema,
})

export const RoomSchema = z.object({
  id: NonEmptyString,
  periodId: NonEmptyString,
  slug: z.string().regex(/^[a-z0-9-]+$/, 'slug must be lowercase-kebab'),
  title: NonEmptyString,
  order: z.number().int().nonnegative(),
  template: z.enum(ROOM_TEMPLATES as [string, ...string[]]),
  modelUrl: UrlString.nullable().default(null),
  wallTextureId: NonEmptyString.nullable(),
  floorTextureId: NonEmptyString.nullable(),
  ceilingTextureId: NonEmptyString.nullable(),
  lightingPreset: z.enum(LIGHTING_PRESETS as [string, ...string[]]),
  entryViewpointId: NonEmptyString,
  viewpoints: z.array(ViewpointSchema).min(1),
  slots: z.array(SlotSchema),
  portals: z.array(RoomPortalSchema).default([]),
})

export const ItemSchema = z.object({
  id: NonEmptyString,
  title: NonEmptyString,
  year: z.number().int().min(1900).max(2100),
  periodId: NonEmptyString,
  shortDesc: z.string(),
  longDesc: z.string(),
  tags: z.array(z.string()),
  mediaType: z.enum(MEDIA_TYPES),
  thumbUrl: UrlString,
  wallTextureUrl: UrlString,
  fullUrl: UrlString,
  source: z.string(),
  approvedBy: z.string(),
  priority: z.number().int().min(0),
  status: z.enum(ITEM_STATUSES),
})

export const TextureAssetSchema = z.object({
  id: NonEmptyString,
  name: NonEmptyString,
  url: UrlString,
  type: z.enum(TEXTURE_TYPES),
})

export const ContentSchema = z.object({
  version: z.literal(CONTENT_VERSION),
  updatedAt: z.string().datetime(),
  periods: z.array(PeriodSchema).min(1),
  rooms: z.array(RoomSchema).min(1),
  items: z.array(ItemSchema),
  textures: z.array(TextureAssetSchema),
})

// ─── Inferred types (re-export for consumers who prefer schema-inferred) ──────
export type PeriodInput = z.input<typeof PeriodSchema>
export type RoomInput = z.input<typeof RoomSchema>
export type SlotInput = z.input<typeof SlotSchema>
export type ItemInput = z.input<typeof ItemSchema>
export type ContentInput = z.input<typeof ContentSchema>
