import { useEffect, useMemo, useState } from 'react'
import type { DocumentImage, DocumentItem } from '@vm/shared'
import { resolveDocumentImageVariantUrl } from '@vm/shared'
import { MarkdownText } from './MarkdownText.js'
import { brand } from './theme.js'

const ASSET_BASE_URL = (import.meta.env.VITE_ASSET_BASE_URL ?? '').replace(/\/+$/, '')

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
  } catch {}
  return url
}



function toDrivePreviewUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')
    if (host === 'drive.google.com') {
      const fileMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/)
      const id = fileMatch?.[1] ?? parsed.searchParams.get('id')
      if (id) return `https://drive.google.com/file/d/${id}/preview`
    }
  } catch {}
  return url
}

function hostLabel(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

interface Props {
  documents: DocumentItem[]
  onClose: () => void
}

function isCompactViewport() {
  return typeof window !== 'undefined' && (window.innerWidth < 820 || window.innerHeight < 520)
}

export function InfoModal({ documents, onClose }: Props) {
  const [pageIndex, setPageIndex] = useState(0)
  const [compact, setCompact] = useState(isCompactViewport)

  useEffect(() => {
    const on = () => setCompact(isCompactViewport())
    window.addEventListener('resize', on)
    window.addEventListener('orientationchange', on)
    return () => {
      window.removeEventListener('resize', on)
      window.removeEventListener('orientationchange', on)
    }
  }, [])

  useEffect(() => {
    if (pageIndex > documents.length - 1) setPageIndex(Math.max(0, documents.length - 1))
  }, [documents.length, pageIndex])

  const item = documents[pageIndex]
  const pageCount = documents.length
  const canPage = pageCount > 1

  const imageUrls = useMemo(() => {
    if (!item) return []
    const imageMap = new Map(item.images.map((image) => [image.id, image]))
    const configured: DocumentImage[] = (item.detailImageIds.length > 0 ? item.detailImageIds : [item.viewerImageId])
      .map((id) => imageMap.get(id) ?? { id })
    const resolved: Array<DocumentImage & { url: string }> = []
    for (const image of configured) {
      const url = resolveDocumentImageVariantUrl(item.documentKey, image.id, 'full', { assetBaseUrl: ASSET_BASE_URL, assetVersion: import.meta.env.VITE_ASSET_VERSION ?? '' })
      if (url) resolved.push({ ...image, url })
    }
    return resolved
  }, [item])

  if (!item) return null

  const goPrev = () => setPageIndex((i) => Math.max(0, i - 1))
  const goNext = () => setPageIndex((i) => Math.min(pageCount - 1, i + 1))

  if ((item.mediaType === 'youtube' || item.mediaType === 'iframe') && item.embedUrl) {
    const iframeSrc = item.mediaType === 'youtube' ? toEmbedUrl(item.embedUrl) : toDrivePreviewUrl(item.embedUrl)
    return (
      <div style={styles.overlay} onClick={onClose}>
        <div style={item.mediaType === 'iframe' ? styles.documentPanel : styles.embedPanel} onClick={(e) => e.stopPropagation()}>
          <button style={styles.close} onClick={onClose}>×</button>
          <iframe
            src={iframeSrc}
            title={item.title}
            style={styles.embedIframe}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
          {canPage && <PageNav index={pageIndex} total={pageCount} onPrev={goPrev} onNext={goNext} />}
        </div>
      </div>
    )
  }

  const hasText = Boolean(item.summary || item.body || item.tags.length > 0 || item.source || item.externalUrl)

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        style={{
          ...styles.panel,
          ...(hasText ? styles.panelWithText : styles.panelImageOnly),
          ...(compact ? styles.panelCompact : {}),
          flexDirection: compact ? 'column' : 'row',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button style={styles.close} onClick={onClose}>×</button>

        <div style={{ ...styles.imageWrap, ...(compact ? styles.imageWrapCompact : hasText ? styles.imageWrapWide : styles.imageWrapSolo) }}>
          <div style={styles.imageStack}>
            {imageUrls.map((image) => (
              <figure key={image.id} style={styles.figure}>
                <img src={image.url} alt={image.alt ?? item.title} style={{ ...styles.image, ...(compact ? styles.imageCompact : {}) }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                {image.caption && <figcaption style={styles.caption}>{image.caption}</figcaption>}
              </figure>
            ))}
          </div>
          <div style={styles.yearBadge}>{item.year}</div>
        </div>

        {hasText && (
          <div style={{ ...styles.body, ...(compact ? styles.bodyCompact : {}) }}>
            <div style={styles.kicker}>{item.externalUrl ? hostLabel(item.externalUrl) : 'Tư liệu'}</div>
            <h2 style={styles.title}>{item.title}</h2>
            {item.summary && <p style={styles.lead}>{item.summary}</p>}
            {item.body && <MarkdownText text={item.body} style={{ marginTop: '14px' }} />}
            {item.tags.length > 0 && (
              <div style={styles.tags}>{item.tags.map((tag) => <span key={tag} style={styles.tag}>#{tag}</span>)}</div>
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
        {canPage && <PageNav index={pageIndex} total={pageCount} onPrev={goPrev} onNext={goNext} />}
      </div>
    </div>
  )
}

function PageNav({ index, total, onPrev, onNext }: { index: number; total: number; onPrev: () => void; onNext: () => void }) {
  return (
    <>
      <button style={{ ...styles.edgePageBtn, ...styles.edgePageBtnLeft }} onClick={onPrev} disabled={index === 0} aria-label="Trang trước">‹</button>
      <button style={{ ...styles.edgePageBtn, ...styles.edgePageBtnRight }} onClick={onNext} disabled={index === total - 1} aria-label="Trang sau">›</button>
      <div style={styles.pageCountFloating}>{index + 1} / {total}</div>
    </>
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
  overlay: { position: 'fixed', inset: 0, background: 'rgba(8,47,109,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '18px', backdropFilter: 'blur(4px)' },
  embedPanel: { position: 'relative', width: 'min(1080px, 94vw)', aspectRatio: '16 / 9', background: '#000000', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.35)' },
  documentPanel: { position: 'relative', width: 'min(1120px, 94vw)', height: 'min(88vh, 860px)', background: '#000000', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.35)' },
  embedIframe: { width: '100%', height: '100%', border: 0, display: 'block', background: '#000000' },
  panel: { display: 'flex', background: '#f8fbff', border: `1px solid ${brand.line}`, borderRadius: '10px', width: '100%', maxHeight: '92vh', overflow: 'hidden', position: 'relative', boxShadow: '0 24px 70px rgba(8,47,109,0.3)' },
  panelWithText: { maxWidth: '1240px' },
  panelImageOnly: { maxWidth: '1180px' },
  panelCompact: { overflowY: 'auto', overflowX: 'hidden' },
  close: { position: 'absolute', top: '12px', right: '12px', background: 'rgba(255,255,255,0.94)', border: `1px solid ${brand.line}`, color: brand.blue, borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', fontSize: '18px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  imageWrap: { position: 'relative', background: '#071323', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', flexShrink: 0, overflow: 'auto', overscrollBehavior: 'contain' },
  imageWrapWide: { flex: '0 0 66%', alignSelf: 'stretch', minHeight: 0, maxHeight: '92vh' },
  imageWrapSolo: { width: '100%', minHeight: 'min(82vh, 760px)', maxHeight: '92vh' },
  imageWrapCompact: { width: '100%', height: 'auto', minHeight: '180px', maxHeight: 'none', overflow: 'visible' },
  imageStack: { width: '100%', minHeight: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '18px', alignItems: 'center', justifyContent: 'flex-start', padding: '18px 18px 48px' },
  figure: { margin: 0, width: '100%', flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },
  image: { maxWidth: '100%', maxHeight: '70vh', width: 'auto', height: 'auto', objectFit: 'contain', display: 'block' },
  imageCompact: { maxHeight: 'none', width: '100%' },
  caption: { color: 'rgba(255,255,255,0.78)', fontSize: '12px', textAlign: 'center' },
  yearBadge: { position: 'absolute', bottom: '14px', left: '16px', background: 'rgba(255,255,255,0.92)', border: `1px solid ${brand.line}`, color: brand.blue, borderRadius: '6px', padding: '4px 11px', fontSize: '13px', fontWeight: 800 },
  body: { flex: 1, minWidth: 0, padding: '34px 34px 32px', overflowY: 'auto', background: 'linear-gradient(180deg,#ffffff,#eef7ff)' },
  bodyCompact: { flex: '0 0 auto', overflowY: 'visible' },
  kicker: { fontSize: '11px', color: brand.blue, textTransform: 'uppercase', fontWeight: 900, letterSpacing: 0, marginBottom: '10px' },
  title: { fontSize: '26px', fontWeight: 900, color: brand.text, marginBottom: '14px', lineHeight: 1.24 },
  lead: { fontSize: '16px', color: brand.text, lineHeight: 1.7, borderLeft: `3px solid ${brand.blue}`, paddingLeft: '13px' },
  tags: { display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '18px 0 10px' },
  tag: { background: 'rgba(16,80,160,0.1)', border: `1px solid ${brand.line}`, color: brand.blue, borderRadius: '4px', padding: '2px 9px', fontSize: '12px' },
  source: { fontSize: '12px', color: brand.muted, marginTop: '14px' },
  linkBlock: { marginTop: '22px', paddingTop: '18px', borderTop: `1px solid ${brand.line}` },
  linkHint: { fontSize: '12px', color: brand.muted, marginBottom: '8px' },
  primaryLink: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '8px', padding: '11px 16px', background: brand.blue, color: '#ffffff', textDecoration: 'none', fontSize: '13px', fontWeight: 900 },
  edgePageBtn: { position: 'absolute', top: '50%', transform: 'translateY(-50%)', width: '44px', height: '58px', borderRadius: '10px', border: `1px solid ${brand.line}`, background: 'rgba(255,255,255,0.94)', color: brand.blue, cursor: 'pointer', fontSize: '34px', lineHeight: 1, zIndex: 3, boxShadow: '0 10px 24px rgba(8,47,109,0.2)' },
  edgePageBtnLeft: { left: '14px' },
  edgePageBtnRight: { right: '14px' },
  pageCountFloating: { position: 'absolute', left: '50%', bottom: '16px', transform: 'translateX(-50%)', zIndex: 3, minWidth: '56px', textAlign: 'center', fontSize: '13px', fontWeight: 900, color: brand.blue, background: 'rgba(255,255,255,0.92)', border: `1px solid ${brand.line}`, borderRadius: '999px', padding: '6px 12px' },
}
