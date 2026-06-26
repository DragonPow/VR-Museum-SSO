import { create } from 'zustand'
import type { Item, Content } from '@vm/shared'

interface MuseumStore {
  content: Content | null
  currentRoomId: string | null
  activeViewpointId: string | null
  selectedItem: Item | null
  selectedSlotId: string | null

  setContent: (c: Content) => void
  navigateToRoom: (roomId: string) => void
  selectSlot: (slotId: string, item: Item | null) => void
  closeModal: () => void
  setViewpoint: (vpId: string) => void
}

export const useMuseumStore = create<MuseumStore>((set, get) => ({
  content: null,
  currentRoomId: null,
  activeViewpointId: null,
  selectedItem: null,
  selectedSlotId: null,

  setContent: (content) => {
    const firstRoom = content.rooms[0]
    set({
      content,
      currentRoomId: firstRoom?.id ?? null,
      activeViewpointId: firstRoom?.entryViewpointId ?? null,
    })
  },

  navigateToRoom: (roomId) => {
    const { content } = get()
    const room = content?.rooms.find((r) => r.id === roomId)
    if (!room) return
    set({ currentRoomId: roomId, activeViewpointId: room.entryViewpointId, selectedItem: null })
  },

  selectSlot: (slotId, item) => {
    set({ selectedSlotId: slotId, selectedItem: item })
  },

  closeModal: () => set({ selectedItem: null, selectedSlotId: null }),

  setViewpoint: (vpId) => set({ activeViewpointId: vpId }),
}))
