export type GuestbookNoteStatus = 'pending' | 'approved' | 'rejected'

export type GuestbookColorPreset = 'yellow' | 'pink' | 'green' | 'blue' | 'white'

export type GuestbookSortMode = 'priority' | 'newest' | 'oldest' | 'random'

export interface GuestbookEvent {
  id: string
  name: string
  color?: string
  description?: string
  isActive?: boolean
  createdAt?: string
}

export interface GuestbookNote {
  id: string
  content: string
  signature?: string | null
  colorPreset: GuestbookColorPreset
  rotation: number
  status: GuestbookNoteStatus
  isPinned?: boolean
  isVisible?: boolean
  priority?: number
  eventTag?: string | null
  authorId?: string | null
  createdAt: string
}

export interface GuestbookSubmitRequest {
  content: string
  signature?: string
  visitorId?: string
}

export interface GuestbookModerateRequest {
  id: string
  status: GuestbookNoteStatus
}

export interface GuestbookToggleRequest {
  id: string
  isPinned?: boolean
  isVisible?: boolean
  priority?: number
  eventTag?: string | null
}

export interface GuestbookBulkActionRequest {
  ids: string[]
  action: 'approve' | 'reject' | 'delete' | 'hide' | 'show' | 'pin' | 'unpin' | 'priority' | 'set_event'
  priority?: number
  eventTag?: string | null
}
