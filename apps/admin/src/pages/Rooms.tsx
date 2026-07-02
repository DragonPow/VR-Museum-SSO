import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDraftStore } from '../store.js'
import { nanoid } from '../util/nanoid.js'
import type { Room, RoomTemplate, LightingPreset } from '@vm/shared'

const TEMPLATES: { value: RoomTemplate; label: string }[] = [
  { value: 'hall',     label: 'Hall (sảnh lớn)' },
  { value: 'gallery',  label: 'Gallery (phòng tranh)' },
  { value: 'corridor', label: 'Corridor (hành lang)' },
  { value: 'honor',    label: 'Honor (phòng danh dự)' },
]

export function Rooms() {
  const content    = useDraftStore((s) => s.content)
  const addRoom    = useDraftStore((s) => s.addRoom)
  const removeRoom = useDraftStore((s) => s.removeRoom)
  const navigate   = useNavigate()

  const [showAdd, setShowAdd]     = useState(false)
  const [title, setTitle]         = useState('')
  const [periodId, setPeriodId]   = useState('')
  const [template, setTemplate]   = useState<RoomTemplate>('hall')
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  if (!content) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9a9080' }}>
      Đang tải...
    </div>
  )

  const handleAdd = () => {
    if (!title.trim()) return
    const pid = periodId || (content.periods[0]?.id ?? '')
    const order = Math.max(0, ...content.rooms.map((r) => r.order)) + 1
    const room: Room = {
      id:               nanoid(),
      periodId:         pid,
      slug:             title.trim().toLowerCase().replace(/\s+/g, '-'),
      title:            title.trim(),
      order,
      template,
      modelUrl:         null,
      wallTextureId:    null,
      floorTextureId:   null,
      ceilingTextureId: null,
      lightingPreset:   'warm' as LightingPreset,
      entryViewpointId: '',
      viewpoints:       [],
      slots:            [],
      portals:          [],
    }
    addRoom(room)
    setTitle('')
    setPeriodId('')
    setTemplate('hall')
    setShowAdd(false)
    navigate(`/rooms/${room.id}`)
  }

  const handleRemove = (id: string) => {
    removeRoom(id)
    setConfirmDel(null)
  }

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Quản lý phòng</h1>
          <p style={styles.subtitle}>Tạo, xóa, và chỉnh sửa model / viewpoints / portals</p>
        </div>
        <button style={styles.btnAdd} onClick={() => setShowAdd(true)}>+ Thêm phòng</button>
      </div>

      {/* Add room inline form */}
      {showAdd && (
        <div style={styles.addBox}>
          <div style={styles.addTitle}>Tạo phòng mới</div>

          <div style={styles.fieldRow}>
            <div style={styles.field}>
              <label style={styles.label}>Tên phòng *</label>
              <input
                style={styles.input}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Vd: Hội trường 1975–1985"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Thời kỳ</label>
              <select
                style={styles.input}
                value={periodId}
                onChange={(e) => setPeriodId(e.target.value)}
              >
                {content.periods.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Template</label>
              <select
                style={styles.input}
                value={template}
                onChange={(e) => setTemplate(e.target.value as RoomTemplate)}
              >
                {TEMPLATES.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={styles.addActions}>
            <button style={styles.btnCancel} onClick={() => setShowAdd(false)}>Hủy</button>
            <button style={styles.btnPrimary} onClick={handleAdd} disabled={!title.trim()}>
              Tạo và vào editor
            </button>
          </div>
        </div>
      )}

      {/* Room list */}
      <div style={styles.list}>
        {content.rooms.length === 0 && (
          <div style={styles.empty}>Chưa có phòng nào. Nhấn "+ Thêm phòng" để bắt đầu.</div>
        )}
        {content.rooms.map((room) => {
          const period     = content.periods.find((p) => p.id === room.periodId)
          const vpCount    = room.viewpoints.length
          const portalCount = room.portals?.length ?? 0
          const slotCount  = room.slots.length

          return (
            <div key={room.id} style={styles.row}>
              {/* Click area to open editor */}
              <button style={styles.rowMain} onClick={() => navigate(`/rooms/${room.id}`)}>
                <div style={{ ...styles.dot, background: period?.themeColor ?? '#5a4a30' }} />
                <div style={styles.info}>
                  <div style={styles.roomName}>{room.title}</div>
                  <div style={styles.meta}>
                    {period?.title ?? '—'} · {room.modelUrl ? 'GLB' : room.template} · {vpCount} viewpoint{vpCount !== 1 ? 's' : ''} · {portalCount} portal{portalCount !== 1 ? 's' : ''} · {slotCount} slot{slotCount !== 1 ? 's' : ''}
                  </div>
                </div>
                <span style={styles.arrow}>→</span>
              </button>

              {/* Delete button */}
              {confirmDel === room.id ? (
                <div style={styles.confirmRow}>
                  <span style={styles.confirmText}>Xóa phòng này?</span>
                  <button style={styles.btnDanger}   onClick={() => handleRemove(room.id)}>Xóa</button>
                  <button style={styles.btnCancel}   onClick={() => setConfirmDel(null)}>Hủy</button>
                </div>
              ) : (
                <button
                  style={styles.deleteBtn}
                  title="Xóa phòng"
                  onClick={(e) => { e.stopPropagation(); setConfirmDel(room.id) }}
                >
                  🗑
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
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
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottom: '1px solid #2a1e10',
    paddingBottom: '16px',
  },
  title:    { fontSize: '22px', fontWeight: 700, color: '#f0e8d8' },
  subtitle: { fontSize: '13px', color: '#6a5a40', marginTop: '4px' },

  btnAdd: {
    padding: '9px 16px',
    background: 'rgba(200,168,90,0.12)',
    border: '1px solid #c8a85a',
    borderRadius: '8px',
    color: '#c8a85a',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
  },

  // Add box
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
  field:    { display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '180px' },
  label:    { fontSize: '12px', color: '#9a9080' },
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
  addActions: { display: 'flex', gap: '8px', justifyContent: 'flex-end' },

  // List
  list:  { display: 'flex', flexDirection: 'column', gap: '6px' },
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
  dot:      { width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0 },
  info:     { flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 },
  roomName: { fontSize: '14px', fontWeight: 600, color: '#f0e8d8' },
  meta:     { fontSize: '12px', color: '#6a5a40', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  arrow:    { fontSize: '18px', color: '#6a5a40', flexShrink: 0 },

  deleteBtn: {
    background: 'none',
    border: 'none',
    padding: '14px 14px',
    cursor: 'pointer',
    fontSize: '16px',
    color: '#6a5a40',
    flexShrink: 0,
  },
  confirmRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    flexShrink: 0,
  },
  confirmText: { fontSize: '12px', color: '#c85a5a', whiteSpace: 'nowrap' },

  // Buttons
  btnPrimary: {
    padding: '8px 14px',
    background: 'rgba(200,168,90,0.12)',
    border: '1px solid #c8a85a',
    borderRadius: '6px',
    color: '#c8a85a',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnCancel: {
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid #3a2e1e',
    borderRadius: '6px',
    color: '#9a9080',
    fontSize: '13px',
    cursor: 'pointer',
  },
  btnDanger: {
    padding: '6px 12px',
    background: 'rgba(200,90,90,0.1)',
    border: '1px solid #c85a5a',
    borderRadius: '6px',
    color: '#c85a5a',
    fontSize: '12px',
    cursor: 'pointer',
  },
}
