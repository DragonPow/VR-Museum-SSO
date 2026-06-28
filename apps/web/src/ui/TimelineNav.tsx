import type { Period, RoomStub } from '@vm/shared'

interface Props {
  periods: Period[]
  rooms: RoomStub[]
  currentRoomId: string | null
  onNavigate: (roomId: string) => void
  onBack: () => void
}

export function TimelineNav({ periods, rooms, currentRoomId, onNavigate, onBack }: Props) {
  const currentRoom = rooms.find((r) => r.id === currentRoomId)
  const currentPeriod = periods.find((p) => p.id === currentRoom?.periodId)

  return (
    <div style={styles.wrap}>
      <button style={styles.backBtn} onClick={onBack} title="Về trang chủ">
        ← Trang chủ
      </button>

      <div style={styles.timeline}>
        {periods.map((period) => {
          const periodRooms = rooms.filter((r) => r.periodId === period.id)
          const isActive = period.id === currentPeriod?.id
          return (
            <div key={period.id} style={styles.periodGroup}>
              <div
                style={{
                  ...styles.periodLabel,
                  color: isActive ? period.themeColor : '#7a7060',
                  borderBottom: isActive ? `2px solid ${period.themeColor}` : '2px solid transparent',
                }}
              >
                {period.yearStart}–{period.yearEnd}
              </div>
              <div style={styles.roomList}>
                {periodRooms.map((room) => (
                  <button
                    key={room.id}
                    style={{
                      ...styles.roomBtn,
                      background: room.id === currentRoomId
                        ? `${period.themeColor}33`
                        : 'transparent',
                      borderColor: room.id === currentRoomId
                        ? period.themeColor
                        : 'transparent',
                      color: room.id === currentRoomId ? '#f5e6c8' : '#9a9080',
                    }}
                    onClick={() => onNavigate(room.id)}
                  >
                    {room.title}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'absolute', top: 0, left: 0, right: 0,
    background: 'linear-gradient(to bottom, rgba(15,10,5,0.92), transparent)',
    padding: '10px 16px 24px',
    display: 'flex', alignItems: 'flex-start', gap: '12px',
    zIndex: 10, pointerEvents: 'auto',
  },
  backBtn: {
    background: 'rgba(0,0,0,0.4)', border: '1px solid #5a4a30',
    color: '#c8a85a', borderRadius: '6px',
    padding: '6px 12px', fontSize: '12px', cursor: 'pointer',
    whiteSpace: 'nowrap', flexShrink: 0,
  },
  timeline: {
    display: 'flex', gap: '4px', overflowX: 'auto',
    scrollbarWidth: 'none', flexGrow: 1,
  },
  periodGroup: { flexShrink: 0 },
  periodLabel: {
    fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em',
    paddingBottom: '4px', marginBottom: '4px', whiteSpace: 'nowrap',
    transition: 'color 0.2s',
  },
  roomList: { display: 'flex', flexDirection: 'column', gap: '2px' },
  roomBtn: {
    border: '1px solid', borderRadius: '4px',
    padding: '4px 10px', fontSize: '11px', cursor: 'pointer',
    whiteSpace: 'nowrap', textAlign: 'left', transition: 'all 0.15s',
  },
}
