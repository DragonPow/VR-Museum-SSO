import type { RoomStub, Period } from '@vm/shared'

interface Props {
  rooms: RoomStub[]
  periods: Period[]
  currentRoomId: string | null
  onNavigate: (roomId: string) => void
}

export function Minimap({ rooms, periods, currentRoomId, onNavigate }: Props) {
  const periodMap = Object.fromEntries(periods.map((p) => [p.id, p]))

  return (
    <div style={styles.wrap}>
      <div style={styles.label}>Sơ đồ</div>
      <div style={styles.list}>
        {rooms.map((room) => {
          const period = periodMap[room.periodId]
          return (
            <button
              key={room.id}
              style={{
                ...styles.dot,
                background: room.id === currentRoomId
                  ? (period?.themeColor ?? '#c8a85a')
                  : 'rgba(255,255,255,0.15)',
                transform: room.id === currentRoomId ? 'scale(1.3)' : 'scale(1)',
              }}
              title={room.title}
              onClick={() => onNavigate(room.id)}
            />
          )
        })}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'absolute', bottom: '60px', right: '16px',
    background: 'rgba(15,10,5,0.75)', border: '1px solid #5a4a30',
    borderRadius: '8px', padding: '8px 10px',
    zIndex: 10, pointerEvents: 'auto',
    backdropFilter: 'blur(6px)',
  },
  label: { fontSize: '10px', color: '#7a7060', marginBottom: '6px', letterSpacing: '0.05em' },
  list: { display: 'flex', gap: '6px', flexWrap: 'wrap', maxWidth: '120px' },
  dot: {
    width: '12px', height: '12px', borderRadius: '50%',
    border: 'none', cursor: 'pointer',
    transition: 'all 0.2s',
  },
}
