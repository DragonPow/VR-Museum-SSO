import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Period, Room, LightingPreset } from '@vm/shared'
import { useDraftStore } from '../store.js'
import { nanoid } from '../util/nanoid.js'

const DEFAULT_PERIOD_COLOR = '#c8a85a'

export function Rooms() {
  const content = useDraftStore((s) => s.content)
  const addPeriod = useDraftStore((s) => s.addPeriod)
  const updatePeriod = useDraftStore((s) => s.updatePeriod)
  const removePeriod = useDraftStore((s) => s.removePeriod)
  const addRoom = useDraftStore((s) => s.addRoom)
  const removeRoom = useDraftStore((s) => s.removeRoom)
  const navigate = useNavigate()

  const [showAddRoom, setShowAddRoom] = useState(false)
  const [showPeriodForm, setShowPeriodForm] = useState(false)
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null)
  const [confirmDelRoom, setConfirmDelRoom] = useState<string | null>(null)
  const [confirmDelPeriod, setConfirmDelPeriod] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [periodId, setPeriodId] = useState('')

  const [periodTitle, setPeriodTitle] = useState('')
  const [periodYears, setPeriodYears] = useState('')
  const [periodDescription, setPeriodDescription] = useState('')
  const [periodColor, setPeriodColor] = useState(DEFAULT_PERIOD_COLOR)

  const periodUsage = useMemo(() => {
    if (!content) return new Map<string, { rooms: number; items: number }>()
    const map = new Map<string, { rooms: number; items: number }>()
    content.periods.forEach((period) => map.set(period.id, { rooms: 0, items: 0 }))
    content.rooms.forEach((room) => {
      const stats = map.get(room.periodId)
      if (stats) stats.rooms += 1
    })
    content.items.forEach((item) => {
      const stats = map.get(item.periodId)
      if (stats) stats.items += 1
    })
    return map
  }, [content])

  if (!content) {
    return <div style={styles.center}>Đang tải...</div>
  }

  const resetPeriodForm = () => {
    setEditingPeriodId(null)
    setPeriodTitle('')
    setPeriodYears('')
    setPeriodDescription('')
    setPeriodColor(DEFAULT_PERIOD_COLOR)
    setShowPeriodForm(false)
  }

  const openCreatePeriod = () => {
    setEditingPeriodId(null)
    setPeriodTitle('')
    setPeriodYears('')
    setPeriodDescription('')
    setPeriodColor(DEFAULT_PERIOD_COLOR)
    setShowPeriodForm(true)
  }

  const openEditPeriod = (period: Period) => {
    setEditingPeriodId(period.id)
    setPeriodTitle(period.title)
    setPeriodYears(`${period.yearStart}-${period.yearEnd}`)
    setPeriodDescription(period.description)
    setPeriodColor(period.themeColor)
    setShowPeriodForm(true)
  }

  const handleSavePeriod = () => {
    const nextTitle = periodTitle.trim()
    if (!nextTitle) return

    const match = periodYears.trim().match(/^(\d{4})\s*-\s*(\d{4})$/)
    const yearStart = match ? Number(match[1]) : new Date().getFullYear()
    const yearEnd = match ? Number(match[2]) : yearStart

    if (editingPeriodId) {
      const current = content.periods.find((period) => period.id === editingPeriodId)
      if (!current) return
      updatePeriod(editingPeriodId, {
        title: nextTitle,
        slug: slugify(nextTitle),
        yearStart,
        yearEnd,
        description: periodDescription.trim(),
        themeColor: periodColor,
      })
    } else {
      const order = Math.max(-1, ...content.periods.map((period) => period.order)) + 1
      addPeriod({
        id: nanoid(),
        slug: slugify(nextTitle),
        title: nextTitle,
        yearStart,
        yearEnd,
        order,
        description: periodDescription.trim(),
        themeColor: periodColor,
      })
    }

    resetPeriodForm()
  }

  const handleRemovePeriod = (id: string) => {
    const usage = periodUsage.get(id)
    if ((usage?.rooms ?? 0) > 0 || (usage?.items ?? 0) > 0) return
    removePeriod(id)
    setConfirmDelPeriod(null)
  }

  const handleAddRoom = () => {
    if (!title.trim()) return
    const pid = (periodId || content.periods[0]?.id) ?? ''
    if (!pid) return

    const order = Math.max(0, ...content.rooms.map((room) => room.order)) + 1
    const room: Room = {
      id: nanoid(),
      periodId: pid,
      slug: slugify(title),
      title: title.trim(),
      order,
      template: 'gallery',
      modelUrl: null,
      wallTextureId: null,
      floorTextureId: null,
      ceilingTextureId: null,
      lightingPreset: 'warm' as LightingPreset,
      entryViewpointId: '',
      viewpoints: [],
      slots: [],
      portals: [],
    }

    addRoom(room)
    setTitle('')
    setPeriodId('')
    setShowAddRoom(false)
    navigate(`/rooms/${room.id}`)
  }

  const handleRemoveRoom = (id: string) => {
    removeRoom(id)
    setConfirmDelRoom(null)
  }

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Quản lý phòng</h1>
          <p style={styles.subtitle}>
            Tạo thời kỳ, tạo phòng, và chỉnh sửa model / viewpoints / portals
          </p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.btnGhost} onClick={openCreatePeriod}>
            + Thêm thời kỳ
          </button>
          <button style={styles.btnAdd} onClick={() => setShowAddRoom(true)}>
            + Thêm phòng
          </button>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionHeader}>
          <div>
            <div style={styles.sectionTitle}>Thời kỳ</div>
            <div style={styles.hint}>Danh sách này dùng cho phòng và thư viện ảnh.</div>
          </div>
        </div>

        {showPeriodForm && (
          <div style={styles.addBox}>
            <div style={styles.addTitle}>{editingPeriodId ? 'Sửa thời kỳ' : 'Tạo thời kỳ mới'}</div>
            <div style={styles.fieldRow}>
              <div style={styles.field}>
                <label style={styles.label}>Tên thời kỳ *</label>
                <input
                  style={styles.input}
                  value={periodTitle}
                  onChange={(e) => setPeriodTitle(e.target.value)}
                  placeholder="Vd: 1975-1985"
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Năm bắt đầu-kết thúc</label>
                <input
                  style={styles.input}
                  value={periodYears}
                  onChange={(e) => setPeriodYears(e.target.value)}
                  placeholder="1975-1985"
                />
              </div>
              <div style={{ ...styles.field, maxWidth: '180px' }}>
                <label style={styles.label}>Màu theme</label>
                <input
                  style={styles.input}
                  type="color"
                  value={periodColor}
                  onChange={(e) => setPeriodColor(e.target.value)}
                />
              </div>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Mô tả</label>
              <textarea
                style={styles.textarea}
                value={periodDescription}
                onChange={(e) => setPeriodDescription(e.target.value)}
                placeholder="Mô tả ngắn cho thời kỳ này"
              />
            </div>
            <div style={styles.addActions}>
              <button style={styles.btnCancel} onClick={resetPeriodForm}>
                Hủy
              </button>
              <button
                style={styles.btnPrimary}
                onClick={handleSavePeriod}
                disabled={!periodTitle.trim()}
              >
                Lưu thời kỳ
              </button>
            </div>
          </div>
        )}

        <div style={styles.list}>
          {content.periods.map((period) => {
            const usage = periodUsage.get(period.id) ?? { rooms: 0, items: 0 }
            const locked = usage.rooms > 0 || usage.items > 0

            return (
              <div key={period.id} style={styles.row}>
                <div style={styles.rowMainStatic}>
                  <div style={{ ...styles.dot, background: period.themeColor }} />
                  <div style={styles.info}>
                    <div style={styles.roomName}>{period.title}</div>
                    <div style={styles.meta}>
                      {period.yearStart}-{period.yearEnd} · {usage.rooms} phòng · {usage.items} hiện
                      vật
                    </div>
                  </div>
                </div>
                <div style={styles.rowActions}>
                  <button style={styles.iconBtn} onClick={() => openEditPeriod(period)}>
                    Sửa
                  </button>
                  {confirmDelPeriod === period.id ? (
                    <>
                      <span style={styles.confirmText}>
                        {locked ? 'Đang được dùng' : 'Xóa thời kỳ?'}
                      </span>
                      {!locked && (
                        <button
                          style={styles.btnDanger}
                          onClick={() => handleRemovePeriod(period.id)}
                        >
                          Xóa
                        </button>
                      )}
                      <button style={styles.btnCancel} onClick={() => setConfirmDelPeriod(null)}>
                        Hủy
                      </button>
                    </>
                  ) : (
                    <button
                      style={styles.deleteBtn}
                      onClick={() => setConfirmDelPeriod(period.id)}
                      title={locked ? 'Không thể xóa khi còn phòng hoặc hiện vật' : 'Xóa thời kỳ'}
                    >
                      🗑
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionHeader}>
          <div>
            <div style={styles.sectionTitle}>Phòng</div>
            <div style={styles.hint}>
              Phong moi mac dinh dung fallback procedural tam thoi. Sau do hay upload GLB trong
              editor de dung mo hinh that.
            </div>
          </div>
        </div>

        {showAddRoom && (
          <div style={styles.addBox}>
            <div style={styles.addTitle}>Tạo phòng mới</div>

            <div style={styles.fieldRow}>
              <div style={styles.field}>
                <label style={styles.label}>Tên phòng *</label>
                <input
                  style={styles.input}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Vd: Hội trường 1975-1985"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleAddRoom()}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Thời kỳ</label>
                <select
                  style={styles.input}
                  value={periodId}
                  onChange={(e) => setPeriodId(e.target.value)}
                >
                  {content.periods.map((period) => (
                    <option key={period.id} value={period.id}>
                      {period.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={styles.hint}>
              Template procedural se duoc gan ngam de viewer co fallback khi phong chua co GLB.
            </div>

            <div style={styles.addActions}>
              <button style={styles.btnCancel} onClick={() => setShowAddRoom(false)}>
                Hủy
              </button>
              <button
                style={styles.btnPrimary}
                onClick={handleAddRoom}
                disabled={!title.trim() || content.periods.length === 0}
              >
                Tạo và vào editor
              </button>
            </div>
          </div>
        )}

        <div style={styles.list}>
          {content.rooms.length === 0 && (
            <div style={styles.empty}>Chưa có phòng nào. Nhấn "+ Thêm phòng" để bắt đầu.</div>
          )}
          {content.rooms.map((room) => {
            const period = content.periods.find((item) => item.id === room.periodId)
            const vpCount = room.viewpoints.length
            const portalCount = room.portals?.length ?? 0
            const slotCount = room.slots.length

            return (
              <div key={room.id} style={styles.row}>
                <button style={styles.rowMain} onClick={() => navigate(`/rooms/${room.id}`)}>
                  <div style={{ ...styles.dot, background: period?.themeColor ?? '#5a4a30' }} />
                  <div style={styles.info}>
                    <div style={styles.roomName}>{room.title}</div>
                    <div style={styles.meta}>
                      {period?.title ?? '—'} · {room.modelUrl ? 'GLB' : 'Chua co GLB'} · {vpCount}{' '}
                      viewpoint{vpCount !== 1 ? 's' : ''} · {portalCount} portal
                      {portalCount !== 1 ? 's' : ''} · {slotCount} slot{slotCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <span style={styles.arrow}>→</span>
                </button>

                {confirmDelRoom === room.id ? (
                  <div style={styles.confirmRow}>
                    <span style={styles.confirmText}>Xóa phòng này?</span>
                    <button style={styles.btnDanger} onClick={() => handleRemoveRoom(room.id)}>
                      Xóa
                    </button>
                    <button style={styles.btnCancel} onClick={() => setConfirmDelRoom(null)}>
                      Hủy
                    </button>
                  </div>
                ) : (
                  <button
                    style={styles.deleteBtn}
                    title="Xóa phòng"
                    onClick={(e) => {
                      e.stopPropagation()
                      setConfirmDelRoom(room.id)
                    }}
                  >
                    🗑
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    padding: '24px',
    overflowY: 'auto',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    boxSizing: 'border-box',
  },
  center: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#9a9080',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottom: '1px solid #2a1e10',
    paddingBottom: '16px',
    gap: '12px',
  },
  headerActions: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  title: { fontSize: '22px', fontWeight: 700, color: '#f0e8d8' },
  subtitle: { fontSize: '13px', color: '#6a5a40', marginTop: '4px' },
  card: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid #2a1e10',
    borderRadius: '12px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
  },
  sectionTitle: { fontSize: '16px', fontWeight: 700, color: '#f0e8d8' },
  hint: { fontSize: '12px', color: '#6a5a40', lineHeight: 1.5 },
  btnAdd: {
    padding: '9px 16px',
    background: 'rgba(200,168,90,0.12)',
    border: '1px solid #c8a85a',
    borderRadius: '8px',
    color: '#c8a85a',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnGhost: {
    padding: '9px 16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid #3a2e1e',
    borderRadius: '8px',
    color: '#f0e8d8',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  addBox: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid #3a2e1e',
    borderRadius: '10px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  addTitle: { fontSize: '14px', fontWeight: 600, color: '#f0e8d8' },
  fieldRow: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '180px' },
  label: { fontSize: '12px', color: '#9a9080' },
  input: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid #3a2e1e',
    borderRadius: '6px',
    color: '#f0e8d8',
    fontSize: '13px',
    padding: '7px 10px',
    boxSizing: 'border-box',
    width: '100%',
  },
  textarea: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid #3a2e1e',
    borderRadius: '6px',
    color: '#f0e8d8',
    fontSize: '13px',
    padding: '10px',
    boxSizing: 'border-box',
    width: '100%',
    minHeight: '90px',
    resize: 'vertical',
  },
  addActions: { display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' },
  list: { display: 'flex', flexDirection: 'column', gap: '6px' },
  empty: { fontSize: '13px', color: '#5a4a2a', fontStyle: 'italic', padding: '8px 0' },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid #2a1e10',
    borderRadius: '10px',
    overflow: 'hidden',
  },
  rowMain: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '14px 16px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    flex: 1,
    minWidth: 0,
  },
  rowMainStatic: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '14px 16px',
    flex: 1,
    minWidth: 0,
  },
  rowActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    paddingRight: '12px',
    flexWrap: 'wrap',
  },
  dot: { width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0 },
  info: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' },
  roomName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#f0e8d8',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  meta: {
    fontSize: '12px',
    color: '#7a7060',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  arrow: { marginLeft: 'auto', color: '#6a5a40', fontSize: '16px', flexShrink: 0 },
  deleteBtn: {
    width: '42px',
    height: '42px',
    border: 'none',
    borderLeft: '1px solid #2a1e10',
    background: 'rgba(255,255,255,0.02)',
    color: '#8a5040',
    cursor: 'pointer',
    flexShrink: 0,
  },
  confirmRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    paddingRight: '10px',
    flexWrap: 'wrap',
  },
  confirmText: { fontSize: '12px', color: '#9a9080' },
  btnPrimary: {
    padding: '8px 14px',
    background: '#c8a85a',
    border: '1px solid #c8a85a',
    borderRadius: '7px',
    color: '#120d07',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnCancel: {
    padding: '8px 14px',
    background: 'transparent',
    border: '1px solid #3a2e1e',
    borderRadius: '7px',
    color: '#9a9080',
    fontSize: '13px',
    cursor: 'pointer',
  },
  btnDanger: {
    padding: '8px 14px',
    background: 'rgba(160,60,60,0.12)',
    border: '1px solid #904040',
    borderRadius: '7px',
    color: '#e09090',
    fontSize: '13px',
    cursor: 'pointer',
  },
  iconBtn: {
    padding: '7px 12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid #3a2e1e',
    borderRadius: '7px',
    color: '#f0e8d8',
    fontSize: '12px',
    cursor: 'pointer',
  },
}
