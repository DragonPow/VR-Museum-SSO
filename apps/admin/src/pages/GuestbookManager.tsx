import { useEffect, useState, useMemo } from 'react'
import type { GuestbookNote, GuestbookNoteStatus, GuestbookEvent } from '@vm/shared'
import {
  getGuestbookNotes,
  moderateGuestbookNote,
  deleteGuestbookNote,
  toggleGuestbookPin,
  toggleGuestbookVisibility,
  setGuestbookEvent,
  getGuestbookEvents,
  saveGuestbookEvent,
  deleteGuestbookEvent,
  bulkModerateGuestbookNotes,
  reorderGuestbookNotes,
  updateGuestbookNote,
} from '../api.js'

type FilterTab = 'all' | 'order' | 'pending' | 'approved' | 'rejected'
type OrderViewMode = 'list' | 'grid'

export function GuestbookManager() {
  const [notes, setNotes] = useState<GuestbookNote[]>([])
  const [events, setEvents] = useState<GuestbookEvent[]>([])
  const [loading, setLoading] = useState(true)

  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<FilterTab>('all')
  const [orderViewMode, setOrderViewMode] = useState<OrderViewMode>('list')
  const [selectedEventFilter, setSelectedEventFilter] = useState<string>('all')
  const [selectedPinFilter, setSelectedPinFilter] = useState<'all' | 'pinned' | 'unpinned'>('all')
  const [selectedVisibilityFilter, setSelectedVisibilityFilter] = useState<'all' | 'visible' | 'hidden'>('all')

  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // State to track inline edits: { [noteId]: { content: string; signature: string; isDirty: boolean } }
  const [edits, setEdits] = useState<Record<string, { content: string; signature: string; isDirty: boolean }>>({})

  // Drag & Drop tracking state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // Event Modal state
  const [showEventModal, setShowEventModal] = useState(false)
  const [newEventName, setNewEventName] = useState('')
  const [newEventColor, setNewEventColor] = useState('#c8a85a')
  const [newEventDesc, setNewEventDesc] = useState('')

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [notesData, eventsData] = await Promise.all([
        getGuestbookNotes(true).catch(() => []),
        getGuestbookEvents().catch(() => []),
      ])
      setNotes(notesData)
      if (eventsData && eventsData.length > 0) {
        setEvents(eventsData)
      }
      setSelectedIds(new Set())
      // Reset edit buffers
      const initialEdits: Record<string, { content: string; signature: string; isDirty: boolean }> = {}
      for (const n of notesData) {
        initialEdits[n.id] = {
          content: n.content,
          signature: n.signature || '',
          isDirty: false,
        }
      }
      setEdits(initialEdits)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const showToast = (msg: string) => {
    setSaveSuccessMsg(msg)
    setTimeout(() => setSaveSuccessMsg(null), 3000)
  }

  const handleContentChange = (id: string, newContent: string) => {
    setEdits((prev) => ({
      ...prev,
      [id]: {
        content: newContent,
        signature: prev[id]?.signature ?? '',
        isDirty: true,
      },
    }))
  }

  const handleSignatureChange = (id: string, newSignature: string) => {
    setEdits((prev) => ({
      ...prev,
      [id]: {
        content: prev[id]?.content ?? '',
        signature: newSignature,
        isDirty: true,
      },
    }))
  }

  const handleSaveNoteEdit = async (id: string) => {
    const editData = edits[id]
    if (!editData) return
    try {
      setActionLoading(id)
      await updateGuestbookNote(id, {
        content: editData.content,
        signature: editData.signature,
      })
      setNotes((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, content: editData.content, signature: editData.signature } : n
        )
      )
      setEdits((prev) => ({
        ...prev,
        [id]: { ...prev[id]!, isDirty: false },
      }))
      showToast('✓ Đã lưu thay đổi nội dung lời chúc!')
    } catch (err) {
      alert(`Lưu chỉnh sửa thất bại: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleModerate = async (id: string, status: GuestbookNoteStatus) => {
    try {
      setActionLoading(id)
      await moderateGuestbookNote(id, status)
      setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, status } : n)))
    } catch (err) {
      alert(`Thao tác thất bại: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleTogglePin = async (id: string, currentPin: boolean) => {
    try {
      setActionLoading(id)
      const nextPin = !currentPin
      await toggleGuestbookPin(id, nextPin)
      setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, isPinned: nextPin } : n)))
    } catch (err) {
      alert(`Ghim thất bại: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggleVisibility = async (id: string, currentVisible: boolean) => {
    try {
      setActionLoading(id)
      const nextVisible = !currentVisible
      await toggleGuestbookVisibility(id, nextVisible)
      setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, isVisible: nextVisible } : n)))
    } catch (err) {
      alert(`Đổi hiển thị thất bại: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleAssignEvent = async (id: string, eventTag: string | null) => {
    try {
      setActionLoading(id)
      await setGuestbookEvent(id, eventTag)
      setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, eventTag } : n)))
    } catch (err) {
      alert(`Gán sự kiện thất bại: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa vĩnh viễn lời nhắn này?')) return
    try {
      setActionLoading(id)
      await deleteGuestbookNote(id)
      setNotes((prev) => prev.filter((n) => n.id !== id))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    } catch (err) {
      alert(`Xóa thất bại: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleBulkAction = async (
    action: 'approve' | 'reject' | 'delete' | 'hide' | 'show' | 'pin' | 'unpin' | 'priority' | 'set_event',
    priorityVal?: number,
    eventTagVal?: string | null
  ) => {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)

    if (action === 'delete' && !confirm(`Bạn có chắc muốn xóa ${ids.length} lời nhắn đã chọn?`)) {
      return
    }

    try {
      setActionLoading('bulk')
      await bulkModerateGuestbookNotes(ids, action, priorityVal, eventTagVal)

      setNotes((prev) => {
        if (action === 'delete') {
          return prev.filter((n) => !selectedIds.has(n.id))
        }
        return prev.map((n) => {
          if (!selectedIds.has(n.id)) return n
          if (action === 'approve') return { ...n, status: 'approved' }
          if (action === 'reject') return { ...n, status: 'rejected' }
          if (action === 'hide') return { ...n, isVisible: false }
          if (action === 'show') return { ...n, isVisible: true }
          if (action === 'pin') return { ...n, isPinned: true }
          if (action === 'unpin') return { ...n, isPinned: false }
          if (action === 'priority' && typeof priorityVal === 'number') return { ...n, priority: priorityVal }
          if (action === 'set_event') return { ...n, eventTag: eventTagVal || null }
          return n
        })
      })
      setSelectedIds(new Set())
    } catch (err) {
      alert(`Thao tác hàng loạt thất bại: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setActionLoading(null)
    }
  }

  // Drag & Drop / Move Reordering Logic
  const handleReorderList = async (reorderedList: GuestbookNote[]) => {
    const total = reorderedList.length
    const updatePayload = reorderedList.map((item, index) => ({
      id: item.id,
      priority: (total - index) * 10,
    }))

    const priorityMap = new Map(updatePayload.map((p) => [p.id, p.priority]))
    setNotes((prev) =>
      prev.map((n) => (priorityMap.has(n.id) ? { ...n, priority: priorityMap.get(n.id)! } : n))
    )

    try {
      setActionLoading('reorder')
      await reorderGuestbookNotes(updatePayload)
      showToast('✓ Đã cập nhật & lưu thứ tự ưu tiên mới thành công!')
    } catch (err) {
      alert(`Lưu thứ tự thất bại: ${err instanceof Error ? err.message : String(err)}`)
      void loadData()
    } finally {
      setActionLoading(null)
    }
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (dragOverIndex !== index) {
      setDragOverIndex(index)
    }
  }

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      return
    }

    const currentList = [...orderDisplayNotes]
    const [movedItem] = currentList.splice(draggedIndex, 1)
    if (movedItem) {
      currentList.splice(targetIndex, 0, movedItem)
      void handleReorderList(currentList)
    }

    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleMoveStep = (fromIndex: number, toIndex: number) => {
    const currentList = [...orderDisplayNotes]
    if (toIndex < 0 || toIndex >= currentList.length) return
    const [movedItem] = currentList.splice(fromIndex, 1)
    if (movedItem) {
      currentList.splice(toIndex, 0, movedItem)
      void handleReorderList(currentList)
    }
  }

  // Toggle all notes belonging to an event
  const handleToggleEventVisibility = async (eventId: string, show: boolean) => {
    const targetNotes = notes.filter((n) => n.eventTag === eventId)
    if (targetNotes.length === 0) {
      alert('Không có lời nhắn nào được gán cho sự kiện này.')
      return
    }
    const ids = targetNotes.map((n) => n.id)
    try {
      setActionLoading('event_toggle')
      await bulkModerateGuestbookNotes(ids, show ? 'show' : 'hide')
      setNotes((prev) =>
        prev.map((n) => (n.eventTag === eventId ? { ...n, isVisible: show } : n))
      )
    } catch (err) {
      alert(`Đổi hiển thị theo sự kiện thất bại: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setActionLoading(null)
    }
  }

  // Event CRUD
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEventName.trim()) return
    try {
      const newEv = {
        name: newEventName.trim(),
        color: newEventColor,
        description: newEventDesc.trim(),
      }
      const res = await saveGuestbookEvent(newEv)
      setEvents((prev) => [...prev, { id: res.eventId, ...newEv }])
      setNewEventName('')
      setNewEventDesc('')
      setShowEventModal(false)
    } catch (err) {
      alert(`Tạo sự kiện thất bại: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa sự kiện này? Các lời nhắn đã gán sẽ trở về không thuộc sự kiện.')) return
    try {
      await deleteGuestbookEvent(id)
      setEvents((prev) => prev.filter((ev) => ev.id !== id))
      setNotes((prev) => prev.map((n) => (n.eventTag === id ? { ...n, eventTag: null } : n)))
    } catch (err) {
      alert(`Xóa sự kiện thất bại: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const toggleSelectNote = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const pendingCount = notes.filter((n) => n.status === 'pending').length
  const approvedCount = notes.filter((n) => n.status === 'approved').length
  const rejectedCount = notes.filter((n) => n.status === 'rejected').length
  const pinnedCount = notes.filter((n) => n.isPinned).length
  const hiddenCount = notes.filter((n) => n.status === 'approved' && n.isVisible === false).length
  const activeDisplayCount = notes.filter((n) => n.status === 'approved' && n.isVisible !== false).length

  // List of active notes for Order tab
  const orderDisplayNotes = useMemo(() => {
    let list = notes.filter((n) => n.status === 'approved' && n.isVisible !== false)
    if (selectedEventFilter !== 'all') {
      list = list.filter((n) => n.eventTag === selectedEventFilter)
    }
    if (selectedPinFilter === 'pinned') {
      list = list.filter((n) => Boolean(n.isPinned))
    } else if (selectedPinFilter === 'unpinned') {
      list = list.filter((n) => !n.isPinned)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((n) => (n.content.toLowerCase().includes(q) || (n.signature ?? '').toLowerCase().includes(q)))
    }
    return [...list].sort((a, b) => {
      const pinA = a.isPinned ? 1 : 0
      const pinB = b.isPinned ? 1 : 0
      if (pinB !== pinA) return pinB - pinA
      const prioA = a.priority || 0
      const prioB = b.priority || 0
      if (prioB !== prioA) return prioB - prioA
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [notes, selectedEventFilter, selectedPinFilter, searchQuery])

  // Filter notes according to current tab
  const filteredNotes = useMemo(() => {
    if (tab === 'order') return orderDisplayNotes

    let list = notes
    if (tab !== 'all') {
      list = list.filter((n) => n.status === tab)
    }
    if (selectedEventFilter !== 'all') {
      list = list.filter((n) => n.eventTag === selectedEventFilter)
    }
    if (selectedPinFilter === 'pinned') {
      list = list.filter((n) => Boolean(n.isPinned))
    } else if (selectedPinFilter === 'unpinned') {
      list = list.filter((n) => !n.isPinned)
    }
    if (selectedVisibilityFilter === 'visible') {
      list = list.filter((n) => n.isVisible !== false)
    } else if (selectedVisibilityFilter === 'hidden') {
      list = list.filter((n) => n.isVisible === false)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((n) => {
        const matchContent = n.content.toLowerCase().includes(q)
        const matchSig = (n.signature ?? '').toLowerCase().includes(q)
        return matchContent || matchSig
      })
    }
    return list
  }, [notes, tab, orderDisplayNotes, selectedEventFilter, selectedPinFilter, selectedVisibilityFilter, searchQuery])


  const isAllFilteredSelected = filteredNotes.length > 0 && filteredNotes.every((n) => selectedIds.has(n.id))

  const toggleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredNotes.map((n) => n.id)))
    }
  }

  const getEventName = (tag?: string | null) => {
    if (!tag) return null
    return events.find((e) => e.id === tag)
  }

  return (
    <div style={styles.root}>
      {/* Toast Notification */}
      {saveSuccessMsg && (
        <div style={styles.toast}>
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Quản Lý & Duyệt Lưu Bút 50 Năm</h1>
          <p style={styles.subtitle}>
            Xem toàn bộ nội dung, biên tập câu chữ, Kéo & Thả sắp xếp thứ tự (Drag & Drop), và điều phối theo Sự kiện
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button style={styles.eventManageBtn} onClick={() => setShowEventModal(true)}>
            🏷️ Quản lý Sự kiện ({events.length})
          </button>
          <button style={styles.reloadBtn} onClick={() => void loadData()} disabled={loading}>
            {loading ? 'Đang tải...' : '🔄 Làm mới'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={styles.statsRow}>
        <div
          style={{ ...styles.statCard, cursor: 'pointer', borderColor: tab === 'all' ? '#c8a85a' : '#2a1e10' }}
          onClick={() => setTab('all')}
        >
          <div style={styles.statIcon}>📝</div>
          <div style={styles.statValue}>{notes.length}</div>
          <div style={styles.statLabel}>Tổng số lời nhắn</div>
        </div>

        <div
          style={{
            ...styles.statCard,
            cursor: 'pointer',
            borderColor: tab === 'order' ? '#c8a85a' : '#2a1e10',
            background: tab === 'order' ? 'rgba(200, 168, 90, 0.12)' : 'rgba(255,255,255,0.03)',
          }}
          onClick={() => setTab('order')}
        >
          <div style={styles.statIcon}>🎯</div>
          <div style={{ ...styles.statValue, color: '#fde047' }}>{activeDisplayCount}</div>
          <div style={styles.statLabel}>Đang phát ngoài Web (Kéo & Thả thứ tự)</div>
        </div>

        <div
          style={{ ...styles.statCard, cursor: 'pointer', borderColor: tab === 'pending' ? '#c8a85a' : '#2a1e10' }}
          onClick={() => setTab('pending')}
        >
          <div style={styles.statIcon}>⏳</div>
          <div style={{ ...styles.statValue, color: '#f59e0b' }}>{pendingCount}</div>
          <div style={styles.statLabel}>Chờ duyệt</div>
        </div>

        <div
          style={{ ...styles.statCard, cursor: 'pointer', borderColor: tab === 'approved' ? '#c8a85a' : '#2a1e10' }}
          onClick={() => setTab('approved')}
        >
          <div style={styles.statIcon}>✅</div>
          <div style={{ ...styles.statValue, color: '#10b981' }}>{approvedCount}</div>
          <div style={styles.statLabel}>Đã duyệt ({pinnedCount} ghim · {hiddenCount} ẩn)</div>
        </div>

        <div
          style={{ ...styles.statCard, cursor: 'pointer', borderColor: tab === 'rejected' ? '#c8a85a' : '#2a1e10' }}
          onClick={() => setTab('rejected')}
        >
          <div style={styles.statIcon}>❌</div>
          <div style={{ ...styles.statValue, color: '#ef4444' }}>{rejectedCount}</div>
          <div style={styles.statLabel}>Từ chối</div>
        </div>
      </div>

      {/* Main Tabs & Filters Row */}
      <div style={styles.controlsRow}>
        <div style={styles.tabGroup}>
          <button style={{ ...styles.tabBtn, ...(tab === 'all' ? styles.tabBtnActive : {}) }} onClick={() => setTab('all')}>
            Tất cả ({notes.length})
          </button>
          <button
            style={{
              ...styles.tabBtn,
              ...(tab === 'order' ? styles.tabBtnOrderActive : styles.tabBtnOrder),
            }}
            onClick={() => setTab('order')}
            title="Kéo thả điều chỉnh thứ tự ưu tiên của các lời chúc đang phát ngoài Web"
          >
            🎯 Kéo & Thả Thứ Tự Ưu Tiên ({activeDisplayCount})
          </button>
          <button style={{ ...styles.tabBtn, ...(tab === 'pending' ? styles.tabBtnActive : {}) }} onClick={() => setTab('pending')}>
            Chờ duyệt ({pendingCount})
          </button>
          <button style={{ ...styles.tabBtn, ...(tab === 'approved' ? styles.tabBtnActive : {}) }} onClick={() => setTab('approved')}>
            Đã duyệt ({approvedCount})
          </button>
          <button style={{ ...styles.tabBtn, ...(tab === 'rejected' ? styles.tabBtnActive : {}) }} onClick={() => setTab('rejected')}>
            Từ chối ({rejectedCount})
          </button>
        </div>

        {/* Search & Event filter & View mode switch */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {tab === 'order' && (
            <div style={styles.viewModeToggle}>
              <button
                style={{ ...styles.viewModeBtn, ...(orderViewMode === 'list' ? styles.viewModeBtnActive : {}) }}
                onClick={() => setOrderViewMode('list')}
                title="Xem dạng danh sách kéo thả"
              >
                📋 Danh sách
              </button>
              <button
                style={{ ...styles.viewModeBtn, ...(orderViewMode === 'grid' ? styles.viewModeBtnActive : {}) }}
                onClick={() => setOrderViewMode('grid')}
                title="Xem dạng thẻ chi tiết"
              >
                🗂️ Dạng thẻ
              </button>
            </div>
          )}

          {/* Event Filter Dropdown */}
          <div style={styles.eventFilterWrap}>
            <span style={{ fontSize: '12px', color: '#9a9080' }}>Sự kiện:</span>
            <select
              value={selectedEventFilter}
              onChange={(e) => setSelectedEventFilter(e.target.value)}
              style={styles.eventSelect}
            >
              <option value="all">Tất cả sự kiện</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  🏷️ {ev.name} ({notes.filter((n) => n.eventTag === ev.id).length})
                </option>
              ))}
            </select>
          </div>

          {/* Pin Filter Dropdown */}
          <div style={styles.eventFilterWrap}>
            <span style={{ fontSize: '12px', color: '#9a9080' }}>Ghim:</span>
            <select
              value={selectedPinFilter}
              onChange={(e) => setSelectedPinFilter(e.target.value as 'all' | 'pinned' | 'unpinned')}
              style={styles.eventSelect}
            >
              <option value="all">Tất cả ghim</option>
              <option value="pinned">📌 Đã ghim ({notes.filter((n) => n.isPinned).length})</option>
              <option value="unpinned">Chưa ghim ({notes.filter((n) => !n.isPinned).length})</option>
            </select>
          </div>

          {/* Visibility Filter Dropdown (cho các tab ngoài tab 'order') */}
          {tab !== 'order' && (
            <div style={styles.eventFilterWrap}>
              <span style={{ fontSize: '12px', color: '#9a9080' }}>Hiển thị:</span>
              <select
                value={selectedVisibilityFilter}
                onChange={(e) => setSelectedVisibilityFilter(e.target.value as 'all' | 'visible' | 'hidden')}
                style={styles.eventSelect}
              >
                <option value="all">Tất cả hiển thị</option>
                <option value="visible">👁️ Đang hiện ({notes.filter((n) => n.isVisible !== false).length})</option>
                <option value="hidden">🙈 Đang ẩn ({notes.filter((n) => n.isVisible === false).length})</option>
              </select>
            </div>
          )}

          <input
            type="text"
            placeholder="🔍 Tìm nội dung, người ký..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
        </div>
      </div>


      {/* Guide Banner for Drag & Drop Order Tab */}
      {tab === 'order' && (
        <div style={styles.orderBanner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>💡</span>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#fde047' }}>
                Chế độ Kéo & Thả Điều Phối Thứ Tự (Drag & Drop Reordering)
              </div>
              <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                Giữ chuột vào biểu tượng <strong style={{ color: '#fde047' }}>⠿</strong> rồi kéo lên/xuống để đổi thứ tự. Thiệp ở trên cùng <strong>(#1)</strong> sẽ luôn xuất hiện đầu tiên trên bảo tàng số.
              </div>
            </div>
          </div>
          {actionLoading === 'reorder' && (
            <div style={{ fontSize: '12px', color: '#fde047', fontWeight: 600 }}>
              Đang lưu thứ tự mới vào D1 database...
            </div>
          )}
        </div>
      )}

      {/* Event Fast-Action Bar (when filtered by a specific event) */}
      {selectedEventFilter !== 'all' && (
        <div style={styles.eventActionBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: '#fde047', fontWeight: 600 }}>
              Sự kiện đang chọn: {getEventName(selectedEventFilter)?.name}
            </span>
            <span style={{ fontSize: '12px', color: '#9a9080' }}>
              ({notes.filter((n) => n.eventTag === selectedEventFilter).length} lời chúc)
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              style={styles.eventActionBtnShow}
              onClick={() => handleToggleEventVisibility(selectedEventFilter, true)}
              title="Bật hiển thị tất cả lời chúc thuộc sự kiện này ngoài web"
            >
              ⚡ Bật hiển thị sự kiện này
            </button>
            <button
              style={styles.eventActionBtnHide}
              onClick={() => handleToggleEventVisibility(selectedEventFilter, false)}
              title="Ẩn tất cả lời chúc thuộc sự kiện này"
            >
              ⚡ Ẩn tất cả lời chúc sự kiện này
            </button>
          </div>
        </div>
      )}

      {/* Select All Checkbox */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 14px' }}>
        {filteredNotes.length > 0 && (
          <label style={styles.selectAllLabel}>
            <input
              type="checkbox"
              checked={isAllFilteredSelected}
              onChange={toggleSelectAllFiltered}
              style={{ cursor: 'pointer' }}
            />
            <span>Chọn tất cả ({filteredNotes.length})</span>
          </label>
        )}
      </div>

      {/* Bulk Action Toolbar */}
      {selectedIds.size > 0 && (
        <div style={styles.bulkToolbar}>
          <div style={styles.bulkCount}>
            Đã chọn <strong style={{ color: '#c8a85a' }}>{selectedIds.size}</strong> lời nhắn:
          </div>
          <div style={styles.bulkBtns}>
            <button
              style={styles.bulkBtnApprove}
              disabled={Boolean(actionLoading)}
              onClick={() => handleBulkAction('approve')}
            >
              ✓ Duyệt
            </button>
            <button
              style={styles.bulkBtnReject}
              disabled={Boolean(actionLoading)}
              onClick={() => handleBulkAction('reject')}
            >
              ✕ Từ chối
            </button>
            <button
              style={styles.bulkBtnToggle}
              disabled={Boolean(actionLoading)}
              onClick={() => handleBulkAction('show')}
              title="Cho phép hiển thị ra web"
            >
              👁️ Hiện
            </button>
            <button
              style={styles.bulkBtnToggle}
              disabled={Boolean(actionLoading)}
              onClick={() => handleBulkAction('hide')}
              title="Ẩn khỏi web (không xóa)"
            >
              🙈 Ẩn
            </button>

            {/* Bulk Assign Event Dropdown */}
            <select
              style={styles.bulkEventSelect}
              onChange={(e) => {
                const val = e.target.value
                if (val) {
                  void handleBulkAction('set_event', undefined, val === 'none' ? null : val)
                  e.target.value = ''
                }
              }}
              defaultValue=""
            >
              <option value="" disabled>🏷️ Gán sự kiện...</option>
              <option value="none">❌ Xóa khỏi sự kiện</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </select>

            <button
              style={styles.bulkBtnDelete}
              disabled={Boolean(actionLoading)}
              onClick={() => handleBulkAction('delete')}
            >
              🗑 Xóa
            </button>
            <button style={styles.bulkBtnClear} onClick={() => setSelectedIds(new Set())}>
              Bỏ chọn
            </button>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div style={styles.errorBox}>
          <span>⚠️ {error}</span>
          <button style={styles.actionBtn} onClick={() => void loadData()}>Thử lại</button>
        </div>
      )}

      {/* Main Content Area */}
      {loading && notes.length === 0 ? (
        <div style={styles.emptyState}>Đang tải danh sách lưu bút...</div>
      ) : filteredNotes.length === 0 ? (
        <div style={styles.emptyState}>
          {searchQuery ? 'Không tìm thấy lời nhắn phù hợp' : 'Không có lời nhắn nào trong mục này'}
        </div>
      ) : tab === 'order' && orderViewMode === 'list' ? (
        /* DRAG & DROP LIST VIEW */
        <div style={styles.dragListContainer}>
          {filteredNotes.map((note, index) => {
            const isDragging = draggedIndex === index
            const isOver = dragOverIndex === index
            const assignedEvent = getEventName(note.eventTag)
            const isPinned = Boolean(note.isPinned)

            return (
              <div
                key={note.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={() => {
                  setDraggedIndex(null)
                  setDragOverIndex(null)
                }}
                style={{
                  ...styles.dragRow,
                  opacity: isDragging ? 0.35 : 1,
                  borderColor: isOver ? '#fde047' : isPinned ? 'rgba(234, 179, 8, 0.4)' : '#2a1e10',
                  boxShadow: isOver ? '0 0 12px rgba(253, 224, 71, 0.3)' : 'none',
                  background: isOver ? 'rgba(200, 168, 90, 0.12)' : 'rgba(255,255,255,0.03)',
                }}
              >
                {/* Drag Handle */}
                <div style={styles.dragHandle} title="Kéo để di chuyển vị trí">
                  ⠿
                </div>

                {/* Rank Number */}
                <div style={styles.dragRank}>
                  #{index + 1}
                </div>

                {/* Main Content Snippet */}
                <div style={styles.dragContent}>
                  <div style={styles.dragText}>"{note.content}"</div>
                  <div style={styles.dragMeta}>
                    <span style={styles.dragSig}>— {note.signature || 'Ẩn danh'}</span>
                    <span style={styles.dragDate}>{new Date(note.createdAt).toLocaleDateString('vi-VN')}</span>
                  </div>
                </div>

                {/* Event & Pin Badges */}
                <div style={styles.dragBadges}>
                  {isPinned && <span style={styles.pinnedBadge}>📌 Ghim</span>}
                  {assignedEvent && (
                    <span style={{ ...styles.eventBadge, borderColor: assignedEvent.color || '#c8a85a', color: assignedEvent.color || '#fde047' }}>
                      🏷️ {assignedEvent.name}
                    </span>
                  )}
                </div>


                {/* Step Move Buttons */}
                <div style={styles.dragActions}>
                  <button
                    style={styles.stepBtn}
                    disabled={index === 0}
                    onClick={() => handleMoveStep(index, index - 1)}
                    title="Di chuyển lên 1 bậc"
                  >
                    ▲
                  </button>
                  <button
                    style={styles.stepBtn}
                    disabled={index === filteredNotes.length - 1}
                    onClick={() => handleMoveStep(index, index + 1)}
                    title="Di chuyển xuống 1 bậc"
                  >
                    ▼
                  </button>
                  <button
                    style={{
                      ...styles.btnIcon,
                      background: isPinned ? 'rgba(234, 179, 8, 0.2)' : 'rgba(255,255,255,0.05)',
                      borderColor: isPinned ? '#eab308' : '#3a2e1e',
                      color: isPinned ? '#fde047' : '#9a9080',
                    }}
                    onClick={() => handleTogglePin(note.id, isPinned)}
                    title={isPinned ? 'Bỏ ghim' : 'Ghim lên vị trí nổi bật'}
                  >
                    📌
                  </button>
                  <button
                    style={{ ...styles.btnIcon, background: 'rgba(239,68,68,0.1)', borderColor: '#ef4444', color: '#fca5a5' }}
                    onClick={() => handleToggleVisibility(note.id, true)}
                    title="Ẩn thiệp này khỏi Web"
                  >
                    🙈
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* STANDARD ADMIN EDITABLE FORM CARDS */
        <div style={styles.grid}>
          {filteredNotes.map((note, index) => {
            const isActing = actionLoading === note.id || actionLoading === 'bulk'
            const isSelected = selectedIds.has(note.id)
            const isPinned = Boolean(note.isPinned)
            const isVisible = note.isVisible !== false
            const priorityVal = note.priority || 0
            const assignedEvent = getEventName(note.eventTag)
            const editState = edits[note.id] || { content: note.content, signature: note.signature || '', isDirty: false }

            return (
              <div
                key={note.id}
                draggable={tab === 'order'}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                style={{
                  ...styles.noteCard,
                  borderColor: isSelected ? '#c8a85a' : isPinned ? 'rgba(234, 179, 8, 0.35)' : 'rgba(255, 255, 255, 0.07)',
                  background: isSelected ? 'rgba(200, 168, 90, 0.05)' : '#130f0a',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
                }}
              >

                {/* Top card bar with rank, checkbox & quick badges */}
                <div style={styles.cardTopRow}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {tab === 'order' && (
                      <span style={styles.rankBadge}>#{index + 1}</span>
                    )}
                    <label style={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectNote(note.id)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '11.5px', color: '#9a9080' }}>Chọn</span>
                    </label>
                  </div>

                  <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {isPinned && <span style={styles.pinnedBadge}>📌 Ghim</span>}
                    {!isVisible && <span style={styles.hiddenBadge}>🙈 Đang ẩn</span>}
                    {assignedEvent && (
                      <span style={{ ...styles.eventBadge, borderColor: assignedEvent.color || '#c8a85a', color: assignedEvent.color || '#fde047' }}>
                        🏷️ {assignedEvent.name}
                      </span>
                    )}
                  </div>
                </div>


                {/* NORMAL ADMIN EDITABLE FORM FIELDS (Thay thế hoàn toàn thẻ mô phỏng UI) */}
                <div style={styles.formFieldsBox}>
                  {/* Content Textarea */}
                  <div style={styles.fieldGroup}>
                    <label style={styles.fieldLabel}>Lời chúc / Nội dung:</label>
                    <textarea
                      value={editState.content}
                      onChange={(e) => handleContentChange(note.id, e.target.value)}
                      placeholder="Nhập nội dung lời chúc..."
                      rows={4}
                      style={styles.contentTextarea}
                    />
                  </div>

                  {/* Signature Input & Save button */}
                  <div style={styles.fieldGroup}>
                    <label style={styles.fieldLabel}>Người ký / Đơn vị:</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={editState.signature}
                        onChange={(e) => handleSignatureChange(note.id, e.target.value)}
                        placeholder="Chưa có tên người ký..."
                        style={styles.signatureInput}
                      />
                      {editState.isDirty && (
                        <button
                          style={styles.saveEditBtn}
                          disabled={isActing}
                          onClick={() => handleSaveNoteEdit(note.id)}
                          title="Lưu thay đổi nội dung và người ký"
                        >
                          💾 Lưu
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Note Metadata & Actions */}
                <div style={styles.noteMeta}>
                  <div style={styles.metaRow}>
                    <span style={styles.dateLabel}>
                      🕒 {new Date(note.createdAt).toLocaleString('vi-VN')}
                    </span>
                    <span style={{ ...styles.statusBadge, ...getStatusStyle(note.status) }}>
                      {note.status === 'approved' ? 'Đã duyệt' : note.status === 'pending' ? 'Chờ duyệt' : 'Từ chối'}
                    </span>
                  </div>

                  {/* Step Move Buttons in Grid mode */}
                  {tab === 'order' && (
                    <div style={styles.gridMoveRow}>
                      <span style={{ fontSize: '11.5px', color: '#fde047', fontWeight: 600 }}>Thứ hạng #{index + 1}</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          style={styles.stepBtn}
                          disabled={index === 0}
                          onClick={() => handleMoveStep(index, index - 1)}
                          title="Lên 1 bậc"
                        >
                          ▲ Lên
                        </button>
                        <button
                          style={styles.stepBtn}
                          disabled={index === filteredNotes.length - 1}
                          onClick={() => handleMoveStep(index, index + 1)}
                          title="Xuống 1 bậc"
                        >
                          ▼ Xuống
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Event tag selector */}
                  <div style={styles.eventRow}>
                    <span style={{ fontSize: '11px', color: '#9a9080' }}>Sự kiện:</span>
                    <select
                      value={note.eventTag ?? ''}
                      onChange={(e) => handleAssignEvent(note.id, e.target.value || null)}
                      style={styles.cardEventSelect}
                    >
                      <option value="">(Không gán)</option>
                      {events.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          🏷️ {ev.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Action buttons */}
                  <div style={styles.actionGroup}>
                    {note.status === 'pending' && (
                      <>
                        <button
                          style={{ ...styles.btnApprove, opacity: isActing ? 0.5 : 1 }}
                          disabled={isActing}
                          onClick={() => handleModerate(note.id, 'approved')}
                          title="Duyệt để hiển thị trên web"
                        >
                          ✓ Duyệt
                        </button>
                        <button
                          style={{ ...styles.btnReject, opacity: isActing ? 0.5 : 1 }}
                          disabled={isActing}
                          onClick={() => handleModerate(note.id, 'rejected')}
                          title="Từ chối lời nhắn"
                        >
                          ✕ Từ chối
                        </button>
                      </>
                    )}

                    {note.status === 'rejected' && (
                      <button
                        style={{ ...styles.btnApprove, opacity: isActing ? 0.5 : 1 }}
                        disabled={isActing}
                        onClick={() => handleModerate(note.id, 'approved')}
                        title="Duyệt lại lời nhắn này"
                      >
                        ✓ Duyệt lại
                      </button>
                    )}

                    {note.status === 'approved' && (
                      <>
                        {/* Quick Pin Toggle */}
                        <button
                          style={{
                            ...styles.btnIcon,
                            background: isPinned ? 'rgba(234, 179, 8, 0.15)' : 'rgba(255,255,255,0.03)',
                            borderColor: isPinned ? 'rgba(234, 179, 8, 0.4)' : 'rgba(255,255,255,0.08)',
                            color: isPinned ? '#fde047' : '#9a9080',
                          }}
                          disabled={isActing}
                          onClick={() => handleTogglePin(note.id, isPinned)}
                          title={isPinned ? 'Bỏ ghim khỏi trung tâm' : 'Ghim vào vị trí trung tâm nổi bật'}
                        >
                          📌 {isPinned ? 'Đã ghim' : 'Ghim'}
                        </button>

                        {/* Quick Visibility Toggle */}
                        <button
                          style={{
                            ...styles.btnIcon,
                            background: !isVisible ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.03)',
                            borderColor: !isVisible ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255,255,255,0.08)',
                            color: !isVisible ? '#fca5a5' : '#9a9080',
                          }}
                          disabled={isActing}
                          onClick={() => handleToggleVisibility(note.id, isVisible)}
                          title={isVisible ? 'Ẩn khỏi web (không xóa)' : 'Hiện lại trên web'}
                        >
                          {isVisible ? '👁️ Đang hiện' : '🙈 Đang ẩn'}
                        </button>
                      </>
                    )}

                    {/* Delete button */}
                    <button
                      style={{ ...styles.btnDelete, opacity: isActing ? 0.5 : 1 }}
                      disabled={isActing}
                      onClick={() => handleDelete(note.id)}
                      title="Xóa vĩnh viễn"
                    >
                      🗑
                    </button>

                  </div>

                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Event Management Modal */}
      {showEventModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>🏷️ Quản Lý Sự Kiện & Enum Lời Chúc</h2>
              <button style={styles.modalCloseBtn} onClick={() => setShowEventModal(false)}>✕</button>
            </div>

            <p style={{ fontSize: '13px', color: '#9a9080', margin: '0 0 16px' }}>
              Tạo các sự kiện để phân loại lời chúc. Bạn có thể bật/tắt toàn bộ lời chúc của 1 sự kiện khi sự kiện đó diễn ra để tránh làm loãng nội dung.
            </p>

            {/* Form Add New Event */}
            <form onSubmit={handleCreateEvent} style={styles.eventForm}>
              <h3 style={{ fontSize: '14px', color: '#fde047', margin: '0 0 10px' }}>➕ Thêm sự kiện mới</h3>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <input
                  type="text"
                  placeholder="Tên sự kiện (VD: Lễ Khai Mạc, Hội Nghị Tri Ân...)"
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  style={{ ...styles.searchInput, flex: 2 }}
                  required
                />
                <input
                  type="color"
                  value={newEventColor}
                  onChange={(e) => setNewEventColor(e.target.value)}
                  style={styles.colorInput}
                  title="Chọn màu sắc cho nhãn sự kiện"
                />
              </div>
              <input
                type="text"
                placeholder="Mô tả sự kiện (tùy chọn)..."
                value={newEventDesc}
                onChange={(e) => setNewEventDesc(e.target.value)}
                style={{ ...styles.searchInput, width: '100%', marginBottom: '10px' }}
              />
              <button type="submit" style={styles.createEventBtn}>
                ✓ Thêm sự kiện
              </button>
            </form>

            {/* List Existing Events */}
            <div style={{ marginTop: '20px' }}>
              <h3 style={{ fontSize: '14px', color: '#e5e7eb', margin: '0 0 10px' }}>
                Danh sách sự kiện hiện có ({events.length}):
              </h3>
              <div style={styles.eventList}>
                {events.map((ev) => {
                  const count = notes.filter((n) => n.eventTag === ev.id).length
                  return (
                    <div key={ev.id} style={styles.eventItem}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ ...styles.eventColorDot, backgroundColor: ev.color || '#c8a85a' }} />
                        <div>
                          <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#f3f4f6' }}>
                            {ev.name}
                          </div>
                          {ev.description && (
                            <div style={{ fontSize: '11.5px', color: '#9a9080' }}>{ev.description}</div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={styles.eventCountBadge}>{count} lời chúc</span>
                        <button
                          style={styles.deleteEventBtn}
                          onClick={() => handleDeleteEvent(ev.id)}
                          title="Xóa sự kiện này"
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function getStatusStyle(status: GuestbookNoteStatus): React.CSSProperties {
  if (status === 'approved') return { borderColor: 'rgba(52, 211, 153, 0.3)', color: '#34d399', background: 'rgba(52, 211, 153, 0.08)' }
  if (status === 'rejected') return { borderColor: 'rgba(248, 113, 113, 0.3)', color: '#f87171', background: 'rgba(248, 113, 113, 0.08)' }
  return { borderColor: 'rgba(251, 191, 36, 0.3)', color: '#fbbf24', background: 'rgba(251, 191, 36, 0.08)' }
}


const styles: Record<string, React.CSSProperties> = {
  root: {
    padding: '32px',
    maxWidth: '1400px',
    width: '100%',
    margin: '0 auto',
    color: '#e5e7eb',
    fontFamily: '"Be Vietnam Pro", system-ui, sans-serif',
    overflowY: 'auto',
    height: '100%',
    boxSizing: 'border-box',
    paddingBottom: '120px',
  },
  toast: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    background: '#10b981',
    color: '#ffffff',
    padding: '12px 20px',
    borderRadius: '8px',
    fontWeight: 700,
    fontSize: '13.5px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    zIndex: 9999,
    animation: 'fadein 0.3s ease',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 800,
    color: '#f3f4f6',
    margin: '0 0 6px',
    letterSpacing: '-0.3px',
  },
  subtitle: {
    fontSize: '13px',
    color: '#9a9080',
    margin: 0,
  },
  eventManageBtn: {
    padding: '8px 16px',
    background: 'rgba(200, 168, 90, 0.15)',
    border: '1px solid #c8a85a',
    borderRadius: '8px',
    color: '#fde047',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  reloadBtn: {
    padding: '8px 16px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid #3a2e1e',
    borderRadius: '8px',
    color: '#e5e7eb',
    fontSize: '13px',
    cursor: 'pointer',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
    gap: '14px',
    marginBottom: '24px',
  },
  statCard: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid #2a1e10',
    borderRadius: '12px',
    padding: '16px',
    transition: 'all 0.2s ease',
  },
  statIcon: { fontSize: '20px', marginBottom: '6px' },
  statValue: { fontSize: '22px', fontWeight: 800, color: '#f3f4f6', marginBottom: '4px' },
  statLabel: { fontSize: '11.5px', color: '#9a9080' },

  controlsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    gap: '16px',
    flexWrap: 'wrap',
  },
  tabGroup: {
    display: 'flex',
    gap: '6px',
    background: 'rgba(0,0,0,0.3)',
    padding: '4px',
    borderRadius: '8px',
    border: '1px solid #2a1e10',
    flexWrap: 'wrap',
  },
  tabBtn: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: 'none',
    background: 'transparent',
    color: '#9a9080',
    fontSize: '12.5px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  tabBtnActive: {
    background: 'rgba(200, 168, 90, 0.25)',
    color: '#fde047',
    border: '1px solid #c8a85a',
  },
  tabBtnOrder: {
    color: '#fde047',
    background: 'rgba(234, 179, 8, 0.1)',
  },
  tabBtnOrderActive: {
    background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.35), rgba(200, 168, 90, 0.45))',
    color: '#ffffff',
    border: '1px solid #eab308',
    fontWeight: 700,
    boxShadow: '0 2px 10px rgba(234, 179, 8, 0.2)',
  },
  viewModeToggle: {
    display: 'flex',
    background: 'rgba(0,0,0,0.3)',
    padding: '2px',
    borderRadius: '6px',
    border: '1px solid #3a2e1e',
  },
  viewModeBtn: {
    padding: '4px 10px',
    border: 'none',
    background: 'transparent',
    color: '#9a9080',
    fontSize: '11.5px',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  viewModeBtnActive: {
    background: 'rgba(200, 168, 90, 0.3)',
    color: '#fde047',
    fontWeight: 700,
  },
  eventFilterWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  eventSelect: {
    padding: '7px 10px',
    borderRadius: '6px',
    border: '1px solid #3a2e1e',
    background: '#1a140d',
    color: '#f3f4f6',
    fontSize: '12px',
    outline: 'none',
    cursor: 'pointer',
  },
  searchInput: {
    padding: '7px 12px',
    borderRadius: '6px',
    border: '1px solid #3a2e1e',
    background: 'rgba(255,255,255,0.05)',
    color: '#f3f4f6',
    fontSize: '12.5px',
    outline: 'none',
    width: '210px',
  },
  selectAllLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12.5px',
    color: '#9a9080',
    cursor: 'pointer',
  },

  orderBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 18px',
    background: 'rgba(234, 179, 8, 0.1)',
    border: '1px solid rgba(234, 179, 8, 0.3)',
    borderRadius: '10px',
    marginBottom: '14px',
    flexWrap: 'wrap',
    gap: '10px',
  },
  eventActionBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 16px',
    background: 'rgba(200, 168, 90, 0.08)',
    border: '1px solid rgba(200, 168, 90, 0.3)',
    borderRadius: '8px',
    marginBottom: '14px',
    flexWrap: 'wrap',
    gap: '10px',
  },
  eventActionBtnShow: {
    padding: '6px 12px',
    background: 'rgba(16, 185, 129, 0.2)',
    border: '1px solid #10b981',
    color: '#10b981',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  eventActionBtnHide: {
    padding: '6px 12px',
    background: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid #ef4444',
    color: '#fca5a5',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  bulkToolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 16px',
    background: 'rgba(200, 168, 90, 0.12)',
    border: '1px solid #c8a85a',
    borderRadius: '8px',
    marginBottom: '16px',
    flexWrap: 'wrap',
    gap: '10px',
  },
  bulkCount: { fontSize: '13px', color: '#f3f4f6' },
  bulkBtns: { display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' },
  bulkBtnApprove: {
    padding: '5px 10px',
    background: '#10b981',
    border: 'none',
    color: '#ffffff',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  bulkBtnReject: {
    padding: '5px 10px',
    background: '#ef4444',
    border: 'none',
    color: '#ffffff',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  bulkBtnToggle: {
    padding: '5px 10px',
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid #4a3e2e',
    color: '#f3f4f6',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  bulkEventSelect: {
    padding: '5px 8px',
    background: '#1a140d',
    border: '1px solid #c8a85a',
    color: '#fde047',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    outline: 'none',
  },
  bulkBtnDelete: {
    padding: '5px 10px',
    background: 'rgba(239,68,68,0.2)',
    border: '1px solid #ef4444',
    color: '#ef4444',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  bulkBtnClear: {
    padding: '5px 10px',
    background: 'transparent',
    border: '1px solid #6a5a40',
    color: '#9a9080',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
  },

  // Drag & Drop List styles
  dragListContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  dragRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '12px 16px',
    border: '1px solid #2a1e10',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.03)',
    transition: 'all 0.15s ease',
    cursor: 'grab',
  },
  dragHandle: {
    fontSize: '20px',
    color: '#c8a85a',
    cursor: 'grab',
    userSelect: 'none',
    lineHeight: 1,
    padding: '0 4px',
  },
  dragRank: {
    background: 'linear-gradient(135deg, #f59e0b, #c8a85a)',
    color: '#1a1208',
    fontWeight: 800,
    fontSize: '12px',
    padding: '3px 8px',
    borderRadius: '8px',
    minWidth: '32px',
    textAlign: 'center',
  },
  dragContent: {
    flex: 1,
    minWidth: 0,
  },
  dragText: {
    fontSize: '13.5px',
    color: '#f3f4f6',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginBottom: '4px',
  },
  dragMeta: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
  },
  dragSig: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#fde047',
  },
  dragDate: {
    fontSize: '11px',
    color: '#6a5a40',
  },
  dragBadges: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
  priorityScoreBadge: {
    fontSize: '11px',
    color: '#9a9080',
    background: 'rgba(0,0,0,0.2)',
    padding: '2px 8px',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.05)',
  },
  dragActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexShrink: 0,
  },
  stepBtn: {
    padding: '4px 8px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid #3a2e1e',
    color: '#e5e7eb',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },

  // Card Grid styles
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
    gap: '18px',
  },
  noteCard: {
    border: '1px solid',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    transition: 'all 0.2s ease',
  },
  cardTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rankBadge: {
    background: 'linear-gradient(135deg, #f59e0b, #c8a85a)',
    color: '#1a1208',
    fontWeight: 800,
    fontSize: '11px',
    padding: '2px 7px',
    borderRadius: '10px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
  },
  pinnedBadge: {
    background: 'rgba(234, 179, 8, 0.2)',
    color: '#fde047',
    border: '1px solid #eab308',
    borderRadius: '10px',
    fontSize: '10px',
    fontWeight: 700,
    padding: '2px 6px',
  },
  hiddenBadge: {
    background: 'rgba(239, 68, 68, 0.2)',
    color: '#fca5a5',
    border: '1px solid #ef4444',
    borderRadius: '10px',
    fontSize: '10px',
    fontWeight: 700,
    padding: '2px 6px',
  },
  priorityBadge: {
    background: 'rgba(200, 168, 90, 0.2)',
    color: '#fde047',
    border: '1px solid #c8a85a',
    borderRadius: '10px',
    fontSize: '10px',
    fontWeight: 700,
    padding: '2px 6px',
  },
  eventBadge: {
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid',
    borderRadius: '10px',
    fontSize: '10px',
    fontWeight: 600,
    padding: '2px 6px',
  },

  // Editable Form fields box
  formFieldsBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    background: 'rgba(0, 0, 0, 0.25)',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  fieldLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#8e8271',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  contentTextarea: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '6px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    background: '#0c0906',
    color: '#e2e8f0',
    fontSize: '13px',
    lineHeight: '1.5',
    outline: 'none',
    boxSizing: 'border-box',
    resize: 'vertical',
    fontFamily: '"Be Vietnam Pro", system-ui, sans-serif',
  },
  signatureInput: {
    flex: 1,
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    background: '#0c0906',
    color: '#d4c5a9',
    fontSize: '12.5px',
    fontWeight: 600,
    outline: 'none',
    boxSizing: 'border-box',
  },

  saveEditBtn: {
    padding: '6px 12px',
    background: '#10b981',
    border: 'none',
    borderRadius: '6px',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    flexShrink: 0,
  },

  noteMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    paddingTop: '10px',
  },
  metaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateLabel: { fontSize: '11px', color: '#7a6e5d' },
  statusBadge: {
    fontSize: '11px',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '12px',
    border: '1px solid',
  },

  gridMoveRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'rgba(200, 168, 90, 0.08)',
    padding: '4px 8px',
    borderRadius: '6px',
    border: '1px solid rgba(200, 168, 90, 0.2)',
  },

  eventRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(0,0,0,0.15)',
    padding: '4px 8px',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.04)',
  },
  cardEventSelect: {
    flex: 1,
    padding: '4px 6px',
    background: '#1a140d',
    border: '1px solid #3a2e1e',
    borderRadius: '4px',
    color: '#e5e7eb',
    fontSize: '11.5px',
    outline: 'none',
    cursor: 'pointer',
  },

  actionGroup: {
    display: 'flex',
    gap: '5px',
    alignItems: 'center',
    marginTop: '2px',
  },
  btnApprove: {
    flex: 1,
    padding: '6px 8px',
    background: 'rgba(16, 185, 129, 0.15)',
    border: '1px solid #10b981',
    color: '#10b981',
    borderRadius: '6px',
    fontSize: '11.5px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnReject: {
    flex: 1,
    padding: '6px 8px',
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid #ef4444',
    color: '#ef4444',
    borderRadius: '6px',
    fontSize: '11.5px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnIcon: {
    padding: '5px 7px',
    borderRadius: '6px',
    border: '1px solid',
    fontSize: '11.5px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDelete: {
    padding: '6px 8px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid #3a2e1e',
    color: '#9a9080',
    borderRadius: '6px',
    fontSize: '11.5px',
    cursor: 'pointer',
  },

  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#9a9080',
    fontSize: '14px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '12px',
    border: '1px dashed #3a2e1e',
  },
  errorBox: {
    padding: '12px 16px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid #ef4444',
    borderRadius: '8px',
    color: '#fca5a5',
    marginBottom: '16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionBtn: {
    padding: '4px 10px',
    background: 'transparent',
    border: '1px solid #ef4444',
    borderRadius: '4px',
    color: '#ef4444',
    fontSize: '12px',
    cursor: 'pointer',
  },

  // Modal styles
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px',
  },
  modalContent: {
    background: '#16110a',
    border: '1px solid #4a3e2e',
    borderRadius: '14px',
    padding: '24px',
    maxWidth: '560px',
    width: '100%',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  modalTitle: {
    fontSize: '17px',
    fontWeight: 700,
    color: '#fde047',
    margin: 0,
  },
  modalCloseBtn: {
    background: 'transparent',
    border: 'none',
    color: '#9a9080',
    fontSize: '18px',
    cursor: 'pointer',
  },
  eventForm: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid #2a1e10',
    borderRadius: '8px',
    padding: '14px',
  },
  colorInput: {
    width: '42px',
    height: '36px',
    border: '1px solid #3a2e1e',
    borderRadius: '6px',
    background: '#1a140d',
    cursor: 'pointer',
  },
  createEventBtn: {
    width: '100%',
    padding: '8px',
    background: 'linear-gradient(135deg, #fde047, #c8a85a)',
    color: '#1a1208',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  eventList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  eventItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid #2a1e10',
    borderRadius: '6px',
  },
  eventColorDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  eventCountBadge: {
    fontSize: '11px',
    color: '#9a9080',
    background: 'rgba(0,0,0,0.3)',
    padding: '2px 8px',
    borderRadius: '10px',
    border: '1px solid #3a2e1e',
  },
  deleteEventBtn: {
    background: 'transparent',
    border: 'none',
    color: '#ef4444',
    cursor: 'pointer',
    fontSize: '14px',
  },
}
