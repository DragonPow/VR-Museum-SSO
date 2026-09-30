import { useState } from 'react'
import { brand } from '../theme.js'

interface Props {
  onClose: () => void
  onSuccess: () => void
  eventTag?: string | undefined
}

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export function GuestbookFormModal({ onClose, onSuccess, eventTag }: Props) {
  const [content, setContent] = useState('')
  const [signature, setSignature] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || content.trim().length < 2) {
      setError('Vui lòng nhập lời chúc ít nhất 2 ký tự')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const visitorId = localStorage.getItem('visitor_id') || undefined
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

      if (data.noteId) {
        try {
          const stored = JSON.parse(localStorage.getItem('vm_my_guestbook_notes') || '[]') as string[]
          if (!stored.includes(data.noteId)) {
            stored.push(data.noteId)
            localStorage.setItem('vm_my_guestbook_notes', JSON.stringify(stored))
          }
        } catch {
          // ignore localStorage errors
        }
      }

      setSubmitted(true)
      setTimeout(() => {
        onSuccess()
      }, 2000)

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
          <div style={styles.successBox}>
            <div style={styles.successIcon}>🎉</div>
            <h3 style={styles.successTitle}>Cảm ơn bạn rất nhiều!</h3>
            <p style={styles.successText}>
              Lời nhắn của bạn đã được gửi thành công và đang chờ ban quản trị duyệt trước khi hiển thị lên tường lưu bút.
            </p>
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
  successBox: {
    padding: '40px 20px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  successIcon: {
    fontSize: '48px',
  },
  successTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 700,
    color: '#0f2e54',
  },
  successText: {
    margin: 0,
    fontSize: '14px',
    color: '#475569',
    lineHeight: '1.6',
    maxWidth: '360px',
  },
}
