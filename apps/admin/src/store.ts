import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_CONTENT, parseContent } from '@vm/shared'
import type { Content, Item } from '@vm/shared'

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
}

export const useDraftStore = create<DraftStore>()(
  persist(
    (set, get) => ({
      content: null,
      dirty: false,
      loading: false,
      error: null,

      init: async () => {
        if (get().content) return
        set({ loading: true, error: null })

        try {
          const res = await fetch(`${API_BASE}/api/draft`)
          if (res.ok) {
            const content = parseContent(await res.json())
            set({ content, loading: false })
            return
          }
        } catch {}

        set({ content: DEFAULT_CONTENT, loading: false, dirty: true })
      },

      loadContent: (content) => set({ content, dirty: false }),

      addItem: (item) => set((s) => {
        if (!s.content) return s
        return { content: { ...s.content, items: [...s.content.items, item] }, dirty: true }
      }),

      updateItem: (id, patch) => set((s) => {
        if (!s.content) return s
        return {
          content: { ...s.content, items: s.content.items.map((it) => it.id === id ? { ...it, ...patch } : it) },
          dirty: true,
        }
      }),

      removeItem: (id) => set((s) => {
        if (!s.content) return s
        return {
          content: {
            ...s.content,
            items: s.content.items.filter((it) => it.id !== id),
            rooms: s.content.rooms.map((r) => ({
              ...r,
              slots: r.slots.map((sl) => sl.itemId === id ? { ...sl, itemId: null } : sl),
            })),
          },
          dirty: true,
        }
      }),

      assignItem: (roomId, slotId, itemId) => set((s) => {
        if (!s.content) return s
        return {
          content: {
            ...s.content,
            rooms: s.content.rooms.map((r) => r.id !== roomId ? r : {
              ...r,
              slots: r.slots.map((sl) => sl.id !== slotId ? sl : { ...sl, itemId }),
            }),
          },
          dirty: true,
        }
      }),

      markClean: () => set({ dirty: false }),

      reset: () => set({ content: null, dirty: false, error: null }),
    }),
    {
      name: 'vm-admin-draft-v1',
      partialize: (s) => ({ content: s.content, dirty: s.dirty }),
    },
  ),
)
