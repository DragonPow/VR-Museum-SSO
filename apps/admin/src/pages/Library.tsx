import { useState, useRef, useMemo } from 'react'
import type { Item, MediaType } from '@vm/shared'
import { useDraftStore } from '../store.js'
import { uploadFile, checkApi } from '../api.js'
import { resizeImage, blobToObjectUrl } from '../util/imageResize.js'
import { nanoid } from '../util/nanoid.js'
import { resolveAssetUrl } from '@vm/shared'

const ASSET_BASE_URL = (import.meta.env.VITE_ASSET_BASE_URL ?? '').replace(/\/+$/, '')
const assetUrl = (u?: string | null) => resolveAssetUrl(u, { assetBaseUrl: ASSET_BASE_URL }) ?? undefined

const YOUTUBE_PREVIEW = '/content/images/photo-2025.png'
const EXTERNAL_PREVIEW = '/content/images/photo-1995.png'

type UploadStep = 'form' | 'resizing' | 'uploading' | 'done' | 'error'
type ContentItemType = 'image' | 'youtube' | 'external'

function getItemContentType(item: Item): ContentItemType {
  if (item.embedUrl) return 'youtube'
  if (item.externalUrl) return 'external'
  return 'image'
}

function getItemTypeLabel(item: Item) {
  const type = getItemContentType(item)
  if (type === 'youtube') return 'YouTube'
  if (type === 'external') return 'Link ngoài'
  if (item.mediaType === 'video') return 'Video'
  if (item.mediaType === 'audio') return 'Audio'
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

function splitTags(value: string) {
  return value.split(',').map((t) => t.trim()).filter(Boolean)
}

export function Library() {
  const content = useDraftStore((s) => s.content)
  const addItem = useDraftStore((s) => s.addItem)
  const updateItem = useDraftStore((s) => s.updateItem)
  const removeItem = useDraftStore((s) => s.removeItem)

  const [showUpload, setShowUpload] = useState(false)
  const [search, setSearch] = useState('')
  const [periodFilter, setPeriodFilter] = useState('')
  const [editId, setEditId] = useState<string | null>(null)

  if (!content) return <div style={styles.empty}>Đang tải...</div>

  const assignCount = useMemo(() => {
    const counts: Record<string, number> = {}
    content.rooms.flatMap((r) => r.slots).forEach((s) => {
      if (s.itemId) counts[s.itemId] = (counts[s.itemId] ?? 0) + 1
    })
    return counts
  }, [content.rooms])

  const filtered = content.items.filter((it) => {
    const typeLabel = getItemTypeLabel(it).toLowerCase()
    const query = search.toLowerCase()
    const matchSearch = !search ||
      it.title.toLowerCase().includes(query) ||
      it.tags.some((t) => t.toLowerCase().includes(query)) ||
      String(it.year).includes(search) ||
      typeLabel.includes(query)
    const matchPeriod = !periodFilter || it.periodId === periodFilter
    return matchSearch && matchPeriod
  })

  const editItem = editId ? content.items.find((it) => it.id === editId) : null

  return (
    <div style={styles.root}>
      <div style={styles.toolbar}>
        <div>
          <h2 style={styles.title}>Thư viện tư liệu</h2>
          <p style={styles.sub}>{content.items.length} tư liệu · {Object.values(assignCount).reduce((a, b) => a + b, 0)} lần gán</p>
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
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          style={styles.filterSelect}
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value)}
        >
          <option value="">Tất cả thời kỳ</option>
          {content.periods.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div style={styles.empty}>
          {content.items.length === 0
            ? 'Chưa có tư liệu nào. Nhấn "Thêm tư liệu" để bắt đầu.'
            : 'Không tìm thấy tư liệu phù hợp.'}
        </div>
      ) : (
        <div style={styles.grid}>
          {filtered.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              assignCount={assignCount[item.id] ?? 0}
              onEdit={() => setEditId(item.id)}
              onRemove={() => {
                if (confirm(`Xóa "${item.title}"? Tư liệu sẽ bị bỏ gán khỏi tất cả slot.`)) {
                  removeItem(item.id)
                }
              }}
            />
          ))}
        </div>
      )}

      {showUpload && (
        <UploadModal
          periods={content.periods}
          onClose={() => setShowUpload(false)}
          onDone={(item) => { addItem(item); setShowUpload(false) }}
        />
      )}

      {editItem && (
        <EditModal
          item={editItem}
          periods={content.periods}
          onClose={() => setEditId(null)}
          onSave={(patch) => { updateItem(editItem.id, patch); setEditId(null) }}
        />
      )}
    </div>
  )
}

function ItemCard({ item, assignCount, onEdit, onRemove }: {
  item: Item
  assignCount: number
  onEdit: () => void
  onRemove: () => void
}) {
  return (
    <div style={styles.card}>
      <div style={styles.cardThumbWrap}>
        <img src={assetUrl(item.thumbUrl)} alt={item.title} style={styles.cardThumb} loading="lazy" />
        <div style={styles.typeBadge}>{getItemTypeLabel(item)}</div>
        {assignCount > 0 && (
          <div style={styles.assignBadge}>{assignCount} slot</div>
        )}
      </div>
      <div style={styles.cardBody}>
        <div style={styles.cardTitle}>{item.title}</div>
        <div style={styles.cardMeta}>{item.year} · {item.source || 'Chưa rõ nguồn'}</div>
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
  onDone: (item: Item) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [step, setStep] = useState<UploadStep>('form')
  const [errorMsg, setErrorMsg] = useState('')

  const [form, setForm] = useState({
    contentType: 'image' as ContentItemType,
    title: '', year: new Date().getFullYear(), periodId: periods[0]?.id ?? '',
    shortDesc: '', longDesc: '', tags: '', source: '',
    embedUrl: '', externalUrl: '', externalLabel: '',
  })

  const handleFile = (file: File) => {
    setSelectedFile(file)
    const url = URL.createObjectURL(file)
    setPreview(url)
    if (!form.title) setForm((f) => ({ ...f, title: file.name.replace(/\.[^.]+$/, '') }))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file?.type.startsWith('image/')) handleFile(file)
  }

  const buildCommonItem = (itemId: string) => ({
    id: itemId,
    title: form.title.trim(),
    year: form.year,
    periodId: form.periodId,
    shortDesc: form.shortDesc.trim(),
    longDesc: form.longDesc.trim(),
    tags: splitTags(form.tags),
    source: form.source.trim(),
    approvedBy: '',
    priority: 0,
    status: 'draft' as const,
  })

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.periodId) return
    if (form.contentType === 'image' && !selectedFile) return
    if (form.contentType === 'youtube' && !form.embedUrl.trim()) return
    if (form.contentType === 'external' && !form.externalUrl.trim()) return

    setErrorMsg('')
    try {
      const itemId = `item-${nanoid(8)}`
      const common = buildCommonItem(itemId)

      if (form.contentType === 'youtube') {
        const item: Item = {
          ...common,
          mediaType: 'video' as MediaType,
          thumbUrl: YOUTUBE_PREVIEW,
          wallTextureUrl: YOUTUBE_PREVIEW,
          fullUrl: YOUTUBE_PREVIEW,
          embedUrl: normalizeYouTubeUrl(form.embedUrl),
        }
        setStep('done')
        onDone(item)
        return
      }

      if (form.contentType === 'external') {
        const item: Item = {
          ...common,
          mediaType: 'image' as MediaType,
          thumbUrl: EXTERNAL_PREVIEW,
          wallTextureUrl: EXTERNAL_PREVIEW,
          fullUrl: EXTERNAL_PREVIEW,
          externalUrl: form.externalUrl.trim(),
          externalLabel: form.externalLabel.trim() || 'Mở trang',
        }
        setStep('done')
        onDone(item)
        return
      }

      if (!selectedFile) return
      setStep('resizing')
      const variants = await resizeImage(selectedFile)
      setStep('uploading')

      const apiAvailable = await checkApi()
      const rawExt = (selectedFile.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')

      let thumbUrl: string, wallUrl: string, fullUrl: string, rawUrl: string
      if (apiAvailable) {
        ;[thumbUrl, wallUrl, fullUrl, rawUrl] = await Promise.all([
          uploadFile(variants.thumb, `content/media/${itemId}/thumb.webp`),
          uploadFile(variants.wall,  `content/media/${itemId}/wall.webp`),
          uploadFile(variants.full,  `content/media/${itemId}/full.webp`),
          uploadFile(selectedFile,   `content/media/${itemId}/raw.${rawExt}`),
        ])
      } else {
        thumbUrl = blobToObjectUrl(variants.thumb)
        wallUrl  = blobToObjectUrl(variants.wall)
        fullUrl  = blobToObjectUrl(variants.full)
        rawUrl   = blobToObjectUrl(selectedFile)
      }

      const item: Item = {
        ...common,
        mediaType: 'image' as MediaType,
        thumbUrl,
        wallTextureUrl: wallUrl,
        fullUrl,
        rawUrl,
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
    form.title.trim() && form.periodId && !busy &&
    (form.contentType === 'image' ? selectedFile : form.contentType === 'youtube' ? form.embedUrl.trim() : form.externalUrl.trim())
  )

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <span style={styles.modalTitle}>Thêm tư liệu</span>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={styles.modalBody}>
          {form.contentType === 'image' ? (
            <div
              style={{ ...styles.dropZone, ...(preview ? styles.dropZoneWithPreview : {}) }}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
            >
              {preview ? (
                <img src={preview} alt="preview" style={styles.previewImg} />
              ) : (
                <div style={styles.dropHint}>
                  <div style={styles.dropIcon}>IMG</div>
                  <div>Kéo thả ảnh vào đây hoặc click để chọn</div>
                  <div style={{ fontSize: '12px', color: '#6a5a40' }}>JPG, PNG, WebP - tự động resize</div>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </div>
          ) : (
            <div style={styles.typePanel}>
              <div style={styles.typePanelTitle}>{form.contentType === 'youtube' ? 'Iframe YouTube' : 'Link ngoài'}</div>
              <div style={styles.typePanelText}>
                {form.contentType === 'youtube'
                  ? 'Nhập link YouTube, khi khách bấm slot sẽ mở iframe video trực tiếp.'
                  : 'Nhập đường dẫn ngoài, khi khách bấm slot sẽ hiện hộp xác nhận trước khi rời trang.'}
              </div>
            </div>
          )}

          <div style={styles.formGrid}>
            <FormField label="Loại tư liệu *" style={{ gridColumn: '1 / -1' }}>
              <select style={styles.input} value={form.contentType} onChange={(e) => setForm((f) => ({ ...f, contentType: e.target.value as ContentItemType }))}>
                <option value="image">Ảnh</option>
                <option value="youtube">Iframe YouTube</option>
                <option value="external">Link ngoài</option>
              </select>
            </FormField>
            {form.contentType === 'youtube' && (
              <FormField label="Link YouTube *" style={{ gridColumn: '1 / -1' }}>
                <input style={styles.input} placeholder="https://www.youtube.com/watch?v=..." value={form.embedUrl} onChange={(e) => setForm((f) => ({ ...f, embedUrl: e.target.value }))} />
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
            <FormField label="Tiêu đề *" required>
              <input style={styles.input} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </FormField>
            <FormField label="Năm *">
              <input style={styles.input} type="number" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: +e.target.value }))} />
            </FormField>
            <FormField label="Thời kỳ *" style={{ gridColumn: '1 / -1' }}>
              <select style={styles.input} value={form.periodId} onChange={(e) => setForm((f) => ({ ...f, periodId: e.target.value }))}>
                {periods.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </FormField>
            <FormField label="Mô tả ngắn" style={{ gridColumn: '1 / -1' }}>
              <input style={styles.input} value={form.shortDesc} onChange={(e) => setForm((f) => ({ ...f, shortDesc: e.target.value }))} />
            </FormField>
            <FormField label="Mô tả đầy đủ" style={{ gridColumn: '1 / -1' }}>
              <textarea style={{ ...styles.input, height: '80px', resize: 'vertical' }} value={form.longDesc} onChange={(e) => setForm((f) => ({ ...f, longDesc: e.target.value }))} />
            </FormField>
            <FormField label="Tags (cách nhau bởi dấu phẩy)" style={{ gridColumn: '1 / -1' }}>
              <input style={styles.input} placeholder="kỷ niệm, lãnh đạo, 1975" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} />
            </FormField>
            <FormField label="Nguồn / Tác giả" style={{ gridColumn: '1 / -1' }}>
              <input style={styles.input} value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} />
            </FormField>
          </div>

          {step === 'error' && <div style={styles.errorMsg}>{errorMsg}</div>}
          {busy && (
            <div style={styles.busyMsg}>
              {step === 'resizing' ? 'Đang xử lý ảnh...' : 'Đang tải lên...'}
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
  item: Item
  periods: { id: string; title: string }[]
  onClose: () => void
  onSave: (patch: Partial<Item>) => void
}) {
  const [form, setForm] = useState({
    contentType: getItemContentType(item),
    title: item.title, year: item.year, periodId: item.periodId,
    shortDesc: item.shortDesc, longDesc: item.longDesc,
    tags: item.tags.join(', '), source: item.source,
    embedUrl: item.embedUrl ?? '',
    externalUrl: item.externalUrl ?? '',
    externalLabel: item.externalLabel ?? '',
  })

  const handleSave = () => {
    const patch: Partial<Item> = {
      title: form.title.trim(),
      year: form.year,
      periodId: form.periodId,
      shortDesc: form.shortDesc.trim(),
      longDesc: form.longDesc.trim(),
      tags: splitTags(form.tags),
      source: form.source.trim(),
      approvedBy: item.approvedBy ?? '',
      status: item.status ?? 'draft',
    }

    const clearField = (key: keyof Item) => {
      ;(patch as Record<string, unknown>)[key] = undefined
    }

    if (form.contentType === 'youtube') {
      patch.mediaType = 'video' as MediaType
      patch.embedUrl = normalizeYouTubeUrl(form.embedUrl)
      clearField('externalUrl')
      clearField('externalLabel')
      if (!item.thumbUrl) patch.thumbUrl = YOUTUBE_PREVIEW
      if (!item.wallTextureUrl) patch.wallTextureUrl = YOUTUBE_PREVIEW
      if (!item.fullUrl) patch.fullUrl = YOUTUBE_PREVIEW
    } else if (form.contentType === 'external') {
      patch.mediaType = 'image' as MediaType
      clearField('embedUrl')
      patch.externalUrl = form.externalUrl.trim()
      patch.externalLabel = form.externalLabel.trim() || 'Mở trang'
      if (!item.thumbUrl) patch.thumbUrl = EXTERNAL_PREVIEW
      if (!item.wallTextureUrl) patch.wallTextureUrl = EXTERNAL_PREVIEW
      if (!item.fullUrl) patch.fullUrl = EXTERNAL_PREVIEW
    } else {
      patch.mediaType = 'image' as MediaType
      clearField('embedUrl')
      clearField('externalUrl')
      clearField('externalLabel')
    }

    onSave(patch)
  }

  const canSave = Boolean(
    form.title.trim() && form.periodId &&
    (form.contentType === 'image' ? true : form.contentType === 'youtube' ? form.embedUrl.trim() : form.externalUrl.trim())
  )

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
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
                <option value="external">Link ngoài</option>
              </select>
            </FormField>
            {form.contentType === 'youtube' && (
              <FormField label="Link YouTube *" style={{ gridColumn: '1 / -1' }}>
                <input style={styles.input} placeholder="https://www.youtube.com/watch?v=..." value={form.embedUrl} onChange={(e) => setForm((f) => ({ ...f, embedUrl: e.target.value }))} />
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
            <FormField label="Tiêu đề *" required>
              <input style={styles.input} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </FormField>
            <FormField label="Năm">
              <input style={styles.input} type="number" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: +e.target.value }))} />
            </FormField>
            <FormField label="Thời kỳ" style={{ gridColumn: '1 / -1' }}>
              <select style={styles.input} value={form.periodId} onChange={(e) => setForm((f) => ({ ...f, periodId: e.target.value }))}>
                {periods.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </FormField>
            <FormField label="Mô tả ngắn" style={{ gridColumn: '1 / -1' }}>
              <input style={styles.input} value={form.shortDesc} onChange={(e) => setForm((f) => ({ ...f, shortDesc: e.target.value }))} />
            </FormField>
            <FormField label="Mô tả đầy đủ" style={{ gridColumn: '1 / -1' }}>
              <textarea style={{ ...styles.input, height: '80px', resize: 'vertical' }} value={form.longDesc} onChange={(e) => setForm((f) => ({ ...f, longDesc: e.target.value }))} />
            </FormField>
            <FormField label="Tags" style={{ gridColumn: '1 / -1' }}>
              <input style={styles.input} value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} />
            </FormField>
            <FormField label="Nguồn" style={{ gridColumn: '1 / -1' }}>
              <input style={styles.input} value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} />
            </FormField>
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
  root: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
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
    flex: 1, overflowY: 'auto', padding: '20px 24px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '16px',
    alignContent: 'start',
  },
  empty: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#6a5a40', fontSize: '14px', padding: '40px',
  },
  card: {
    background: 'rgba(255,255,255,0.04)', border: '1px solid #2a1e10',
    borderRadius: '10px', overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
  },
  cardThumbWrap: { position: 'relative', aspectRatio: '4/3', overflow: 'hidden', background: '#1a1208' },
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
  cardBody: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 },
  cardTitle: { fontSize: '13px', fontWeight: 600, color: '#f0e8d8', lineHeight: 1.3 },
  cardMeta: { fontSize: '11px', color: '#6a5a40' },
  tagRow: { display: 'flex', gap: '4px', flexWrap: 'wrap' },
  tag: {
    fontSize: '10px', padding: '2px 6px',
    background: 'rgba(200,168,90,0.1)', border: '1px solid rgba(200,168,90,0.2)',
    borderRadius: '4px', color: '#c8a85a',
  },
  cardActions: { display: 'flex', gap: '6px', marginTop: 'auto', paddingTop: '8px' },
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
  typePanel: {
    border: '1px solid #3a2e1e', borderRadius: '10px', background: 'rgba(200,168,90,0.07)',
    padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px',
  },
  typePanelTitle: { fontSize: '13px', fontWeight: 700, color: '#c8a85a' },
  typePanelText: { fontSize: '12px', color: '#9a9080', lineHeight: 1.5 },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
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
}
