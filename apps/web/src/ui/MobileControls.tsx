import { useRef } from 'react'

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
        <span style={{ fontSize: '18px' }}>📱</span>
        <span style={{ fontSize: '11px', marginTop: '2px' }}>
          {gyroEnabled ? 'Cảm biến\nBẬT' : 'Cảm biến\nTẮT'}
        </span>
      </button>

      {/* D-pad */}
      <div style={styles.dpad}>
        <div style={styles.row}>
          <span style={styles.corner} />
          <button style={styles.btn} {...makeHandlers('up')}>▲</button>
          <span style={styles.corner} />
        </div>
        <div style={styles.row}>
          <button style={styles.btn} {...makeHandlers('left')}>◀</button>
          <span style={styles.center} />
          <button style={styles.btn} {...makeHandlers('right')}>▶</button>
        </div>
        <div style={styles.row}>
          <span style={styles.corner} />
          <button style={styles.btn} {...makeHandlers('down')}>▼</button>
          <span style={styles.corner} />
        </div>
      </div>
    </div>
  )
}

const BTN_SIZE = 52

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'absolute',
    bottom: '80px',
    left: '12px',
    zIndex: 15,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
    userSelect: 'none',
    touchAction: 'none',
  },
  gyroBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: BTN_SIZE * 3 + 4,  // same width as d-pad
    minHeight: '54px',
    background: 'rgba(10,8,4,0.75)',
    border: '1px solid #5a4a30',
    borderRadius: '12px',
    color: '#9a9080',
    cursor: 'pointer',
    backdropFilter: 'blur(8px)',
    gap: '2px',
    whiteSpace: 'pre-line',
    lineHeight: 1.2,
  },
  gyroBtnOn: {
    background: 'rgba(20,60,20,0.85)',
    borderColor: '#5ac85a',
    color: '#b0ffb0',
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
    background: 'rgba(10,8,4,0.75)',
    border: '1px solid #5a4a30',
    borderRadius: '8px',
    color: '#c8a85a',
    fontSize: '18px',
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
    background: 'rgba(10,8,4,0.4)',
    borderRadius: '8px',
    border: '1px solid rgba(90,74,48,0.3)',
  },
}
