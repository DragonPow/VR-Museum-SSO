import type { RoomStub } from '@vm/shared'
import { brand, glassPanel } from './theme.js'

interface Props {
  rooms: RoomStub[]
  currentRoomId: string | null
  onNavigate: (roomId: string) => void
}

export function Minimap({ rooms, currentRoomId, onNavigate }: Props) {
  return (
    <div style={styles.wrap}>
      <div style={styles.list}>
        {rooms.map((room) => {
          const active = room.id === currentRoomId
          return (
            <button
              key={room.id}
              style={{
                ...styles.dot,
                background: active ? brand.blue : 'rgba(16,80,160,0.2)',
                boxShadow: active ? '0 0 0 4px rgba(16,80,160,0.14)' : 'none',
                transform: active ? 'scale(1.3)' : 'scale(1)',
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
    ...glassPanel,
    borderRadius: '8px', padding: '8px 10px',
    zIndex: 10, pointerEvents: 'auto',
  },
  list: { display: 'flex', gap: '6px', flexWrap: 'wrap', maxWidth: '120px' },
  dot: {
    width: '12px', height: '12px', borderRadius: '50%',
    border: 'none', cursor: 'pointer',
    transition: 'all 0.2s',
  },
}
