import { useEffect, useState, useRef, useMemo } from 'react'
import type { GuestbookNote } from '@vm/shared'
import { GuestbookNoteThumb } from './GuestbookNoteThumb.js'
import { GuestbookDetailModal } from './GuestbookDetailModal.js'
import { GuestbookFormModal } from './GuestbookFormModal.js'

interface Props {
  onClose: () => void
  eventId?: string | undefined
  eventTitle?: string | undefined
}

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export function GuestbookWall({ onClose, eventId, eventTitle }: Props) {
  const [notes, setNotes] = useState<GuestbookNote[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<'priority' | 'newest' | 'random'>('priority')
  const [selectedNote, setSelectedNote] = useState<GuestbookNote | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [myNoteIds, setMyNoteIds] = useState<Set<string>>(new Set())
  const [visitorId, setVisitorId] = useState<string>('')

  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  // Load user's visitor ID & submitted note IDs from localStorage
  const loadMyNotes = () => {
    try {
      const vId = localStorage.getItem('visitor_id') || ''
      setVisitorId(vId)
      const stored = JSON.parse(localStorage.getItem('vm_my_guestbook_notes') || '[]') as string[]
      setMyNoteIds(new Set(stored))
    } catch {
      setMyNoteIds(new Set())
    }
  }

  const fetchInitialNotes = async (mode = sortMode) => {
    try {
      setLoading(true)
      setPage(1)
      const eventQuery = eventId ? `&event=${encodeURIComponent(eventId)}` : ''
      const res = await fetch(`${API_BASE}/api/guestbook?page=1&limit=12&sort=${mode}${eventQuery}`)
      if (res.ok) {
        const data = (await res.json()) as { notes: GuestbookNote[]; hasMore?: boolean }
        setNotes(data.notes || [])
        setHasMore(Boolean(data.hasMore))
      } else {
        setNotes([])
        setHasMore(false)
      }
    } catch {
      setNotes([])
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }

  const fetchMoreNotes = async () => {
    if (loadingMore || !hasMore || searchQuery.trim()) return
    try {
      setLoadingMore(true)
      const nextPage = page + 1
      const eventQuery = eventId ? `&event=${encodeURIComponent(eventId)}` : ''
      const res = await fetch(`${API_BASE}/api/guestbook?page=${nextPage}&limit=8&sort=${sortMode}${eventQuery}`)
      if (res.ok) {
        const data = (await res.json()) as { notes: GuestbookNote[]; hasMore?: boolean }
        if (data.notes && data.notes.length > 0) {
          setNotes((prev) => {
            const existingIds = new Set(prev.map((n) => n.id))
            const newUnique = data.notes.filter((n) => !existingIds.has(n.id))
            return [...prev, ...newUnique]
          })
          setPage(nextPage)
          setHasMore(Boolean(data.hasMore))
          return
        }
      }
      setHasMore(false)
    } catch {
      setHasMore(false)
    } finally {
      setLoadingMore(false)
    }
  }


  const handleSortChange = (mode: 'priority' | 'newest' | 'random') => {
    setSortMode(mode)
    void fetchInitialNotes(mode)
  }

  useEffect(() => {
    loadMyNotes()
    void fetchInitialNotes('priority')
  }, [eventId])

  // Infinite Scroll IntersectionObserver
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || loadingMore || loading) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void fetchMoreNotes()
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    )

    observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loading, page, searchQuery, sortMode, eventId])

  // Close on Escape if no modal open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !selectedNote && !showForm) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, selectedNote, showForm])

  // Filter notes according to search
  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes
    const q = searchQuery.toLowerCase()
    return notes.filter((n) => {
      const matchContent = n.content.toLowerCase().includes(q)
      const matchSig = (n.signature ?? '').toLowerCase().includes(q)
      return matchContent || matchSig
    })
  }, [notes, searchQuery])

  // Separate pinned (central focus) and regular notes
  const pinnedNotes = useMemo(() => {
    return filteredNotes.filter((n) => Boolean(n.isPinned))
  }, [filteredNotes])

  const regularNotes = useMemo(() => {
    return filteredNotes.filter((n) => !n.isPinned)
  }, [filteredNotes])

  const isNoteMine = (note: GuestbookNote) => {
    if (visitorId && note.authorId && note.authorId === visitorId) return true
    return myNoteIds.has(note.id)
  }

  return (
    <div style={styles.overlay}>
      {/* Top Navigation Bar */}
      <header style={styles.topBar}>
        <div style={styles.titleGroup}>
          <span style={styles.titleIcon}>📌</span>
          <div>
            <h1 style={styles.title}>
              {eventTitle ? `Tường Lưu Bút - ${eventTitle}` : 'Tường Lưu Bút 50 Năm'}
            </h1>
            <p style={styles.subtitle}>
              {eventId ? `Nơi lưu giữ những lời chúc dành riêng cho sự kiện này` : 'Nơi lưu giữ những lời chúc và tình cảm của người tham quan'}
            </p>
          </div>
        </div>

        {/* Sort & Filter Controls */}
        <div style={styles.controlsGroup}>
          {/* Sort Pills */}
          <div style={styles.sortPills}>
            <button
              style={{
                ...styles.sortPill,
                ...(sortMode === 'priority' ? styles.sortPillActive : {}),
              }}
              onClick={() => handleSortChange('priority')}
              title="Xem các lời chúc tiêu biểu được ghim & ưu tiên"
            >
              🌟 Tiêu biểu
            </button>
            <button
              style={{
                ...styles.sortPill,
                ...(sortMode === 'newest' ? styles.sortPillActive : {}),
              }}
              onClick={() => handleSortChange('newest')}
              title="Xem các lời chúc mới gửi gần đây"
            >
              ⏳ Mới nhất
            </button>
            <button
              style={{
                ...styles.sortPill,
                ...(sortMode === 'random' ? styles.sortPillActive : {}),
              }}
              onClick={() => handleSortChange('random')}
              title="Khám phá ngẫu nhiên các lời chúc khác nhau"
            >
              🎲 Ngẫu nhiên
            </button>
          </div>

          {/* Search bar */}
          <div style={styles.searchWrapper}>
            <input
              type="text"
              placeholder="🔍 Tìm lời chúc hoặc người ký..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
            {searchQuery && (
              <button style={styles.clearSearchBtn} onClick={() => setSearchQuery('')}>✕</button>
            )}
          </div>
        </div>

        <div style={styles.actionGroup}>
          <button style={styles.writeBtn} onClick={() => setShowForm(true)}>
            ✍️ Viết lời chúc
          </button>
          <button style={styles.closeBtn} onClick={onClose} title="Đóng (Esc)">
            ✕
          </button>
        </div>
      </header>

      {/* Main Wall Content Area */}
      <div style={styles.wallContainer}>
        {loading ? (
          <div style={styles.centerBox}>
            <div style={styles.spinner} />
            <p style={{ color: '#64748b', fontSize: '14px', marginTop: '12px' }}>Đang dán lời chúc lên tường...</p>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div style={styles.centerBox}>
            <p style={{ color: '#64748b', fontSize: '15px' }}>
              {searchQuery ? `Không tìm thấy lời chúc nào với từ khóa "${searchQuery}"` : 'Chưa có lời chúc nào trên tường.'}
            </p>
          </div>
        ) : (
          <div style={styles.wallBody}>
            {/* Pinned Notes Showcase (Centered Hero Focus) */}
            {pinnedNotes.length > 0 && (
              <div style={styles.pinnedRow}>
                {pinnedNotes.map((note) => (
                  <GuestbookNoteThumb
                    key={note.id}
                    note={note}
                    isMine={isNoteMine(note)}
                    onClick={() => setSelectedNote(note)}
                  />
                ))}
              </div>
            )}

            {/* Community Notes (Clean 4-column balanced flow) */}
            {regularNotes.length > 0 && (
              <div style={styles.notesGrid}>
                {regularNotes.map((note) => (
                  <GuestbookNoteThumb
                    key={note.id}
                    note={note}
                    isMine={isNoteMine(note)}
                    onClick={() => setSelectedNote(note)}
                  />
                ))}
              </div>
            )}

            {/* Infinite Scroll Trigger Sentinel */}
            <div ref={loadMoreRef} style={styles.sentinel}>
              {loadingMore && (
                <div style={styles.loadingMoreBox}>
                  <div style={styles.smallSpinner} />
                  <span style={{ fontSize: '13px', color: '#64748b' }}>Đang nạp thêm lời chúc...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Floating quick write button on mobile */}
      <button style={styles.mobileFloatingBtn} onClick={() => setShowForm(true)}>
        ✍️ Để lại lời chúc
      </button>

      {/* Detail Modal */}
      {selectedNote && (
        <GuestbookDetailModal
          note={selectedNote}
          onClose={() => setSelectedNote(null)}
        />
      )}

      {/* Form Modal */}
      {showForm && (
        <GuestbookFormModal
          eventTag={eventId}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false)
            loadMyNotes()
            void fetchInitialNotes()
          }}
        />
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 900,
    backgroundColor: '#ece8e1',
    backgroundImage: `
      radial-gradient(circle at 50% 50%, rgba(200, 168, 90, 0.08) 0%, transparent 80%),
      radial-gradient(#c5beae 1px, transparent 1px)
    `,
    backgroundSize: '100% 100%, 28px 28px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    animation: 'fadein 0.3s ease',
  },
  topBar: {
    padding: '14px 28px',
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(0,0,0,0.08)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
    zIndex: 10,
    gap: '16px',
    flexWrap: 'wrap',
  },
  titleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  titleIcon: {
    fontSize: '28px',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 800,
    color: '#1a1208',
    letterSpacing: '-0.2px',
    fontFamily: '"Playfair Display", "Be Vietnam Pro", serif',
  },
  subtitle: {
    margin: 0,
    fontSize: '12px',
    color: '#7a6e5d',
  },
  controlsGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  sortPills: {
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(0, 0, 0, 0.04)',
    padding: '3px',
    borderRadius: '20px',
    border: '1px solid rgba(0, 0, 0, 0.06)',
  },
  sortPill: {
    border: 'none',
    background: 'transparent',
    color: '#6a5a40',
    fontSize: '12.5px',
    fontWeight: 600,
    padding: '5px 12px',
    borderRadius: '16px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  sortPillActive: {
    background: '#ffffff',
    color: '#854d0e',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
    fontWeight: 700,
  },
  searchWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    width: '240px',
  },
  searchInput: {
    width: '100%',
    padding: '8px 32px 8px 14px',
    borderRadius: '20px',
    border: '1px solid #d4cdbe',
    backgroundColor: 'rgba(255,255,255,0.9)',
    fontSize: '13px',
    color: '#2c2214',
    outline: 'none',
    boxSizing: 'border-box',
    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.04)',
  },
  clearSearchBtn: {
    position: 'absolute',
    right: '10px',
    background: 'none',
    border: 'none',
    color: '#9a9080',
    fontSize: '12px',
    cursor: 'pointer',
  },
  actionGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  writeBtn: {
    padding: '9px 20px',
    background: 'linear-gradient(135deg, #fde047, #c8a85a)',
    color: '#1a1208',
    border: 'none',
    borderRadius: '24px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(200, 168, 90, 0.4)',
    transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  closeBtn: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    border: '1px solid rgba(0,0,0,0.1)',
    backgroundColor: '#ffffff',
    color: '#4a3e2e',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
  },
  wallContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '36px 32px 80px',
    display: 'flex',
    flexDirection: 'column',
  },
  wallBody: {
    maxWidth: '1260px',
    width: '100%',
    margin: 'auto',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '24px',
  },
  pinnedRow: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '24px',
    width: '100%',
    marginBottom: '4px',
  },
  notesGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: '24px',
    width: '100%',
  },
  sentinel: {
    height: '40px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingMoreBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 16px',
    background: 'rgba(255,255,255,0.8)',
    borderRadius: '20px',
    border: '1px solid #d4cdbe',
  },
  smallSpinner: {
    width: '14px',
    height: '14px',
    border: '2px solid rgba(200, 168, 90, 0.3)',
    borderTopColor: '#c8a85a',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  centerBox: {
    margin: 'auto',
    textAlign: 'center',
    padding: '40px',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid rgba(200, 168, 90, 0.2)',
    borderTopColor: '#c8a85a',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto',
  },
  mobileFloatingBtn: {
    display: 'none',
  },
}
