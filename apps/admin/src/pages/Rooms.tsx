import { useNavigate } from 'react-router-dom'
import { useDraftStore } from '../store.js'

export function Rooms() {
  const content = useDraftStore((s) => s.content)
  const navigate = useNavigate()

  if (!content) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9a9080' }}>
      Đang tải...
    </div>
  )

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <h1 style={styles.title}>Quản lý phòng</h1>
        <p style={styles.subtitle}>Chọn phòng để chỉnh sửa model, viewpoints và portals</p>
      </div>

      <div style={styles.list}>
        {content.rooms.map((room) => {
          const period = content.periods.find((p) => p.id === room.periodId)
          const vpCount = room.viewpoints.length
          const portalCount = room.portals?.length ?? 0
          return (
            <button key={room.id} style={styles.row} onClick={() => navigate(`/rooms/${room.id}`)}>
              <div style={{ ...styles.dot, background: period?.themeColor ?? '#5a4a30' }} />
              <div style={styles.info}>
                <div style={styles.roomName}>{room.title}</div>
                <div style={styles.meta}>
                  {period?.title ?? '—'} ·{' '}
                  {room.modelUrl ? 'GLB' : 'template'} ·{' '}
                  {vpCount} viewpoint{vpCount !== 1 ? 's' : ''} ·{' '}
                  {portalCount} portal{portalCount !== 1 ? 's' : ''}
                </div>
              </div>
              <span style={styles.arrow}>→</span>
            </button>
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
    gap: '24px',
  },
  header: { borderBottom: '1px solid #2a1e10', paddingBottom: '16px' },
  title: { fontSize: '22px', fontWeight: 700, color: '#f0e8d8' },
  subtitle: { fontSize: '13px', color: '#6a5a40', marginTop: '4px' },
  list: { display: 'flex', flexDirection: 'column', gap: '8px' },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '14px 16px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid #2a1e10',
    borderRadius: '10px',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    transition: 'background 0.15s, border-color 0.15s',
  },
  dot: { width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0 },
  info: { flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' },
  roomName: { fontSize: '14px', fontWeight: 600, color: '#f0e8d8' },
  meta: { fontSize: '12px', color: '#6a5a40' },
  arrow: { fontSize: '18px', color: '#6a5a40' },
}
