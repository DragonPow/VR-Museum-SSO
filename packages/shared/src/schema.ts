import { z } from 'zod'
import {
  ROOM_TEMPLATES,
  LIGHTING_PRESETS,
  SLOT_TYPES,
  FRAME_STYLES,
  DOCUMENT_MEDIA_TYPES,
  VIEWER_VARIANTS,
  TEXTURE_TYPES,
  CONTENT_VERSION,
} from './constants.js'

const Vec3Schema = z.object({ x: z.number(), y: z.number(), z: z.number() })
const Vec2Schema = z.object({ w: z.number().positive(), h: z.number().positive() })
const NonEmptyString = z.string().min(1)
const UrlString = z.string().url().or(z.string().startsWith('/'))
const HexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a hex color like #FF0000')

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
  transform: SlotTransformSchema.optional(),
  frameStyle: z.enum(FRAME_STYLES),
  documentIds: z.array(NonEmptyString).default([]),
  visible: z.boolean(),
  zone: z.string().optional(),
  viewerVariant: z.enum(VIEWER_VARIANTS).optional(),
})

export const RoomPortalSchema = z.object({
  id: NonEmptyString,
  targetRoomId: NonEmptyString,
  label: NonEmptyString,
  position: Vec3Schema,
  rotation: Vec3Schema,
})

export const ObstacleZoneSchema = z.object({
  minX: z.number(),
  maxX: z.number(),
  minZ: z.number(),
  maxZ: z.number(),
})

export const RoomSchema = z.object({
  id: NonEmptyString,
  periodId: NonEmptyString,
  slug: z.string().regex(/^[a-z0-9-]+$/, 'slug must be lowercase-kebab'),
  title: NonEmptyString,
  order: z.number().int().nonnegative(),
  template: z.enum(ROOM_TEMPLATES as [string, ...string[]]),
  modelUrl: UrlString.nullable().default(null),
  modelOffset: z.tuple([z.number(), z.number(), z.number()]).optional(),
  lightmapUrl: UrlString.nullable().optional(),
  obstacles: z.array(ObstacleZoneSchema).optional(),
  wallTextureId: NonEmptyString.nullable(),
  floorTextureId: NonEmptyString.nullable(),
  ceilingTextureId: NonEmptyString.nullable(),
  lightingPreset: z.enum(LIGHTING_PRESETS as [string, ...string[]]),
  entryViewpointId: z.string(),
  viewpoints: z.array(ViewpointSchema),
  slots: z.array(SlotSchema),
  portals: z.array(RoomPortalSchema).default([]),
})

export const DocumentImageSchema = z.object({
  id: NonEmptyString,
  caption: z.string().optional(),
  alt: z.string().optional(),
  rawExt: z.string().optional(),
})


export const DocumentIndexItemSchema = z.object({
  id: NonEmptyString,
  documentKey: NonEmptyString,
  mediaType: z.enum(DOCUMENT_MEDIA_TYPES),
  viewerImageId: NonEmptyString,
})

export const DocumentItemSchema = z.object({
  id: NonEmptyString,
  documentKey: NonEmptyString,
  title: NonEmptyString,
  year: z.number().int().min(1900).max(2100),
  periodId: NonEmptyString,
  summary: z.string(),
  body: z.string(),
  tags: z.array(z.string()),
  mediaType: z.enum(DOCUMENT_MEDIA_TYPES),
  thumbnailImageId: NonEmptyString.default('photo1'),
  viewerImageId: NonEmptyString.default('photo1'),
  detailImageIds: z.array(NonEmptyString).default(['photo1']),
  images: z.array(DocumentImageSchema).default([]),
  embedUrl: UrlString.optional(),
  externalUrl: UrlString.optional(),
  externalLabel: z.string().optional(),
  source: z.string(),
  priority: z.number().int().min(0),
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
  documentIndex: z.array(DocumentIndexItemSchema).default([]),
  documents: z.array(DocumentItemSchema).default([]),
  textures: z.array(TextureAssetSchema),
})

export const RoomStubSchema = z.object({
  id: NonEmptyString,
  periodId: NonEmptyString,
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: NonEmptyString,
  order: z.number().int().nonnegative(),
  template: z.enum(ROOM_TEMPLATES as [string, ...string[]]),
  dataUrl: UrlString,
})

export const ContentIndexSchema = z.object({
  version: z.string(),
  updatedAt: z.string(),
  defaultRoomId: NonEmptyString,
  totalItems: z.number().int().nonnegative(),
  periods: z.array(PeriodSchema).min(1),
  rooms: z.array(RoomStubSchema).min(1),
  documentIndex: z.array(DocumentIndexItemSchema).default([]),
  textures: z.array(TextureAssetSchema),
})

export const RoomDataSchema = RoomSchema.extend({
  documents: z.record(z.string(), DocumentIndexItemSchema),
})

export type PeriodInput = z.input<typeof PeriodSchema>
export type RoomInput = z.input<typeof RoomSchema>
export type SlotInput = z.input<typeof SlotSchema>
export type DocumentIndexItemInput = z.input<typeof DocumentIndexItemSchema>
export type DocumentItemInput = z.input<typeof DocumentItemSchema>
export type ContentInput = z.input<typeof ContentSchema>
