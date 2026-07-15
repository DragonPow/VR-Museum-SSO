import { useRef } from 'react'
import { brand } from './theme.js'

interface Props {
  moveRef: { current: { dx: number; dz: number } }
  gyroEnabled: boolean
  onGyroToggle: () => void
}

type Dir = 'up' | 'down' | 'left' | 'right'

export function MobileControls({ moveRef, gyroEnabled, onGyroToggle }: Props) {
  const pressed = useRef<Record<Dir, boolean>>({ up: false, down: false, left: false, right: false })

  function sync() {
    moveRef.current.dz = (pressed.current.up ? 1 : 0) - (pressed.current.down ? 1 : 0)
    moveRef.current.dx = (pressed.current.right ? 1 : 0) - (pressed.current.left ? 1 : 0)
  }

  function makeHandlers(dir: Dir) {
    return {
      onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        pressed.current[dir] = true
        sync()
        // Boot the render loop (frameloop='demand'); NavController listens for this.
        window.dispatchEvent(new Event('vm:wake'))
      },
      onPointerUp: () => { pressed.current[dir] = false; sync() },
      onPointerCancel: () => { pressed.current[dir] = false; sync() },
      onPointerLeave: () => { pressed.current[dir] = false; sync() },
    }
  }

  return (
    <div style={styles.wrap}>
      {/* Gyro toggle button */}
      <button
        style={{
          ...styles.gyroBtn,
          ...(gyroEnabled ? styles.gyroBtnOn : {}),
        }}
        onClick={onGyroToggle}
      >
        <PhoneIcon />
        <span style={{ fontSize: '10px', marginTop: '1px' }}>
          {gyroEnabled ? 'Cảm biến BẬT' : 'Cảm biến TẮT'}
        </span>
      </button>

      {/* D-pad */}
      <div style={styles.dpad}>
        <div style={styles.row}>
          <span style={styles.corner} />
          <button style={styles.btn} {...makeHandlers('up')}><ChevronUp /></button>
          <span style={styles.corner} />
        </div>
        <div style={styles.row}>
          <button style={styles.btn} {...makeHandlers('left')}><ChevronLeft /></button>
          <span style={styles.center} />
          <button style={styles.btn} {...makeHandlers('right')}><ChevronRight /></button>
        </div>
        <div style={styles.row}>
          <span style={styles.corner} />
          <button style={styles.btn} {...makeHandlers('down')}><ChevronDown /></button>
          <span style={styles.corner} />
        </div>
      </div>
    </div>
  )
}

function PhoneIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <rect x="7" y="2.5" width="10" height="19" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M11 18h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function ChevronUp() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 15l6-6 6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg> }
function ChevronDown() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg> }
function ChevronLeft() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg> }
function ChevronRight() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg> }

const BTN_SIZE = 40

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'absolute',
    bottom: '64px',
    left: '10px',
    zIndex: 15,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    opacity: 0.9,
    userSelect: 'none',
    touchAction: 'none',
  },
  gyroBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: BTN_SIZE * 3 + 4,  // same width as d-pad
    minHeight: '38px',
    background: 'rgba(255,255,255,0.88)',
    border: `1px solid ${brand.line}`,
    borderRadius: '12px',
    color: brand.muted,
    cursor: 'pointer',
    backdropFilter: 'blur(8px)',
    gap: '2px',
    whiteSpace: 'pre-line',
    lineHeight: 1.2,
  },
  gyroBtnOn: {
    background: 'rgba(16,80,160,0.12)',
    borderColor: brand.blue,
    color: brand.blue,
  },
  dpad: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  row: {
    display: 'flex',
    gap: '2px',
  },
  btn: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    background: 'rgba(255,255,255,0.88)',
    border: `1px solid ${brand.line}`,
    borderRadius: '8px',
    color: brand.blue,
    fontSize: 0,
    cursor: 'pointer',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    touchAction: 'none',
    flexShrink: 0,
  },
  corner: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    flexShrink: 0,
  },
  center: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    flexShrink: 0,
    background: 'rgba(16,80,160,0.08)',
    borderRadius: '8px',
    border: `1px solid ${brand.line}`,
  },
}
