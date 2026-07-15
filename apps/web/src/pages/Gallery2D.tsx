import { useState } from 'react'
import type { ContentIndex, DocumentIndexItem, DocumentItem, RoomData } from '@vm/shared'
import { resolveDocumentImageVariantUrl } from '@vm/shared'
import { fetchDocumentDetails } from '../content/documents.js'
import { InfoModal } from '../ui/InfoModal.js'
import { brand, glassPanel } from '../ui/theme.js'

interface Props {
  content: ContentIndex
  roomData: RoomData
  currentRoomId: string
  onNavigate: (roomId: string) => void
  onBack: () => void
}

export function Gallery2D({ content, roomData, currentRoomId, onNavigate, onBack }: Props) {
  const [selectedDocuments, setSelectedDocuments] = useState<DocumentItem[]>([])
  const room = roomData
  const documentMap = roomData.documents

  const seen = new Set<string>()
  const assignedDocuments = (room?.slots ?? [])
    .flatMap((s) => s.documentIds ?? [])
    .map((id) => documentMap[id])
    .filter((document): document is DocumentIndexItem => !!document && !seen.has(document.id) && (seen.add(document.id), true))

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <button style={styles.back} onClick={onBack} title="Về trang chủ" aria-label="Về trang chủ"><HomeIcon /><span>Trang chủ</span></button>
        <h2 style={styles.title}>{room?.title}</h2>
      </div>

      {content.rooms.length > 1 && (
        <div style={styles.tabs}>
          {content.rooms.map((r) => {
            const period = content.periods.find((p) => p.id === r.periodId)
            const slotCount = r.id === currentRoomId ? roomData.slots.filter((s) => (s.documentIds ?? []).length > 0).length : 0
            return (
              <button key={r.id} style={{ ...styles.tab, ...(r.id === currentRoomId ? styles.tabActive : {}) }} onClick={() => onNavigate(r.id)}>
                <span style={styles.tabName}>{r.title}</span>
                {period && <span style={styles.tabPeriod}>{period.title}</span>}
                {slotCount > 0 && <span style={styles.tabCount}>{slotCount} slot</span>}
              </button>
            )
          })}
        </div>
      )}

      <div style={styles.grid}>
        {assignedDocuments.length === 0 ? (
          <div style={styles.empty}>Phòng này chưa có tư liệu nào được trưng bày.</div>
        ) : (
          assignedDocuments.map((document) => (
            <button key={document.id} style={styles.card} onClick={() => { void fetchDocumentDetails([document]).then(setSelectedDocuments) }}>
              <img src={resolveDocumentImageVariantUrl(document.documentKey, document.viewerImageId, 'thumb') ?? ''} alt="Tư liệu" style={styles.thumb} />
              <div style={styles.cardBody}>
                <div style={styles.cardTitle}>{document.mediaType === 'iframe' ? 'Tài liệu nhúng' : document.mediaType === 'youtube' ? 'Video' : document.mediaType === 'external' ? 'Link ngoài' : 'Tư liệu ảnh'}</div>
              </div>
            </button>
          ))
        )}
      </div>

      {selectedDocuments.length > 0 && <InfoModal documents={selectedDocuments} onClose={() => setSelectedDocuments([])} />}
    </div>
  )
}

function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M3 10.8 12 3l9 7.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 9.5V20h13V9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 20v-6h5v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { width: '100%', height: '100%', overflowY: 'auto', background: brand.sky, padding: '0 0 32px', fontFamily: brand.fontFamily },
  header: { padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '16px', borderBottom: `1px solid ${brand.line}`, position: 'sticky', top: 0, background: 'rgba(255,255,255,0.92)', zIndex: 10 },
  back: { ...glassPanel, color: brand.blue, borderRadius: '8px', padding: '7px 13px', fontSize: '12px', cursor: 'pointer', fontWeight: 800, fontFamily: brand.fontFamily, display: 'inline-flex', alignItems: 'center', gap: '8px' },
  title: { fontSize: '20px', color: brand.text, fontWeight: 800 },
  tabs: { display: 'flex', gap: '8px', padding: '12px 24px', overflowX: 'auto' },
  tab: { border: `1px solid ${brand.line}`, borderRadius: '8px', background: '#ffffff', color: brand.text, padding: '9px 12px', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 160, cursor: 'pointer', textAlign: 'left' },
  tabActive: { borderColor: brand.blue, boxShadow: '0 0 0 2px rgba(16,80,160,0.12)' },
  tabName: { fontSize: '13px', fontWeight: 800 },
  tabPeriod: { fontSize: '11px', color: brand.muted },
  tabCount: { fontSize: '11px', color: brand.blue, fontWeight: 800 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16, padding: 24 },
  empty: { gridColumn: '1/-1', padding: 32, color: brand.muted, textAlign: 'center' },
  card: { border: `1px solid ${brand.line}`, borderRadius: '8px', background: '#ffffff', overflow: 'hidden', padding: 0, textAlign: 'left', cursor: 'pointer', color: brand.text },
  thumb: { width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', display: 'block', background: '#dbe7f4' },
  cardBody: { padding: 12 },
  year: { color: brand.blue, fontWeight: 900, fontSize: 12, marginBottom: 4 },
  cardTitle: { fontWeight: 900, fontSize: 14, lineHeight: 1.35 },
  desc: { color: brand.muted, fontSize: 12, lineHeight: 1.5, marginTop: 6 },
}
