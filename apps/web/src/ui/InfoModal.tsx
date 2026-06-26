import type { Item } from '@vm/shared'

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
          <img src={item.fullUrl} alt={item.title} style={styles.image} />
        </div>

        <div style={styles.body}>
          <div style={styles.year}>{item.year}</div>
          <h2 style={styles.title}>{item.title}</h2>
          <p style={styles.short}>{item.shortDesc}</p>
          {item.longDesc && <p style={styles.long}>{item.longDesc}</p>}

          {item.tags.length > 0 && (
            <div style={styles.tags}>
              {item.tags.map((tag) => (
                <span key={tag} style={styles.tag}>#{tag}</span>
              ))}
            </div>
          )}

          {item.source && (
            <div style={styles.source}>Nguồn: {item.source}</div>
          )}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100, padding: '16px',
  },
  panel: {
    background: '#2a2218',
    border: '1px solid #5a4a30',
    borderRadius: '8px',
    maxWidth: '760px', width: '100%',
    maxHeight: '90vh', overflow: 'auto',
    position: 'relative',
    display: 'flex', flexDirection: 'column',
  },
  close: {
    position: 'absolute', top: '12px', right: '12px',
    background: 'rgba(0,0,0,0.5)', border: '1px solid #5a4a30',
    color: '#f0ede8', borderRadius: '50%',
    width: '32px', height: '32px',
    cursor: 'pointer', fontSize: '14px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1,
  },
  imageWrap: {
    width: '100%', aspectRatio: '16/9',
    background: '#1a1410', overflow: 'hidden', borderRadius: '8px 8px 0 0',
  },
  image: {
    width: '100%', height: '100%', objectFit: 'cover',
  },
  body: { padding: '20px 24px 24px' },
  year: {
    fontSize: '13px', color: '#c8a85a', fontWeight: 600,
    letterSpacing: '0.08em', marginBottom: '6px',
  },
  title: {
    fontSize: '22px', fontWeight: 700, color: '#f5e6c8',
    marginBottom: '12px', lineHeight: 1.3,
  },
  short: { fontSize: '15px', color: '#d4cabb', marginBottom: '10px', lineHeight: 1.6 },
  long: { fontSize: '14px', color: '#b8ad9e', lineHeight: 1.7, marginBottom: '14px' },
  tags: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' },
  tag: {
    background: 'rgba(200,168,90,0.15)', border: '1px solid rgba(200,168,90,0.3)',
    color: '#c8a85a', borderRadius: '4px', padding: '2px 8px', fontSize: '12px',
  },
  source: { fontSize: '12px', color: '#7a7060', marginTop: '8px' },
}
