import type { Period, RoomStub } from '@vm/shared'
import { brand, glassPanel } from './theme.js'

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
        Trang chủ
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
                  color: isActive ? brand.blue : brand.muted,
                  borderBottom: isActive ? `2px solid ${brand.blue}` : '2px solid transparent',
                }}
              >
                {period.yearStart}-{period.yearEnd}
              </div>
              <div style={styles.roomList}>
                {periodRooms.map((room) => {
                  const active = room.id === currentRoomId
                  return (
                    <button
                      key={room.id}
                      style={{
                        ...styles.roomBtn,
                        background: active ? 'rgba(16,80,160,0.12)' : 'rgba(255,255,255,0.58)',
                        borderColor: active ? brand.blue : 'rgba(16,80,160,0.12)',
                        color: active ? brand.blueDeep : brand.text,
                        fontWeight: active ? 800 : 600,
                      }}
                      onClick={() => onNavigate(room.id)}
                    >
                      {room.title}
                    </button>
                  )
                })}
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
    padding: '10px 16px 28px',
    display: 'flex', alignItems: 'flex-start', gap: '12px',
    zIndex: 10, pointerEvents: 'none',
  },
  backBtn: {
    ...glassPanel,
    color: brand.blue, borderRadius: '8px',
    padding: '7px 13px', fontSize: '12px', cursor: 'pointer',
    whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 800, pointerEvents: 'auto',
  },
  timeline: {
    display: 'flex', gap: '6px', overflowX: 'auto',
    scrollbarWidth: 'none', flexGrow: 1, pointerEvents: 'auto',
  },
  periodGroup: { flexShrink: 0 },
  periodLabel: {
    fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em',
    paddingBottom: '4px', marginBottom: '5px', whiteSpace: 'nowrap',
    transition: 'color 0.2s',
  },
  roomList: { display: 'flex', flexDirection: 'column', gap: '3px' },
  roomBtn: {
    border: '1px solid', borderRadius: '6px',
    padding: '5px 10px', fontSize: '11px', cursor: 'pointer',
    whiteSpace: 'nowrap', textAlign: 'left', transition: 'all 0.15s',
    boxShadow: '0 8px 18px rgba(8,47,109,0.08)',
  },
}
