import { useEffect } from 'react'
import type { GuestbookNote } from '@vm/shared'

const COLOR_THEMES: Record<string, {
  bg: string
  border: string
  innerBorder: string
  text: string
  sigColor: string
  dateColor: string
  badgeBg: string
  shadow: string
}> = {
  yellow: {
    bg: 'linear-gradient(145deg, #fffdf8 0%, #fdf6e7 100%)',
    border: '#d4af37',
    innerBorder: 'rgba(212, 175, 55, 0.4)',
    text: '#2c2214',
    sigColor: '#854d0e',
    dateColor: '#92400e',
    badgeBg: 'linear-gradient(135deg, #d4af37, #b8860b)',
    shadow: 'rgba(184, 134, 11, 0.25)',
  },
  blue: {
    bg: 'linear-gradient(145deg, #f8fbff 0%, #edf5fd 100%)',
    border: '#a3c4e8',
    innerBorder: 'rgba(16, 80, 160, 0.25)',
    text: '#0f2942',
    sigColor: '#1050a0',
    dateColor: '#1e40af',
    badgeBg: 'linear-gradient(135deg, #1050a0, #082f6d)',
    shadow: 'rgba(16, 80, 160, 0.25)',
  },
  pink: {
    bg: 'linear-gradient(145deg, #fffbfc 0%, #fdf0f4 100%)',
    border: '#e8b4c4',
    innerBorder: 'rgba(180, 60, 90, 0.25)',
    text: '#3b121e',
    sigColor: '#9f1239',
    dateColor: '#be123c',
    badgeBg: 'linear-gradient(135deg, #be123c, #881337)',
    shadow: 'rgba(190, 18, 60, 0.25)',
  },
  green: {
    bg: 'linear-gradient(145deg, #f9fdfa 0%, #eef8f2 100%)',
    border: '#a3d9b8',
    innerBorder: 'rgba(20, 90, 50, 0.25)',
    text: '#0d2e1b',
    sigColor: '#15803d',
    dateColor: '#166534',
    badgeBg: 'linear-gradient(135deg, #15803d, #14532d)',
    shadow: 'rgba(21, 128, 61, 0.25)',
  },
  white: {
    bg: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
    border: '#cbd5e1',
    innerBorder: 'rgba(100, 116, 139, 0.25)',
    text: '#1e293b',
    sigColor: '#334155',
    dateColor: '#475569',
    badgeBg: 'linear-gradient(135deg, #475569, #1e293b)',
    shadow: 'rgba(0, 0, 0, 0.25)',
  },
}

interface Props {
  note: GuestbookNote
  onClose: () => void
}

export function GuestbookDetailModal({ note, onClose }: Props) {
  const theme = COLOR_THEMES[note.colorPreset] ?? COLOR_THEMES.yellow!
  const isPinned = Boolean(note.isPinned)

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        style={{
          ...styles.outerCard,
          background: theme.bg,
          borderColor: isPinned ? '#d4af37' : theme.border,
          boxShadow: `0 30px 80px ${theme.shadow}, 0 10px 30px rgba(0,0,0,0.35)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Inner Gold Inset Frame */}
        <div
          style={{
            ...styles.innerFrame,
            borderColor: isPinned ? 'rgba(212, 175, 55, 0.6)' : theme.innerBorder,
          }}
        >
          {/* Close button */}
          <button style={styles.closeBtn} onClick={onClose} title="Đóng">
            ✕
          </button>

          {/* Note Content */}
          <div style={styles.body}>
            <p style={{ ...styles.contentText, color: theme.text }}>
              "{note.content}"
            </p>
          </div>

          {/* Gold Decorative Divider */}
          <div style={styles.goldDivider} />

          {/* Footer with date & signature */}
          <div style={styles.footer}>
            <div style={{ ...styles.date, color: theme.dateColor }}>
              {new Date(note.createdAt).toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
            </div>
            {note.signature && (
              <div style={{ ...styles.signature, color: theme.sigColor }}>
                — {note.signature}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(5, 12, 24, 0.75)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '24px',
    animation: 'fadein 0.2s ease',
  },
  outerCard: {
    position: 'relative',
    width: '100%',
    maxWidth: '540px',
    maxHeight: '85vh',
    borderRadius: '12px',
    borderWidth: '2px',
    borderStyle: 'solid',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    animation: 'popin 0.25s cubic-bezier(0.25, 1, 0.5, 1)',
    boxSizing: 'border-box',
  },
  innerFrame: {
    width: '100%',
    height: '100%',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderRadius: '8px',
    padding: '32px 28px 24px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    boxSizing: 'border-box',
    position: 'relative',
    overflowY: 'auto',
  },
  closeBtn: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: '1px solid rgba(0,0,0,0.1)',
    background: 'rgba(255,255,255,0.7)',
    color: '#4a3e2e',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s',
    zIndex: 10,
  },
  headerEmblem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '16px',
  },
  emblemIcon: {
    fontSize: '28px',
    marginBottom: '4px',
  },
  emblemTitle: {
    fontSize: '13px',
    fontWeight: 800,
    color: '#854d0e',
    letterSpacing: '1.5px',
    fontFamily: '"Playfair Display", "Be Vietnam Pro", serif',
    textTransform: 'uppercase',
  },
  emblemSubtitle: {
    fontSize: '11px',
    color: '#8a7a60',
    letterSpacing: '2px',
    fontFamily: '"Playfair Display", serif',
    marginTop: '2px',
  },
  body: {
    flex: 1,
    padding: '12px 0 20px',
    overflowY: 'auto',
    textAlign: 'center',
  },
  contentText: {
    margin: 0,
    fontSize: '20px',
    lineHeight: '1.7',
    fontFamily: '"Lora", Georgia, serif',
    fontStyle: 'italic',
    fontWeight: 500,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  goldDivider: {
    height: '1px',
    background: 'linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.6), transparent)',
    width: '80%',
    margin: '0 auto 16px',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: '6px 12px',
    paddingTop: '8px',
  },
  date: {
    fontSize: '12.5px',
    fontWeight: 600,
    opacity: 0.95,
    fontFamily: '"Be Vietnam Pro", sans-serif',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flexShrink: 0,
  },
  signature: {
    fontSize: '18px',
    fontWeight: 700,
    fontFamily: '"Playfair Display", "Be Vietnam Pro", serif',
    letterSpacing: '0.3px',
    wordBreak: 'break-word',
    whiteSpace: 'normal',
    lineHeight: '1.35',
    textAlign: 'right',
    marginLeft: 'auto',
  },
}
