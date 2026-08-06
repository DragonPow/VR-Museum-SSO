import { useState, useRef, useMemo, useEffect } from 'react'
import type { DocumentImage, DocumentItem, ImageRescaleSettings, ExternalLink } from '@vm/shared'
import { DocumentItemSchema } from '@vm/shared'
import { useDraftStore } from '../store.js'
import { uploadFile, checkApi, deleteDocumentStorage, deleteImageStorage } from '../api.js'
import { resizeImage, blobToObjectUrl } from '../util/imageResize.js'
import { nanoid } from '../util/nanoid.js'
import { resolveDocumentImageVariantUrl } from '@vm/shared'

const ASSET_BASE_URL = (import.meta.env.VITE_ASSET_BASE_URL ?? '').replace(/\/+$/, '')
const assetUrl = (documentKey?: string | null, imageId?: string | null, variant: 'thumb' | 'wall' | 'full' = 'thumb') =>
  resolveDocumentImageVariantUrl(documentKey, imageId, variant, { assetBaseUrl: ASSET_BASE_URL, assetVersion: import.meta.env.VITE_ASSET_VERSION ?? '' }) ?? undefined

type UploadStep = 'form' | 'resizing' | 'uploading' | 'done' | 'error'
type ContentItemType = 'image' | 'youtube' | 'iframe' | 'external'

interface PendingUploadImage {
  id: string
  file: File
  previewUrl: string
  caption: string
}

function getDocumentContentType(document: DocumentItem): ContentItemType {
  return document.mediaType
}

function getDocumentTypeLabel(document: DocumentItem) {
  if (document.mediaType === 'youtube') return 'YouTube'
  if (document.mediaType === 'iframe') return 'Iframe tài liệu'
  if (document.mediaType === 'external') return 'Link ngoài'
  return 'Ảnh'
}

function normalizeYouTubeUrl(value: string) {
  const raw = value.trim()
  if (!raw) return raw
  try {
    const url = new URL(raw)
    if (url.hostname.includes('youtu.be')) {
      const id = url.pathname.replace(/^\/+/, '').split('/')[0]
      return id ? `https://www.youtube.com/embed/${id}` : raw
    }
    if (url.hostname.includes('youtube.com')) {
      const id = url.searchParams.get('v')
      if (id) return `https://www.youtube.com/embed/${id}`
    }
  } catch {
    return raw
  }
  return raw
}



function normalizeIframeUrl(value: string) {
  const raw = value.trim()
  if (!raw) return raw
  try {
    const url = new URL(raw)
    const host = url.hostname.replace(/^www\./, '')
    if (host === 'drive.google.com') {
      const fileMatch = url.pathname.match(/\/file\/d\/([^/]+)/)
      const id = fileMatch?.[1] ?? url.searchParams.get('id')
      if (id) return `https://drive.google.com/file/d/${id}/preview`
    }
  } catch {
    return raw
  }
  return raw
}

function getDocumentImageUrl(item: DocumentItem, image: DocumentImage) {
  return resolveDocumentImageVariantUrl(item.documentKey, image.id, 'full', { assetBaseUrl: ASSET_BASE_URL, assetVersion: import.meta.env.VITE_ASSET_VERSION ?? '' }) ?? undefined
}

async function uploadImageVariants(documentKey: string, imageId: string, file: File, settings?: ImageRescaleSettings) {
  const variants = await resizeImage(file, settings)
  const apiAvailable = await checkApi()
  const rawExt = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
  if (apiAvailable) {
    await Promise.all([
      uploadFile(variants.thumb!, `content/documents/${documentKey}/images/${imageId}/thumb.webp`),
      uploadFile(variants.wall!, `content/documents/${documentKey}/images/${imageId}/wall.webp`),
      uploadFile(variants.full!, `content/documents/${documentKey}/images/${imageId}/full.webp`),
      uploadFile(file, `content/documents/${documentKey}/images/${imageId}/raw.${rawExt}`),
    ])
  } else {
    blobToObjectUrl(variants.thumb!)
    blobToObjectUrl(variants.wall!)
    blobToObjectUrl(variants.full!)
    blobToObjectUrl(file)
  }
  return rawExt
}

function splitTags(value: string) {
  return value.split(',').map((t) => t.trim()).filter(Boolean)
}

function Pagination({ current, total, onChange }: { current: number; total: number; onChange: (p: number) => void }) {
  if (total <= 1) return null

  const pages: (number | string)[] = []
  const range = 2

  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= current - range && i <= current + range)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...')
    }
  }

  return (
    <div style={styles.pagination}>
      <button
        style={{ ...styles.pageBtn, ...(current === 1 ? styles.pageBtnDisabled : {}) }}
        disabled={current === 1}
        onClick={() => onChange(current - 1)}
      >
        ◀ Trước
      </button>
      {pages.map((p, idx) =>
        typeof p === 'number' ? (
          <button
            key={idx}
            style={{ ...styles.pageBtn, ...(current === p ? styles.pageBtnActive : {}) }}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        ) : (
          <span key={idx} style={styles.pageEllipsis}>
            {p}
          </span>
        )
      )}
      <button
        style={{ ...styles.pageBtn, ...(current === total ? styles.pageBtnDisabled : {}) }}
        disabled={current === total}
        onClick={() => onChange(current + 1)}
      >
        Sau ▶
      </button>
    </div>
  )
}

export function Library() {
  const content = useDraftStore((s) => s.content)
  const addDocument = useDraftStore((s) => s.addDocument)
  const updateDocument = useDraftStore((s) => s.updateDocument)
  const removeDocument = useDraftStore((s) => s.removeDocument)

  const [showUpload, setShowUpload] = useState(false)
  const [search, setSearch] = useState('')
  const [periodFilter, setPeriodFilter] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 24

  if (!content) return <div style={styles.empty}>Đang tải...</div>

  const assignCount = useMemo(() => {
    const counts: Record<string, number> = {}
    content.rooms.flatMap((r) => r.slots).forEach((s) => {
      for (const documentId of (s.documentIds ?? [])) counts[documentId] = (counts[documentId] ?? 0) + 1
    })
    return counts
  }, [content.rooms])

  const sortedPeriods = useMemo(() => {
    return [...content.periods].sort((a, b) => a.order - b.order)
  }, [content.periods])

  const filtered = content.documents.filter((it) => {
    const typeLabel = getDocumentTypeLabel(it).toLowerCase()
    const query = search.toLowerCase()
    const matchSearch = !search ||
      it.title.toLowerCase().includes(query) ||
      it.tags.some((t) => t.toLowerCase().includes(query)) ||
      (it.year != null && String(it.year).toLowerCase().includes(query)) ||
      typeLabel.includes(query)
    const matchPeriod = !periodFilter || it.periodId === periodFilter
    return matchSearch && matchPeriod
  })

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const displayedItems = useMemo(() => {
    return filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
  }, [filtered, currentPage])

  const editItem = editId ? content.documents.find((it) => it.id === editId) : null

  return (
    <div style={styles.root}>
      <div style={styles.toolbar}>
        <div>
          <h2 style={styles.title}>Thư viện tư liệu</h2>
          <p style={styles.sub}>{content.documents.length} tư liệu · {Object.values(assignCount).reduce((a, b) => a + b, 0)} lần gán</p>
        </div>
        <button style={styles.uploadBtn} onClick={() => setShowUpload(true)}>
          + Thêm tư liệu
        </button>
      </div>

      <div style={styles.filters}>
        <input
          style={styles.searchInput}
          placeholder="Tìm theo tên, năm, tag, loại..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
        />
        <select
          style={styles.filterSelect}
          value={periodFilter}
          onChange={(e) => { setPeriodFilter(e.target.value); setCurrentPage(1); }}
        >
          <option value="">Tất cả thời kỳ</option>
          {sortedPeriods.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div style={styles.empty}>
          {content.documents.length === 0
            ? 'Chưa có tư liệu nào. Nhấn "Thêm tư liệu" để bắt đầu.'
            : 'Không tìm thấy tư liệu phù hợp.'}
        </div>
      ) : (
        <>
          <div style={styles.grid}>
            {displayedItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                assignCount={assignCount[item.id] ?? 0}
                onEdit={() => setEditId(item.id)}
                onRemove={() => {
                  if (confirm(`Xóa "${item.title}"? Tư liệu sẽ bị bỏ gán khỏi tất cả slot và xóa toàn bộ tệp lưu trữ.`)) {
                    removeDocument(item.id)
                    void deleteDocumentStorage(item.documentKey || item.id)
                  }
                }}
              />
            ))}
          </div>
          <Pagination current={currentPage} total={totalPages} onChange={setCurrentPage} />
        </>
      )}

      {showUpload && (
        <UploadModal
          periods={sortedPeriods}
          onClose={() => setShowUpload(false)}
          onDone={(document) => { addDocument(document); setShowUpload(false) }}
        />
      )}

      {editItem && (
        <EditModal
          item={editItem}
          periods={sortedPeriods}
          onClose={() => setEditId(null)}
          onSave={(patch) => { updateDocument(editItem.id, patch); setEditId(null) }}
        />
      )}
    </div>
  )
}

function ItemCard({ item, assignCount, onEdit, onRemove }: {
  item: DocumentItem
  assignCount: number
  onEdit: () => void
  onRemove: () => void
}) {
  return (
    <div style={styles.card}>
      <div style={styles.cardThumbWrap}>
        <img src={assetUrl(item.documentKey, item.thumbnailImageId, 'thumb')} alt={item.title} style={styles.cardThumb} loading="lazy" />
        <div style={styles.typeBadge}>{getDocumentTypeLabel(item)}</div>
        {assignCount > 0 && (
          <div style={styles.assignBadge}>{assignCount} slot</div>
        )}
      </div>
      <div style={styles.cardBody}>
        <div style={styles.cardTitle}>{item.title}</div>
        <div style={styles.cardMeta}>{item.year ? `${item.year} · ` : ''}{item.source || 'Chưa rõ nguồn'}</div>
        {item.tags.length > 0 && (
          <div style={styles.tagRow}>
            {item.tags.slice(0, 3).map((t) => (
              <span key={t} style={styles.tag}>{t}</span>
            ))}
          </div>
        )}
        <div style={styles.cardActions}>
          <button style={styles.cardBtn} onClick={onEdit}>Sửa</button>
          <button style={{ ...styles.cardBtn, color: '#c85a5a' }} onClick={onRemove}>Xóa</button>
        </div>
      </div>
    </div>
  )
}

function UploadModal({ periods, onClose, onDone }: {
  periods: { id: string; title: string }[]
  onClose: () => void
  onDone: (item: DocumentItem) => void
}) {
  const content = useDraftStore((s) => s.content)
  const fileRef = useRef<HTMLInputElement>(null)
  const [images, setImages] = useState<PendingUploadImage[]>([])
  const [formViewerImageId, setFormViewerImageId] = useState<string>('')
  const [formThumbnailImageId, setFormThumbnailImageId] = useState<string>('')
  const [step, setStep] = useState<UploadStep>('form')
  const [uploadProgress, setUploadProgress] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const previewUrlsRef = useRef<string[]>([])

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url)
        } catch (_) {}
      })
    }
  }, [])

  const [form, setForm] = useState({
    contentType: 'image' as ContentItemType,
    title: '', year: '', periodId: periods[0]?.id ?? '',
    priority: 0, summary: '', body: '', tags: '', source: '',
    embedUrl: '', externalUrl: '', externalLabel: '',
    externalLinks: [] as ExternalLink[],
  })

  const handleFiles = (files: FileList | File[]) => {
    const fileList = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (fileList.length === 0) return

    const newImages = fileList.map((file) => {
      const id = `photo-${nanoid(8)}`
      const url = URL.createObjectURL(file)
      previewUrlsRef.current.push(url)
      return {
        id,
        file,
        previewUrl: url,
        caption: file.name.replace(/\.[^.]+$/, ''),
      }
    })

    setImages((prev) => {
      const updated = [...prev, ...newImages]
      if (updated.length > 0) {
        setFormViewerImageId((curr) => curr || updated[0]!.id)
        setFormThumbnailImageId((curr) => curr || updated[0]!.id)
      }
      return updated
    })

    const firstFile = fileList[0]
    if (fileList.length === 1 && images.length === 0 && firstFile && !form.title) {
      setForm((f) => ({ ...f, title: firstFile.name.replace(/\.[^.]+$/, '') }))
    }
  }

  const handleMoveImage = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= images.length) return
    setImages((prev) => {
      const nextImages = [...prev]
      const temp = nextImages[index]!
      nextImages[index] = nextImages[target]!
      nextImages[target] = temp
      return nextImages
    })
  }

  const removeImage = (id: string) => {
    const target = images.find((img) => img.id === id)
    if (target) {
      URL.revokeObjectURL(target.previewUrl)
      previewUrlsRef.current = previewUrlsRef.current.filter((u) => u !== target.previewUrl)
    }

    setImages((prev) => {
      const nextImages = prev.filter((img) => img.id !== id)
      if (nextImages.length > 0) {
        if (formViewerImageId === id || !nextImages.some(img => img.id === formViewerImageId)) {
          setFormViewerImageId(nextImages[0]!.id)
        }
        if (formThumbnailImageId === id || !nextImages.some(img => img.id === formThumbnailImageId)) {
          setFormThumbnailImageId(nextImages[0]!.id)
        }
      } else {
        setFormViewerImageId('')
        setFormThumbnailImageId('')
      }
      return nextImages
    })
  }

  const updateImageCaption = (id: string, caption: string) => {
    setImages((prev) => prev.map((img) => img.id === id ? { ...img, caption } : img))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer?.files?.length) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.periodId || images.length === 0) return
    if (form.contentType === 'youtube' && !form.embedUrl.trim()) return
    if (form.contentType === 'iframe' && !form.embedUrl.trim()) return
    if (form.contentType === 'external' && !form.externalUrl.trim() && !(form.externalLinks && form.externalLinks.some(l => l.url.trim()))) return

    const ensureProtocol = (u: string) => {
      const t = u.trim()
      if (!t) return t
      if (t.startsWith('http://') || t.startsWith('https://') || t.startsWith('/')) return t
      return `https://${t}`
    }

    const finalLinks = (form.externalLinks || [])
      .map(link => {
        const trimmedLabel = link.label?.trim()
        return {
          url: ensureProtocol(link.url),
          ...(trimmedLabel ? { label: trimmedLabel } : {})
        } as ExternalLink
      })
      .filter(link => link.url !== '')

    if (finalLinks.length === 0 && form.contentType === 'external' && form.externalUrl.trim()) {
      finalLinks.push({
        url: ensureProtocol(form.externalUrl),
        label: form.externalLabel.trim() || 'Mở link đính kèm'
      })
    }

    const firstLink = finalLinks[0]
    const hasLinks = finalLinks.length > 0

    // Validate locally first using Zod before doing any heavy image processing/upload
    const tempItem = {
      id: 'temp-id',
      title: form.title.trim(),
      ...(form.year.trim() ? { year: form.year.trim() } : {}),
      periodId: form.periodId,
      priority: form.priority || 0,
      summary: form.summary.trim(),
      body: form.body.trim(),
      tags: splitTags(form.tags),
      source: form.source.trim(),
      documentKey: 'temp-key',
      thumbnailImageId: 'photo1',
      viewerImageId: 'photo1',
      detailImageIds: ['photo1'],
      images: [{ id: 'photo1', caption: 'temp' }],
      mediaType: form.contentType,
      ...(form.contentType === 'youtube' ? { embedUrl: normalizeYouTubeUrl(form.embedUrl) } : {}),
      ...(form.contentType === 'iframe' ? { embedUrl: normalizeIframeUrl(form.embedUrl) } : {}),
      ...((form.contentType === 'external' || form.contentType === 'image') && firstLink ? {
        externalUrl: firstLink.url,
        ...(firstLink.label ? { externalLabel: firstLink.label } : {}),
      } : {}),
      ...(hasLinks ? { externalLinks: finalLinks } : {}),
    }

    const validationResult = DocumentItemSchema.safeParse(tempItem)
    if (!validationResult.success) {
      const errorText = validationResult.error.issues.map(issue => {
        let fieldName = issue.path.join('.')
        fieldName = fieldName
          .replace('externalUrl', 'Đường dẫn ngoài')
          .replace('externalLabel', 'Nhãn nút mở link')
          .replace('embedUrl', 'Đường dẫn iframe/YouTube')
          .replace('title', 'Tiêu đề')
          .replace('year', 'Năm')
          .replace(/externalLinks\.(\d+)\.url/, (_, idx) => `Đường dẫn liên kết #${parseInt(idx) + 1}`)
          .replace(/externalLinks\.(\d+)\.label/, (_, idx) => `Nhãn nút liên kết #${parseInt(idx) + 1}`)
        return `• ${fieldName}: ${issue.message}`
      }).join('\n')
      setErrorMsg(`Dữ liệu chưa hợp lệ:\n${errorText}`)
      setStep('error')
      return
    }

    setErrorMsg('')
    try {
      setStep('resizing')
      const itemId = `item-${nanoid(8)}`
      const uploadedImages: DocumentImage[] = []

      for (let i = 0; i < images.length; i++) {
        const img = images[i]
        if (!img) continue

        setUploadProgress(`Đang xử lý ảnh ${i + 1}/${images.length}...`)
        setStep('uploading')

        try {
          const rawExt = await uploadImageVariants(itemId, img.id, img.file, content?.settings?.imageRescale)
          uploadedImages.push({
            id: img.id,
            rawExt,
            caption: img.caption.trim(),
          })
        } catch (err) {
          throw new Error(`Lỗi tải ảnh #${i + 1} (${img.caption}): ${err instanceof Error ? err.message : String(err)}`)
        }

        if (i < images.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1200))
        }
      }

      const ensureProtocol = (u: string) => {
        const t = u.trim()
        if (!t) return t
        if (t.startsWith('http://') || t.startsWith('https://') || t.startsWith('/')) return t
        return `https://${t}`
      }

      const finalLinks = (form.externalLinks || [])
        .map(link => {
          const trimmedLabel = link.label?.trim()
          return {
            url: ensureProtocol(link.url),
            ...(trimmedLabel ? { label: trimmedLabel } : {})
          } as ExternalLink
        })
        .filter(link => link.url !== '')

      if (finalLinks.length === 0 && form.contentType === 'external' && form.externalUrl.trim()) {
        finalLinks.push({
          url: ensureProtocol(form.externalUrl),
          label: form.externalLabel.trim() || 'Mở link đính kèm'
        })
      }

      const firstLink = finalLinks[0]
      const hasLinks = finalLinks.length > 0

      const item: DocumentItem = {
        id: itemId,
        title: form.title.trim(),
        ...(form.year.trim() ? { year: form.year.trim() } : {}),
        periodId: form.periodId,
        priority: form.priority || 0,
        summary: form.summary.trim(),
        body: form.body.trim(),
        tags: splitTags(form.tags),
        source: form.source.trim(),
        documentKey: itemId,
        thumbnailImageId: formThumbnailImageId || images[0]?.id || 'photo1',
        viewerImageId: formViewerImageId || images[0]?.id || 'photo1',
        detailImageIds: uploadedImages.map((img) => img.id),
        images: uploadedImages,
        mediaType: form.contentType,
        ...(form.contentType === 'youtube' ? { embedUrl: normalizeYouTubeUrl(form.embedUrl) } : {}),
        ...(form.contentType === 'iframe' ? { embedUrl: normalizeIframeUrl(form.embedUrl) } : {}),
        ...((form.contentType === 'external' || form.contentType === 'image') && firstLink ? {
          externalUrl: firstLink.url,
          ...(firstLink.label ? { externalLabel: firstLink.label } : {}),
        } : {}),
        ...(hasLinks ? { externalLinks: finalLinks } : {}),
      }

      setStep('done')
      onDone(item)
    } catch (err) {
      setStep('error')
      setErrorMsg(String(err))
    }
  }

  const busy = step === 'resizing' || step === 'uploading'
  const canSubmit = Boolean(
    form.title.trim() && form.periodId && images.length > 0 && !busy &&
    (form.contentType === 'image' ? true : form.contentType === 'youtube' || form.contentType === 'iframe' ? form.embedUrl.trim() : (form.externalUrl.trim() || (form.externalLinks && form.externalLinks.some(l => l.url.trim()))))
  )

  return (
    <div style={styles.overlay}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <span style={styles.modalTitle}>Thêm tư liệu {images.length > 1 ? `(${images.length} ảnh)` : ''}</span>
          <button style={styles.closeBtn} onClick={onClose} disabled={busy}>×</button>
        </div>

        <div style={styles.modalBody}>
          {images.length === 0 && (
            <div
              style={styles.dropZone}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
            >
              <div style={styles.dropHint}>
                <div style={styles.dropIcon}>IMG</div>
                <div>Chọn 1 hoặc nhiều ảnh (ảnh 1 làm ảnh chính, ảnh 2..N làm ảnh phụ)</div>
                <div style={{ fontSize: '12px', color: '#6a5a40' }}>Bắt buộc cho ảnh, YouTube, iframe tài liệu và link ngoài</div>
              </div>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = '' }}
          />

          {form.contentType !== 'image' && (
            <div style={styles.typePanel}>
              <div style={styles.typePanelTitle}>{form.contentType === 'youtube' ? 'Iframe YouTube' : form.contentType === 'iframe' ? 'Iframe tài liệu' : 'Link ngoài'}</div>
              <div style={styles.typePanelText}>
                {form.contentType === 'youtube'
                  ? 'Ảnh trên dùng để treo trong phòng; khi khách bấm slot sẽ mở iframe video trực tiếp.'
                  : form.contentType === 'iframe'
                    ? 'Ảnh trên dùng để treo trong phòng; khi khách bấm slot sẽ mở iframe tài liệu như Google Drive PDF.'
                    : 'Ảnh trên dùng để treo trong phòng và mở detail. Trong detail sẽ có nút mở link đính kèm.'}
              </div>
            </div>
          )}

          <div style={styles.formGrid}>
            <FormField label="Loại tư liệu *" style={{ gridColumn: '1 / -1' }}>
              <select style={styles.input} value={form.contentType} onChange={(e) => setForm((f) => ({ ...f, contentType: e.target.value as ContentItemType }))}>
                <option value="image">Ảnh</option>
                <option value="youtube">Iframe YouTube</option>
                <option value="iframe">Iframe tài liệu / Drive PDF</option>
                <option value="external">Link ngoài</option>
              </select>
            </FormField>
            {form.contentType === 'youtube' && (
              <FormField label="Link YouTube *" style={{ gridColumn: '1 / -1' }}>
                <input style={styles.input} placeholder="https://www.youtube.com/watch?v=..." value={form.embedUrl} onChange={(e) => setForm((f) => ({ ...f, embedUrl: e.target.value }))} />
              </FormField>
            )}
            {form.contentType === 'iframe' && (
              <FormField label="Link iframe tài liệu *" style={{ gridColumn: '1 / -1' }}>
                <input style={styles.input} placeholder="https://drive.google.com/file/d/.../view hoặc /preview" value={form.embedUrl} onChange={(e) => setForm((f) => ({ ...f, embedUrl: e.target.value }))} />
              </FormField>
            )}
            {form.contentType === 'external' && (
              <>
                <FormField label="Đường dẫn ngoài *" style={{ gridColumn: '1 / -1' }}>
                  <input style={styles.input} placeholder="https://..." value={form.externalUrl} onChange={(e) => setForm((f) => ({ ...f, externalUrl: e.target.value }))} />
                </FormField>
                <FormField label="Nhãn nút mở link" style={{ gridColumn: '1 / -1' }}>
                  <input style={styles.input} placeholder="Mở trang" value={form.externalLabel} onChange={(e) => setForm((f) => ({ ...f, externalLabel: e.target.value }))} />
                </FormField>
              </>
            )}
            {(form.contentType === 'external' || form.contentType === 'image') && (
              <div style={{ gridColumn: '1 / -1', border: '1px solid #3a2e1e', borderRadius: '8px', padding: '16px', background: 'rgba(255,255,255,0.02)', marginTop: '8px', marginBottom: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#9a9080', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Danh sách liên kết đính kèm {form.contentType === 'image' ? '' : '(Không bắt buộc)'}</span>
                  <button
                    type="button"
                    style={{ background: '#3a2e1e', border: '1px solid #4a3e2e', color: '#f0e8d8', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                    onClick={() => {
                      const currentLinks = form.externalLinks || [];
                      setForm((f) => ({
                        ...f,
                        externalLinks: [...currentLinks, { url: '', label: '' }],
                      }));
                    }}
                  >
                    + Thêm link
                  </button>
                </div>
                {(!form.externalLinks || form.externalLinks.length === 0) ? (
                  <div style={{ fontSize: '12px', color: '#6a5a40', fontStyle: 'italic' }}>Chưa có liên kết đính kèm nào. Bấm "+ Thêm link" để đính kèm đường dẫn.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {form.externalLinks.map((link, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          style={{ ...styles.input, flex: 2 }}
                          placeholder="Nhãn nút (VD: Xem chi tiết)"
                          value={link.label || ''}
                          onChange={(e) => {
                            const newLinks = [...form.externalLinks];
                            const curr = newLinks[idx];
                            if (curr) {
                              newLinks[idx] = { ...curr, label: e.target.value };
                              setForm((f) => ({ ...f, externalLinks: newLinks }));
                            }
                          }}
                        />
                        <input
                          style={{ ...styles.input, flex: 3 }}
                          placeholder="https://..."
                          value={link.url}
                          onChange={(e) => {
                            const newLinks = [...form.externalLinks];
                            const curr = newLinks[idx];
                            if (curr) {
                              newLinks[idx] = { ...curr, url: e.target.value };
                              setForm((f) => ({ ...f, externalLinks: newLinks }));
                            }
                          }}
                        />
                        <button
                          type="button"
                          style={{ background: 'rgba(200,90,90,0.15)', border: '1px solid #c85a5a', color: '#ff8888', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                          onClick={() => {
                            const newLinks = form.externalLinks.filter((_, i) => i !== idx);
                            setForm((f) => ({ ...f, externalLinks: newLinks }));
                          }}
                        >
                          Xóa
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <FormField label="Tiêu đề *" required style={{ gridColumn: '1 / -1' }}>
              <input style={styles.input} placeholder="VD: Lễ kỷ niệm thành lập" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </FormField>
            <FormField label="Năm">
              <input style={styles.input} type="text" placeholder="VD: 1975, Thập niên 90... (không bắt buộc)" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))} />
            </FormField>
            <FormField label="Thứ tự ưu tiên (Priority)">
              <input style={styles.input} type="number" min="0" placeholder="0" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: +e.target.value }))} />
            </FormField>
            <FormField label="Thời kỳ *" style={{ gridColumn: '1 / -1' }}>
              <select style={styles.input} value={form.periodId} onChange={(e) => setForm((f) => ({ ...f, periodId: e.target.value }))}>
                {periods.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </FormField>
            <FormField label="Mô tả ngắn" style={{ gridColumn: '1 / -1' }}>
              <input style={styles.input} value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} />
            </FormField>
            <FormField label="Mô tả đầy đủ" style={{ gridColumn: '1 / -1' }}>
              <textarea style={{ ...styles.input, height: '80px', resize: 'vertical' }} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
            </FormField>
            <FormField label="Tags (cách nhau bởi dấu phẩy)" style={{ gridColumn: '1 / -1' }}>
              <input style={styles.input} placeholder="kỷ niệm, lãnh đạo, 1975" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} />
            </FormField>
            <FormField label="Nguồn / Tác giả" style={{ gridColumn: '1 / -1' }}>
              <input style={styles.input} value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} />
            </FormField>
          </div>

          {images.length > 0 && (
            <div style={styles.mediaPanel}>
              <div style={styles.mediaHeader}>
                <div>
                  <div style={styles.mediaTitle}>Ảnh trong tư liệu ({images.length} ảnh)</div>
                  <div style={styles.mediaSub}>Ảnh chính dùng cho thumb/tường; ảnh phụ hiển thị thêm trong detail của cùng page.</div>
                </div>
                <div style={styles.mediaActions}>
                  <button type="button" style={styles.cardBtn} onClick={() => fileRef.current?.click()} disabled={busy}>Thêm ảnh</button>
                </div>
              </div>
              <div style={styles.mediaGrid}>
                {images.map((img, index) => (
                  <div key={img.id} style={styles.mediaItem}>
                    <img src={img.previewUrl} alt={`preview ${index}`} style={styles.mediaThumb} />
                    <div style={styles.mediaFields}>
                      <div style={styles.mediaKind}>
                        {img.id === formViewerImageId ? 'Ảnh viewer' : img.id === formThumbnailImageId ? 'Ảnh thumbnail' : 'Ảnh phụ'}
                      </div>
                      <input
                        style={styles.input}
                        value={img.caption}
                        placeholder="Caption"
                        onChange={(e) => updateImageCaption(img.id, e.target.value)}
                        disabled={busy}
                      />
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          style={{
                            ...styles.cardBtn,
                            width: '28px',
                            flex: 'none',
                            opacity: index === 0 ? 0.3 : 1,
                            cursor: index === 0 ? 'not-allowed' : 'pointer',
                          }}
                          disabled={index === 0 || busy}
                          onClick={() => handleMoveImage(index, -1)}
                          title="Di chuyển lên"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          style={{
                            ...styles.cardBtn,
                            width: '28px',
                            flex: 'none',
                            opacity: index === images.length - 1 ? 0.3 : 1,
                            cursor: index === images.length - 1 ? 'not-allowed' : 'pointer',
                          }}
                          disabled={index === images.length - 1 || busy}
                          onClick={() => handleMoveImage(index, 1)}
                          title="Di chuyển xuống"
                        >
                          ▼
                        </button>
                        <button type="button" style={styles.cardBtn} onClick={() => setFormViewerImageId(img.id)} disabled={busy}>Dùng làm viewer</button>
                        <button type="button" style={styles.cardBtn} onClick={() => setFormThumbnailImageId(img.id)} disabled={busy}>Dùng làm thumb</button>
                        <button type="button" style={{ ...styles.cardBtn, color: '#c85a5a' }} onClick={() => removeImage(img.id)} disabled={busy}>Xóa</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 'error' && <div style={styles.errorMsg}>{errorMsg}</div>}
          {busy && (
            <div style={styles.busyMsg}>
              {uploadProgress || (step === 'resizing' ? 'Đang xử lý ảnh...' : 'Đang tải lên...')}
            </div>
          )}
        </div>

        <div style={styles.modalFooter}>
          <button style={styles.cancelBtn} onClick={onClose} disabled={busy}>Hủy</button>
          <button
            style={{ ...styles.submitBtn, opacity: canSubmit ? 1 : 0.5 }}
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {busy ? 'Đang xử lý...' : 'Thêm vào thư viện'}
          </button>
        </div>
      </div>
    </div>
  )
}

function EditModal({ item, periods, onClose, onSave }: {
  item: DocumentItem
  periods: { id: string; title: string }[]
  onClose: () => void
  onSave: (patch: Partial<DocumentItem>) => void
}) {
  const content = useDraftStore((s) => s.content)
  const [form, setForm] = useState({
    contentType: getDocumentContentType(item),
    title: item.title, year: item.year != null ? String(item.year) : '', periodId: item.periodId,
    priority: item.priority ?? 0,
    summary: item.summary, body: item.body,
    tags: item.tags.join(', '), source: item.source,
    embedUrl: item.embedUrl ?? '',
    externalUrl: item.externalUrl ?? '',
    externalLabel: item.externalLabel ?? '',
    externalLinks: item.externalLinks ?? [] as ExternalLink[],
    thumbnailImageId: item.thumbnailImageId,
    viewerImageId: item.viewerImageId,
  })
  const initialImages = item.images?.length > 0 ? item.images : [{ id: item.viewerImageId || 'photo1' }]
  const [images, setImages] = useState<DocumentImage[]>(initialImages)
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([])
  const [mediaBusy, setMediaBusy] = useState('')
  const [mediaError, setMediaError] = useState('')
  const replaceMainRef = useRef<HTMLInputElement>(null)
  const addImagesRef = useRef<HTMLInputElement>(null)

  const handleReplaceMainImage = async (file: File) => {
    setMediaError('')
    setMediaBusy('Đang thay ảnh chính...')
    try {
      await uploadImageVariants(item.documentKey, form.viewerImageId || item.viewerImageId, file, content?.settings?.imageRescale)
    } catch (err) {
      setMediaError(String(err))
    } finally {
      setMediaBusy('')
    }
  }

  const handleAddDetailImages = async (files: FileList | null) => {
    const picked = Array.from(files ?? []).filter((file) => file.type.startsWith('image/'))
    if (picked.length === 0) return
    setMediaError('')
    setMediaBusy('Đang thêm ảnh...')
    try {
      const added: DocumentImage[] = []
      for (let i = 0; i < picked.length; i++) {
        const file = picked[i]!
        const key = `photo-${nanoid(8)}`
        setMediaBusy(`Đang tải ảnh ${i + 1}/${picked.length}...`)
        try {
          await uploadImageVariants(item.documentKey, key, file, content?.settings?.imageRescale)
          added.push({ id: key, caption: file.name.replace(/\.[^.]+$/, '') })
        } catch (err) {
          throw new Error(`Lỗi tải ảnh #${i + 1} (${file.name}): ${err instanceof Error ? err.message : String(err)}`)
        }

        if (i < picked.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1200))
        }
      }
      setImages((prev) => [...prev, ...added])
    } catch (err) {
      setMediaError(String(err))
    } finally {
      setMediaBusy('')
    }
  }

  const updateImage = (id: string, patch: Partial<DocumentImage>) => {
    setImages((prev) => prev.map((image) => image.id === id ? { ...image, ...patch } : image))
  }

  const removeImage = (id: string) => {
    if (id !== form.viewerImageId && id !== form.thumbnailImageId) {
      setRemovedImageIds((prev) => [...prev, id])
    }
    setImages((prev) => prev.filter((image) => image.id !== id || image.id === form.viewerImageId || image.id === form.thumbnailImageId))
  }

  const handleMoveImage = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= images.length) return
    const nextImages = [...images]
    const temp = nextImages[index]!
    nextImages[index] = nextImages[targetIndex]!
    nextImages[targetIndex] = temp
    setImages(nextImages)
  }

  const handleSave = () => {
    setMediaError('')
    for (const id of removedImageIds) {
      void deleteImageStorage(item.documentKey, id)
    }

    const ensureProtocol = (u: string) => {
      const t = u.trim()
      if (!t) return t
      if (t.startsWith('http://') || t.startsWith('https://') || t.startsWith('/')) return t
      return `https://${t}`
    }

    const finalLinks = (form.externalLinks || [])
      .map(link => {
        const trimmedLabel = link.label?.trim()
        return {
          url: ensureProtocol(link.url),
          ...(trimmedLabel ? { label: trimmedLabel } : {})
        } as ExternalLink
      })
      .filter(link => link.url !== '')

    if (finalLinks.length === 0 && form.contentType === 'external' && form.externalUrl.trim()) {
      finalLinks.push({
        url: ensureProtocol(form.externalUrl),
        label: form.externalLabel.trim() || 'Mở link đính kèm'
      })
    }

    const firstLink = finalLinks[0]
    const hasLinks = finalLinks.length > 0

    const patch: Partial<DocumentItem> = {
      title: form.title.trim(),
      ...(form.year.trim() ? { year: form.year.trim() } : {}),
      periodId: form.periodId,
      priority: form.priority || 0,
      summary: form.summary.trim(),
      body: form.body.trim(),
      tags: splitTags(form.tags),
      source: form.source.trim(),
      thumbnailImageId: form.thumbnailImageId || images[0]?.id || 'photo1',
      viewerImageId: form.viewerImageId || images[0]?.id || 'photo1',
      detailImageIds: images.map((image) => image.id),
      images,
    }

    const clearField = (key: keyof DocumentItem) => {
      ;(patch as Record<string, unknown>)[key] = undefined
    }

    if (!form.year.trim()) {
      clearField('year')
    }

    if (form.contentType === 'youtube') {
      patch.mediaType = 'youtube'
      patch.embedUrl = normalizeYouTubeUrl(form.embedUrl)
      clearField('externalUrl')
      clearField('externalLabel')
      clearField('externalLinks')
    } else if (form.contentType === 'iframe') {
      patch.mediaType = 'iframe'
      patch.embedUrl = normalizeIframeUrl(form.embedUrl)
      clearField('externalUrl')
      clearField('externalLabel')
      clearField('externalLinks')
    } else {
      if (form.contentType === 'external') {
        patch.mediaType = 'external'
      } else {
        patch.mediaType = 'image'
      }
      clearField('embedUrl')

      if (firstLink) {
        patch.externalUrl = firstLink.url
        if (firstLink.label) {
          patch.externalLabel = firstLink.label
        } else {
          clearField('externalLabel')
        }
      } else {
        clearField('externalUrl')
        clearField('externalLabel')
      }

      if (hasLinks) {
        patch.externalLinks = finalLinks
      } else {
        clearField('externalLinks')
      }
    }

    // Validate the complete merged item locally before triggering onSave
    const updatedItem = {
      ...item,
      ...patch,
    }

    // Strip undefined keys from updatedItem to match real shape expected by validator
    Object.keys(updatedItem).forEach(key => {
      if ((updatedItem as Record<string, unknown>)[key] === undefined) {
        delete (updatedItem as Record<string, unknown>)[key]
      }
    })

    const validationResult = DocumentItemSchema.safeParse(updatedItem)
    if (!validationResult.success) {
      const errorText = validationResult.error.issues.map(issue => {
        let fieldName = issue.path.join('.')
        fieldName = fieldName
          .replace('externalUrl', 'Đường dẫn ngoài')
          .replace('externalLabel', 'Nhãn nút mở link')
          .replace('embedUrl', 'Đường dẫn iframe/YouTube')
          .replace('title', 'Tiêu đề')
          .replace('year', 'Năm')
          .replace(/externalLinks\.(\d+)\.url/, (_, idx) => `Đường dẫn liên kết #${parseInt(idx) + 1}`)
          .replace(/externalLinks\.(\d+)\.label/, (_, idx) => `Nhãn nút liên kết #${parseInt(idx) + 1}`)
        return `• ${fieldName}: ${issue.message}`
      }).join('\n')
      setMediaError(`Dữ liệu chưa hợp lệ:\n${errorText}`)
      return
    }

    onSave(patch)
  }

  const canSave = Boolean(
    form.title.trim() && form.periodId &&
    (form.contentType === 'image' ? true : form.contentType === 'youtube' || form.contentType === 'iframe' ? form.embedUrl.trim() : form.externalUrl.trim())
  )

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <span style={styles.modalTitle}>Sửa thông tin</span>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <div style={styles.modalBody}>
          <div style={styles.formGrid}>
            <FormField label="Loại tư liệu *" style={{ gridColumn: '1 / -1' }}>
              <select style={styles.input} value={form.contentType} onChange={(e) => setForm((f) => ({ ...f, contentType: e.target.value as ContentItemType }))}>
                <option value="image">Ảnh</option>
                <option value="youtube">Iframe YouTube</option>
                <option value="iframe">Iframe tài liệu / Drive PDF</option>
                <option value="external">Link ngoài</option>
              </select>
            </FormField>
            {form.contentType === 'youtube' && (
              <FormField label="Link YouTube *" style={{ gridColumn: '1 / -1' }}>
                <input style={styles.input} placeholder="https://www.youtube.com/watch?v=..." value={form.embedUrl} onChange={(e) => setForm((f) => ({ ...f, embedUrl: e.target.value }))} />
              </FormField>
            )}
            {form.contentType === 'iframe' && (
              <FormField label="Link iframe tài liệu *" style={{ gridColumn: '1 / -1' }}>
                <input style={styles.input} placeholder="https://drive.google.com/file/d/.../view hoặc /preview" value={form.embedUrl} onChange={(e) => setForm((f) => ({ ...f, embedUrl: e.target.value }))} />
              </FormField>
            )}
            {form.contentType === 'external' && (
              <>
                <FormField label="Đường dẫn ngoài *" style={{ gridColumn: '1 / -1' }}>
                  <input style={styles.input} placeholder="https://..." value={form.externalUrl} onChange={(e) => setForm((f) => ({ ...f, externalUrl: e.target.value }))} />
                </FormField>
                <FormField label="Nhãn nút mở link" style={{ gridColumn: '1 / -1' }}>
                  <input style={styles.input} placeholder="Mở trang" value={form.externalLabel} onChange={(e) => setForm((f) => ({ ...f, externalLabel: e.target.value }))} />
                </FormField>
              </>
            )}
            {(form.contentType === 'external' || form.contentType === 'image') && (
              <div style={{ gridColumn: '1 / -1', border: '1px solid #3a2e1e', borderRadius: '8px', padding: '16px', background: 'rgba(255,255,255,0.02)', marginTop: '8px', marginBottom: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#9a9080', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Danh sách liên kết đính kèm {form.contentType === 'image' ? '' : '(Không bắt buộc)'}</span>
                  <button
                    type="button"
                    style={{ background: '#3a2e1e', border: '1px solid #4a3e2e', color: '#f0e8d8', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                    onClick={() => {
                      const currentLinks = form.externalLinks || [];
                      setForm((f) => ({
                        ...f,
                        externalLinks: [...currentLinks, { url: '', label: '' }],
                      }));
                    }}
                  >
                    + Thêm link
                  </button>
                </div>
                {(!form.externalLinks || form.externalLinks.length === 0) ? (
                  <div style={{ fontSize: '12px', color: '#6a5a40', fontStyle: 'italic' }}>Chưa có liên kết đính kèm nào. Bấm "+ Thêm link" để đính kèm đường dẫn.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {form.externalLinks.map((link, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          style={{ ...styles.input, flex: 2 }}
                          placeholder="Nhãn nút (VD: Xem chi tiết)"
                          value={link.label || ''}
                          onChange={(e) => {
                            const newLinks = [...form.externalLinks];
                            const curr = newLinks[idx];
                            if (curr) {
                              newLinks[idx] = { ...curr, label: e.target.value };
                              setForm((f) => ({ ...f, externalLinks: newLinks }));
                            }
                          }}
                        />
                        <input
                          style={{ ...styles.input, flex: 3 }}
                          placeholder="https://..."
                          value={link.url}
                          onChange={(e) => {
                            const newLinks = [...form.externalLinks];
                            const curr = newLinks[idx];
                            if (curr) {
                              newLinks[idx] = { ...curr, url: e.target.value };
                              setForm((f) => ({ ...f, externalLinks: newLinks }));
                            }
                          }}
                        />
                        <button
                          type="button"
                          style={{ background: 'rgba(200,90,90,0.15)', border: '1px solid #c85a5a', color: '#ff8888', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                          onClick={() => {
                            const newLinks = form.externalLinks.filter((_, i) => i !== idx);
                            setForm((f) => ({ ...f, externalLinks: newLinks }));
                          }}
                        >
                          Xóa
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <FormField label="Tiêu đề *" required style={{ gridColumn: '1 / -1' }}>
              <input style={styles.input} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </FormField>
            <FormField label="Năm">
              <input style={styles.input} type="text" placeholder="VD: 1975, Thập niên 90... (không bắt buộc)" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))} />
            </FormField>
            <FormField label="Thứ tự ưu tiên (Priority)">
              <input style={styles.input} type="number" min="0" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: +e.target.value }))} />
            </FormField>
            <FormField label="Thời kỳ" style={{ gridColumn: '1 / -1' }}>
              <select style={styles.input} value={form.periodId} onChange={(e) => setForm((f) => ({ ...f, periodId: e.target.value }))}>
                {periods.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </FormField>
            <FormField label="Mô tả ngắn" style={{ gridColumn: '1 / -1' }}>
              <input style={styles.input} value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} />
            </FormField>
            <FormField label="Mô tả đầy đủ" style={{ gridColumn: '1 / -1' }}>
              <textarea style={{ ...styles.input, height: '80px', resize: 'vertical' }} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
            </FormField>
            <FormField label="Tags" style={{ gridColumn: '1 / -1' }}>
              <input style={styles.input} value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} />
            </FormField>
            <FormField label="Nguồn" style={{ gridColumn: '1 / -1' }}>
              <input style={styles.input} value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} />
            </FormField>
          </div>

          <div style={styles.mediaPanel}>
            <div style={styles.mediaHeader}>
              <div>
                <div style={styles.mediaTitle}>Ảnh trong tư liệu</div>
                <div style={styles.mediaSub}>Ảnh chính dùng cho thumb/tường; ảnh phụ hiển thị thêm trong detail của cùng page.</div>
              </div>
              <div style={styles.mediaActions}>
                <button style={styles.cardBtn} onClick={() => replaceMainRef.current?.click()} disabled={!!mediaBusy}>Thay ảnh chính</button>
                <button style={styles.cardBtn} onClick={() => addImagesRef.current?.click()} disabled={!!mediaBusy}>Thêm ảnh phụ</button>
              </div>
              <input ref={replaceMainRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleReplaceMainImage(f); e.currentTarget.value = '' }} />
              <input ref={addImagesRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => { void handleAddDetailImages(e.target.files); e.currentTarget.value = '' }} />
            </div>
            <div style={styles.mediaGrid}>
              {images.map((image, index) => (
                <div key={image.id} style={styles.mediaItem}>
                  <img src={getDocumentImageUrl(item, image)} alt={image.alt ?? item.title} style={styles.mediaThumb} />
                  <div style={styles.mediaFields}>
                    <div style={styles.mediaKind}>{image.id === form.viewerImageId ? 'Ảnh viewer' : image.id === form.thumbnailImageId ? 'Ảnh thumbnail' : 'Ảnh phụ'}</div>
                    <input style={styles.input} value={image.caption ?? ''} placeholder="Caption" onChange={(e) => updateImage(image.id, { caption: e.target.value })} />
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        style={{
                          ...styles.cardBtn,
                          width: '28px',
                          flex: 'none',
                          opacity: index === 0 ? 0.3 : 1,
                          cursor: index === 0 ? 'not-allowed' : 'pointer',
                        }}
                        disabled={index === 0}
                        onClick={() => handleMoveImage(index, 'up')}
                        title="Di chuyển lên"
                      >
                        ▲
                      </button>
                      <button
                        style={{
                          ...styles.cardBtn,
                          width: '28px',
                          flex: 'none',
                          opacity: index === images.length - 1 ? 0.3 : 1,
                          cursor: index === images.length - 1 ? 'not-allowed' : 'pointer',
                        }}
                        disabled={index === images.length - 1}
                        onClick={() => handleMoveImage(index, 'down')}
                        title="Di chuyển xuống"
                      >
                        ▼
                      </button>
                      <button style={styles.cardBtn} onClick={() => setForm((f) => ({ ...f, viewerImageId: image.id }))}>Dùng làm viewer</button>
                      <button style={styles.cardBtn} onClick={() => setForm((f) => ({ ...f, thumbnailImageId: image.id }))}>Dùng làm thumb</button>
                      <button style={{ ...styles.cardBtn, color: '#c85a5a' }} onClick={() => removeImage(image.id)}>Xóa</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {mediaBusy && <div style={styles.busyMsg}>{mediaBusy}</div>}
            {mediaError && <div style={styles.errorMsg}>{mediaError}</div>}
          </div>
        </div>
        <div style={styles.modalFooter}>
          <button style={styles.cancelBtn} onClick={onClose}>Hủy</button>
          <button style={{ ...styles.submitBtn, opacity: canSave ? 1 : 0.5 }} onClick={handleSave} disabled={!canSave}>Lưu thay đổi</button>
        </div>
      </div>
    </div>
  )
}

function FormField({ label, required, style, children }: {
  label: string
  required?: boolean
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', ...style }}>
      <label style={styles.label}>
        {label}{required && <span style={{ color: '#c85a5a' }}> *</span>}
      </label>
      {children}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' },
  toolbar: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '20px 24px', borderBottom: '1px solid #2a1e10', flexShrink: 0,
  },
  title: { fontSize: '20px', fontWeight: 700, color: '#f0e8d8' },
  sub: { fontSize: '12px', color: '#6a5a40', marginTop: '3px' },
  uploadBtn: {
    padding: '10px 18px', background: 'rgba(200,168,90,0.12)',
    border: '1px solid #c8a85a', borderRadius: '8px',
    color: '#c8a85a', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },
  filters: {
    display: 'flex', gap: '10px', padding: '12px 24px',
    borderBottom: '1px solid #1a1208', flexShrink: 0,
  },
  searchInput: {
    flex: 1, padding: '8px 12px',
    background: 'rgba(255,255,255,0.06)', border: '1px solid #3a2e1e',
    borderRadius: '6px', color: '#f0e8d8', outline: 'none',
  },
  filterSelect: {
    padding: '8px 12px', minWidth: '200px',
    background: 'rgba(255,255,255,0.06)', border: '1px solid #3a2e1e',
    borderRadius: '6px', color: '#f0e8d8', outline: 'none',
  },
  grid: {
    flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 24px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 260px))',
    gridAutoRows: 'minmax(340px, auto)',
    gap: '16px',
    alignContent: 'start',
  },
  empty: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#6a5a40', fontSize: '14px', padding: '40px',
  },
  card: {
    background: 'rgba(255,255,255,0.04)', border: '1px solid #2a1e10',
    borderRadius: '10px',
    display: 'flex', flexDirection: 'column',
  },
  cardThumbWrap: {
    position: 'relative', width: '100%', aspectRatio: '4/3', overflow: 'hidden',
    background: '#1a1208', flexShrink: 0,
    borderTopLeftRadius: '9px', borderTopRightRadius: '9px',
  },
  cardThumb: { width: '100%', height: '100%', objectFit: 'cover' },
  typeBadge: {
    position: 'absolute', top: '6px', left: '6px',
    background: 'rgba(15,10,6,0.85)', border: '1px solid rgba(200,168,90,0.35)', borderRadius: '10px',
    padding: '2px 8px', fontSize: '10px', fontWeight: 700, color: '#c8a85a',
  },
  assignBadge: {
    position: 'absolute', top: '6px', right: '6px',
    background: 'rgba(90,200,90,0.85)', borderRadius: '10px',
    padding: '2px 8px', fontSize: '10px', fontWeight: 700, color: '#fff',
  },
  cardBody: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 },
  cardTitle: { fontSize: '13px', fontWeight: 600, color: '#f0e8d8', lineHeight: 1.3 },
  cardMeta: { fontSize: '11px', color: '#6a5a40' },
  tagRow: { display: 'flex', gap: '4px', flexWrap: 'wrap' },
  tag: {
    fontSize: '10px', padding: '2px 6px',
    background: 'rgba(200,168,90,0.1)', border: '1px solid rgba(200,168,90,0.2)',
    borderRadius: '4px', color: '#c8a85a',
  },
  cardActions: { display: 'flex', gap: '6px', paddingTop: '4px' },
  cardBtn: {
    flex: 1, padding: '6px', background: 'rgba(255,255,255,0.04)',
    border: '1px solid #3a2e1e', borderRadius: '5px',
    color: '#9a9080', fontSize: '11px', cursor: 'pointer',
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100, backdropFilter: 'blur(4px)',
  },
  modal: {
    background: '#0f0a06', border: '1px solid #3a2e1e', borderRadius: '14px',
    width: '620px', maxWidth: '95vw', maxHeight: '90vh',
    display: 'flex', flexDirection: 'column',
  },
  modalHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 24px', borderBottom: '1px solid #2a1e10',
  },
  modalTitle: { fontSize: '16px', fontWeight: 700, color: '#c8a85a' },
  closeBtn: { background: 'none', border: 'none', color: '#6a5a40', fontSize: '20px', cursor: 'pointer', padding: '4px 8px', lineHeight: 1 },
  modalBody: { flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' },
  modalFooter: { display: 'flex', gap: '10px', justifyContent: 'flex-end', padding: '16px 24px', borderTop: '1px solid #2a1e10' },
  dropZone: {
    border: '2px dashed #3a2e1e', borderRadius: '10px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', minHeight: '140px', overflow: 'hidden',
    color: '#6a5a40', fontSize: '13px', textAlign: 'center',
  },
  dropZoneWithPreview: { border: '2px solid #5a4a30', minHeight: '200px' },
  dropHint: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '20px' },
  dropIcon: {
    width: '44px', height: '32px', border: '1px solid #5a4a30', borderRadius: '6px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#c8a85a',
  },
  previewImg: { width: '100%', maxHeight: '220px', objectFit: 'contain', background: '#1a1208' },
  multiPreviewGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(75px, 1fr))',
    gap: '8px', width: '100%', maxHeight: '160px', overflowY: 'auto', padding: '8px 12px',
  },
  multiPreviewItem: { position: 'relative', borderRadius: '4px', overflow: 'hidden', border: '1px solid #3a2e1e', background: '#1a1208' },
  multiPreviewBadge: { position: 'absolute', top: '2px', left: '2px', background: 'rgba(0,0,0,0.8)', borderRadius: '3px', padding: '1px 4px', fontSize: '9px', fontWeight: 700, color: '#c8a85a', zIndex: 1 },
  mainPreviewBadge: { position: 'absolute', top: '2px', left: '2px', background: '#c8a85a', borderRadius: '3px', padding: '1px 4px', fontSize: '9px', fontWeight: 700, color: '#000', zIndex: 1 },
  multiPreviewControls: { position: 'absolute', bottom: '2px', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '2px', background: 'rgba(0,0,0,0.6)', padding: '2px 0', zIndex: 1 },
  miniBtn: { padding: '1px 5px', fontSize: '9px', background: '#2a1e10', border: '1px solid #5a4a30', borderRadius: '3px', color: '#f0e8d8', cursor: 'pointer', lineHeight: 1 },
  multiPreviewThumb: { width: '100%', height: '55px', objectFit: 'cover', borderRadius: '4px', display: 'block' },
  addMoreCard: { border: '1px dashed #5a4a30', borderRadius: '4px', height: '55px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.02)' },
  typePanel: {
    border: '1px solid #3a2e1e', borderRadius: '10px', background: 'rgba(200,168,90,0.07)',
    padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px',
  },
  typePanelTitle: { fontSize: '13px', fontWeight: 700, color: '#c8a85a' },
  typePanelText: { fontSize: '12px', color: '#9a9080', lineHeight: 1.5 },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  mediaPanel: { border: '1px solid #2a1e10', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255,255,255,0.025)' },
  mediaHeader: { display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' },
  mediaTitle: { fontSize: '13px', fontWeight: 700, color: '#c8a85a' },
  mediaSub: { fontSize: '11px', color: '#6a5a40', marginTop: '3px', lineHeight: 1.45 },
  mediaActions: { display: 'flex', gap: '8px', flexShrink: 0 },
  mediaGrid: { display: 'grid', gridTemplateColumns: '1fr', gap: '10px' },
  mediaItem: { display: 'grid', gridTemplateColumns: '120px 1fr', gap: '10px', border: '1px solid #2a1e10', borderRadius: '8px', padding: '8px', background: 'rgba(0,0,0,0.12)' },
  mediaThumb: { width: '120px', height: '82px', objectFit: 'cover', borderRadius: '6px', background: '#1a1208' },
  mediaFields: { display: 'flex', flexDirection: 'column', gap: '7px', minWidth: 0 },
  mediaKind: { fontSize: '11px', color: '#9a9080' },
  label: { fontSize: '12px', color: '#9a9080' },
  input: {
    padding: '8px 10px', background: 'rgba(255,255,255,0.06)',
    border: '1px solid #3a2e1e', borderRadius: '6px',
    color: '#f0e8d8', outline: 'none', width: '100%',
  },
  errorMsg: { color: '#c85a5a', fontSize: '13px', padding: '8px 12px', background: 'rgba(200,90,90,0.1)', borderRadius: '6px' },
  busyMsg: { color: '#c8a85a', fontSize: '13px', textAlign: 'center', padding: '8px' },
  cancelBtn: { padding: '9px 20px', background: 'none', border: '1px solid #3a2e1e', borderRadius: '7px', color: '#9a9080', cursor: 'pointer', fontSize: '13px' },
  submitBtn: { padding: '9px 20px', background: 'rgba(200,168,90,0.15)', border: '1px solid #c8a85a', borderRadius: '7px', color: '#c8a85a', cursor: 'pointer', fontSize: '13px', fontWeight: 600 },
  pagination: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    padding: '16px 24px', borderTop: '1px solid #1a1208', flexShrink: 0,
  },
  pageBtn: {
    padding: '6px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid #3a2e1e',
    borderRadius: '6px', color: '#9a9080', cursor: 'pointer', fontSize: '12px', transition: 'all 0.2s',
  },
  pageBtnActive: {
    background: 'rgba(200,168,90,0.15)', border: '1px solid #c8a85a', color: '#c8a85a', fontWeight: 600,
  },
  pageBtnDisabled: {
    opacity: 0.4, cursor: 'not-allowed',
  },
  pageEllipsis: {
    color: '#6a5a40', padding: '0 4px', fontSize: '12px',
  },
}
