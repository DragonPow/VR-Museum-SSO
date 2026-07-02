import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_CONTENT, parseContent } from '@vm/shared'
import type { Content, Item, Period, Room, Viewpoint, RoomPortal } from '@vm/shared'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

interface DraftStore {
  content: Content | null
  dirty: boolean
  loading: boolean
  error: string | null

  init: () => Promise<void>
  loadContent: (c: Content) => void
  addItem: (item: Item) => void
  updateItem: (id: string, patch: Partial<Item>) => void
  removeItem: (id: string) => void
  assignItem: (roomId: string, slotId: string, itemId: string | null) => void
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
        const localContent = get().content
        const localDirty = get().dirty

        if (localContent && localDirty) {
          set({ loading: false, error: null })
          return
        }

        set({ loading: true, error: null })

        try {
          const res = await fetch(`${API_BASE}/api/draft`)
          if (res.ok) {
            const content = parseContent(await res.json())
            set({ content, loading: false, dirty: false })
            return
          }
        } catch {}

        if (localContent) {
          set({ content: localContent, loading: false, error: null })
          return
        }

        set({ content: DEFAULT_CONTENT, loading: false, dirty: true })
      },

      loadContent: (content) => set({ content, dirty: false }),

      addItem: (item) =>
        set((s) => {
          if (!s.content) return s
          return { content: { ...s.content, items: [...s.content.items, item] }, dirty: true }
        }),

      updateItem: (id, patch) =>
        set((s) => {
          if (!s.content) return s
          return {
            content: {
              ...s.content,
              items: s.content.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
            },
            dirty: true,
          }
        }),

      removeItem: (id) =>
        set((s) => {
          if (!s.content) return s
          return {
            content: {
              ...s.content,
              items: s.content.items.filter((it) => it.id !== id),
              rooms: s.content.rooms.map((r) => ({
                ...r,
                slots: r.slots.map((sl) => (sl.itemId === id ? { ...sl, itemId: null } : sl)),
              })),
            },
            dirty: true,
          }
        }),

      assignItem: (roomId, slotId, itemId) =>
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
                      slots: r.slots.map((sl) => (sl.id !== slotId ? sl : { ...sl, itemId })),
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
      name: 'vm-admin-draft-v1',
      partialize: (s) => ({ content: s.content, dirty: s.dirty }),
    },
  ),
)
