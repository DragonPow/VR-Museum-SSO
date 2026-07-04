import { ZodError } from 'zod'
import { ContentSchema, ContentIndexSchema, RoomDataSchema } from './schema.js'
import type { Content, ContentIndex, RoomData } from './types.js'

export class ContentValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: ZodError['issues'],
  ) {
    super(message)
    this.name = 'ContentValidationError'
  }
}

/**
 * Parse and validate raw JSON into a typed Content object.
 * Throws ContentValidationError with detailed issue list on failure.
 */
export function parseContent(input: unknown): Content {
  const result = ContentSchema.safeParse(input)
  if (!result.success) {
    const summary = result.error.issues
      .map((i) => `  [${i.path.join('.')}] ${i.message}`)
      .join('\n')
    throw new ContentValidationError(
      `Content validation failed:\n${summary}`,
      result.error.issues,
    )
  }
  return result.data as Content
}

/** Cross-reference checks beyond zod schema (referential integrity) */
export function validateContentIntegrity(content: Content): string[] {
  const errors: string[] = []
  const periodIds = new Set(content.periods.map((p) => p.id))
  const roomIds = new Set(content.rooms.map((r) => r.id))
  const itemIds = new Set(content.items.map((i) => i.id))
  const textureIds = new Set(content.textures.map((t) => t.id))

  for (const room of content.rooms) {
    if (!periodIds.has(room.periodId)) {
      errors.push(`Room "${room.id}" references unknown period "${room.periodId}"`)
    }

    if (room.viewpoints.length > 0) {
      const viewpointIds = new Set(room.viewpoints.map((v) => v.id))
      if (room.entryViewpointId && !viewpointIds.has(room.entryViewpointId)) {
        errors.push(
          `Room "${room.id}" entryViewpointId "${room.entryViewpointId}" not found in viewpoints`,
        )
      }
    }

    for (const slot of room.slots) {
      if (slot.roomId !== room.id) {
        errors.push(`Slot "${slot.id}" roomId mismatch (expected "${room.id}", got "${slot.roomId}")`)
      }
      if (slot.itemId !== null && !itemIds.has(slot.itemId)) {
        errors.push(`Slot "${slot.id}" references unknown item "${slot.itemId}"`)
      }
    }

    if (room.wallTextureId !== null && !textureIds.has(room.wallTextureId)) {
      errors.push(`Room "${room.id}" references unknown wallTexture "${room.wallTextureId}"`)
    }
    if (room.floorTextureId !== null && !textureIds.has(room.floorTextureId)) {
      errors.push(`Room "${room.id}" references unknown floorTexture "${room.floorTextureId}"`)
    }
    if (room.ceilingTextureId !== null && !textureIds.has(room.ceilingTextureId)) {
      errors.push(`Room "${room.id}" references unknown ceilingTexture "${room.ceilingTextureId}"`)
    }
  }

  for (const item of content.items) {
    if (!periodIds.has(item.periodId)) {
      errors.push(`Item "${item.id}" references unknown period "${item.periodId}"`)
    }
  }

  // Warn (not error) about rooms with no items assigned
  for (const room of content.rooms) {
    const assignedCount = room.slots.filter((s) => s.itemId !== null).length
    if (assignedCount === 0) {
      errors.push(`WARN: Room "${room.id}" has no items assigned to any slot`)
    }
  }

  return errors
}

export function parseContentIndex(input: unknown): ContentIndex {
  const result = ContentIndexSchema.safeParse(input)
  if (!result.success) {
    const summary = result.error.issues
      .map((i) => `  [${i.path.join('.')}] ${i.message}`)
      .join('\n')
    throw new ContentValidationError(`ContentIndex validation failed:\n${summary}`, result.error.issues)
  }
  return result.data as ContentIndex
}

export function parseRoomData(input: unknown): RoomData {
  const result = RoomDataSchema.safeParse(input)
  if (!result.success) {
    const summary = result.error.issues
      .map((i) => `  [${i.path.join('.')}] ${i.message}`)
      .join('\n')
    throw new ContentValidationError(`RoomData validation failed:\n${summary}`, result.error.issues)
  }
  return result.data as RoomData
}

/** Parse + integrity check in one call. Returns typed Content or throws. */
export function parseAndValidateContent(input: unknown): Content {
  const content = parseContent(input)
  const integrityErrors = validateContentIntegrity(content).filter((e) => !e.startsWith('WARN'))
  if (integrityErrors.length > 0) {
    throw new ContentValidationError(
      `Content integrity errors:\n${integrityErrors.map((e) => `  ${e}`).join('\n')}`,
      [],
    )
  }
  return content
}
