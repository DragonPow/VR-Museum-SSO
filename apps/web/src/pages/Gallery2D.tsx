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

  const assignedItems = (room?.slots ?? [])
    .filter((s) => s.itemId)
    .map((s) => itemMap[s.itemId!])
    .filter(Boolean) as Item[]

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <button style={styles.back} onClick={onBack}>← Trang chủ</button>
        <h2 style={styles.title}>{room?.title}</h2>
      </div>

      <div style={styles.grid}>
        {assignedItems.map((item) => (
          <button key={item.id} style={styles.card} onClick={() => setSelectedItem(item)}>
            <img src={item.thumbUrl} alt={item.title} style={styles.thumb} />
            <div style={styles.cardBody}>
              <div style={styles.year}>{item.year}</div>
              <div style={styles.cardTitle}>{item.title}</div>
              <div style={styles.desc}>{item.shortDesc}</div>
            </div>
          </button>
        ))}
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
}
