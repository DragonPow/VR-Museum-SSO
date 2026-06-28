import { useState } from 'react'
import type { Content, Item } from '@vm/shared'
import { InfoModal } from '../ui/InfoModal.js'

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
        <button style={styles.back} onClick={onBack}>← Trang chủ</button>
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

const styles: Record<string, React.CSSProperties> = {
  wrap: { width: '100%', height: '100%', overflowY: 'auto', background: '#1a1410', padding: '0 0 32px' },
  header: {
    padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '16px',
    borderBottom: '1px solid #3a2e1e', position: 'sticky', top: 0,
    background: '#1a1410', zIndex: 10,
  },
  back: {
    background: 'rgba(0,0,0,0.4)', border: '1px solid #5a4a30',
    color: '#c8a85a', borderRadius: '6px', padding: '6px 12px',
    fontSize: '13px', cursor: 'pointer',
  },
  title: { fontSize: '20px', color: '#f5e6c8', fontWeight: 700 },
  tabs: {
    display: 'flex', gap: '8px', padding: '12px 24px',
    borderBottom: '1px solid #2a1e10', flexWrap: 'wrap',
  },
  tab: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px',
    padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
    background: 'rgba(255,255,255,0.03)', border: '1px solid #2a1e10',
    transition: 'border-color 0.15s',
  },
  tabActive: { border: '1px solid #c8a85a', background: 'rgba(200,168,90,0.08)' },
  tabName: { fontSize: '13px', color: '#f5e6c8', fontWeight: 600 },
  tabPeriod: { fontSize: '11px', color: '#6a5a40' },
  tabCount: { fontSize: '11px', color: '#c8a85a', fontWeight: 600 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '16px', padding: '24px',
  },
  card: {
    background: '#2a2218', border: '1px solid #3a2e1e',
    borderRadius: '8px', overflow: 'hidden', cursor: 'pointer',
    textAlign: 'left', display: 'flex', flexDirection: 'column',
    transition: 'border-color 0.15s',
  },
  thumb: { width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' },
  cardBody: { padding: '12px' },
  year: { fontSize: '11px', color: '#c8a85a', fontWeight: 600, marginBottom: '4px' },
  cardTitle: { fontSize: '14px', color: '#f5e6c8', fontWeight: 600, marginBottom: '6px' },
  desc: { fontSize: '12px', color: '#9a9080', lineHeight: 1.5 },
  empty: { gridColumn: '1/-1', color: '#6a5a40', fontSize: '14px', padding: '40px', textAlign: 'center' },
}
