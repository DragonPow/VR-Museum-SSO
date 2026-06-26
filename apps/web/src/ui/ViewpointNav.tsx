import type { Viewpoint } from '@vm/shared'

interface Props {
  viewpoints: Viewpoint[]
  activeId: string
  onSelect: (id: string) => void
  gyroEnabled: boolean
  onGyroToggle: () => void
  showGyro: boolean
}

export function ViewpointNav({ viewpoints, activeId, onSelect, gyroEnabled, onGyroToggle, showGyro }: Props) {
  return (
    <div style={styles.wrap}>
      {viewpoints.map((vp) => (
        <button
          key={vp.id}
          style={{
            ...styles.btn,
            background: vp.id === activeId ? 'rgba(200,168,90,0.25)' : 'rgba(0,0,0,0.45)',
            borderColor: vp.id === activeId ? '#c8a85a' : '#5a4a30',
            color: vp.id === activeId ? '#f5e6c8' : '#9a9080',
          }}
          onClick={() => onSelect(vp.id)}
        >
          {vp.name}
        </button>
      ))}

      {showGyro && (
        <button
          style={{
            ...styles.btn,
            background: gyroEnabled ? 'rgba(90,160,90,0.25)' : 'rgba(0,0,0,0.45)',
            borderColor: gyroEnabled ? '#5aa05a' : '#5a4a30',
            color: gyroEnabled ? '#c8ffb0' : '#9a9080',
          }}
          onClick={onGyroToggle}
          title="Bật/tắt cảm biến xoay điện thoại"
        >
          {gyroEnabled ? '📱 Cảm biến BẬT' : '📱 Cảm biến'}
        </button>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'absolute', bottom: '16px', left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center',
    zIndex: 10, pointerEvents: 'auto',
  },
  btn: {
    border: '1px solid', borderRadius: '20px',
    padding: '6px 14px', fontSize: '12px', cursor: 'pointer',
    transition: 'all 0.15s', backdropFilter: 'blur(4px)',
    whiteSpace: 'nowrap',
  },
}
