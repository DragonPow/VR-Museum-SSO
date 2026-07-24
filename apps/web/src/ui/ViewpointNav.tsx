import { useState, useRef, useEffect } from 'react'
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

function DropdownItem({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...styles.dropdownItem,
        background: active
          ? 'rgba(16,80,160,0.08)'
          : hovered
          ? 'rgba(16,80,160,0.04)'
          : 'transparent',
        fontWeight: active ? 800 : 500,
        color: active ? brand.blue : brand.text,
      }}
    >
      {children}
    </button>
  )
}

export function ViewpointNav({ viewpoints, activeId, onSelect, gyroEnabled, onGyroToggle, showGyro }: Props) {
  const idx = viewpoints.findIndex((v) => v.id === activeId)
  const hasMultiple = viewpoints.length > 1
  const prevIdx = hasMultiple ? (idx - 1 + viewpoints.length) % viewpoints.length : idx
  const nextIdx = hasMultiple ? (idx + 1) % viewpoints.length : idx

  const prev = hasMultiple ? viewpoints[prevIdx] : null
  const next = hasMultiple ? viewpoints[nextIdx] : null

  const [isOpen, setIsOpen] = useState(false)
  const [triggerHovered, setTriggerHovered] = useState(false)
  const [prevHovered, setPrevHovered] = useState(false)
  const [nextHovered, setNextHovered] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div style={styles.wrap}>
      <button
        style={{
          ...styles.arrowBtn,
          opacity: hasMultiple ? 1 : 0.3,
          background: hasMultiple && prevHovered ? 'rgba(16,80,160,0.15)' : 'rgba(16,80,160,0.08)',
          transform: hasMultiple && prevHovered ? 'scale(1.05)' : 'scale(1)',
        }}
        onMouseEnter={() => setPrevHovered(true)}
        onMouseLeave={() => setPrevHovered(false)}
        onClick={() => {
          prev && onSelect(prev.id)
          setIsOpen(false)
        }}
        disabled={!hasMultiple}
        title={prev ? "Trước: " + prev.name : undefined}
      ><ChevronLeft />
      </button>

      <div ref={containerRef} style={styles.selectContainer}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          onMouseEnter={() => setTriggerHovered(true)}
          onMouseLeave={() => setTriggerHovered(false)}
          style={{
            ...styles.selectTrigger,
            background: isOpen || triggerHovered ? 'rgba(16,80,160,0.06)' : 'transparent',
          }}
        >
          <span style={styles.triggerText}>
            {viewpoints.find((v) => v.id === activeId)?.name ?? ''}
          </span>
          <svg
            style={{
              ...styles.chevron,
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {isOpen && (
          <div style={styles.dropdownMenu}>
            {viewpoints.map((vp) => (
              <DropdownItem
                key={vp.id}
                active={vp.id === activeId}
                onClick={() => {
                  onSelect(vp.id)
                  setIsOpen(false)
                }}
              >
                {vp.name}
              </DropdownItem>
            ))}
          </div>
        )}
      </div>

      <button
        style={{
          ...styles.arrowBtn,
          opacity: hasMultiple ? 1 : 0.3,
          background: hasMultiple && nextHovered ? 'rgba(16,80,160,0.15)' : 'rgba(16,80,160,0.08)',
          transform: hasMultiple && nextHovered ? 'scale(1.05)' : 'scale(1)',
        }}
        onMouseEnter={() => setNextHovered(true)}
        onMouseLeave={() => setNextHovered(false)}
        onClick={() => {
          next && onSelect(next.id)
          setIsOpen(false)
        }}
        disabled={!hasMultiple}
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
    transition: 'all 0.2s ease',
    lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px',
  },
  selectContainer: {
    display: 'inline-flex',
    alignItems: 'center',
    position: 'relative',
  },
  selectTrigger: {
    fontFamily: brand.fontFamily,
    fontSize: '13px',
    fontWeight: 800,
    color: brand.blue,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    cursor: 'pointer',
    padding: '6px 12px',
    borderRadius: '8px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    userSelect: 'none',
    transition: 'background-color 0.2s ease',
  },
  triggerText: {
    whiteSpace: 'nowrap',
    minWidth: '80px',
    textAlign: 'center',
  },
  chevron: {
    transition: 'transform 0.2s ease',
    flexShrink: 0,
  },
  dropdownMenu: {
    position: 'absolute',
    bottom: 'calc(100% + 12px)',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '180px',
    maxHeight: '240px',
    overflowY: 'auto',
    ...glassPanel,
    background: 'rgba(255, 255, 255, 0.96)',
    borderRadius: '16px',
    padding: '6px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    zIndex: 100,
    boxShadow: '0 10px 30px rgba(8,47,109,0.15)',
  },
  dropdownItem: {
    fontFamily: brand.fontFamily,
    fontSize: '13px',
    border: 'none',
    outline: 'none',
    cursor: 'pointer',
    padding: '8px 12px',
    borderRadius: '10px',
    textAlign: 'center',
    width: '100%',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
    display: 'block',
  },
  gyroBtn: {
    border: '1px solid', borderRadius: '14px',
    padding: '4px 10px', fontSize: '11px', cursor: 'pointer', fontWeight: 800,
  },
}
