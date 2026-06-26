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
  const idx = viewpoints.findIndex((v) => v.id === activeId)
  const prev = idx > 0 ? viewpoints[idx - 1] : null
  const next = idx < viewpoints.length - 1 ? viewpoints[idx + 1] : null

  return (
    <div style={styles.wrap}>
      {/* Prev arrow */}
      <button
        style={{ ...styles.arrowBtn, opacity: prev ? 1 : 0.25 }}
        onClick={() => prev && onSelect(prev.id)}
        disabled={!prev}
        title={prev ? `← ${prev.name}` : undefined}
      >
        ◀
      </button>

      {/* Viewpoint dots */}
      <div style={styles.dotsRow}>
        {viewpoints.map((vp, i) => (
          <button
            key={vp.id}
            style={{
              ...styles.dot,
              background: vp.id === activeId ? '#c8a85a' : 'rgba(255,255,255,0.25)',
              transform: vp.id === activeId ? 'scale(1.35)' : 'scale(1)',
            }}
            onClick={() => onSelect(vp.id)}
            title={vp.name}
          />
        ))}
      </div>

      {/* Current viewpoint label */}
      <div style={styles.label}>
        {viewpoints.find((v) => v.id === activeId)?.name ?? ''}
      </div>

      {/* Next arrow */}
      <button
        style={{ ...styles.arrowBtn, opacity: next ? 1 : 0.25 }}
        onClick={() => next && onSelect(next.id)}
        disabled={!next}
        title={next ? `${next.name} →` : undefined}
      >
        ▶
      </button>

      {/* Gyro toggle (mobile) */}
      {showGyro && (
        <button
          style={{
            ...styles.gyroBtn,
            background: gyroEnabled ? 'rgba(90,200,90,0.2)' : 'rgba(0,0,0,0.45)',
            borderColor: gyroEnabled ? '#5ac85a' : '#5a4a30',
            color: gyroEnabled ? '#b0ffb0' : '#9a9080',
          }}
          onClick={onGyroToggle}
        >
          {gyroEnabled ? '📱 ON' : '📱'}
        </button>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'absolute', bottom: '20px', left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex', alignItems: 'center', gap: '10px',
    background: 'rgba(10,8,4,0.7)', border: '1px solid #5a4a30',
    borderRadius: '28px', padding: '8px 16px',
    backdropFilter: 'blur(8px)', zIndex: 10,
    pointerEvents: 'auto', userSelect: 'none',
  },
  arrowBtn: {
    background: 'none', border: 'none',
    color: '#c8a85a', fontSize: '16px', cursor: 'pointer',
    padding: '4px 8px', borderRadius: '6px',
    transition: 'opacity 0.15s',
    lineHeight: 1,
  },
  dotsRow: { display: 'flex', gap: '7px', alignItems: 'center' },
  dot: {
    width: '9px', height: '9px', borderRadius: '50%',
    border: 'none', cursor: 'pointer',
    transition: 'all 0.2s', flexShrink: 0,
  },
  label: {
    fontSize: '12px', color: '#c8a85a', whiteSpace: 'nowrap',
    minWidth: '80px', textAlign: 'center',
  },
  gyroBtn: {
    border: '1px solid', borderRadius: '14px',
    padding: '4px 10px', fontSize: '11px', cursor: 'pointer',
  },
}
