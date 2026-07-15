import type { RoomTemplate, LightingPreset, QualityTier } from './types.js'

// ─── Enums as const arrays (for zod and runtime iteration) ────────────────────
export const ROOM_TEMPLATES: readonly RoomTemplate[] = ['hall', 'gallery', 'corridor', 'honor']
export const LIGHTING_PRESETS: readonly LightingPreset[] = ['warm', 'neutral', 'cool']
export const SLOT_TYPES = ['image', 'cluster', 'poster', 'video', 'text'] as const
export const FRAME_STYLES = ['classic', 'modern', 'none'] as const
export const DOCUMENT_MEDIA_TYPES = ['image', 'youtube', 'iframe', 'external'] as const
export const DOCUMENT_IMAGE_VARIANTS = ['thumb', 'wall', 'full'] as const
export const VIEWER_VARIANTS = ['wall', 'full'] as const
export const TEXTURE_TYPES = ['wall', 'floor', 'ceiling', 'decoration'] as const

// ─── Image size targets ───────────────────────────────────────────────────────
export const IMAGE_SIZES = {
  thumb: { width: 300, height: 300, quality: 80 },
  wall: { width: 1024, height: 1024, quality: 85 },
  full: { width: 1920, height: 1280, quality: 90 },
} as const

// ─── Performance budget (CLAUDE.md §6) ───────────────────────────────────────
export const PERF_BUDGET = {
  maxDrawCalls: 150,
  dpr: { desktop: [1, 1.5], mobile: [1, 1] } as const,
  maxGpuTextureMb: 50,
  targetFpsDesktop: 60,
  targetFpsMobile: 30,
  preloadAdjacentRooms: 1,
} as const

// ─── Quality tier thresholds (for PerfGuard) ─────────────────────────────────
export const QUALITY_TIERS: Record<QualityTier, { dprMax: number; shadows: boolean; fxaa: boolean }> = {
  high:   { dprMax: 1.5, shadows: false, fxaa: true },
  medium: { dprMax: 1.0, shadows: false, fxaa: false },
  low:    { dprMax: 1.0, shadows: false, fxaa: false },
}

// ─── Room template default dimensions (meters) ────────────────────────────────
export const ROOM_DIMENSIONS: Record<string, { width: number; height: number; depth: number }> = {
  hall:     { width: 24, height: 5, depth: 16 },
  gallery:  { width: 12, height: 4, depth: 16 },
  corridor: { width:  6, height: 4, depth: 20 },
  honor:    { width: 14, height: 6, depth: 14 },
}

// ─── Content version ──────────────────────────────────────────────────────────
export const CONTENT_VERSION = '1'
export { DEFAULT_CONTENT, contentForPublicIndex, contentIndexFromContent, documentIndexFromDocument, getContentDocumentIndex, roomDataFromContent, splitContentForPublish } from './defaultContent.js'
