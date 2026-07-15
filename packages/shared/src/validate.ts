import { ZodError } from 'zod'
import { ContentSchema, ContentIndexSchema, DocumentItemSchema, RoomDataSchema } from './schema.js'
import type { Content, ContentIndex, DocumentItem, RoomData } from './types.js'

export class ContentValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: ZodError['issues'],
  ) {
    super(message)
    this.name = 'ContentValidationError'
  }
}

function formatIssues(issues: ZodError['issues']): string {
  return issues.map((i) => `  [${i.path.join('.')}] ${i.message}`).join('\n')
}

export function parseContent(input: unknown): Content {
  const result = ContentSchema.safeParse(input)
  if (!result.success) {
    const summary = formatIssues(result.error.issues)
    throw new ContentValidationError(`Content validation failed:\n${summary}`, result.error.issues)
  }
  return result.data as Content
}

export function validateContentIntegrity(content: Content): string[] {
  const errors: string[] = []
  const periodIds = new Set(content.periods.map((p) => p.id))
  const roomIds = new Set(content.rooms.map((r) => r.id))
  const documentIds = new Set([
    ...content.documentIndex.map((d) => d.id),
    ...content.documents.map((d) => d.id),
  ])
  const textureIds = new Set(content.textures.map((t) => t.id))

  for (const room of content.rooms) {
    if (!periodIds.has(room.periodId)) {
      errors.push(`Room "${room.id}" references unknown period "${room.periodId}"`)
    }

    if (room.viewpoints.length > 0) {
      const viewpointIds = new Set(room.viewpoints.map((v) => v.id))
      if (room.entryViewpointId && !viewpointIds.has(room.entryViewpointId)) {
        errors.push(`Room "${room.id}" entryViewpointId "${room.entryViewpointId}" not found in viewpoints`)
      }
    }

    for (const slot of room.slots) {
      if (slot.roomId !== room.id) {
        errors.push(`Slot "${slot.id}" roomId mismatch (expected "${room.id}", got "${slot.roomId}")`)
      }
      for (const documentId of slot.documentIds) {
        if (!documentIds.has(documentId)) {
          errors.push(`Slot "${slot.id}" references unknown document "${documentId}"`)
        }
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

  for (const portalRoom of content.rooms.flatMap((r) => r.portals ?? [])) {
    if (!roomIds.has(portalRoom.targetRoomId)) {
      errors.push(`Portal "${portalRoom.id}" references unknown room "${portalRoom.targetRoomId}"`)
    }
  }

  for (const document of content.documents) {
    if (!periodIds.has(document.periodId)) {
      errors.push(`Document "${document.id}" references unknown period "${document.periodId}"`)
    }
  }

  for (const room of content.rooms) {
    const assignedCount = room.slots.filter((s) => s.documentIds.length > 0).length
    if (assignedCount === 0) errors.push(`WARN: Room "${room.id}" has no documents assigned to any slot`)
  }

  return errors
}

export function parseContentIndex(input: unknown): ContentIndex {
  const result = ContentIndexSchema.safeParse(input)
  if (!result.success) {
    const summary = formatIssues(result.error.issues)
    throw new ContentValidationError(`ContentIndex validation failed:\n${summary}`, result.error.issues)
  }
  return result.data as ContentIndex
}

export function parseDocumentItem(input: unknown): DocumentItem {
  const result = DocumentItemSchema.safeParse(input)
  if (!result.success) {
    const summary = formatIssues(result.error.issues)
    throw new ContentValidationError(`Document validation failed:\n${summary}`, result.error.issues)
  }
  return result.data as DocumentItem
}

export function parseRoomData(input: unknown): RoomData {
  const result = RoomDataSchema.safeParse(input)
  if (!result.success) {
    const summary = formatIssues(result.error.issues)
    throw new ContentValidationError(`RoomData validation failed:\n${summary}`, result.error.issues)
  }
  return result.data as RoomData
}

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
