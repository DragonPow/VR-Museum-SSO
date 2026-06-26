import type { Item } from '@vm/shared'
import { MarkdownText } from './MarkdownText.js'

interface Props {
  item: Item
  onClose: () => void
}

export function InfoModal({ item, onClose }: Props) {
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <button style={styles.close} onClick={onClose}>✕</button>

        <div style={styles.imageWrap}>
          <img src={item.fullUrl} alt={item.title} style={styles.image}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <div style={styles.yearBadge}>{item.year}</div>
        </div>

        <div style={styles.body}>
          <h2 style={styles.title}>{item.title}</h2>

          {item.shortDesc && (
            <p style={styles.lead}>{item.shortDesc}</p>
          )}

          {item.longDesc && (
            <MarkdownText text={item.longDesc} style={{ marginTop: '12px' }} />
          )}

          {item.tags.length > 0 && (
            <div style={styles.tags}>
              {item.tags.map((tag) => (
                <span key={tag} style={styles.tag}>#{tag}</span>
              ))}
            </div>
          )}

          {item.source && (
            <div style={styles.source}>📁 Nguồn: {item.source}</div>
          )}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.8)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100, padding: '16px',
    backdropFilter: 'blur(4px)',
  },
  panel: {
    background: 'linear-gradient(160deg,#2a2218,#1e1a12)',
    border: '1px solid #5a4a30',
    borderRadius: '12px',
    maxWidth: '780px', width: '100%',
    maxHeight: '90vh', overflow: 'auto',
    position: 'relative',
    boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
  },
  close: {
    position: 'absolute', top: '14px', right: '14px',
    background: 'rgba(0,0,0,0.5)', border: '1px solid #5a4a30',
    color: '#c8a85a', borderRadius: '50%',
    width: '34px', height: '34px',
    cursor: 'pointer', fontSize: '14px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1, transition: 'background 0.15s',
  },
  imageWrap: {
    position: 'relative', width: '100%', aspectRatio: '16/9',
    background: '#111', overflow: 'hidden', borderRadius: '12px 12px 0 0',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  image: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  yearBadge: {
    position: 'absolute', bottom: '12px', left: '16px',
    background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(200,168,90,0.5)',
    color: '#c8a85a', borderRadius: '6px',
    padding: '3px 10px', fontSize: '13px', fontWeight: 700,
  },
  body: { padding: '20px 24px 28px' },
  title: {
    fontSize: '22px', fontWeight: 800, color: '#f5e6c8',
    marginBottom: '10px', lineHeight: 1.3,
  },
  lead: {
    fontSize: '15px', color: '#d4cabb', lineHeight: 1.65,
    borderLeft: '3px solid #8b6914', paddingLeft: '12px',
  },
  tags: { display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '14px 0 10px' },
  tag: {
    background: 'rgba(200,168,90,0.12)', border: '1px solid rgba(200,168,90,0.3)',
    color: '#c8a85a', borderRadius: '4px', padding: '2px 9px', fontSize: '12px',
  },
  source: { fontSize: '12px', color: '#6a6050', marginTop: '10px' },
}
