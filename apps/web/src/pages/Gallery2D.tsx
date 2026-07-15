import { useState } from 'react'
import type { Content, Item } from '@vm/shared'
import { InfoModal } from '../ui/InfoModal.js'
import { brand, glassPanel } from '../ui/theme.js'

interface Props {
  content: Content
  currentRoomId: string
  onNavigate: (roomId: string) => void
  onBack: () => void
}

export function Gallery2D({ content, currentRoomId, onNavigate, onBack }: Props) {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)

  const room = content.rooms.find((r) => r.id === currentRoomId)
  const itemMap = Object.fromEntries(content.items.map((i) => [i.id, i]))

  const seen = new Set<string>()
  const assignedItems = (room?.slots ?? [])
    .filter((s) => s.itemId)
    .map((s) => itemMap[s.itemId!])
    .filter((item): item is Item => !!item && !seen.has(item.id) && (seen.add(item.id), true))

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <button style={styles.back} onClick={onBack} title="Về trang chủ" aria-label="Về trang chủ"><HomeIcon /><span>Trang chủ</span></button>
        <h2 style={styles.title}>{room?.title}</h2>
      </div>

      {/* Room tabs */}
      {content.rooms.length > 1 && (
        <div style={styles.tabs}>
          {content.rooms.map((r) => {
            const period = content.periods.find((p) => p.id === r.periodId)
            const slotCount = r.slots.filter((s) => s.itemId).length
            return (
              <button
                key={r.id}
                style={{ ...styles.tab, ...(r.id === currentRoomId ? styles.tabActive : {}) }}
                onClick={() => onNavigate(r.id)}
              >
                <span style={styles.tabName}>{r.title}</span>
                {period && <span style={styles.tabPeriod}>{period.title}</span>}
                {slotCount > 0 && <span style={styles.tabCount}>{slotCount} ảnh</span>}
              </button>
            )
          })}
        </div>
      )}

      <div style={styles.grid}>
        {assignedItems.length === 0 ? (
          <div style={styles.empty}>Phòng này chưa có ảnh nào được trưng bày.</div>
        ) : (
          assignedItems.map((item) => (
            <button key={item.id} style={styles.card} onClick={() => setSelectedItem(item)}>
              <img src={item.thumbUrl} alt={item.title} style={styles.thumb} />
              <div style={styles.cardBody}>
                <div style={styles.year}>{item.year}</div>
                <div style={styles.cardTitle}>{item.title}</div>
                <div style={styles.desc}>{item.shortDesc}</div>
              </div>
            </button>
          ))
        )}
      </div>

      {selectedItem && (
        <InfoModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
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
  header: {
    padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '16px',
    borderBottom: `1px solid ${brand.line}`, position: 'sticky', top: 0,
    background: 'rgba(255,255,255,0.92)', zIndex: 10,
  },
  back: {
    ...glassPanel,
    color: brand.blue,
    borderRadius: '8px',
    padding: '7px 13px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 800,
    fontFamily: brand.fontFamily,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
  },
  title: { fontSize: '20px', color: brand.text, fontWeight: 800 },
  tabs: {
    display: 'flex', gap: '8px', padding: '12px 24px',
    borderBottom: `1px solid ${brand.line}`, flexWrap: 'wrap',
  },
  tab: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px',
    padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
    background: 'rgba(255,255,255,0.72)', border: `1px solid ${brand.line}`,
    transition: 'border-color 0.15s',
  },
  tabActive: { border: `1px solid ${brand.blue}`, background: 'rgba(16,80,160,0.1)' },
  tabName: { fontSize: '13px', color: brand.text, fontWeight: 700 },
  tabPeriod: { fontSize: '11px', color: brand.muted },
  tabCount: { fontSize: '11px', color: brand.blue, fontWeight: 800 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '16px', padding: '24px',
  },
  card: {
    background: '#ffffff', border: `1px solid ${brand.line}`,
    borderRadius: '8px', overflow: 'hidden', cursor: 'pointer',
    textAlign: 'left', display: 'flex', flexDirection: 'column',
    transition: 'border-color 0.15s',
  },
  thumb: { width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' },
  cardBody: { padding: '12px' },
  year: { fontSize: '11px', color: brand.blue, fontWeight: 800, marginBottom: '4px' },
  cardTitle: { fontSize: '14px', color: brand.text, fontWeight: 700, marginBottom: '6px' },
  desc: { fontSize: '12px', color: brand.muted, lineHeight: 1.5 },
  empty: { gridColumn: '1/-1', color: brand.muted, fontSize: '14px', padding: '40px', textAlign: 'center' },
}
