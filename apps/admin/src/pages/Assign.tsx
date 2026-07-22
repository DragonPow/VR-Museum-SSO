import { useState, useMemo } from 'react'
import type { Slot, DocumentItem } from '@vm/shared'
import { resolveDocumentImageVariantUrl } from '@vm/shared'
import { useDraftStore } from '../store.js'

const ASSET_BASE_URL = (import.meta.env.VITE_ASSET_BASE_URL ?? '').replace(/\/+$/, '')
const thumbUrl = (document?: DocumentItem | null) =>
  document ? resolveDocumentImageVariantUrl(document.documentKey, document.thumbnailImageId, 'thumb', { assetBaseUrl: ASSET_BASE_URL, assetVersion: import.meta.env.VITE_ASSET_VERSION ?? '' }) ?? undefined : undefined

function getDocumentTypeLabel(document: DocumentItem) {
  if (document.mediaType === 'youtube') return 'YouTube'
  if (document.mediaType === 'iframe') return 'Iframe tài liệu'
  if (document.mediaType === 'external') return 'Link ngoài'
  return 'Ảnh'
}

export function Assign() {
  const content = useDraftStore((s) => s.content)
  const assignDocuments = useDraftStore((s) => s.assignDocuments)

  const [selectedRoomId, setSelectedRoomId] = useState<string>('')
  const [pickerSlot, setPickerSlot] = useState<Slot | null>(null)
  const [draftIds, setDraftIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [periodFilter, setPeriodFilter] = useState('')

  if (!content) return <div style={styles.center}>Đang tải...</div>

  const documentMap = useMemo(
    () => Object.fromEntries(content.documents.map((it) => [it.id, it])),
    [content.documents],
  )

  const selectedRoom = content.rooms.find((r) => r.id === selectedRoomId)

  const pickerDocuments = useMemo(() => {
    let documents = content.documents
    if (search) documents = documents.filter((it) =>
      it.title.toLowerCase().includes(search.toLowerCase()) ||
      (it.year != null && String(it.year).toLowerCase().includes(search.toLowerCase())) ||
      it.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())) ||
      getDocumentTypeLabel(it).toLowerCase().includes(search.toLowerCase()),
    )
    if (periodFilter) documents = documents.filter((it) => it.periodId === periodFilter)
    return documents
  }, [content.documents, search, periodFilter])

  const openPicker = (slot: Slot) => {
    setPickerSlot(slot)
    setDraftIds(slot.documentIds ?? [])
  }

  const toggleDocument = (documentId: string) => {
    setDraftIds((ids) => ids.includes(documentId) ? ids.filter((id) => id !== documentId) : [...ids, documentId])
  }

  const moveDraft = (documentId: string, dir: -1 | 1) => {
    setDraftIds((ids) => {
      const index = ids.indexOf(documentId)
      const nextIndex = index + dir
      if (index < 0 || nextIndex < 0 || nextIndex >= ids.length) return ids
      const next = [...ids]
      const [item] = next.splice(index, 1)
      if (!item) return ids
      next.splice(nextIndex, 0, item)
      return next
    })
  }

  const saveAssign = () => {
    if (!selectedRoom || !pickerSlot) return
    assignDocuments(selectedRoom.id, pickerSlot.id, draftIds)
    setPickerSlot(null)
    setSearch('')
    setPeriodFilter('')
  }

  const roomsByPeriod = content.periods.map((p) => ({
    period: p,
    rooms: content.rooms.filter((r) => r.periodId === p.id).sort((a, b) => a.order - b.order),
  }))

  return (
    <div style={styles.root}>
      <div style={styles.sidebar}>
        <div style={styles.sidebarTitle}>Chọn phòng</div>
        {roomsByPeriod.map(({ period, rooms }) => (
          rooms.length === 0 ? null : (
            <div key={period.id}>
              <div style={{ ...styles.periodHeader, borderLeftColor: period.themeColor }}>
                <span style={{ color: period.themeColor }}>●</span> {period.title}
              </div>
              {rooms.map((room) => {
                const filled = room.slots.filter((s) => (s.documentIds ?? []).length > 0).length
                const total = room.slots.length
                return (
                  <button key={room.id} style={{ ...styles.roomBtn, ...(room.id === selectedRoomId ? styles.roomBtnActive : {}) }} onClick={() => setSelectedRoomId(room.id)}>
                    <span style={styles.roomBtnName}>{room.title}</span>
                    <span style={styles.roomBtnCount}>{filled}/{total}</span>
                  </button>
                )
              })}
            </div>
          )
        ))}
        {content.rooms.length === 0 && <div style={styles.center}>Chưa có phòng nào.</div>}
      </div>

      <div style={styles.main}>
        {!selectedRoom ? (
          <div style={styles.center}>Chọn một phòng để gán tư liệu</div>
        ) : (
          <>
            <div style={styles.mainHeader}>
              <div>
                <h2 style={styles.roomTitle}>{selectedRoom.title}</h2>
                <p style={styles.roomSub}>{selectedRoom.slots.filter((s) => (s.documentIds ?? []).length > 0).length} / {selectedRoom.slots.length} slot đã có tư liệu</p>
              </div>
            </div>
            <div style={styles.scrollArea}>
              {selectedRoom.slots.length === 0 ? (
                <div style={styles.center}>Phòng này chưa có slot nào.</div>
              ) : (
                groupSlotsByZone(selectedRoom.slots).map(({ zone, slots }) => (
                  <div key={zone} style={styles.zoneBlock}>
                    <div style={styles.zoneHeader}>
                      <span>{zone}</span>
                      <span style={styles.zoneCount}>{slots.filter((s) => (s.documentIds ?? []).length > 0).length}/{slots.length}</span>
                    </div>
                    <div style={styles.slotGrid}>
                      {slots.map((slot) => (
                        <SlotCard key={slot.id} slot={slot} documents={(slot.documentIds ?? []).map((id) => documentMap[id]).filter(Boolean) as DocumentItem[]} onClick={() => openPicker(slot)} />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {pickerSlot && (
        <div style={styles.overlay} onClick={() => { setPickerSlot(null); setSearch('') }}>
          <div style={styles.picker} onClick={(e) => e.stopPropagation()}>
            <div style={styles.pickerHeader}>
              <div>
                <span style={styles.pickerTitle}>Gán tư liệu cho slot</span>
                <span style={styles.pickerSlotName}> — {pickerSlot.name}</span>
              </div>
              <button style={styles.closeBtn} onClick={() => { setPickerSlot(null); setSearch('') }}>×</button>
            </div>

            <div style={styles.currentRow}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', color: '#f0e8d8' }}>Đang chọn {draftIds.length} tài liệu = {draftIds.length} page</div>
                <div style={styles.selectedList}>
                  {draftIds.map((id, index) => {
                    const document = documentMap[id]
                    if (!document) return null
                    return (
                      <div key={id} style={styles.selectedPill}>
                        <span>{index + 1}. {document.title}</span>
                        <button style={styles.iconBtn} onClick={() => moveDraft(id, -1)} disabled={index === 0}>↑</button>
                        <button style={styles.iconBtn} onClick={() => moveDraft(id, 1)} disabled={index === draftIds.length - 1}>↓</button>
                        <button style={styles.iconBtn} onClick={() => toggleDocument(id)}>×</button>
                      </div>
                    )
                  })}
                </div>
              </div>
              <button style={styles.unassignBtn} onClick={() => setDraftIds([])}>Bỏ hết</button>
            </div>

            <div style={styles.pickerFilters}>
              <input autoFocus placeholder="Tìm theo tên, năm, tag, loại..." value={search} onChange={(e) => setSearch(e.target.value)} style={styles.pickerSearch} />
              <select value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)} style={styles.pickerSelect}>
                <option value="">Tất cả thời kỳ</option>
                {content.periods.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>

            <div style={styles.pickerGrid}>
              {content.documents.length === 0 && <div style={{ ...styles.center, gridColumn: '1 / -1', padding: '40px' }}>Chưa có tư liệu nào. Hãy thêm tư liệu trước.</div>}
              {pickerDocuments.map((document) => {
                const active = draftIds.includes(document.id)
                return (
                  <div key={document.id} style={{ ...styles.pickerItem, ...(active ? styles.pickerItemActive : {}) }} onClick={() => toggleDocument(document.id)}>
                    <div style={styles.pickerThumbWrap}>
                      <img src={thumbUrl(document)} alt={document.title} style={styles.pickerThumb} />
                      <span style={styles.typeBadge}>{getDocumentTypeLabel(document)}</span>
                    </div>
                    <div style={styles.pickerItemTitle}>{document.title}</div>
                    {document.year && <div style={styles.pickerItemYear}>{document.year}</div>}
                    {active && <div style={styles.pickerCheck}>{draftIds.indexOf(document.id) + 1}</div>}
                  </div>
                )
              })}
              {pickerDocuments.length === 0 && content.documents.length > 0 && <div style={{ ...styles.center, gridColumn: '1 / -1', padding: '40px' }}>Không tìm thấy tư liệu phù hợp.</div>}
            </div>

            <div style={styles.modalFooter}>
              <button style={styles.cancelBtn} onClick={() => setPickerSlot(null)}>Hủy</button>
              <button style={styles.submitBtn} onClick={saveAssign}>Lưu gán</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const ZONE_ORDER = ['Khu 1', 'Khu 2', 'Khu 3', 'Khu 4', 'Khu 5', 'Khu 6', 'Khu 7', 'Khu 8', 'Khu 9']

/** Slot ids look like `VM_Slot_K3_MT_02` (name: `K3_MT_02`). Zone = the K number. */
function fallbackZone(s: Slot): string {
  const m = /K(\d)_(?:CD|MT|MP|AT|AD)_\d+/.exec(s.name || s.id)
  return m ? `Khu ${m[1]}` : 'Khác'
}

function groupSlotsByZone(slots: Slot[]): { zone: string; slots: Slot[] }[] {
  const map = new Map<string, Slot[]>()
  for (const s of slots) {
    const z = s.zone ?? fallbackZone(s)
    const arr = map.get(z)
    if (arr) arr.push(s)
    else map.set(z, [s])
  }
  const rank = (z: string) => {
    const i = ZONE_ORDER.indexOf(z)
    return i === -1 ? 999 : i
  }
  return [...map.entries()].map(([zone, slots]) => ({ zone, slots })).sort((a, b) => rank(a.zone) - rank(b.zone) || a.zone.localeCompare(b.zone))
}

function SlotCard({ slot, documents, onClick }: { slot: Slot; documents: DocumentItem[]; onClick: () => void }) {
  const first = documents[0]
  return (
    <div style={styles.slotCard} onClick={onClick}>
      {first ? (
        <>
          <div style={styles.slotThumbWrap}>
            <img src={thumbUrl(first)} alt={first.title} style={styles.slotThumb} />
            <span style={styles.typeBadge}>{documents.length} page</span>
          </div>
          <div style={styles.slotInfo}>
            <div style={styles.slotName}>{slot.name}</div>
            <div style={styles.slotItemTitle}>{first.year ? `${first.year} · ` : ''}{first.title}</div>
            <div style={styles.slotStatus}>Đã gán {documents.length} tư liệu</div>
          </div>
        </>
      ) : (
        <>
          <div style={styles.slotEmpty}><span style={styles.slotEmptyIcon}>+</span></div>
          <div style={styles.slotInfo}>
            <div style={styles.slotName}>{slot.name}</div>
            <div style={styles.slotEmptyLabel}>Trống - click để gán</div>
          </div>
        </>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: { display: 'flex', height: '100%', minHeight: 0, overflow: 'hidden' },
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#6a5a40', fontSize: '14px', padding: '24px' },
  sidebar: { width: '260px', flexShrink: 0, minHeight: 0, borderRight: '1px solid #2a1e10', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', padding: '12px 0' },
  sidebarTitle: { padding: '4px 16px 8px', fontSize: '11px', fontWeight: 600, color: '#6a5a40', textTransform: 'uppercase', letterSpacing: '0.05em' },
  periodHeader: { padding: '8px 16px 4px', fontSize: '11px', fontWeight: 700, color: '#9a9080', borderLeft: '3px solid', display: 'flex', alignItems: 'center', gap: '6px' },
  roomBtn: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '8px 16px', background: 'none', border: 'none', color: '#9a9080', fontSize: '13px', cursor: 'pointer', textAlign: 'left' },
  roomBtnActive: { background: 'rgba(200,168,90,0.1)', color: '#c8a85a' },
  roomBtnName: { flex: 1 },
  roomBtnCount: { fontSize: '11px', color: '#6a5a40', marginLeft: '8px' },
  main: { flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  mainHeader: { padding: '20px 24px', borderBottom: '1px solid #2a1e10', flexShrink: 0 },
  roomTitle: { fontSize: '18px', fontWeight: 700, color: '#f0e8d8' },
  roomSub: { fontSize: '12px', color: '#6a5a40', marginTop: '3px' },
  zoneBlock: { marginBottom: '22px' },
  zoneHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '2px 2px 8px', marginBottom: '10px', borderBottom: '1px solid #2a1e10', color: '#c8a85a', fontWeight: 600, fontSize: '14px' },
  zoneCount: { color: '#9a9080', fontWeight: 400, fontSize: '12px' },
  slotGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 240px))', gridAutoRows: 'minmax(250px, auto)', gap: '14px', alignContent: 'start' },
  scrollArea: { flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 24px' },
  slotCard: { background: 'rgba(255,255,255,0.04)', border: '1px solid #2a1e10', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column' },
  slotThumbWrap: { position: 'relative', width: '100%', aspectRatio: '4/3', overflow: 'hidden', background: '#1a1208', flexShrink: 0 },
  slotThumb: { width: '100%', height: '100%', objectFit: 'cover' },
  slotEmpty: { width: '100%', aspectRatio: '4/3', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #2a1e10', flexShrink: 0 },
  slotEmptyIcon: { fontSize: '28px', color: '#3a2e1e' },
  slotInfo: { padding: '10px 12px', flexShrink: 0 },
  slotName: { fontSize: '12px', fontWeight: 600, color: '#f0e8d8' },
  slotItemTitle: { fontSize: '11px', color: '#9a9080', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  slotStatus: { fontSize: '11px', color: '#5ac85a', marginTop: '4px' },
  slotEmptyLabel: { fontSize: '11px', color: '#4a3a20', marginTop: '3px' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  picker: { background: '#0f0a06', border: '1px solid #3a2e1e', borderRadius: '14px', width: '820px', maxWidth: '96vw', maxHeight: '88vh', minHeight: 0, display: 'flex', flexDirection: 'column' },
  pickerHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #2a1e10', flexShrink: 0 },
  pickerTitle: { fontSize: '16px', fontWeight: 700, color: '#c8a85a' },
  pickerSlotName: { fontSize: '16px', color: '#9a9080' },
  closeBtn: { background: 'none', border: 'none', color: '#6a5a40', fontSize: '16px', cursor: 'pointer', padding: '4px 8px' },
  currentRow: { display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 24px', background: 'rgba(200,168,90,0.05)', borderBottom: '1px solid #2a1e10', flexShrink: 0 },
  selectedList: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' },
  selectedPill: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 7px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', border: '1px solid #3a2e1e', color: '#f0e8d8', fontSize: '11px' },
  iconBtn: { border: '1px solid #3a2e1e', background: 'rgba(255,255,255,0.04)', color: '#c8a85a', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', lineHeight: 1 },
  unassignBtn: { padding: '6px 12px', background: 'none', border: '1px solid #c85a5a', borderRadius: '5px', color: '#c85a5a', fontSize: '11px', cursor: 'pointer' },
  pickerFilters: { display: 'flex', gap: '10px', padding: '12px 24px', borderBottom: '1px solid #1a1208', flexShrink: 0 },
  pickerSearch: { flex: 1, padding: '8px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid #3a2e1e', borderRadius: '6px', color: '#f0e8d8', outline: 'none' },
  pickerSelect: { padding: '8px 12px', minWidth: '180px', background: 'rgba(255,255,255,0.06)', border: '1px solid #3a2e1e', borderRadius: '6px', color: '#f0e8d8', outline: 'none' },
  pickerGrid: { flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 200px))', gridAutoRows: 'minmax(210px, auto)', gap: '12px', alignContent: 'start' },
  pickerItem: { position: 'relative', background: 'rgba(255,255,255,0.04)', border: '1px solid #2a1e10', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column' },
  pickerItemActive: { border: '2px solid #c8a85a', background: 'rgba(200,168,90,0.08)' },
  pickerThumbWrap: { position: 'relative', width: '100%', aspectRatio: '4/3', overflow: 'hidden', background: '#1a1208', flexShrink: 0 },
  pickerThumb: { width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: '#1a1208' },
  typeBadge: { position: 'absolute', top: '6px', left: '6px', background: 'rgba(15,10,6,0.85)', border: '1px solid rgba(200,168,90,0.35)', borderRadius: '10px', padding: '2px 8px', fontSize: '10px', fontWeight: 700, color: '#c8a85a' },
  pickerItemTitle: { padding: '8px 8px 2px', fontSize: '12px', fontWeight: 600, color: '#f0e8d8', lineHeight: 1.3, flexShrink: 0 },
  pickerItemYear: { padding: '0 8px 8px', fontSize: '11px', color: '#6a5a40', flexShrink: 0 },
  pickerCheck: { position: 'absolute', top: '6px', right: '6px', background: '#c8a85a', borderRadius: '50%', minWidth: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#0a0804', padding: '0 5px' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '14px 24px', borderTop: '1px solid #2a1e10', flexShrink: 0 },
  cancelBtn: { padding: '8px 14px', background: 'none', border: '1px solid #3a2e1e', borderRadius: '6px', color: '#9a9080', cursor: 'pointer' },
  submitBtn: { padding: '8px 16px', background: '#c8a85a', border: 'none', borderRadius: '6px', color: '#0a0804', fontWeight: 700, cursor: 'pointer' },
}
