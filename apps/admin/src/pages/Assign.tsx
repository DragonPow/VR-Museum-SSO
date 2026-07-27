import { useState, useMemo, useEffect } from 'react'
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

function parseDocumentTitleForNameplate(title: string): { role: string; name: string } {
  // Regex to extract common leadership roles from the start of the title
  const roleRegex = /^(giám đốc|phó giám đốc|quyền giám đốc|phụ trách|quyền gđ|gđ|pgđ)\s+/i
  const match = roleRegex.exec(title)
  if (match) {
    // Keep exact casing from user input, just capitalize first letter for neatness if needed,
    // but returning exact substring matched is safest
    const role = (match[1] ?? '').trim()
    const name = title.substring(match[0].length).trim()
    return { role, name }
  }
  return { role: '', name: title }
}

export function Assign() {
  const content = useDraftStore((s) => s.content)
  const assignDocuments = useDraftStore((s) => s.assignDocuments)

  const [selectedRoomId, setSelectedRoomId] = useState<string>('')
  const [pickerSlot, setPickerSlot] = useState<Slot | null>(null)
  const [draftIds, setDraftIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [periodFilter, setPeriodFilter] = useState('')
  const [pickerPage, setPickerPage] = useState(1)
  const ITEMS_PER_PAGE = 24
  const [expandedZones, setExpandedZones] = useState<Record<string, boolean>>({})

  // Nameplate states
  const [nameplateEnabled, setNameplateEnabled] = useState(false)
  const [nameplateRole, setNameplateRole] = useState('')
  const [nameplatePrimary, setNameplatePrimary] = useState('')
  const [nameplateSecondary, setNameplateSecondary] = useState('')

  useEffect(() => {
    setExpandedZones({})
  }, [selectedRoomId])

  const toggleZone = (zone: string) => {
    setExpandedZones((prev) => ({
      ...prev,
      [zone]: !prev[zone],
    }))
  }

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

  const pickerTotalPages = Math.ceil(pickerDocuments.length / ITEMS_PER_PAGE)
  const displayedPickerDocs = useMemo(() => {
    return pickerDocuments.slice((pickerPage - 1) * ITEMS_PER_PAGE, pickerPage * ITEMS_PER_PAGE)
  }, [pickerDocuments, pickerPage])

  const openPicker = (slot: Slot) => {
    setPickerSlot(slot)
    setDraftIds(slot.documentIds ?? [])
    // Auto-enable nameplate if slot has one, or it's a K5 Slot
    const hasNameplate = !!slot.nameplate
    const isK5 = /^VM_Slot_K5_CD_\d{2}$/i.test(slot.name || slot.id)
    setNameplateEnabled(hasNameplate || isK5)
    setNameplateRole(slot.nameplate?.role ?? '')
    setNameplatePrimary(slot.nameplate?.primary ?? '')
    setNameplateSecondary(slot.nameplate?.secondary ?? '')
    setPickerPage(1)
  }

  const toggleDocument = (documentId: string) => {
    setDraftIds((ids) => {
      const nextIds = ids.includes(documentId) ? ids.filter((id) => id !== documentId) : [...ids, documentId]
      // Autofill nameplate fields if empty and we just selected a document
      const firstId = nextIds[0]
      if (firstId) {
        const firstDoc = documentMap[firstId]
        if (firstDoc) {
          const { role, name } = parseDocumentTitleForNameplate(firstDoc.title)
          setNameplateRole((prev) => prev.trim() === '' ? role : prev)
          setNameplatePrimary((prev) => prev.trim() === '' ? name : prev)
          setNameplateSecondary((prev) => prev.trim() === '' ? (firstDoc.year != null ? String(firstDoc.year) : '') : prev)
        }
      }
      return nextIds
    })
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
      // Re-sync nameplate with the new first item if empty
      const firstId = next[0]
      if (firstId) {
        const firstDoc = documentMap[firstId]
        if (firstDoc) {
          const { role, name } = parseDocumentTitleForNameplate(firstDoc.title)
          setNameplateRole((prev) => prev.trim() === '' ? role : prev)
          setNameplatePrimary((prev) => prev.trim() === '' ? name : prev)
          setNameplateSecondary((prev) => prev.trim() === '' ? (firstDoc.year != null ? String(firstDoc.year) : '') : prev)
        }
      }
      return next
    })
  }

  const saveAssign = () => {
    if (!selectedRoom || !pickerSlot) return
    let nameplate: { primary: string; secondary?: string; role?: string } | undefined = undefined
    if (nameplateEnabled) {
      nameplate = {
        primary: nameplatePrimary.trim() || pickerSlot.name,
      }
      const sec = nameplateSecondary.trim()
      if (sec) {
        nameplate.secondary = sec
      }
      const rol = nameplateRole.trim()
      if (rol) {
        nameplate.role = rol
      }
    }
    assignDocuments(selectedRoom.id, pickerSlot.id, draftIds, nameplate)
    setPickerSlot(null)
    setSearch('')
    setPeriodFilter('')
  }

  const roomsByPeriod = useMemo(() => {
    return [...content.periods]
      .sort((a, b) => a.order - b.order)
      .map((p) => ({
        period: p,
        rooms: content.rooms.filter((r) => r.periodId === p.id).sort((a, b) => a.order - b.order),
      }))
  }, [content.periods, content.rooms])

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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2 style={styles.roomTitle}>{selectedRoom.title}</h2>
                  <p style={styles.roomSub}>{selectedRoom.slots.filter((s) => (s.documentIds ?? []).length > 0).length} / {selectedRoom.slots.length} slot đã có tư liệu</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    style={styles.miniActionBtn}
                    onClick={() => {
                      const allZones = groupSlotsByZone(selectedRoom.slots).map((z) => z.zone)
                      const nextExpanded: Record<string, boolean> = {}
                      allZones.forEach((z) => (nextExpanded[z] = true))
                      setExpandedZones(nextExpanded)
                    }}
                  >
                    Mở tất cả các khu
                  </button>
                  <button style={styles.miniActionBtn} onClick={() => setExpandedZones({})}>
                    Đóng tất cả
                  </button>
                </div>
              </div>
            </div>
            <div style={styles.scrollArea}>
              {selectedRoom.slots.length === 0 ? (
                <div style={styles.center}>Phòng này chưa có slot nào.</div>
              ) : (
                groupSlotsByZone(selectedRoom.slots).map(({ zone, slots }) => {
                  const isExpanded = !!expandedZones[zone]
                  return (
                    <div key={zone} style={styles.zoneBlock}>
                      <div
                        style={{ ...styles.zoneHeader, cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => toggleZone(zone)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '10px', color: '#c8a85a', width: '12px' }}>
                            {isExpanded ? '▼' : '▶'}
                          </span>
                          <span>{zone}</span>
                        </div>
                        <span style={styles.zoneCount}>
                          {slots.filter((s) => (s.documentIds ?? []).length > 0).length}/{slots.length} đã gán
                        </span>
                      </div>
                      {isExpanded && (
                        <div style={styles.slotGrid}>
                          {slots.map((slot) => (
                            <SlotCard
                              key={slot.id}
                              slot={slot}
                              documents={(slot.documentIds ?? []).map((id) => documentMap[id]).filter(Boolean) as DocumentItem[]}
                              onClick={() => openPicker(slot)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
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

            {/* Cấu hình Nameplate */}
            <div style={styles.nameplateSection}>
              <div style={styles.nameplateHeader}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', color: '#c8a85a', fontWeight: 600, fontSize: '13px' }}>
                  <input type="checkbox" checked={nameplateEnabled} onChange={(e) => setNameplateEnabled(e.target.checked)} />
                  Hiển thị bảng tên (Nameplate) dưới slot này
                </label>
                {nameplateEnabled && (
                  <button
                    style={styles.nameplateSyncBtn}
                    onClick={() => {
                      if (draftIds.length > 0) {
                        const firstId = draftIds[0]
                        if (firstId) {
                          const doc = documentMap[firstId]
                          if (doc) {
                            const { role, name } = parseDocumentTitleForNameplate(doc.title)
                            setNameplateRole(role)
                            setNameplatePrimary(name)
                            setNameplateSecondary(doc.year != null ? String(doc.year) : '')
                          }
                        }
                      }
                    }}
                    title="Đồng bộ lại theo thông tin tư liệu đầu tiên được chọn"
                  >
                    🔄 Đồng bộ theo tư liệu
                  </button>
                )}
              </div>
              {nameplateEnabled && (
                <div style={styles.nameplateInputs}>
                  <div style={{ ...styles.inputGroup, flex: '0 0 160px' }}>
                    <span style={styles.inputLabel}>Vị trí (Giám đốc/Phó Giám đốc):</span>
                    <input
                      style={styles.textInput}
                      value={nameplateRole}
                      onChange={(e) => setNameplateRole(e.target.value)}
                      placeholder="Ví dụ: Giám đốc"
                    />
                  </div>
                  <div style={{ ...styles.inputGroup, flex: 2 }}>
                    <span style={styles.inputLabel}>Dòng chữ chính (Tên):</span>
                    <input
                      style={styles.textInput}
                      value={nameplatePrimary}
                      onChange={(e) => setNameplatePrimary(e.target.value)}
                      placeholder="Ví dụ: Lê Đặng Xuân Tân"
                    />
                  </div>
                  <div style={{ ...styles.inputGroup, flex: 1 }}>
                    <span style={styles.inputLabel}>Dòng chữ phụ (Năm):</span>
                    <input
                      style={styles.textInput}
                      value={nameplateSecondary}
                      onChange={(e) => setNameplateSecondary(e.target.value)}
                      placeholder="Ví dụ: 2018 - 2023"
                    />
                  </div>
                </div>
              )}
            </div>

            <div style={styles.pickerFilters}>
              <input autoFocus placeholder="Tìm theo tên, năm, tag, loại..." value={search} onChange={(e) => { setSearch(e.target.value); setPickerPage(1); }} style={styles.pickerSearch} />
              <select value={periodFilter} onChange={(e) => { setPeriodFilter(e.target.value); setPickerPage(1); }} style={styles.pickerSelect}>
                <option value="">Tất cả thời kỳ</option>
                {[...content.periods].sort((a, b) => a.order - b.order).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>

            <div style={styles.pickerGrid}>
              {content.documents.length === 0 && <div style={{ ...styles.center, gridColumn: '1 / -1', padding: '40px' }}>Chưa có tư liệu nào. Hãy thêm tư liệu trước.</div>}
              {displayedPickerDocs.map((document) => {
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

            <Pagination current={pickerPage} total={pickerTotalPages} onChange={setPickerPage} />

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

const ZONE_ORDER = ['Khu 1', 'Khu 2', 'Khu 3', 'Khu 4', 'Khu 5', 'Khu 6', 'Khu 7', 'Khu 8', 'Khu 9', 'Khu 10', 'Khu 11']

/** Slot ids look like `VM_Slot_K10_AP_02` (name: `K10_AP_02`). Zone = the K number. */
function fallbackZone(s: Slot): string {
  const m = /K(\d+)_(?:CD|MT|MP|AT|AD|AP|BN|FT)_\d+/.exec(s.name || s.id)
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
            {slot.nameplate && (
              <div style={styles.slotNameplateBadge}>
                📛 Bảng tên: {slot.nameplate.role ? `[${slot.nameplate.role}] ` : ''}{slot.nameplate.primary}{slot.nameplate.secondary ? ` (${slot.nameplate.secondary})` : ''}
              </div>
            )}
            <div style={styles.slotStatus}>Đã gán {documents.length} tư liệu</div>
          </div>
        </>
      ) : (
        <>
          <div style={styles.slotEmpty}><span style={styles.slotEmptyIcon}>+</span></div>
          <div style={styles.slotInfo}>
            <div style={styles.slotName}>{slot.name}</div>
            {slot.nameplate && (
              <div style={styles.slotNameplateBadge}>
                📛 Bảng tên: {slot.nameplate.role ? `[${slot.nameplate.role}] ` : ''}{slot.nameplate.primary}{slot.nameplate.secondary ? ` (${slot.nameplate.secondary})` : ''}
              </div>
            )}
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
  miniActionBtn: {
    padding: '6px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid #3a2e1e',
    borderRadius: '6px', color: '#9a9080', fontSize: '11px', cursor: 'pointer', transition: 'all 0.2s',
  },
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
  nameplateSection: {
    padding: '12px 24px',
    borderBottom: '1px solid #2a1e10',
    background: 'rgba(0, 0, 0, 0.2)',
    flexShrink: 0,
  },
  nameplateHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  nameplateSyncBtn: {
    background: 'none',
    color: '#c8a85a',
    fontSize: '11px',
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: '4px',
    border: '1px solid rgba(200, 168, 90, 0.3)',
  },
  nameplateInputs: {
    display: 'flex',
    gap: '16px',
    marginTop: '8px',
  },
  inputGroup: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  inputLabel: {
    fontSize: '11px',
    color: '#9a9080',
  },
  textInput: {
    padding: '6px 10px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid #3a2e1e',
    borderRadius: '4px',
    color: '#f0e8d8',
    fontSize: '12px',
    outline: 'none',
  },
  slotNameplateBadge: {
    fontSize: '10px',
    color: '#c8a85a',
    marginTop: '3px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    background: 'rgba(200, 168, 90, 0.08)',
    padding: '2px 4px',
    borderRadius: '3px',
    border: '1px solid rgba(200, 168, 90, 0.15)',
  },
}
