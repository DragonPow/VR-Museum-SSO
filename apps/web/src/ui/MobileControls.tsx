import { useRef, useState } from 'react'
import { brand } from './theme.js'

interface Props {
  moveRef: { current: { dx: number; dz: number } }
}

const JOYSTICK_SIZE = 100
const KNOB_SIZE = 42
const MAX_RADIUS = 35 // Maximum distance the knob can move from center

export function MobileControls({ moveRef }: Props) {
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 })
  const [active, setActive] = useState(false)
  const startRef = useRef({ x: 0, y: 0 })

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setActive(true)
    startRef.current = { x: e.clientX, y: e.clientY }
    // Wake up the R3F render loop (which runs on 'demand' mode)
    window.dispatchEvent(new Event('vm:wake'))
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!active) return

    const dX = e.clientX - startRef.current.x
    const dY = e.clientY - startRef.current.y
    const dist = Math.sqrt(dX * dX + dY * dY)

    let finalX = dX
    let finalY = dY

    if (dist > MAX_RADIUS) {
      finalX = (dX / dist) * MAX_RADIUS
      finalY = (dY / dist) * MAX_RADIUS
    }

    setKnobPos({ x: finalX, y: finalY })

    // dx = speed factor right/left (-1 to 1)
    // dz = speed factor forward/backward (-1 to 1). Note that pulling down (positive dY) is going backward (negative dz)
    moveRef.current.dx = finalX / MAX_RADIUS
    moveRef.current.dz = -finalY / MAX_RADIUS

    window.dispatchEvent(new Event('vm:wake'))
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setActive(false)
    setKnobPos({ x: 0, y: 0 })
    moveRef.current.dx = 0
    moveRef.current.dz = 0
    
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch (err) {
      // Ignore pointer capture errors
    }
  }

  return (
    <div style={styles.wrap}>
      {/* Virtual Joystick Container */}
      <div
        style={{
          ...styles.joystickContainer,
          borderColor: active ? brand.blue : brand.line,
          background: active ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.38)',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Subtle direction indicators in background */}
        <div style={styles.indicators}>
          <div style={styles.arrowUp}>▲</div>
          <div style={styles.arrowDown}>▼</div>
          <div style={styles.arrowLeft}>◀</div>
          <div style={styles.arrowRight}>▶</div>
        </div>

        {/* Outer subtle ring */}
        <div style={styles.outerRing} />

        {/* Joystick Knob */}
        <div
          style={{
            ...styles.knob,
            transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
            transition: active ? 'none' : 'transform 0.18s cubic-bezier(0.25, 0.8, 0.25, 1)',
            background: active ? brand.blue : 'rgba(16, 80, 160, 0.82)',
          }}
        />
      </div>
      <span style={styles.guideText}>Kéo để di chuyển</span>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'absolute',
    bottom: '48px',
    left: '24px',
    zIndex: 15,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    userSelect: 'none',
    touchAction: 'none',
  },
  joystickContainer: {
    width: JOYSTICK_SIZE,
    height: JOYSTICK_SIZE,
    borderRadius: '50%',
    border: `1.5px solid ${brand.line}`,
    backdropFilter: 'blur(10px)',
    position: 'relative',
    cursor: 'pointer',
    touchAction: 'none',
    boxShadow: '0 8px 32px rgba(8, 47, 109, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    position: 'absolute',
    inset: '10px',
    borderRadius: '50%',
    border: '1px dashed rgba(16, 80, 160, 0.15)',
    pointerEvents: 'none',
  },
  knob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: '50%',
    boxShadow: '0 4px 14px rgba(8, 47, 109, 0.26)',
    pointerEvents: 'none',
    zIndex: 2,
  },
  indicators: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    fontSize: '8px',
    color: 'rgba(16, 80, 160, 0.25)',
    fontWeight: 'bold',
  },
  arrowUp: {
    position: 'absolute',
    top: '6px',
  },
  arrowDown: {
    position: 'absolute',
    bottom: '6px',
  },
  arrowLeft: {
    position: 'absolute',
    left: '6px',
  },
  arrowRight: {
    position: 'absolute',
    right: '6px',
  },
  guideText: {
    fontSize: '10px',
    color: brand.muted,
    fontWeight: 'bold',
    textShadow: '0 1px 2px rgba(255,255,255,0.8)',
    pointerEvents: 'none',
  },
}
