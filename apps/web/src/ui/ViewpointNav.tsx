import type { Viewpoint } from '@vm/shared'
import { brand, glassPanel } from './theme.js'

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
      <button
        style={{ ...styles.arrowBtn, opacity: prev ? 1 : 0.3 }}
        onClick={() => prev && onSelect(prev.id)}
        disabled={!prev}
        title={prev ? "Trước: " + prev.name : undefined}
      ><ChevronLeft />
      </button>

      <div style={styles.dotsRow}>
        {viewpoints.map((vp) => (
          <button
            key={vp.id}
            style={{
              ...styles.dot,
              background: vp.id === activeId ? brand.blue : 'rgba(16,80,160,0.22)',
              boxShadow: vp.id === activeId ? '0 0 0 4px rgba(16,80,160,0.13)' : 'none',
              transform: vp.id === activeId ? 'scale(1.35)' : 'scale(1)',
            }}
            onClick={() => onSelect(vp.id)}
            title={vp.name}
          />
        ))}
      </div>

      <div style={styles.label}>
        {viewpoints.find((v) => v.id === activeId)?.name ?? ''}
      </div>

      <button
        style={{ ...styles.arrowBtn, opacity: next ? 1 : 0.3 }}
        onClick={() => next && onSelect(next.id)}
        disabled={!next}
        title={next ? "Tiếp: " + next.name : undefined}
      ><ChevronRight />
      </button>

      {showGyro && (
        <button
          style={{
            ...styles.gyroBtn,
            background: gyroEnabled ? 'rgba(16,80,160,0.12)' : 'rgba(255,255,255,0.7)',
            borderColor: gyroEnabled ? brand.blue : brand.line,
            color: gyroEnabled ? brand.blue : brand.muted,
          }}
          onClick={onGyroToggle}
        >
          <PhoneIcon active={gyroEnabled} />
        </button>
      )}
    </div>
  )
}

function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PhoneIcon({ active }: { active: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
        <rect x="7" y="2.5" width="10" height="19" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M11 18h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {active && <span>ON</span>}
    </span>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'absolute', bottom: '20px', left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex', alignItems: 'center', gap: '10px',
    ...glassPanel,
    borderRadius: '28px', padding: '8px 16px',
    zIndex: 10, pointerEvents: 'auto', userSelect: 'none',
  },
  arrowBtn: {
    background: 'rgba(16,80,160,0.08)', border: `1px solid ${brand.line}`,
    color: brand.blue, fontSize: '0', cursor: 'pointer',
    borderRadius: '8px',
    transition: 'opacity 0.15s',
    lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px',
  },
  dotsRow: { display: 'flex', gap: '7px', alignItems: 'center' },
  dot: {
    width: '9px', height: '9px', borderRadius: '50%',
    border: 'none', cursor: 'pointer',
    transition: 'all 0.2s', flexShrink: 0,
  },
  label: {
    fontSize: '12px', color: brand.text, whiteSpace: 'nowrap',
    minWidth: '80px', textAlign: 'center', fontWeight: 800,
  },
  gyroBtn: {
    border: '1px solid', borderRadius: '14px',
    padding: '4px 10px', fontSize: '11px', cursor: 'pointer', fontWeight: 800,
  },
}
