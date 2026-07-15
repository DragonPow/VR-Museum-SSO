import { useEffect, useState } from 'react'
import type { Item } from '@vm/shared'
import { MarkdownText } from './MarkdownText.js'
import { brand } from './theme.js'

function toEmbedUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = parsed.searchParams.get('v')
      if (id) return `https://www.youtube.com/embed/${id}`
    }
    if (host === 'youtu.be') {
      const id = parsed.pathname.replace(/^\//, '')
      if (id) return `https://www.youtube.com/embed/${id}`
    }
  } catch {
    // Keep original string; schema validation handles persisted URLs.
  }
  return url
}

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

interface Props {
  item: Item
  onClose: () => void
}

export function InfoModal({ item, onClose }: Props) {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 760,
  )
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < 760)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])

  if (item.embedUrl) {
    return (
      <div style={styles.overlay} onClick={onClose}>
        <div style={styles.embedPanel} onClick={(e) => e.stopPropagation()}>
          <button style={styles.close} onClick={onClose}>✕</button>
          <iframe
            src={toEmbedUrl(item.embedUrl)}
            title={item.title}
            style={styles.embedIframe}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>
    )
  }

  if (item.externalUrl) {
    return (
      <div style={styles.overlay} onClick={onClose}>
        <div style={styles.confirmPanel} onClick={(e) => e.stopPropagation()}>
          <button style={styles.close} onClick={onClose}>✕</button>
          <div style={styles.linkIcon} aria-hidden="true">
            <ExternalLinkIcon />
          </div>
          <h2 style={styles.confirmTitle}>Bạn có muốn mở trang ngoài không?</h2>
          <p style={styles.confirmText}>
            Liên kết này sẽ mở trang <strong>{hostLabel(item.externalUrl)}</strong> trong tab mới.
          </p>
          <div style={styles.urlBox}>{item.externalUrl}</div>
          <div style={styles.confirmActions}>
            <button style={styles.secondaryBtn} onClick={onClose}>Hủy</button>
            <a href={item.externalUrl} target="_blank" rel="noreferrer" style={styles.primaryLink}>
              {item.externalLabel ?? 'Mở trang'}
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        style={{ ...styles.panel, flexDirection: narrow ? 'column' : 'row' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button style={styles.close} onClick={onClose}>✕</button>

        <div style={{ ...styles.imageWrap, ...(narrow ? styles.imageWrapNarrow : styles.imageWrapWide) }}>
          <img
            src={item.fullUrl}
            alt={item.title}
            style={styles.image}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <div style={styles.yearBadge}>{item.year}</div>
        </div>

        <div style={styles.body}>
          <h2 style={styles.title}>{item.title}</h2>

          {item.shortDesc && <p style={styles.lead}>{item.shortDesc}</p>}

          {item.longDesc && <MarkdownText text={item.longDesc} style={{ marginTop: '12px' }} />}

          {item.tags.length > 0 && (
            <div style={styles.tags}>
              {item.tags.map((tag) => (
                <span key={tag} style={styles.tag}>#{tag}</span>
              ))}
            </div>
          )}

          {item.source && <div style={styles.source}>Nguồn: {item.source}</div>}
        </div>
      </div>
    </div>
  )
}

function ExternalLinkIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M14 4h6v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 14 20 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}


const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(8,47,109,0.34)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100, padding: '16px',
    backdropFilter: 'blur(4px)',
  },

  embedPanel: {
    position: 'relative',
    width: 'min(1080px, 94vw)',
    aspectRatio: '16 / 9',
    background: '#000000',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
  },
  embedIframe: { width: '100%', height: '100%', border: 0, display: 'block', background: '#000000' },
  confirmPanel: {
    position: 'relative',
    width: 'min(480px, 94vw)',
    background: 'linear-gradient(160deg,#ffffff,#eef7ff)',
    border: `1px solid ${brand.line}`,
    borderRadius: '12px',
    padding: '34px 30px 28px',
    boxShadow: '0 24px 64px rgba(8,47,109,0.24)',
    textAlign: 'center',
  },
  linkIcon: {
    width: '58px', height: '58px', borderRadius: '50%',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(16,80,160,0.1)', color: brand.blue,
    border: `1px solid ${brand.line}`, marginBottom: '16px',
  },
  confirmTitle: { fontSize: '20px', fontWeight: 800, color: brand.text, marginBottom: '10px', lineHeight: 1.35 },
  confirmText: { fontSize: '14px', color: brand.muted, lineHeight: 1.65, marginBottom: '14px' },
  urlBox: {
    fontSize: '12px', color: brand.text,
    background: 'rgba(16,80,160,0.06)', border: `1px solid ${brand.line}`,
    borderRadius: '8px', padding: '10px 12px', overflowWrap: 'anywhere', textAlign: 'left',
  },
  confirmActions: { display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '22px', flexWrap: 'wrap' },
  secondaryBtn: {
    border: `1px solid ${brand.line}`, background: '#ffffff', color: brand.text,
    borderRadius: '8px', padding: '10px 18px', cursor: 'pointer', fontWeight: 800, fontFamily: brand.fontFamily,
  },
  primaryLink: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: '8px', padding: '10px 18px', background: brand.blue, color: '#ffffff',
    textDecoration: 'none', fontSize: '13px', fontWeight: 800,
  },
  panel: {
    display: 'flex',
    background: 'linear-gradient(160deg,#ffffff,#eef7ff)',
    border: `1px solid ${brand.line}`,
    borderRadius: '12px',
    maxWidth: '980px', width: '100%',
    maxHeight: '88vh', overflow: 'hidden',
    position: 'relative',
    boxShadow: '0 24px 64px rgba(8,47,109,0.24)',
  },
  close: {
    position: 'absolute', top: '12px', right: '12px',
    background: 'rgba(255,255,255,0.9)', border: `1px solid ${brand.line}`,
    color: brand.blue, borderRadius: '50%',
    width: '34px', height: '34px',
    cursor: 'pointer', fontSize: '14px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 2,
  },
  imageWrap: {
    position: 'relative',
    background: '#e7f0fa',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  imageWrapWide: { flex: '0 0 46%', alignSelf: 'stretch', minHeight: '260px' },
  imageWrapNarrow: { width: '100%', aspectRatio: '16 / 9' },
  image: { width: '100%', height: '100%', objectFit: 'contain', display: 'block' },
  iframe: { width: '100%', height: '100%', border: 0, display: 'block', background: '#000' },
  yearBadge: {
    position: 'absolute', bottom: '12px', left: '14px',
    background: 'rgba(255,255,255,0.9)', border: `1px solid ${brand.line}`,
    color: brand.blue, borderRadius: '6px',
    padding: '3px 10px', fontSize: '13px', fontWeight: 700,
  },
  body: {
    flex: 1, minWidth: 0,
    padding: '26px 28px 30px',
    overflowY: 'auto',
  },
  title: {
    fontSize: '22px', fontWeight: 800, color: brand.text,
    marginBottom: '12px', lineHeight: 1.3,
  },
  lead: {
    fontSize: '15px', color: brand.text, lineHeight: 1.65,
    borderLeft: `3px solid ${brand.blue}`, paddingLeft: '12px',
  },
  tags: { display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '16px 0 10px' },
  externalLink: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    marginTop: '18px', padding: '10px 14px',
    borderRadius: '6px', border: `1px solid ${brand.line}`,
    background: 'rgba(16,80,160,0.1)', color: brand.blue,
    textDecoration: 'none', fontSize: '13px', fontWeight: 700,
  },
  tag: {
    background: 'rgba(16,80,160,0.1)', border: `1px solid ${brand.line}`,
    color: brand.blue, borderRadius: '4px', padding: '2px 9px', fontSize: '12px',
  },
  source: { fontSize: '12px', color: brand.muted, marginTop: '12px' },
}
