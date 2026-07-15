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
    () => typeof window !== 'undefined' && window.innerWidth < 820,
  )
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < 820)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])

  if (item.embedUrl) {
    return (
      <div style={styles.overlay} onClick={onClose}>
        <div style={styles.embedPanel} onClick={(e) => e.stopPropagation()}>
          <button style={styles.close} onClick={onClose}>×</button>
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

  const hasText = Boolean(item.shortDesc || item.longDesc || item.tags.length > 0 || item.source || item.externalUrl)

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        style={{
          ...styles.panel,
          ...(hasText ? styles.panelWithText : styles.panelImageOnly),
          flexDirection: narrow ? 'column' : 'row',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button style={styles.close} onClick={onClose}>×</button>

        <div
          style={{
            ...styles.imageWrap,
            ...(narrow ? styles.imageWrapNarrow : hasText ? styles.imageWrapWide : styles.imageWrapSolo),
          }}
        >
          <img
            src={item.fullUrl}
            alt={item.title}
            style={styles.image}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <div style={styles.yearBadge}>{item.year}</div>
        </div>

        {hasText && (
          <div style={styles.body}>
            <div style={styles.kicker}>{item.externalUrl ? hostLabel(item.externalUrl) : 'Tư liệu'}</div>
            <h2 style={styles.title}>{item.title}</h2>

            {item.shortDesc && <p style={styles.lead}>{item.shortDesc}</p>}
            {item.longDesc && <MarkdownText text={item.longDesc} style={{ marginTop: '14px' }} />}

            {item.tags.length > 0 && (
              <div style={styles.tags}>
                {item.tags.map((tag) => (
                  <span key={tag} style={styles.tag}>#{tag}</span>
                ))}
              </div>
            )}

            {item.source && <div style={styles.source}>Nguồn: {item.source}</div>}

            {item.externalUrl && (
              <div style={styles.linkBlock}>
                <div style={styles.linkHint}>Liên kết đính kèm</div>
                <a href={item.externalUrl} target="_blank" rel="noreferrer" style={styles.primaryLink}>
                  <ExternalLinkIcon />
                  <span>{item.externalLabel ?? 'Mở link đính kèm'}</span>
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ExternalLinkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M14 4h6v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 14 20 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(8,47,109,0.42)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100, padding: '18px',
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
  panel: {
    display: 'flex',
    background: '#f8fbff',
    border: `1px solid ${brand.line}`,
    borderRadius: '10px',
    width: '100%',
    maxHeight: '92vh', overflow: 'hidden',
    position: 'relative',
    boxShadow: '0 24px 70px rgba(8,47,109,0.3)',
  },
  panelWithText: { maxWidth: '1240px' },
  panelImageOnly: { maxWidth: '1180px' },
  close: {
    position: 'absolute', top: '12px', right: '12px',
    background: 'rgba(255,255,255,0.94)', border: `1px solid ${brand.line}`,
    color: brand.blue, borderRadius: '50%',
    width: '36px', height: '36px',
    cursor: 'pointer', fontSize: '18px', lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 2,
  },
  imageWrap: {
    position: 'relative',
    background: '#071323',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  imageWrapWide: { flex: '0 0 66%', alignSelf: 'stretch', minHeight: '560px' },
  imageWrapSolo: { width: '100%', minHeight: 'min(82vh, 760px)' },
  imageWrapNarrow: { width: '100%', aspectRatio: '16 / 10', minHeight: '260px' },
  image: { width: '100%', height: '100%', objectFit: 'contain', display: 'block' },
  yearBadge: {
    position: 'absolute', bottom: '14px', left: '16px',
    background: 'rgba(255,255,255,0.92)', border: `1px solid ${brand.line}`,
    color: brand.blue, borderRadius: '6px',
    padding: '4px 11px', fontSize: '13px', fontWeight: 800,
  },
  body: {
    flex: 1, minWidth: 0,
    padding: '34px 34px 32px',
    overflowY: 'auto',
    background: 'linear-gradient(180deg,#ffffff,#eef7ff)',
  },
  kicker: { fontSize: '11px', color: brand.blue, textTransform: 'uppercase', fontWeight: 900, letterSpacing: 0, marginBottom: '10px' },
  title: { fontSize: '26px', fontWeight: 900, color: brand.text, marginBottom: '14px', lineHeight: 1.24 },
  lead: { fontSize: '16px', color: brand.text, lineHeight: 1.7, borderLeft: `3px solid ${brand.blue}`, paddingLeft: '13px' },
  tags: { display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '18px 0 10px' },
  tag: {
    background: 'rgba(16,80,160,0.1)', border: `1px solid ${brand.line}`,
    color: brand.blue, borderRadius: '4px', padding: '2px 9px', fontSize: '12px',
  },
  source: { fontSize: '12px', color: brand.muted, marginTop: '14px' },
  linkBlock: { marginTop: '22px', paddingTop: '18px', borderTop: `1px solid ${brand.line}` },
  linkHint: { fontSize: '12px', color: brand.muted, marginBottom: '8px' },
  primaryLink: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    borderRadius: '8px', padding: '11px 16px', background: brand.blue, color: '#ffffff',
    textDecoration: 'none', fontSize: '13px', fontWeight: 900,
  },
}
