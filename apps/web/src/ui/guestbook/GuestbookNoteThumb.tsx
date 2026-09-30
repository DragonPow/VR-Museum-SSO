import { useState } from 'react'
import type { GuestbookNote } from '@vm/shared'

const COLOR_THEMES: Record<string, {
  bg: string
  border: string
  innerBorder: string
  text: string
  sigColor: string
  shadow: string
  glow: string
}> = {
  yellow: {
    bg: 'linear-gradient(145deg, #fffdf8 0%, #fdf6e7 100%)',
    border: '#d4af37',
    innerBorder: 'rgba(212, 175, 55, 0.35)',
    text: '#2c2214',
    sigColor: '#854d0e',
    shadow: 'rgba(184, 134, 11, 0.15)',
    glow: '0 0 28px rgba(212, 175, 55, 0.5), 0 12px 28px rgba(184, 134, 11, 0.25)',
  },
  blue: {
    bg: 'linear-gradient(145deg, #f8fbff 0%, #edf5fd 100%)',
    border: '#a3c4e8',
    innerBorder: 'rgba(16, 80, 160, 0.2)',
    text: '#0f2942',
    sigColor: '#1050a0',
    shadow: 'rgba(16, 80, 160, 0.15)',
    glow: '0 0 28px rgba(16, 80, 160, 0.45), 0 12px 28px rgba(16, 80, 160, 0.25)',
  },
  pink: {
    bg: 'linear-gradient(145deg, #fffbfc 0%, #fdf0f4 100%)',
    border: '#e8b4c4',
    innerBorder: 'rgba(180, 60, 90, 0.2)',
    text: '#3b121e',
    sigColor: '#9f1239',
    shadow: 'rgba(190, 18, 60, 0.15)',
    glow: '0 0 28px rgba(225, 29, 72, 0.45), 0 12px 28px rgba(190, 18, 60, 0.25)',
  },
  green: {
    bg: 'linear-gradient(145deg, #f9fdfa 0%, #eef8f2 100%)',
    border: '#a3d9b8',
    innerBorder: 'rgba(20, 90, 50, 0.2)',
    text: '#0d2e1b',
    sigColor: '#15803d',
    shadow: 'rgba(21, 128, 61, 0.15)',
    glow: '0 0 28px rgba(34, 197, 94, 0.45), 0 12px 28px rgba(21, 128, 61, 0.25)',
  },
  white: {
    bg: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
    border: '#cbd5e1',
    innerBorder: 'rgba(100, 116, 139, 0.2)',
    text: '#1e293b',
    sigColor: '#334155',
    shadow: 'rgba(0, 0, 0, 0.12)',
    glow: '0 0 28px rgba(148, 163, 184, 0.45), 0 12px 28px rgba(0, 0, 0, 0.18)',
  },
}

interface Props {
  note: GuestbookNote
  isMine?: boolean
  showStatusBadge?: boolean
  onClick: () => void
}

export function GuestbookNoteThumb({ note, isMine, showStatusBadge, onClick }: Props) {
  const [hovered, setHovered] = useState(false)
  const theme = COLOR_THEMES[note.colorPreset] ?? COLOR_THEMES.yellow!
  const isPinned = Boolean(note.isPinned)

  const formattedDate = new Date(note.createdAt).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  const renderStatusBadge = () => {
    const status = note.status ?? 'approved'
    if (status === 'pending') {
      return (
        <div style={{ ...styles.myBadge, background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 3px 10px rgba(245, 158, 11, 0.45)' }}>
          ⏳ Đang chờ duyệt
        </div>
      )
    }
    if (status === 'rejected') {
      return (
        <div style={{ ...styles.myBadge, background: 'linear-gradient(135deg, #f43f5e, #e11d48)', boxShadow: '0 3px 10px rgba(225, 29, 72, 0.45)' }}>
          ❌ Từ chối
        </div>
      )
    }
    if (showStatusBadge || isMine) {
      return (
        <div style={{ ...styles.myBadge, background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 3px 10px rgba(16, 185, 129, 0.4)' }}>
          ✅ Đã duyệt
        </div>
      )
    }
    return null
  }

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...styles.cardWrapper,
        width: isPinned ? '285px' : '265px',
        minHeight: isPinned ? '245px' : '230px',
        transform: hovered
          ? 'translateY(-6px) scale(1.02)'
          : `rotate(${note.rotation * 0.3}deg)`, // Minimal subtle stately tilt
        zIndex: hovered ? 20 : isPinned ? 10 : 1,
      }}
      title="Nhấn để xem chi tiết thiệp chúc mừng"
    >
      {/* Outer Card with Gold Foil Border */}
      <div
        style={{
          ...styles.card,
          background: theme.bg,
          borderColor: note.status === 'pending'
            ? '#f59e0b'
            : note.status === 'rejected'
            ? '#f43f5e'
            : isMine
            ? '#f59e0b'
            : isPinned
            ? '#d4af37'
            : theme.border,
          borderWidth: isPinned || isMine || showStatusBadge ? '2px' : '1.5px',
          boxShadow: hovered
            ? `0 24px 48px ${theme.shadow}, 0 8px 16px rgba(0,0,0,0.1)`
            : isPinned
            ? theme.glow
            : note.status === 'pending'
            ? `0 0 0 3px rgba(245, 158, 11, 0.35), 0 12px 28px rgba(245, 158, 11, 0.2)`
            : isMine
            ? `0 0 0 3px rgba(245, 158, 11, 0.5), 0 12px 28px rgba(245, 158, 11, 0.2)`
            : `0 8px 24px ${theme.shadow}, 0 2px 6px rgba(0,0,0,0.04)`,
        }}
      >
        {/* Inner Filigree Inset Frame */}
        <div
          style={{
            ...styles.innerFrame,
            borderColor: isPinned ? 'rgba(212, 175, 55, 0.5)' : theme.innerBorder,
          }}
        >
          {/* Status Badge */}
          {renderStatusBadge()}

          {/* Main Commemorative Message Content */}
          <p style={{ ...styles.content, color: theme.text }}>
            "{note.content}"
          </p>

          {/* Gold Divider Line & Footer with Date + Signature */}
          <div style={styles.footerRow}>
            <div style={styles.goldDivider} />
            <div style={styles.footerMeta}>
              <span style={styles.dateText}>
                {formattedDate}
              </span>
              {note.signature && (
                <div style={{ ...styles.signature, color: theme.sigColor }}>
                  — {note.signature}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  cardWrapper: {
    position: 'relative',
    transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)',
    cursor: 'pointer',
    userSelect: 'none',
    boxSizing: 'border-box',
    flexShrink: 0,
  },
  card: {
    width: '100%',
    height: '100%',
    padding: '10px',
    borderRadius: '10px',
    borderStyle: 'solid',
    boxSizing: 'border-box',
    position: 'relative',
    transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
  },
  innerFrame: {
    width: '100%',
    height: '100%',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderRadius: '6px',
    padding: '18px 14px 14px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    boxSizing: 'border-box',
    position: 'relative',
  },
  myBadge: {
    position: 'absolute',
    top: '-16px',
    right: '8px',
    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: 700,
    padding: '3px 10px',
    borderRadius: '12px',
    boxShadow: '0 3px 8px rgba(245, 158, 11, 0.4)',
    letterSpacing: '0.3px',
    zIndex: 5,
  },
  content: {
    margin: '4px 0 16px',
    fontSize: '15.5px',
    lineHeight: '1.6',
    fontFamily: '"Lora", Georgia, serif',
    fontStyle: 'italic',
    fontWeight: 500,
    display: '-webkit-box',
    WebkitLineClamp: 5,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    wordBreak: 'break-word',
    textAlign: 'center',
  },
  footerRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginTop: 'auto',
  },
  goldDivider: {
    height: '1px',
    background: 'linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.45), transparent)',
    width: '85%',
    margin: '0 auto',
  },
  footerMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: '4px 8px',
    width: '100%',
  },
  dateText: {
    fontSize: '11px',
    color: '#8a7a60',
    fontFamily: '"Be Vietnam Pro", sans-serif',
    opacity: 0.85,
    flexShrink: 0,
    marginBottom: '1px',
  },
  signature: {
    textAlign: 'right',
    fontSize: '14px',
    fontWeight: 700,
    fontFamily: '"Playfair Display", "Be Vietnam Pro", serif',
    letterSpacing: '0.2px',
    wordBreak: 'break-word',
    whiteSpace: 'normal',
    lineHeight: '1.35',
    marginLeft: 'auto',
  },
}
