import { create } from 'zustand'
import type { Item, ContentIndex, RoomStub } from '@vm/shared'

interface MuseumStore {
  index: ContentIndex | null
  currentRoomId: string | null
  activeViewpointId: string | null
  selectedItem: Item | null
  selectedSlotId: string | null

  setIndex: (index: ContentIndex) => void
  navigateToRoom: (roomId: string) => void
  selectSlot: (slotId: string, item: Item | null) => void
  closeModal: () => void
  setViewpoint: (vpId: string) => void
  setActiveViewpoint: (vpId: string) => void
}

export const useMuseumStore = create<MuseumStore>((set, get) => ({
  index: null,
  currentRoomId: null,
  activeViewpointId: null,
  selectedItem: null,
  selectedSlotId: null,

  setIndex: (index) => {
    set({ index, currentRoomId: index.defaultRoomId, activeViewpointId: null })
  },

  navigateToRoom: (roomId) => {
    set({ currentRoomId: roomId, activeViewpointId: null, selectedItem: null })
  },

  selectSlot: (slotId, item) => set({ selectedSlotId: slotId, selectedItem: item }),
  closeModal: () => set({ selectedItem: null, selectedSlotId: null }),
  setViewpoint: (vpId) => set({ activeViewpointId: vpId }),
  setActiveViewpoint: (vpId) => set({ activeViewpointId: vpId }),
}))

/** Look up the current room stub from the index. */
export function useCurrentRoomStub(): RoomStub | undefined {
  return useMuseumStore((s) => s.index?.rooms.find((r) => r.id === s.currentRoomId))
}
