import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_CONTENT, documentIndexFromDocument } from '@vm/shared'
import { loadDraftContent, loadStaticContent } from './contentSource.js'
import type { Content, DocumentItem, Period, Room, Viewpoint, RoomPortal } from '@vm/shared'


function documentKeyFromLegacyItem(item: Record<string, unknown>): string {
  for (const field of ['wallTextureUrl', 'fullUrl', 'thumbUrl']) {
    const value = typeof item[field] === 'string' ? item[field] as string : ''
    const marker = '/content/media/'
    if (value.includes(marker)) {
      const key = value.split(marker)[1]?.split('/')[0]
      if (key) return key
    }
  }
  return typeof item.id === 'string' ? item.id : `document-${Date.now()}`
}

function normalizeLegacyDocument(item: Record<string, unknown>): DocumentItem {
  const hasEmbed = typeof item.embedUrl === 'string' && item.embedUrl.length > 0
  const hasExternal = typeof item.externalUrl === 'string' && item.externalUrl.length > 0
  const documentKey = typeof item.documentKey === 'string'
    ? item.documentKey
    : typeof item.mediaKey === 'string'
      ? item.mediaKey
      : documentKeyFromLegacyItem(item)
  const rawImages = Array.isArray(item.images) ? item.images.filter((image): image is Record<string, unknown> => Boolean(image) && typeof image === 'object') : []
  const images = rawImages.length > 0
    ? rawImages.map((image, index) => ({
        id: typeof image.id === 'string' && image.id.startsWith('photo') ? image.id : `photo${index + 1}`,
        ...(typeof image.caption === 'string' ? { caption: image.caption } : {}),
        ...(typeof image.alt === 'string' ? { alt: image.alt } : {}),
        ...(typeof image.rawExt === 'string' ? { rawExt: image.rawExt } : {}),
      }))
    : [{ id: 'photo1', ...(typeof item.rawExt === 'string' ? { rawExt: item.rawExt } : {}) }]
  const firstImageId = images[0]?.id ?? 'photo1'
  return {
    id: typeof item.id === 'string' ? item.id : `document-${Date.now()}`,
    documentKey,
    title: typeof item.title === 'string' ? item.title : 'Tư liệu chưa đặt tên',
    year: typeof item.year === 'number' ? item.year : new Date().getFullYear(),
    periodId: typeof item.periodId === 'string' ? item.periodId : '',
    summary: typeof item.summary === 'string' ? item.summary : (typeof item.shortDesc === 'string' ? item.shortDesc : ''),
    body: typeof item.body === 'string' ? item.body : (typeof item.longDesc === 'string' ? item.longDesc : ''),
    tags: Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    mediaType: typeof item.mediaType === 'string' && item.mediaType === 'iframe' ? 'iframe' : hasEmbed ? 'youtube' : hasExternal ? 'external' : 'image',
    thumbnailImageId: typeof item.thumbnailImageId === 'string' ? item.thumbnailImageId : firstImageId,
    viewerImageId: typeof item.viewerImageId === 'string' ? item.viewerImageId : firstImageId,
    detailImageIds: Array.isArray(item.detailImageIds) ? item.detailImageIds.filter((id): id is string => typeof id === 'string') : images.map((image) => image.id),
    images,
    ...(hasEmbed ? { embedUrl: item.embedUrl as string } : {}),
    ...(hasExternal ? { externalUrl: item.externalUrl as string } : {}),
    ...(typeof item.externalLabel === 'string' ? { externalLabel: item.externalLabel } : {}),
    source: typeof item.source === 'string' ? item.source : '',
    priority: typeof item.priority === 'number' ? item.priority : 0,
  }
}

function normalizeContentShape(content: Content): Content {
  const raw = content as Content & { items?: Array<Record<string, unknown>> }
  const documents = (raw.documents ?? (raw.items ?? [])).map((document) => normalizeLegacyDocument(document as Record<string, unknown>))
  return {
    ...content,
    documentIndex: documents.length > 0 ? documents.map(documentIndexFromDocument) : (Array.isArray(raw.documentIndex) ? raw.documentIndex as Content['documentIndex'] : []),
    documents,
    rooms: content.rooms.map((room) => ({
      ...room,
      slots: room.slots.map((slot) => {
        const rawSlot = slot as typeof slot & { itemId?: string | null }
        return {
          ...slot,
          documentIds: Array.isArray(slot.documentIds)
            ? slot.documentIds
            : rawSlot.itemId
              ? [rawSlot.itemId]
              : [],
        }
      }),
    })),
  }
}

interface DraftStore {
  content: Content | null
  dirty: boolean
  loading: boolean
  error: string | null

  init: () => Promise<void>
  loadContent: (c: Content) => void
  addDocument: (document: DocumentItem) => void
  updateDocument: (id: string, patch: Partial<DocumentItem>) => void
  removeDocument: (id: string) => void
  assignDocuments: (roomId: string, slotId: string, documentIds: string[]) => void
  markClean: () => void
  reset: () => void

  // Room management
  addPeriod: (period: Period) => void
  updatePeriod: (id: string, patch: Partial<Period>) => void
  removePeriod: (id: string) => void
  addRoom: (room: Room) => void
  removeRoom: (id: string) => void
  updateRoom: (id: string, patch: Partial<Room>) => void
  addViewpoint: (roomId: string, vp: Viewpoint) => void
  updateViewpoint: (roomId: string, vpId: string, patch: Partial<Viewpoint>) => void
  removeViewpoint: (roomId: string, vpId: string) => void
  setEntryViewpoint: (roomId: string, vpId: string) => void
  addPortal: (roomId: string, portal: RoomPortal) => void
  updatePortal: (roomId: string, portalId: string, patch: Partial<RoomPortal>) => void
  removePortal: (roomId: string, portalId: string) => void
}

export const useDraftStore = create<DraftStore>()(
  persist(
    (set, get) => ({
      content: null,
      dirty: false,
      loading: false,
      error: null,

      init: async () => {
        set({ loading: true, error: null })

        const local = get().content
        const localDirty = get().dirty
        const localIsBootstrap = local?.rooms.length === 1 && local.rooms[0]?.id === DEFAULT_CONTENT.rooms[0]?.id
        const localSlotCount = local?.rooms.reduce((sum, room) => sum + room.slots.length, 0) ?? 0
        const localHasUsefulData = localSlotCount > 0

        // If the browser has unsaved edits (e.g. a fresh local upload/assignment), keep
        // them across F5. Otherwise the static seed would overwrite the just-created item.
        if (local && localDirty && !localIsBootstrap && localHasUsefulData) {
          set({ content: normalizeContentShape(local), loading: false, dirty: true })
          return
        }

        // Cloudflare and local-wrangler modes: Worker draft/content is the shared source.
        const draftContent = await loadDraftContent()
        if (draftContent) {
          set({ content: normalizeContentShape(draftContent), loading: false, dirty: false })
          return
        }

        // Last fallback: committed static content files, then bootstrap seed.
        const staticContent = await loadStaticContent()
        set({
          content: normalizeContentShape(staticContent ?? (localIsBootstrap ? DEFAULT_CONTENT : (local ?? DEFAULT_CONTENT))),
          loading: false,
          dirty: false,
        })
      },

      loadContent: (content) => set({ content: normalizeContentShape(content), dirty: false }),

      addDocument: (document) =>
        set((s) => {
          if (!s.content) return s
          return { content: { ...s.content, documents: [...s.content.documents, document] }, dirty: true }
        }),

      updateDocument: (id, patch) =>
        set((s) => {
          if (!s.content) return s
          return {
            content: {
              ...s.content,
              documents: s.content.documents.map((it) => {
                if (it.id !== id) return it
                const next = { ...it, ...patch }
                Object.entries(patch).forEach(([key, value]) => {
                  if (value === undefined) delete (next as Record<string, unknown>)[key]
                })
                return next
              }),
            },
            dirty: true,
          }
        }),

      removeDocument: (id) =>
        set((s) => {
          if (!s.content) return s
          return {
            content: {
              ...s.content,
              documents: s.content.documents.filter((it) => it.id !== id),
              rooms: s.content.rooms.map((r) => ({
                ...r,
                slots: r.slots.map((sl) => ({ ...sl, documentIds: (sl.documentIds ?? []).filter((documentId) => documentId !== id) })),
              })),
            },
            dirty: true,
          }
        }),

      assignDocuments: (roomId, slotId, documentIds) =>
        set((s) => {
          if (!s.content) return s
          return {
            content: {
              ...s.content,
              rooms: s.content.rooms.map((r) =>
                r.id !== roomId
                  ? r
                  : {
                      ...r,
                      slots: r.slots.map((sl) => (sl.id !== slotId ? sl : { ...sl, documentIds })),
                    },
              ),
            },
            dirty: true,
          }
        }),

      markClean: () => set({ dirty: false }),

      reset: () => set({ content: null, dirty: false, error: null }),

      addPeriod: (period) =>
        set((s) => {
          if (!s.content) return s
          return {
            content: { ...s.content, periods: [...s.content.periods, period] },
            dirty: true,
          }
        }),

      updatePeriod: (id, patch) =>
        set((s) => {
          if (!s.content) return s
          return {
            content: {
              ...s.content,
              periods: s.content.periods.map((period) =>
                period.id !== id ? period : { ...period, ...patch },
              ),
            },
            dirty: true,
          }
        }),

      removePeriod: (id) =>
        set((s) => {
          if (!s.content) return s
          return {
            content: {
              ...s.content,
              periods: s.content.periods.filter((period) => period.id !== id),
            },
            dirty: true,
          }
        }),

      addRoom: (room) =>
        set((s) => {
          if (!s.content) return s
          return {
            content: { ...s.content, rooms: [...s.content.rooms, room] },
            dirty: true,
          }
        }),

      removeRoom: (id) =>
        set((s) => {
          if (!s.content) return s
          return {
            content: {
              ...s.content,
              rooms: s.content.rooms
                .filter((r) => r.id !== id)
                // also clear portals pointing to this room
                .map((r) => ({
                  ...r,
                  portals: (r.portals ?? []).filter((p) => p.targetRoomId !== id),
                })),
            },
            dirty: true,
          }
        }),

      updateRoom: (id, patch) =>
        set((s) => {
          if (!s.content) return s
          return {
            content: {
              ...s.content,
              rooms: s.content.rooms.map((r) => (r.id !== id ? r : { ...r, ...patch })),
            },
            dirty: true,
          }
        }),

      addViewpoint: (roomId, vp) =>
        set((s) => {
          if (!s.content) return s
          return {
            content: {
              ...s.content,
              rooms: s.content.rooms.map((r) =>
                r.id !== roomId
                  ? r
                  : {
                      ...r,
                      viewpoints: [...r.viewpoints, vp],
                      entryViewpointId: r.viewpoints.length === 0 ? vp.id : r.entryViewpointId,
                    },
              ),
            },
            dirty: true,
          }
        }),

      updateViewpoint: (roomId, vpId, patch) =>
        set((s) => {
          if (!s.content) return s
          return {
            content: {
              ...s.content,
              rooms: s.content.rooms.map((r) => {
                if (r.id !== roomId) return r
                return {
                  ...r,
                  viewpoints: r.viewpoints.map((vp) => (vp.id !== vpId ? vp : { ...vp, ...patch })),
                }
              }),
            },
            dirty: true,
          }
        }),

      removeViewpoint: (roomId, vpId) =>
        set((s) => {
          if (!s.content) return s
          return {
            content: {
              ...s.content,
              rooms: s.content.rooms.map((r) => {
                if (r.id !== roomId) return r
                const viewpoints = r.viewpoints.filter((v) => v.id !== vpId)
                return {
                  ...r,
                  viewpoints,
                  entryViewpointId:
                    r.entryViewpointId === vpId ? (viewpoints[0]?.id ?? '') : r.entryViewpointId,
                }
              }),
            },
            dirty: true,
          }
        }),

      setEntryViewpoint: (roomId, vpId) =>
        set((s) => {
          if (!s.content) return s
          return {
            content: {
              ...s.content,
              rooms: s.content.rooms.map((r) =>
                r.id !== roomId ? r : { ...r, entryViewpointId: vpId },
              ),
            },
            dirty: true,
          }
        }),

      addPortal: (roomId, portal) =>
        set((s) => {
          if (!s.content) return s
          return {
            content: {
              ...s.content,
              rooms: s.content.rooms.map((r) =>
                r.id !== roomId
                  ? r
                  : {
                      ...r,
                      portals: [...(r.portals ?? []), portal],
                    },
              ),
            },
            dirty: true,
          }
        }),

      updatePortal: (roomId, portalId, patch) =>
        set((s) => {
          if (!s.content) return s
          return {
            content: {
              ...s.content,
              rooms: s.content.rooms.map((r) => {
                if (r.id !== roomId) return r
                return {
                  ...r,
                  portals: (r.portals ?? []).map((portal) =>
                    portal.id !== portalId ? portal : { ...portal, ...patch },
                  ),
                }
              }),
            },
            dirty: true,
          }
        }),

      removePortal: (roomId, portalId) =>
        set((s) => {
          if (!s.content) return s
          return {
            content: {
              ...s.content,
              rooms: s.content.rooms.map((r) =>
                r.id !== roomId
                  ? r
                  : {
                      ...r,
                      portals: (r.portals ?? []).filter((p) => p.id !== portalId),
                    },
              ),
            },
            dirty: true,
          }
        }),
    }),
    {
      name: 'vm-admin-draft-v2',
      partialize: (s) => ({ content: s.content, dirty: s.dirty }),
      merge: (persisted, current) => {
        const state = { ...current, ...(persisted as Partial<DraftStore>) }
        return {
          ...state,
          content: state.content ? normalizeContentShape(state.content) : null,
        } as DraftStore
      },
    },
  ),
)
