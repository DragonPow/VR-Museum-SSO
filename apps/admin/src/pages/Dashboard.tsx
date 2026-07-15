import { useNavigate } from 'react-router-dom'
import { useDraftStore } from '../store.js'

export function Dashboard() {
  const content = useDraftStore((s) => s.content)
  const loading = useDraftStore((s) => s.loading)
  const error = useDraftStore((s) => s.error)
  const navigate = useNavigate()

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />
  if (!content) return <LoadingState />

  const totalSlots = content.rooms.flatMap((r) => r.slots).length
  const assignedSlots = content.rooms.flatMap((r) => r.slots).filter((s) => (s.documentIds ?? []).length > 0).length
  const totalItems = content.documents.length
  const progress = totalSlots > 0 ? Math.round((assignedSlots / totalSlots) * 100) : 0

  const stats = [
    { label: 'Thời kỳ', value: content.periods.length, icon: '📅' },
    { label: 'Phòng', value: content.rooms.length, icon: '🚪' },
    { label: 'Slot', value: `${assignedSlots}/${totalSlots}`, icon: '🖼', sub: `${progress}% đã gán` },
    { label: 'Tư liệu', value: totalItems, icon: '📷' },
  ]

  const roomProgress = content.rooms.map((r) => {
    const period = content.periods.find((p) => p.id === r.periodId)
    const filled = r.slots.filter((s) => (s.documentIds ?? []).length > 0).length
    return { room: r, period, filled, total: r.slots.length }
  })

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <h1 style={styles.title}>Dashboard</h1>
        <p style={styles.subtitle}>Tổng quan nội dung — Phòng Truyền Thống 50 Năm</p>
      </div>

      {/* Stats row */}
      <div style={styles.statsRow}>
        {stats.map(({ label, value, icon, sub }) => (
          <div key={label} style={styles.statCard}>
            <div style={styles.statIcon}>{icon}</div>
            <div style={styles.statValue}>{value}</div>
            <div style={styles.statLabel}>{label}</div>
            {sub && <div style={styles.statSub}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Tiến độ gán ảnh</div>
        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressFill, width: `${progress}%` }} />
        </div>
        <div style={styles.progressLabel}>{assignedSlots} / {totalSlots} slot đã có ảnh ({progress}%)</div>
      </div>

      {/* Per-room breakdown */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Chi tiết theo phòng</div>
        <div style={styles.roomList}>
          {roomProgress.map(({ room, period, filled, total }) => {
            const pct = total > 0 ? Math.round((filled / total) * 100) : 0
            return (
              <div key={room.id} style={styles.roomRow}>
                <div style={{ ...styles.roomDot, background: period?.themeColor ?? '#5a4a30' }} />
                <div style={styles.roomInfo}>
                  <span style={styles.roomName}>{room.title}</span>
                  <span style={styles.roomPeriod}>{period?.title}</span>
                </div>
                <div style={styles.roomBarWrap}>
                  <div style={styles.roomBar}>
                    <div style={{ ...styles.roomBarFill, width: `${pct}%`, background: period?.themeColor ?? '#c8a85a' }} />
                  </div>
                </div>
                <div style={styles.roomCount}>{filled}/{total}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Quick actions */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Thao tác nhanh</div>
        <div style={styles.actions}>
          <button style={styles.actionBtn} onClick={() => navigate('/library')}>
            🖼 Upload ảnh mới
          </button>
          <button style={styles.actionBtn} onClick={() => navigate('/assign')}>
            📌 Gán ảnh vào slot
          </button>
          <button style={styles.actionBtn} onClick={() => navigate('/preview')}>
            👁 Xem trước 3D
          </button>
          <button style={{ ...styles.actionBtn, ...styles.actionBtnPrimary }} onClick={() => navigate('/publish')}>
            🚀 Xuất bản
          </button>
        </div>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9a9080' }}>
      <div>Đang tải nội dung...</div>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  const init = useDraftStore((s) => s.init)
  const reset = useDraftStore((s) => s.reset)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px', color: '#c85a5a' }}>
      <div style={{ fontSize: '32px' }}>⚠️</div>
      <div style={{ fontSize: '14px', textAlign: 'center', maxWidth: '400px' }}>{message}</div>
      <div style={{ display: 'flex', gap: '12px' }}>
        <button style={{ ...styles.actionBtn }} onClick={init}>Thử lại</button>
        <button style={{ ...styles.actionBtn, color: '#c85a5a', borderColor: '#c85a5a' }} onClick={reset}>Xóa cache</button>
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
    gap: '24px',
  },
  header: { borderBottom: '1px solid #2a1e10', paddingBottom: '16px' },
  title: { fontSize: '22px', fontWeight: 700, color: '#f0e8d8' },
  subtitle: { fontSize: '13px', color: '#6a5a40', marginTop: '4px' },
  statsRow: { display: 'flex', gap: '16px' },
  statCard: {
    flex: 1,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid #2a1e10',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  statIcon: { fontSize: '24px' },
  statValue: { fontSize: '28px', fontWeight: 700, color: '#c8a85a', lineHeight: 1.2 },
  statLabel: { fontSize: '12px', color: '#9a9080' },
  statSub: { fontSize: '11px', color: '#5a8a5a' },
  section: { display: 'flex', flexDirection: 'column', gap: '12px' },
  sectionTitle: { fontSize: '13px', fontWeight: 600, color: '#9a9080', textTransform: 'uppercase', letterSpacing: '0.05em' },
  progressTrack: { height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' },
  progressFill: { height: '100%', background: '#c8a85a', borderRadius: '4px', transition: 'width 0.4s' },
  progressLabel: { fontSize: '13px', color: '#9a9080' },
  roomList: { display: 'flex', flexDirection: 'column', gap: '10px' },
  roomRow: { display: 'flex', alignItems: 'center', gap: '12px' },
  roomDot: { width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0 },
  roomInfo: { width: '260px', flexShrink: 0 },
  roomName: { display: 'block', fontSize: '13px', color: '#f0e8d8' },
  roomPeriod: { display: 'block', fontSize: '11px', color: '#6a5a40' },
  roomBarWrap: { flex: 1 },
  roomBar: { height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' },
  roomBarFill: { height: '100%', borderRadius: '3px', transition: 'width 0.4s' },
  roomCount: { width: '40px', textAlign: 'right', fontSize: '12px', color: '#9a9080', flexShrink: 0 },
  actions: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  actionBtn: {
    padding: '10px 18px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid #3a2e1e',
    borderRadius: '8px',
    color: '#c8a85a',
    fontSize: '13px',
    cursor: 'pointer',
  },
  actionBtnPrimary: {
    background: 'rgba(200,168,90,0.12)',
    borderColor: '#c8a85a',
  },
}
