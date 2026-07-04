import { useState } from 'react'
import { useDraftStore } from '../store.js'
import { publish, saveDraft, checkApi, ApiError } from '../api.js'
import type { Content } from '@vm/shared'

const API_BASE = (import.meta.env['VITE_API_URL'] ?? '').replace(/\/+$/, '')

type PublishStep = 'idle' | 'checking' | 'saving' | 'verifying' | 'done' | 'error'

export function Publish() {
  const content = useDraftStore((s) => s.content)
  const dirty = useDraftStore((s) => s.dirty)
  const markClean = useDraftStore((s) => s.markClean)
  const [step, setStep] = useState<PublishStep>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null)
  const [verifyInfo, setVerifyInfo] = useState<string | null>(null)

  if (!content) return <div style={styles.center}>Đang tải...</div>

  const stats = getSummary(content)

  const handleCheckApi = async () => {
    setStep('checking')
    const ok = await checkApi()
    setApiAvailable(ok)
    setStep('idle')
  }

  const handlePublish = async () => {
    setStep('saving')
    setErrorMsg('')
    try {
      const snapshot: Content = { ...content, updatedAt: new Date().toISOString() }
      await publish(snapshot)
      markClean()
      // Verify by reading back from /api/content
      setStep('verifying')
      try {
        const res = await fetch(`${API_BASE}/api/content`, { signal: AbortSignal.timeout(5000) })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const published = await res.json() as { rooms?: unknown[]; updatedAt?: string }
        const roomCount = Array.isArray(published.rooms) ? published.rooms.length : '?'
        setVerifyInfo(`${roomCount} phòng — cập nhật lúc ${published.updatedAt ? new Date(published.updatedAt as string).toLocaleTimeString('vi') : 'vừa xong'}`)
      } catch {
        setVerifyInfo(null) // publish ok but can't verify — still show success
      }
      setStep('done')
    } catch (err) {
      setStep('error')
      setErrorMsg(formatPublishError(err, content))
    }
  }

  const handleExport = () => {
    const snapshot: Content = { ...content, updatedAt: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `content-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    markClean()
  }

  const handleSaveDraft = async () => {
    setStep('saving')
    try {
      await saveDraft(content)
      markClean()
      setStep('idle')
    } catch (err) {
      setStep('error')
      setErrorMsg(String(err))
    }
  }

  const busy = step === 'checking' || step === 'saving' || step === 'verifying'

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <h1 style={styles.title}>Xuất bản</h1>
        <p style={styles.sub}>Kiểm tra nội dung và đẩy lên hệ thống</p>
      </div>

      {/* Summary */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Tóm tắt nội dung</div>
        <div style={styles.summaryGrid}>
          <SummaryRow label="Tổng số thời kỳ" value={stats.periods} />
          <SummaryRow label="Tổng số phòng" value={stats.rooms} />
          <SummaryRow label="Slot đã gán / tổng" value={`${stats.assigned} / ${stats.total}`} ok={stats.assigned === stats.total} />
          <SummaryRow label="Số ảnh trong thư viện" value={stats.items} />
          <SummaryRow label="Slot còn trống" value={stats.total - stats.assigned} warn={stats.total - stats.assigned > 0} />
          <SummaryRow label="Trạng thái draft" value={dirty ? 'Có thay đổi chưa lưu' : 'Đã đồng bộ'} warn={dirty} />
        </div>
      </div>

      {/* API status */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Kết nối Worker API</div>
        <div style={{ ...styles.apiRow, flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ fontSize: '13px', color: '#9a9080' }}>
              {apiAvailable === null && 'Chưa kiểm tra kết nối'}
              {apiAvailable === true && <span style={{ color: '#5ac85a' }}>✓ Kết nối thành công — sẵn sàng xuất bản lên R2</span>}
              {apiAvailable === false && <span style={{ color: '#c85a5a' }}>✗ Không kết nối được Worker API — chỉ có thể xuất file JSON</span>}
            </div>
            <button style={styles.checkBtn} onClick={handleCheckApi} disabled={busy}>
              {step === 'checking' ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}
            </button>
          </div>
          <div style={{ fontSize: '11px', color: '#4a3a28', fontFamily: 'monospace', padding: '6px 10px', background: 'rgba(0,0,0,0.2)', borderRadius: '5px', width: '100%', boxSizing: 'border-box' }}>
            {API_BASE
              ? <>VITE_API_URL = <span style={{ color: '#c8a85a' }}>{API_BASE}</span></>
              : <span style={{ color: '#c85a5a' }}>⚠ VITE_API_URL chưa được set — cần set env var này trong Cloudflare Pages</span>
            }
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Thao tác</div>
        <div style={styles.actions}>
          <ActionCard
            icon="💾"
            title="Lưu draft lên API"
            desc="Lưu nháp lên Worker để tiếp tục sau hoặc chia sẻ với người khác."
            btnLabel="Lưu draft"
            disabled={busy || apiAvailable !== true}
            onClick={handleSaveDraft}
          />
          <ActionCard
            icon="🚀"
            title="Xuất bản chính thức"
            desc="Ghi content.json lên R2. Site khách sẽ cập nhật ngay sau đó."
            btnLabel="Xuất bản ngay"
            primary
            disabled={busy || apiAvailable !== true}
            onClick={handlePublish}
          />
          <ActionCard
            icon="📥"
            title="Xuất file JSON"
            desc="Tải về content.json để dùng offline hoặc deploy lên Nginx nội bộ."
            btnLabel="Tải về JSON"
            disabled={busy}
            onClick={handleExport}
          />
        </div>
      </div>

      {/* Status messages */}
      {step === 'done' && (
        <div style={styles.successBox}>
          ✓ Xuất bản thành công!
          {verifyInfo
            ? <> Đã xác nhận R2 nhận được: <strong>{verifyInfo}</strong>. Site khách sẽ cập nhật ngay.</>
            : <> Đã ghi lên R2. Nếu site vẫn chưa đổi, kiểm tra lại <code>VITE_ASSET_BASE_URL</code> của web app.</>
          }
        </div>
      )}
      {step === 'error' && (
        <div style={{ ...styles.errorBox, whiteSpace: 'pre-line' }}>
          ⚠ {errorMsg}
          {!API_BASE && <div style={{ marginTop: '8px', fontSize: '12px', opacity: 0.8 }}>Hint: VITE_API_URL chưa được set — publish không thể gọi tới Worker.</div>}
        </div>
      )}
      {step === 'verifying' && (
        <div style={styles.infoBox}>⏳ Đang xác nhận dữ liệu trên R2...</div>
      )}
      {(step === 'checking' || step === 'saving') && (
        <div style={styles.infoBox}>⏳ Đang xử lý...</div>
      )}
    </div>
  )
}

function SummaryRow({ label, value, ok, warn }: { label: string; value: string | number; ok?: boolean; warn?: boolean }) {
  return (
    <div style={styles.summaryRow}>
      <span style={styles.summaryLabel}>{label}</span>
      <span style={{ ...styles.summaryValue, ...(ok ? { color: '#5ac85a' } : warn ? { color: '#c8a85a' } : {}) }}>
        {value}
      </span>
    </div>
  )
}

function ActionCard({ icon, title, desc, btnLabel, primary, disabled, onClick }: {
  icon: string; title: string; desc: string; btnLabel: string;
  primary?: boolean; disabled?: boolean; onClick: () => void
}) {
  return (
    <div style={{ ...styles.actionCard, ...(primary ? styles.actionCardPrimary : {}) }}>
      <div style={styles.actionIcon}>{icon}</div>
      <div style={styles.actionTitle}>{title}</div>
      <div style={styles.actionDesc}>{desc}</div>
      <button
        style={{ ...styles.actionBtn, ...(primary ? styles.actionBtnPrimary : {}), opacity: disabled ? 0.5 : 1 }}
        disabled={disabled}
        onClick={onClick}
      >
        {btnLabel}
      </button>
    </div>
  )
}

function formatPublishError(err: unknown, content: Content): string {
  if (!(err instanceof ApiError)) return String(err)

  if (err.status === 422) {
    const body = err.tryParseJson() as { error?: string } | null
    const raw = body?.error ?? err.body
    // Extract zod-style "[path] message" lines
    const lines = raw.split('\n')
    const issues: string[] = []
    for (const line of lines) {
      const m = line.match(/\[rooms\.(\d+)\.([^\]]+)\]\s+(.+)/)
      if (m && m[1] && m[2] && m[3]) {
        const idx = parseInt(m[1])
        const field = m[2]
        const msg = m[3]
        const roomTitle = content.rooms[idx]?.title ?? `Phòng #${idx + 1}`
        const fieldLabel: Record<string, string> = {
          entryViewpointId: 'điểm đứng mặc định',
          viewpoints: 'danh sách điểm đứng',
          title: 'tên phòng',
          slug: 'slug',
        }
        issues.push(`• Phòng "${roomTitle}": ${(field != null ? fieldLabel[field] : null) ?? field} — ${msg}`)
      } else if (/\[.+\]/.test(line)) {
        issues.push(`• ${line.trim()}`)
      }
    }
    if (issues.length > 0) {
      return `Dữ liệu chưa hợp lệ (422):\n${issues.join('\n')}`
    }
    return `Lỗi validation (422): ${raw}`
  }

  if (err.status === 0 || err.status === undefined) {
    return 'Không thể kết nối tới Worker API. Kiểm tra VITE_API_URL và Worker đã deploy chưa.'
  }

  return `Lỗi ${err.status}: ${err.body}`
}

function getSummary(content: Content) {
  const allSlots = content.rooms.flatMap((r) => r.slots)
  return {
    periods: content.periods.length,
    rooms: content.rooms.length,
    items: content.items.length,
    total: allSlots.length,
    assigned: allSlots.filter((s) => s.itemId).length,
  }
}

const styles: Record<string, React.CSSProperties> = {
  root: { padding: '24px', overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: '24px' },
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6a5a40' },
  header: { borderBottom: '1px solid #2a1e10', paddingBottom: '16px' },
  title: { fontSize: '22px', fontWeight: 700, color: '#f0e8d8' },
  sub: { fontSize: '13px', color: '#6a5a40', marginTop: '4px' },
  section: { display: 'flex', flexDirection: 'column', gap: '12px' },
  sectionTitle: { fontSize: '11px', fontWeight: 600, color: '#6a5a40', textTransform: 'uppercase', letterSpacing: '0.06em' },
  summaryGrid: { display: 'flex', flexDirection: 'column', gap: '1px', border: '1px solid #2a1e10', borderRadius: '10px', overflow: 'hidden' },
  summaryRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: 'rgba(255,255,255,0.02)' },
  summaryLabel: { fontSize: '13px', color: '#9a9080' },
  summaryValue: { fontSize: '13px', fontWeight: 600, color: '#f0e8d8' },
  apiRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid #2a1e10', borderRadius: '10px' },
  checkBtn: { padding: '7px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid #3a2e1e', borderRadius: '6px', color: '#c8a85a', fontSize: '12px', cursor: 'pointer' },
  actions: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' },
  actionCard: { background: 'rgba(255,255,255,0.04)', border: '1px solid #2a1e10', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' },
  actionCardPrimary: { border: '1px solid rgba(200,168,90,0.3)', background: 'rgba(200,168,90,0.05)' },
  actionIcon: { fontSize: '28px' },
  actionTitle: { fontSize: '15px', fontWeight: 700, color: '#f0e8d8' },
  actionDesc: { fontSize: '12px', color: '#6a5a40', lineHeight: 1.5, flex: 1 },
  actionBtn: { marginTop: '4px', padding: '9px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid #3a2e1e', borderRadius: '7px', color: '#c8a85a', fontSize: '13px', cursor: 'pointer' },
  actionBtnPrimary: { background: 'rgba(200,168,90,0.15)', borderColor: '#c8a85a', fontWeight: 600 },
  successBox: { padding: '14px 18px', background: 'rgba(90,200,90,0.1)', border: '1px solid #5ac85a', borderRadius: '8px', color: '#b0ffb0', fontSize: '14px' },
  errorBox: { padding: '14px 18px', background: 'rgba(200,90,90,0.1)', border: '1px solid #c85a5a', borderRadius: '8px', color: '#ffb0b0', fontSize: '14px' },
  infoBox: { padding: '14px 18px', background: 'rgba(200,168,90,0.08)', border: '1px solid #5a4a30', borderRadius: '8px', color: '#c8a85a', fontSize: '14px' },
}
