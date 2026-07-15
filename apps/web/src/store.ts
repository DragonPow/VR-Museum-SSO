import { create } from 'zustand'
import type { DocumentItem, ContentIndex, RoomStub } from '@vm/shared'

interface MuseumStore {
  index: ContentIndex | null
  currentRoomId: string | null
  activeViewpointId: string | null
  selectedDocuments: DocumentItem[]
  selectedSlotId: string | null

  setIndex: (index: ContentIndex) => void
  navigateToRoom: (roomId: string) => void
  selectSlot: (slotId: string, documents: DocumentItem[]) => void
  closeModal: () => void
  setViewpoint: (vpId: string) => void
  setActiveViewpoint: (vpId: string) => void
}

export const useMuseumStore = create<MuseumStore>((set) => ({
  index: null,
  currentRoomId: null,
  activeViewpointId: null,
  selectedDocuments: [],
  selectedSlotId: null,

  setIndex: (index) => {
    set({ index, currentRoomId: index.defaultRoomId, activeViewpointId: null })
  },

  navigateToRoom: (roomId) => {
    set({ currentRoomId: roomId, activeViewpointId: null, selectedDocuments: [] })
  },

  selectSlot: (slotId, documents) => set({ selectedSlotId: slotId, selectedDocuments: documents }),
  closeModal: () => set({ selectedDocuments: [], selectedSlotId: null }),
  setViewpoint: (vpId) => set({ activeViewpointId: vpId }),
  setActiveViewpoint: (vpId) => set({ activeViewpointId: vpId }),
}))

export function useCurrentRoomStub(): RoomStub | undefined {
  return useMuseumStore((s) => s.index?.rooms.find((r) => r.id === s.currentRoomId))
}
