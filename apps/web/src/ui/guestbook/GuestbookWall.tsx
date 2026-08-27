import { useEffect, useState, useRef, useMemo } from 'react'
import type { GuestbookNote } from '@vm/shared'
import { GuestbookNoteThumb } from './GuestbookNoteThumb.js'
import { GuestbookDetailModal } from './GuestbookDetailModal.js'
import { GuestbookFormModal } from './GuestbookFormModal.js'

interface Props {
  onClose: () => void
}

const API_BASE = import.meta.env.VITE_API_URL ?? ''

// Mock default initial notes in case API has no notes yet
const SEED_NOTES: GuestbookNote[] = [
  {
    id: 'gb_seed_1',
    content: 'Chúc mừng 50 năm thành lập công ty! Chúc tập thể luôn đoàn kết, vững mạnh và không ngừng phát triển vươn xa trên trường quốc tế.',
    signature: 'Chủ Tịch HĐQT',
    colorPreset: 'yellow',
    rotation: -2.2,
    status: 'approved',
    isPinned: true,
    isVisible: true,
    priority: 100,
    createdAt: '2026-08-27T01:00:00.000Z',
  },
  {
    id: 'gb_seed_2',
    content: '50 năm kiên định một tầm nhìn, tiên phong trong từng bước đi. Chúc toàn thể cán bộ nhân viên luôn tràn đầy nhiệt huyết sáng tạo.',
    signature: 'Tổng Giám Đốc',
    colorPreset: 'blue',
    rotation: 2.1,
    status: 'approved',
    isPinned: true,
    isVisible: true,
    priority: 90,
    createdAt: '2026-08-27T01:05:00.000Z',
  },
  {
    id: 'gb_seed_3',
    content: 'Tự hào là một phần của đại gia đình trong suốt 15 năm qua. Chúc mừng sinh nhật lần thứ 50! Mong là trong vòng 50 năm tới vẫn sẽ luôn tuyệt vời như ngày hôm nay vậy.',
    signature: 'Khối Sản Xuất',
    colorPreset: 'pink',
    rotation: 3.4,
    status: 'approved',
    isPinned: false,
    isVisible: true,
    priority: 50,
    createdAt: '2026-08-27T01:10:00.000Z',
  },
  {
    id: 'gb_seed_4',
    content: 'Không gian bảo tàng số 3D rất hoành tráng và ấn tượng! Kính chúc công ty ngày càng thịnh vượng, vững bước tương lai.',
    signature: 'Đoàn Thanh Niên',
    colorPreset: 'green',
    rotation: -3.5,
    status: 'approved',
    isPinned: false,
    isVisible: true,
    priority: 40,
    createdAt: '2026-08-27T01:15:00.000Z',
  },
  {
    id: 'gb_seed_5',
    content: '50 năm một chặng đường tự hào. Tri ân các thế hệ đi trước đã cống hiến hết mình cho sự phát triển của công ty hôm nay.',
    signature: 'Công Đoàn SSO',
    colorPreset: 'blue',
    rotation: 1.5,
    status: 'approved',
    isPinned: false,
    isVisible: true,
    priority: 45,
    createdAt: '2026-08-27T01:20:00.000Z',
  },
  {
    id: 'gb_seed_6',
    content: 'Khối Kỹ Thuật cam kết luôn làm chủ công nghệ mới, đồng hành cùng sự bứt phá và chuyển đổi số toàn diện của công ty!',
    signature: 'Khối Kỹ Thuật & CNTT',
    colorPreset: 'yellow',
    rotation: -1.8,
    status: 'approved',
    isPinned: false,
    isVisible: true,
    createdAt: '2026-08-27T01:25:00.000Z',
  },
  {
    id: 'gb_seed_7',
    content: 'Kính chúc đại gia đình SSO dồi dào sức khỏe, luôn giữ vững ngọn lửa nhiệt huyết và gặt hái thêm nhiều thắng lợi rực rỡ.',
    signature: 'Phòng Quản Trị Nhân Sự',
    colorPreset: 'pink',
    rotation: 2.8,
    status: 'approved',
    isPinned: false,
    isVisible: true,
    createdAt: '2026-08-27T01:30:00.000Z',
  },
  {
    id: 'gb_seed_8',
    content: 'Được cống hiến và trưởng thành cùng công ty là niềm tự hào lớn nhất trong sự nghiệp của tôi. Chúc mừng cột mốc 50 năm vàng son!',
    signature: 'Nguyễn Minh Tuấn (Phòng R&D)',
    colorPreset: 'white',
    rotation: -3.1,
    status: 'approved',
    isPinned: false,
    isVisible: true,
    createdAt: '2026-08-27T01:35:00.000Z',
  },
  {
    id: 'gb_seed_9',
    content: 'Từ mảnh đất phương Nam, Chi nhánh miền Nam xin gửi trọn niềm tin và lời chúc mừng nồng nhiệt nhất đến ngày hội lớn 50 năm!',
    signature: 'Chi Nhánh Miền Nam',
    colorPreset: 'green',
    rotation: 1.2,
    status: 'approved',
    isPinned: false,
    isVisible: true,
    createdAt: '2026-08-27T01:40:00.000Z',
  },
  {
    id: 'gb_seed_10',
    content: 'Mỗi con số, mỗi báo cáo tài chính qua từng năm đều minh chứng cho sự tăng trưởng vượt bậc và bền vững. Chúc công ty bứt phá hơn nữa!',
    signature: 'Ban Tài Chính Kế Toán',
    colorPreset: 'yellow',
    rotation: -2.7,
    status: 'approved',
    isPinned: false,
    isVisible: true,
    createdAt: '2026-08-27T01:45:00.000Z',
  },
  {
    id: 'gb_seed_11',
    content: 'Xem lại những thước phim và hình ảnh lịch sử trong bảo tàng 3D xúc động vô cùng. Cảm ơn các thế hệ tiền bối!',
    signature: 'Lê Thị Hồng Hạnh',
    colorPreset: 'pink',
    rotation: 3.6,
    status: 'approved',
    isPinned: false,
    isVisible: true,
    createdAt: '2026-08-27T01:50:00.000Z',
  },
  {
    id: 'gb_seed_12',
    content: 'Đối tác tin cậy, hợp tác bền lâu. Chúc mừng kỷ niệm 50 năm thành lập và chúc cho mối quan hệ hợp tác của chúng ta ngày càng bền chặt.',
    signature: 'Đối tác Chiến Lược Viettel',
    colorPreset: 'blue',
    rotation: -1.4,
    status: 'approved',
    isPinned: false,
    isVisible: true,
    createdAt: '2026-08-27T01:55:00.000Z',
  },
  {
    id: 'gb_seed_13',
    content: 'Thế hệ trẻ chúng tôi xin hứa sẽ tiếp bước ngọn lửa truyền thống 50 năm, không ngừng sáng tạo và phụng sự vì sự phát triển chung!',
    signature: 'Đội ngũ Gen Z SSO',
    colorPreset: 'green',
    rotation: 2.3,
    status: 'approved',
    isPinned: false,
    isVisible: true,
    createdAt: '2026-08-27T02:00:00.000Z',
  },
  {
    id: 'gb_seed_14',
    content: 'Là một cán bộ đã nghỉ hưu hơn 10 năm, khi mở xem bảo tàng số này tôi thấy như được sống lại những năm tháng tuổi trẻ sôi nổi.',
    signature: 'Bác Quách Văn Mùi (Hưu trí)',
    colorPreset: 'yellow',
    rotation: -2.9,
    status: 'approved',
    isPinned: false,
    isVisible: true,
    createdAt: '2026-08-27T02:05:00.000Z',
  },
  {
    id: 'gb_seed_15',
    content: 'Chúc công ty tuổi 50 tràn đầy sức trẻ, vươn cao vươn xa, luôn là lá cờ đầu trong ngành!',
    signature: 'Trần Quốc Bảo (Khối Kinh Doanh)',
    colorPreset: 'pink',
    rotation: 1.8,
    status: 'approved',
    isPinned: false,
    isVisible: true,
    createdAt: '2026-08-27T02:10:00.000Z',
  },
  {
    id: 'gb_seed_16',
    content: 'Tự hào từng dòng sản phẩm mang thương hiệu SSO đến tay hàng triệu khách hàng. 50 năm vững tin!',
    signature: 'Phòng Quản Lý Chất Lượng QA/QC',
    colorPreset: 'green',
    rotation: -1.5,
    status: 'approved',
    isPinned: false,
    isVisible: true,
    createdAt: '2026-08-27T02:15:00.000Z',
  },
  {
    id: 'gb_seed_17',
    content: 'Kỷ niệm 50 năm là dịp nhìn lại chặng đường vẻ vang để bứt phá mạnh mẽ hơn. Kính chúc ban lãnh đạo sáng suốt và thành công!',
    signature: 'Ban Quản Lý Dự Án',
    colorPreset: 'blue',
    rotation: 2.6,
    status: 'approved',
    isPinned: false,
    isVisible: true,
    createdAt: '2026-08-27T02:20:00.000Z',
  },
  {
    id: 'gb_seed_18',
    content: 'Chúc mừng sinh nhật công ty! Chúc toàn thể anh chị em luôn giữ vững niềm tin, đoàn kết cùng nhau kiến tạo tương lai mới.',
    signature: 'Hoàng Kim Ngân',
    colorPreset: 'white',
    rotation: -2.1,
    status: 'approved',
    isPinned: false,
    isVisible: true,
    createdAt: '2026-08-27T02:25:00.000Z',
  },
  {
    id: 'gb_seed_19',
    content: 'Chúc cho ngọn cờ SSO luôn bay cao trên bản đồ kinh tế Việt Nam và vươn tầm khu vực.',
    signature: 'Chi Nhánh Miền Trung',
    colorPreset: 'yellow',
    rotation: 3.1,
    status: 'approved',
    isPinned: false,
    isVisible: true,
    createdAt: '2026-08-27T02:30:00.000Z',
  },
  {
    id: 'gb_seed_20',
    content: 'Xin gửi lời tri ân chân thành nhất tới Ban Lãnh Đạo đã luôn chèo lái con thuyền SSO vượt qua mọi thăng trầm lịch sử.',
    signature: 'Tập thể Cán bộ Thâm niên',
    colorPreset: 'pink',
    rotation: -3.8,
    status: 'approved',
    isPinned: false,
    isVisible: true,
    createdAt: '2026-08-27T02:35:00.000Z',
  },
  {
    id: 'gb_seed_21',
    content: 'Tự hào truyền thống 50 năm – Khát vọng vươn tầm tương lai!',
    signature: 'Chi Bộ Đảng SSO',
    colorPreset: 'blue',
    rotation: 1.7,
    status: 'approved',
    isPinned: false,
    isVisible: true,
    createdAt: '2026-08-27T02:40:00.000Z',
  },
  {
    id: 'gb_seed_22',
    content: 'Trải nghiệm không gian 3D quá chân thực và đẹp mắt. Chúc mừng sự kiện 50 năm thành công rực rỡ!',
    signature: 'Đoàn Đại Biểu Khách Quý',
    colorPreset: 'green',
    rotation: -2.4,
    status: 'approved',
    isPinned: false,
    isVisible: true,
    createdAt: '2026-08-27T02:45:00.000Z',
  },
]

export function GuestbookWall({ onClose }: Props) {
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
      const res = await fetch(`${API_BASE}/api/guestbook?page=1&limit=12&sort=${mode}`)
      if (res.ok) {
        const data = (await res.json()) as { notes: GuestbookNote[]; hasMore?: boolean }
        if (data.notes && data.notes.length > 0) {
          setNotes(data.notes)
          setHasMore(Boolean(data.hasMore))
          return
        }
      }
      // Fallback: seed notes with local sorting
      let fallback = [...SEED_NOTES]
      if (mode === 'newest') {
        fallback.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      } else if (mode === 'random') {
        const pinned = fallback.filter((n) => n.isPinned)
        const unpinned = fallback.filter((n) => !n.isPinned).sort(() => Math.random() - 0.5)
        fallback = [...pinned, ...unpinned]
      }
      setNotes(fallback.slice(0, 12))
      setHasMore(fallback.length > 12)
    } catch {
      setNotes(SEED_NOTES.slice(0, 12))
      setHasMore(SEED_NOTES.length > 12)
    } finally {
      setLoading(false)
    }
  }

  const fetchMoreNotes = async () => {
    if (loadingMore || !hasMore || searchQuery.trim()) return
    try {
      setLoadingMore(true)
      const nextPage = page + 1
      const res = await fetch(`${API_BASE}/api/guestbook?page=${nextPage}&limit=8&sort=${sortMode}`)
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
      // Local seed pagination fallback
      const start = (nextPage - 1) * 8 + 4
      const nextChunk = SEED_NOTES.slice(start, start + 8)
      if (nextChunk.length > 0) {
        setNotes((prev) => {
          const existingIds = new Set(prev.map((n) => n.id))
          const newUnique = nextChunk.filter((n) => !existingIds.has(n.id))
          return [...prev, ...newUnique]
        })
        setPage(nextPage)
        setHasMore(start + 8 < SEED_NOTES.length)
      } else {
        setHasMore(false)
      }
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
  }, [])

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
  }, [hasMore, loadingMore, loading, page, searchQuery, sortMode])

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
            <h1 style={styles.title}>Tường Lưu Bút 50 Năm</h1>
            <p style={styles.subtitle}>Nơi lưu giữ những lời chúc và tình cảm của người tham quan</p>
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
