import type { GuestbookNote, GuestbookNoteStatus } from '@vm/shared'

const VIRTUAL_MUSEUM_MY_WISHES_KEY = 'vm_my_guestbook_full_notes'
const VIRTUAL_MUSEUM_NOTE_IDS_KEY = 'vm_my_guestbook_notes'
const VISITOR_ID_KEY = 'visitor_id'

export function getOrCreateVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_ID_KEY)
    if (!id) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `v_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
      localStorage.setItem(VISITOR_ID_KEY, id)
    }
    return id
  } catch {
    return `v_${Date.now()}`
  }
}

export function getMyLocalNotes(): GuestbookNote[] {
  try {
    const raw = localStorage.getItem(VIRTUAL_MUSEUM_MY_WISHES_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as GuestbookNote[]
      if (Array.isArray(parsed)) {
        return parsed
      }
    }
    return []
  } catch {
    return []
  }
}

export function saveMyLocalNote(note: GuestbookNote): GuestbookNote[] {
  try {
    const existing = getMyLocalNotes()
    const index = existing.findIndex((n) => n.id === note.id)
    if (index >= 0) {
      existing[index] = note
    } else {
      existing.unshift(note)
    }
    localStorage.setItem(VIRTUAL_MUSEUM_MY_WISHES_KEY, JSON.stringify(existing))

    // Keep legacy vm_my_guestbook_notes IDs in sync
    const ids = existing.map((n) => n.id)
    localStorage.setItem(VIRTUAL_MUSEUM_NOTE_IDS_KEY, JSON.stringify(ids))
    return existing
  } catch {
    return getMyLocalNotes()
  }
}

export function deleteMyLocalNote(noteId: string): GuestbookNote[] {
  try {
    const existing = getMyLocalNotes()
    const updated = existing.filter((n) => n.id !== noteId)
    localStorage.setItem(VIRTUAL_MUSEUM_MY_WISHES_KEY, JSON.stringify(updated))

    const ids = updated.map((n) => n.id)
    localStorage.setItem(VIRTUAL_MUSEUM_NOTE_IDS_KEY, JSON.stringify(ids))
    return updated
  } catch {
    return getMyLocalNotes()
  }
}

export function syncMyLocalNotesWithPublic(publicApprovedNotes: GuestbookNote[]): GuestbookNote[] {
  const localNotes = getMyLocalNotes()
  if (localNotes.length === 0) return []

  const approvedMap = new Map(publicApprovedNotes.map((n) => [n.id, n]))
  let updated = false

  const synced = localNotes.map((local) => {
    const publicNote = approvedMap.get(local.id)
    if (publicNote) {
      if (local.status !== 'approved' || local.isPinned !== publicNote.isPinned) {
        updated = true
        const updatedNote: GuestbookNote = {
          ...local,
          status: 'approved',
          ...(publicNote.isPinned !== undefined ? { isPinned: publicNote.isPinned } : {}),
          ...(publicNote.priority !== undefined ? { priority: publicNote.priority } : {}),
        }
        return updatedNote
      }
    }
    return local
  })

  if (updated) {
    try {
      localStorage.setItem(VIRTUAL_MUSEUM_MY_WISHES_KEY, JSON.stringify(synced))
    } catch {
      // ignore
    }
  }

  return synced
}
