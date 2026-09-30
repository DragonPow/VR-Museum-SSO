import { useState } from 'react'
import type { GuestbookNote } from '@vm/shared'
import { brand } from '../theme.js'
import { getOrCreateVisitorId, saveMyLocalNote } from './myWishesStorage.js'

interface Props {
  onClose: () => void
  onSuccess: (opts?: { viewMyWishes?: boolean }) => void
  eventTag?: string | undefined
}

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export function GuestbookFormModal({ onClose, onSuccess, eventTag }: Props) {
  const [content, setContent] = useState('')
  const [signature, setSignature] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [createdNote, setCreatedNote] = useState<GuestbookNote | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || content.trim().length < 2) {
      setError('Vui lòng nhập lời chúc ít nhất 2 ký tự')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const visitorId = getOrCreateVisitorId()
      const res = await fetch(`${API_BASE}/api/guestbook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          signature: signature.trim() || undefined,
          visitorId,
          eventTag: eventTag || undefined,
        }),
      })

      const data = await res.json() as { ok?: boolean; error?: string; message?: string; noteId?: string }

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Không thể gửi lưu bút lúc này. Vui lòng thử lại!')
      }

      const noteId = data.noteId || `gb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      const colorPresets: ('yellow' | 'pink' | 'green' | 'blue' | 'white')[] = ['yellow', 'pink', 'green', 'blue', 'white']
      const randomColor = colorPresets[Math.floor(Math.random() * colorPresets.length)]!

      const newNote: GuestbookNote = {
        id: noteId,
        content: content.trim(),
        signature: signature.trim() || null,
        colorPreset: randomColor,
        rotation: Math.round((Math.random() * 10 - 5) * 10) / 10,
        status: 'pending',
        createdAt: new Date().toISOString(),
        eventTag: eventTag || null,
        authorId: visitorId,
      }

      saveMyLocalNote(newNote)
      setCreatedNote(newNote)
      setSubmitted(true)

    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerIcon}>✍️</div>
          <div>
            <h2 style={styles.title}>Để lại Lưu Bút</h2>
            <p style={styles.subtitle}>Gửi lời chúc mừng kỷ niệm 50 năm thành lập</p>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {submitted ? (
          <div style={styles.successContainer}>
            <style>{`
              @keyframes popScale {
                0% { transform: scale(0.6) translateY(20px); opacity: 0; }
                60% { transform: scale(1.04) translateY(-4px); opacity: 1; }
                100% { transform: scale(1) translateY(0); opacity: 1; }
              }
              @keyframes stampDrop {
                0% { transform: scale(2.2) rotate(-30deg); opacity: 0; }
                70% { transform: scale(0.92) rotate(-6deg); opacity: 1; }
                100% { transform: scale(1) rotate(-8deg); opacity: 1; }
              }
              @keyframes pulseRing {
                0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.6); }
                70% { box-shadow: 0 0 0 14px rgba(245, 158, 11, 0); }
                100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
              }
            `}</style>

            <div style={styles.paperStage}>
              <div style={styles.successPaper}>
                <p style={styles.successPaperContent}>"{createdNote?.content ?? content}"</p>
                {(createdNote?.signature || signature) && (
                  <div style={styles.successPaperSig}>— {createdNote?.signature ?? signature}</div>
                )}
              </div>

              {/* Rubber Stamp showing pending status */}
              <div style={styles.pendingStamp}>
                <span style={{ fontSize: '13px' }}>⏳</span> ĐANG CHỜ DUYỆT
              </div>
            </div>

            <div style={styles.successTextGroup}>
              <h3 style={styles.successTitle}>Đã gửi lời chúc thành công! 🎉</h3>
              <p style={styles.successSubtext}>
                Lời nhắn của bạn đang nằm trong danh sách <strong>Đang chờ duyệt</strong> của Ban Quản Trị. Bạn có thể theo dõi trạng thái tại tab <strong>"Lời chúc của tôi"</strong>!
              </p>
            </div>

            <div style={styles.successActions}>
              <button
                style={styles.viewMyBtn}
                onClick={() => onSuccess({ viewMyWishes: true })}
              >
                👤 Xem trong "Lời chúc của tôi"
              </button>
              <button
                style={styles.doneBtn}
                onClick={() => onSuccess()}
              >
                ✕ Hoàn tất
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={styles.form}>
            {error && (
              <div style={styles.errorBanner}>
                <span>⚠️ {error}</span>
              </div>
            )}

            {/* Note Content */}
            <div style={styles.field}>
              <div style={styles.labelRow}>
                <label style={styles.label}>Lời chúc / Cảm nghĩ của bạn <span style={{ color: '#ef4444' }}>*</span></label>
                <span style={styles.charCount}>{content.length}/300</span>
              </div>
              <textarea
                style={styles.textarea}
                rows={4}
                maxLength={300}
                placeholder="Nhập lời chúc, cảm nghĩ hoặc kỷ niệm của bạn về công ty..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {/* Signature */}
            <div style={styles.field}>
              <div style={styles.labelRow}>
                <label style={styles.label}>Ký tên / Người gửi</label>
                <span style={styles.charCount}>{signature.length}/100</span>
              </div>
              <input
                type="text"
                style={styles.input}
                maxLength={100}
                placeholder="Ví dụ: Nguyễn Văn A - Ban Kỹ Thuật"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Live Note Preview */}
            {content.trim() && (
              <div style={styles.previewContainer}>
                <div style={styles.previewLabel}>Xem trước tờ note của bạn:</div>
                <div style={styles.previewPaper}>
                  <p style={styles.previewText}>{content}</p>
                  {signature.trim() && (
                    <div style={styles.previewSig}>— {signature}</div>
                  )}
                </div>
              </div>
            )}

            {/* Buttons */}
            <div style={styles.btnRow}>
              <button
                type="button"
                style={styles.cancelBtn}
                onClick={onClose}
                disabled={loading}
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                style={{ ...styles.submitBtn, opacity: loading ? 0.7 : 1 }}
                disabled={loading}
              >
                {loading ? 'Đang gửi...' : 'Gửi lời chúc 🚀'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(5, 18, 38, 0.7)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
    padding: '20px',
  },
  modal: {
    width: '100%',
    maxWidth: '480px',
    background: '#ffffff',
    borderRadius: '16px',
    boxShadow: '0 25px 50px -12px rgba(8, 47, 109, 0.35)',
    border: '1px solid rgba(16, 80, 160, 0.15)',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    position: 'relative',
    borderBottom: '1px solid #f1f5f9',
    paddingBottom: '16px',
  },
  headerIcon: {
    fontSize: '28px',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 700,
    color: '#0f2e54',
  },
  subtitle: {
    margin: '2px 0 0',
    fontSize: '12px',
    color: '#64748b',
  },
  closeBtn: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: 'none',
    background: '#f1f5f9',
    color: '#64748b',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  errorBanner: {
    padding: '10px 14px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    color: '#dc2626',
    fontSize: '13px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#334155',
  },
  charCount: {
    fontSize: '11px',
    color: '#94a3b8',
  },
  textarea: {
    padding: '12px 14px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
    lineHeight: '1.5',
    color: '#1e293b',
    fontFamily: '"Be Vietnam Pro", sans-serif',
    outline: 'none',
    resize: 'vertical',
    minHeight: '90px',
  },
  input: {
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
    color: '#1e293b',
    fontFamily: '"Be Vietnam Pro", sans-serif',
    outline: 'none',
  },
  previewContainer: {
    background: '#f8fafc',
    borderRadius: '8px',
    padding: '12px',
    border: '1px dashed #cbd5e1',
  },
  previewLabel: {
    fontSize: '11px',
    color: '#64748b',
    marginBottom: '8px',
    fontWeight: 600,
  },
  previewPaper: {
    background: '#fef9c3',
    border: '1px solid #fef08a',
    borderRadius: '4px',
    padding: '14px',
    boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
    transform: 'rotate(-1deg)',
  },
  previewText: {
    margin: 0,
    fontSize: '16px',
    color: '#713f12',
    fontFamily: '"Mali", "Patrick Hand", "Itim", cursive, sans-serif',
    lineHeight: '1.45',
    whiteSpace: 'pre-wrap',
  },
  previewSig: {
    textAlign: 'right',
    marginTop: '8px',
    fontSize: '18px',
    fontWeight: 700,
    color: '#713f12',
    fontFamily: '"Charm", "Charmonman", cursive, sans-serif',
  },

  btnRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '8px',
  },
  cancelBtn: {
    padding: '10px 18px',
    background: '#f1f5f9',
    border: 'none',
    borderRadius: '8px',
    color: '#475569',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  submitBtn: {
    padding: '10px 22px',
    background: brand.blue,
    border: 'none',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(16, 80, 160, 0.3)',
  },
  successContainer: {
    padding: '16px 10px 10px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
    animation: 'popScale 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  paperStage: {
    position: 'relative',
    width: '100%',
    maxWidth: '320px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '10px 0',
  },
  successPaper: {
    background: 'linear-gradient(145deg, #fffdf8 0%, #fdf6e7 100%)',
    border: '2px solid #d4af37',
    borderRadius: '12px',
    padding: '20px 18px',
    boxShadow: '0 12px 28px rgba(184, 134, 11, 0.25), 0 4px 10px rgba(0,0,0,0.06)',
    width: '100%',
    boxSizing: 'border-box',
    transform: 'rotate(-2deg)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  successPaperContent: {
    margin: 0,
    fontSize: '15px',
    lineHeight: '1.55',
    color: '#2c2214',
    fontFamily: '"Lora", Georgia, serif',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  successPaperSig: {
    textAlign: 'right',
    fontSize: '14px',
    fontWeight: 700,
    color: '#854d0e',
    fontFamily: '"Playfair Display", serif',
  },
  pendingStamp: {
    position: 'absolute',
    bottom: '-8px',
    right: '12px',
    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: 800,
    padding: '6px 14px',
    borderRadius: '20px',
    boxShadow: '0 4px 14px rgba(245, 158, 11, 0.45)',
    animation: 'stampDrop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both, pulseRing 2s infinite',
    letterSpacing: '0.5px',
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    border: '2px solid #ffffff',
  },
  successTextGroup: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  successTitle: {
    margin: 0,
    fontSize: '19px',
    fontWeight: 800,
    color: '#0f2e54',
  },
  successSubtext: {
    margin: 0,
    fontSize: '13px',
    color: '#475569',
    lineHeight: '1.55',
  },
  successActions: {
    display: 'flex',
    gap: '10px',
    width: '100%',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: '4px',
  },
  viewMyBtn: {
    padding: '11px 20px',
    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '20px',
    fontSize: '13.5px',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.35)',
    transition: 'transform 0.15s ease',
  },
  doneBtn: {
    padding: '11px 20px',
    background: '#f1f5f9',
    color: '#475569',
    border: '1px solid #cbd5e1',
    borderRadius: '20px',
    fontSize: '13.5px',
    fontWeight: 600,
    cursor: 'pointer',
  },
}
