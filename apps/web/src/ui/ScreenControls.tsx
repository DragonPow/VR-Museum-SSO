import { useState, useRef } from 'react'
import { brand, glassPanel } from './theme.js'

interface Props {
  moveRef: React.MutableRefObject<{ dx: number; dz: number }>
  lookRef: React.MutableRefObject<{ dyaw: number; dpitch: number }>
}

interface JoystickProps {
  label: string
  onChange: (x: number, y: number) => void
}

function VirtualJoystick({ label, onChange }: JoystickProps) {
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 })
  const [active, setActive] = useState(false)
  const startRef = useRef({ x: 0, y: 0 })

  const JOYSTICK_SIZE = 72
  const KNOB_SIZE = 26
  const MAX_RADIUS = 22

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    setActive(true)
    startRef.current = { x: e.clientX, y: e.clientY }
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
    // Send normalized values (-1 to 1)
    onChange(finalX / MAX_RADIUS, finalY / MAX_RADIUS)
    window.dispatchEvent(new Event('vm:wake'))
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setActive(false)
    setKnobPos({ x: 0, y: 0 })
    onChange(0, 0)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch (_) {}
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
      <span style={{ fontSize: '9px', fontWeight: 800, color: brand.muted, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
        {label}
      </span>
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          width: JOYSTICK_SIZE,
          height: JOYSTICK_SIZE,
          borderRadius: '50%',
          border: active ? `1.5px solid ${brand.blue}` : `1.5px solid ${brand.line}`,
          background: active ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.45)',
          position: 'relative',
          cursor: active ? 'grabbing' : 'grab',
          touchAction: 'none',
          boxShadow: 'inset 0 2px 6px rgba(8, 47, 109, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'border-color 0.2s ease, background-color 0.2s ease',
        }}
      >
        {/* Subtle inner cross lines */}
        <div style={{
          position: 'absolute',
          inset: '10px',
          borderRadius: '50%',
          border: '1px dashed rgba(16, 80, 160, 0.08)',
          pointerEvents: 'none',
        }} />

        {/* Joystick Knob */}
        <div
          style={{
            width: KNOB_SIZE,
            height: KNOB_SIZE,
            borderRadius: '50%',
            background: active ? brand.blue : 'rgba(16, 80, 160, 0.8)',
            transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
            transition: active ? 'none' : 'transform 0.15s cubic-bezier(0.25, 0.8, 0.25, 1)',
            boxShadow: '0 3px 8px rgba(8, 47, 109, 0.22)',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  )
}

export function ScreenControls({ moveRef, lookRef }: Props) {
  const [isExpanded, setIsExpanded] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('vm_controls_expanded') !== 'false'
  })
  const [toggleHovered, setToggleHovered] = useState(false)

  const handleToggle = () => {
    setIsExpanded((prev) => {
      const next = !prev
      localStorage.setItem('vm_controls_expanded', String(next))
      return next
    })
  }

  if (!isExpanded) {
    return (
      <button
        onClick={handleToggle}
        onMouseEnter={() => setToggleHovered(true)}
        onMouseLeave={() => setToggleHovered(false)}
        title="Mở bảng điều khiển"
        aria-label="Mở bảng điều khiển"
        style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          zIndex: 15,
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          ...glassPanel,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: brand.blue,
          transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1)',
          transform: toggleHovered ? 'scale(1.08)' : 'scale(1)',
          background: toggleHovered ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.8)',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8l-4 4 4 4M16 12H8" />
        </svg>
      </button>
    )
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        zIndex: 15,
        ...glassPanel,
        borderRadius: '16px',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        width: '190px',
        boxShadow: '0 10px 30px rgba(8, 47, 109, 0.12)',
        animation: 'fadeIn 0.2s ease-out',
        userSelect: 'none',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(16,80,160,0.08)', paddingBottom: '4px' }}>
        <span style={{ fontSize: '10px', fontWeight: 800, color: brand.blue, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Bảng điều khiển
        </span>
        <button
          onClick={handleToggle}
          title="Thu gọn"
          aria-label="Thu gọn"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '2px',
            color: brand.muted,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Joysticks Row */}
      <div style={{ display: 'flex', gap: '14px', justifyContent: 'space-between', padding: '2px 0' }}>
        {/* Move Joystick */}
        <VirtualJoystick
          label="Di chuyển"
          onChange={(x, y) => {
            moveRef.current.dx = x
            // Dragging up (negative y) goes forward (positive dz)
            moveRef.current.dz = -y
          }}
        />

        {/* Vertical Divider */}
        <div style={{ width: '1px', background: 'rgba(16,80,160,0.08)', alignSelf: 'stretch' }} />

        {/* Look Joystick */}
        <VirtualJoystick
          label="Xoay nhìn"
          onChange={(x, y) => {
            // Dragging right (positive x) turns camera right (negative dyaw)
            lookRef.current.dyaw = -x
            // Dragging up (negative y) tilts camera up (positive dpitch)
            lookRef.current.dpitch = -y
          }}
        />
      </div>

      {/* Mini Guide */}
      <span style={{ fontSize: '8px', color: brand.muted, textAlign: 'center', borderTop: '1px dashed rgba(16,80,160,0.06)', paddingTop: '4px' }}>
        Kéo thả vòng tròn để đi lại/nhìn quanh
      </span>
    </div>
  )
}
