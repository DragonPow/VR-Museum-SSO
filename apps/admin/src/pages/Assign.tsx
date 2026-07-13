import { useState, useMemo } from 'react'
import type { Slot, Item } from '@vm/shared'
import { useDraftStore } from '../store.js'
import { resolveAssetUrl } from '@vm/shared'

const ASSET_BASE_URL = (import.meta.env.VITE_ASSET_BASE_URL ?? '').replace(/\/+$/, '')
const assetUrl = (u?: string | null) => resolveAssetUrl(u, { assetBaseUrl: ASSET_BASE_URL }) ?? undefined

export function Assign() {
  const content = useDraftStore((s) => s.content)
  const assignItem = useDraftStore((s) => s.assignItem)

  const [selectedRoomId, setSelectedRoomId] = useState<string>('')
  const [pickerSlot, setPickerSlot] = useState<Slot | null>(null)
  const [search, setSearch] = useState('')
  const [periodFilter, setPeriodFilter] = useState('')

  if (!content) return <div style={styles.center}>Đang tải...</div>

  const itemMap = useMemo(
    () => Object.fromEntries(content.items.map((it) => [it.id, it])),
    [content.items],
  )

  const selectedRoom = content.rooms.find((r) => r.id === selectedRoomId)

  const pickerItems = useMemo(() => {
    let items = content.items
    if (search) items = items.filter((it) =>
      it.title.toLowerCase().includes(search.toLowerCase()) ||
      String(it.year).includes(search) ||
      it.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())),
    )
    if (periodFilter) items = items.filter((it) => it.periodId === periodFilter)
    return items
  }, [content.items, search, periodFilter])

  const handleAssign = (itemId: string | null) => {
    if (!selectedRoom || !pickerSlot) return
    assignItem(selectedRoom.id, pickerSlot.id, itemId)
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
      {/* Left: room selector */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarTitle}>Chọn phòng</div>
        {roomsByPeriod.map(({ period, rooms }) => (
          rooms.length === 0 ? null : (
            <div key={period.id}>
              <div style={{ ...styles.periodHeader, borderLeftColor: period.themeColor }}>
                <span style={{ color: period.themeColor }}>●</span> {period.title}
              </div>
              {rooms.map((room) => {
                const filled = room.slots.filter((s) => s.itemId).length
                const total = room.slots.length
                return (
                  <button
                    key={room.id}
                    style={{
                      ...styles.roomBtn,
                      ...(room.id === selectedRoomId ? styles.roomBtnActive : {}),
                    }}
                    onClick={() => setSelectedRoomId(room.id)}
                  >
                    <span style={styles.roomBtnName}>{room.title}</span>
                    <span style={styles.roomBtnCount}>{filled}/{total}</span>
                  </button>
                )
              })}
            </div>
          )
        ))}
        {content.rooms.length === 0 && (
          <div style={styles.center}>Chưa có phòng nào.</div>
        )}
      </div>

      {/* Right: slot grid */}
      <div style={styles.main}>
        {!selectedRoom ? (
          <div style={styles.center}>← Chọn một phòng để gán ảnh</div>
        ) : (
          <>
            <div style={styles.mainHeader}>
              <div>
                <h2 style={styles.roomTitle}>{selectedRoom.title}</h2>
                <p style={styles.roomSub}>
                  {selectedRoom.slots.filter((s) => s.itemId).length} / {selectedRoom.slots.length} slot đã có ảnh
                </p>
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
                    <span style={styles.zoneCount}>
                      {slots.filter((s) => s.itemId).length}/{slots.length}
                    </span>
                  </div>
                  <div style={styles.slotGrid}>
                    {slots.map((slot) => {
                      const item = slot.itemId ? itemMap[slot.itemId] : null
                      return (
                        <SlotCard
                          key={slot.id}
                          slot={slot}
                          item={item ?? null}
                          onClick={() => setPickerSlot(slot)}
                        />
                      )
                    })}
                  </div>
                </div>
              ))
            )}
            </div>
          </>
        )}
      </div>

      {/* Item picker modal */}
      {pickerSlot && (
        <div style={styles.overlay} onClick={() => { setPickerSlot(null); setSearch('') }}>
          <div style={styles.picker} onClick={(e) => e.stopPropagation()}>
            <div style={styles.pickerHeader}>
              <div>
                <span style={styles.pickerTitle}>Gán ảnh cho slot</span>
                <span style={styles.pickerSlotName}> — {pickerSlot.name}</span>
              </div>
              <button style={styles.closeBtn} onClick={() => { setPickerSlot(null); setSearch('') }}>✕</button>
            </div>

            {pickerSlot.itemId && (
              <div style={styles.currentRow}>
                <img src={assetUrl(itemMap[pickerSlot.itemId]?.thumbUrl)} alt="" style={styles.currentThumb} />
                <div>
                  <div style={{ fontSize: '13px', color: '#f0e8d8' }}>Đang gán: {itemMap[pickerSlot.itemId]?.title}</div>
                  <button style={styles.unassignBtn} onClick={() => handleAssign(null)}>
                    Bỏ gán (để trống)
                  </button>
                </div>
              </div>
            )}

            <div style={styles.pickerFilters}>
              <input
                autoFocus
                placeholder="Tìm theo tên, năm, tag..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={styles.pickerSearch}
              />
              <select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value)}
                style={styles.pickerSelect}
              >
                <option value="">Tất cả thời kỳ</option>
                {content.periods.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>

            <div style={styles.pickerGrid}>
              {content.items.length === 0 && (
                <div style={{ ...styles.center, gridColumn: '1 / -1', padding: '40px' }}>
                  Chưa có ảnh nào. Hãy upload ảnh trước.
                </div>
              )}
              {pickerItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    ...styles.pickerItem,
                    ...(item.id === pickerSlot.itemId ? styles.pickerItemActive : {}),
                  }}
                  onClick={() => handleAssign(item.id)}
                >
                  <img src={assetUrl(item.thumbUrl)} alt={item.title} style={styles.pickerThumb} />
                  <div style={styles.pickerItemTitle}>{item.title}</div>
                  <div style={styles.pickerItemYear}>{item.year}</div>
                  {item.id === pickerSlot.itemId && (
                    <div style={styles.pickerCheck}>✓</div>
                  )}
                </div>
              ))}
              {pickerItems.length === 0 && content.items.length > 0 && (
                <div style={{ ...styles.center, gridColumn: '1 / -1', padding: '40px' }}>
                  Không tìm thấy ảnh phù hợp.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const ZONE_ORDER = [
  'Khu 1 — gần cửa',
  'Khu 2',
  'Khu 3',
  'Khu 4',
  'Khu 5 — cuối tường trái',
  'Tường trái',
  'Hốc đỏ — Cờ',
  'Hốc đỏ — Bằng khen',
  'Tường cuối phòng',
  'Khu bên phải',
]

// When a slot has no baked `zone` (older content), derive a rough one from its name
// so the list still buckets instead of showing 100+ flat slots.
function fallbackZone(s: Slot): string {
  const m = /(\d+)(?:_(Flag|Cert))?/.exec(s.name || s.id)
  if (!m) return 'Khác'
  const num = Number(m[1])
  if (m[2] === 'Flag') return 'Hốc đỏ — Cờ'
  if (m[2] === 'Cert') return 'Hốc đỏ — Bằng khen'
  if (num >= 1000 && num < 2000) return 'Tường cuối phòng'
  if (num >= 2000) return 'Khu bên phải'
  return 'Tường trái'
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
  return [...map.entries()]
    .map(([zone, slots]) => ({ zone, slots }))
    .sort((a, b) => rank(a.zone) - rank(b.zone) || a.zone.localeCompare(b.zone))
}

function SlotCard({ slot, item, onClick }: { slot: Slot; item: Item | null; onClick: () => void }) {
  return (
    <div style={styles.slotCard} onClick={onClick}>
      {item ? (
        <>
          <div style={styles.slotThumbWrap}>
            <img src={assetUrl(item.thumbUrl)} alt={item.title} style={styles.slotThumb} />
          </div>
          <div style={styles.slotInfo}>
            <div style={styles.slotName}>{slot.name}</div>
            <div style={styles.slotItemTitle}>{item.year} · {item.title}</div>
            <div style={styles.slotStatus}>✓ Đã gán</div>
          </div>
        </>
      ) : (
        <>
          <div style={styles.slotEmpty}>
            <span style={styles.slotEmptyIcon}>+</span>
          </div>
          <div style={styles.slotInfo}>
            <div style={styles.slotName}>{slot.name}</div>
            <div style={styles.slotEmptyLabel}>Trống — click để gán</div>
          </div>
        </>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: { display: 'flex', height: '100%', overflow: 'hidden' },
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#6a5a40', fontSize: '14px', padding: '24px' },

  // Sidebar
  sidebar: { width: '260px', flexShrink: 0, borderRight: '1px solid #2a1e10', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', padding: '12px 0' },
  sidebarTitle: { padding: '4px 16px 8px', fontSize: '11px', fontWeight: 600, color: '#6a5a40', textTransform: 'uppercase', letterSpacing: '0.05em' },
  periodHeader: { padding: '8px 16px 4px', fontSize: '11px', fontWeight: 700, color: '#9a9080', borderLeft: '3px solid', display: 'flex', alignItems: 'center', gap: '6px' },
  roomBtn: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '8px 16px', background: 'none', border: 'none', color: '#9a9080', fontSize: '13px', cursor: 'pointer', textAlign: 'left' },
  roomBtnActive: { background: 'rgba(200,168,90,0.1)', color: '#c8a85a' },
  roomBtnName: { flex: 1 },
  roomBtnCount: { fontSize: '11px', color: '#6a5a40', marginLeft: '8px' },

  // Main
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  mainHeader: { padding: '20px 24px', borderBottom: '1px solid #2a1e10', flexShrink: 0 },
  roomTitle: { fontSize: '18px', fontWeight: 700, color: '#f0e8d8' },
  roomSub: { fontSize: '12px', color: '#6a5a40', marginTop: '3px' },
  zoneBlock: { marginBottom: '22px' },
  zoneHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
    padding: '2px 2px 8px', marginBottom: '10px', borderBottom: '1px solid #2a1e10',
    color: '#c8a85a', fontWeight: 600, fontSize: '14px',
  },
  zoneCount: { color: '#9a9080', fontWeight: 400, fontSize: '12px' },
  slotGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '14px',
    alignContent: 'start',
  },
  scrollArea: { flex: 1, overflowY: 'auto', padding: '20px 24px' },
  slotCard: { background: 'rgba(255,255,255,0.04)', border: '1px solid #2a1e10', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column' },
  slotThumbWrap: { aspectRatio: '4/3', overflow: 'hidden', background: '#1a1208' },
  slotThumb: { width: '100%', height: '100%', objectFit: 'cover' },
  slotEmpty: { aspectRatio: '4/3', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #2a1e10' },
  slotEmptyIcon: { fontSize: '28px', color: '#3a2e1e' },
  slotInfo: { padding: '10px 12px' },
  slotName: { fontSize: '12px', fontWeight: 600, color: '#f0e8d8' },
  slotItemTitle: { fontSize: '11px', color: '#9a9080', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  slotStatus: { fontSize: '11px', color: '#5ac85a', marginTop: '4px' },
  slotEmptyLabel: { fontSize: '11px', color: '#4a3a20', marginTop: '3px' },

  // Picker modal
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  picker: { background: '#0f0a06', border: '1px solid #3a2e1e', borderRadius: '14px', width: '720px', maxWidth: '96vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column' },
  pickerHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #2a1e10', flexShrink: 0 },
  pickerTitle: { fontSize: '16px', fontWeight: 700, color: '#c8a85a' },
  pickerSlotName: { fontSize: '16px', color: '#9a9080' },
  closeBtn: { background: 'none', border: 'none', color: '#6a5a40', fontSize: '16px', cursor: 'pointer', padding: '4px 8px' },
  currentRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 24px', background: 'rgba(200,168,90,0.05)', borderBottom: '1px solid #2a1e10', flexShrink: 0 },
  currentThumb: { width: '60px', height: '45px', objectFit: 'cover', borderRadius: '4px' },
  unassignBtn: { marginTop: '6px', padding: '4px 10px', background: 'none', border: '1px solid #c85a5a', borderRadius: '5px', color: '#c85a5a', fontSize: '11px', cursor: 'pointer' },
  pickerFilters: { display: 'flex', gap: '10px', padding: '12px 24px', borderBottom: '1px solid #1a1208', flexShrink: 0 },
  pickerSearch: { flex: 1, padding: '8px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid #3a2e1e', borderRadius: '6px', color: '#f0e8d8', outline: 'none' },
  pickerSelect: { padding: '8px 12px', minWidth: '180px', background: 'rgba(255,255,255,0.06)', border: '1px solid #3a2e1e', borderRadius: '6px', color: '#f0e8d8', outline: 'none' },
  pickerGrid: {
    flex: 1, overflowY: 'auto', padding: '16px 24px',
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px',
    alignContent: 'start',
  },
  pickerItem: { position: 'relative', background: 'rgba(255,255,255,0.04)', border: '1px solid #2a1e10', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer' },
  pickerItemActive: { border: '2px solid #c8a85a', background: 'rgba(200,168,90,0.08)' },
  pickerThumb: { width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block', background: '#1a1208' },
  pickerItemTitle: { padding: '8px 8px 2px', fontSize: '12px', fontWeight: 600, color: '#f0e8d8', lineHeight: 1.3 },
  pickerItemYear: { padding: '0 8px 8px', fontSize: '11px', color: '#6a5a40' },
  pickerCheck: { position: 'absolute', top: '6px', right: '6px', background: '#c8a85a', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#0a0804' },
}
