import { useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDraftStore } from '../store.js'
import { SceneCanvas, RoomScene } from '@vm/viewer'
import type { RoomBounds, CameraState } from '@vm/viewer'
import { nanoid } from '../util/nanoid.js'
import type { Viewpoint, RoomPortal } from '@vm/shared'

type EditMode = 'none' | 'place-portal'

const EDIT_BOUNDS: RoomBounds = { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={sectionStyles.root}>
      <div style={sectionStyles.title}>{title}</div>
      {children}
    </div>
  )
}

const sectionStyles: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '16px', borderBottom: '1px solid #1a1008' },
  title: { fontSize: '11px', fontWeight: 600, color: '#6a5a40', textTransform: 'uppercase', letterSpacing: '0.06em' },
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={dlgStyles.overlay} onClick={onClose}>
      <div style={dlgStyles.box} onClick={(e) => e.stopPropagation()}>
        <div style={dlgStyles.header}>
          <span style={dlgStyles.title}>{title}</span>
          <button style={dlgStyles.closeBtn} onClick={onClose}>×</button>
        </div>
        <div style={dlgStyles.body}>{children}</div>
      </div>
    </div>
  )
}

const dlgStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  box: {
    background: '#120d07', border: '1px solid #3a2e1e', borderRadius: '12px',
    width: '360px', display: 'flex', flexDirection: 'column',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', borderBottom: '1px solid #2a1e10',
  },
  title: { fontSize: '15px', fontWeight: 600, color: '#f0e8d8' },
  closeBtn: {
    background: 'none', border: 'none', color: '#9a9080', fontSize: '20px',
    cursor: 'pointer', lineHeight: 1,
  },
  body: { padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' },
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RoomEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const content   = useDraftStore((s) => s.content)
  const updateRoom        = useDraftStore((s) => s.updateRoom)
  const addViewpoint      = useDraftStore((s) => s.addViewpoint)
  const removeViewpoint   = useDraftStore((s) => s.removeViewpoint)
  const setEntryViewpoint = useDraftStore((s) => s.setEntryViewpoint)
  const addPortal         = useDraftStore((s) => s.addPortal)
  const removePortal      = useDraftStore((s) => s.removePortal)

  const room       = content?.rooms.find((r) => r.id === id)
  const otherRooms = content?.rooms.filter((r) => r.id !== id) ?? []

  const [activeVpId,   setActiveVpId]   = useState<string>('')
  const [editMode,     setEditMode]     = useState<EditMode>('none')

  // Viewpoint dialog
  const [vpDialog,  setVpDialog]  = useState<{ state: CameraState } | null>(null)
  const [vpName,    setVpName]    = useState('')
  const [vpIsEntry, setVpIsEntry] = useState(false)

  // Portal dialog
  const [portalDialog,   setPortalDialog]   = useState<{ x: number; z: number } | null>(null)
  const [portalLabel,    setPortalLabel]    = useState('')
  const [portalTargetId, setPortalTargetId] = useState('')

  const cameraStateRef = useRef<CameraState | null>(null)

  // ── Guard ────────────────────────────────────────────────────────────────────
  if (!room || !content) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9a9080' }}>
      Phòng không tồn tại.
    </div>
  )

  const items    = Object.fromEntries(content.items.map((it) => [it.id, it]))
  const textures = Object.fromEntries(content.textures.map((t) => [t.id, t.url]))

  const currentVpId = activeVpId || room.entryViewpointId || room.viewpoints[0]?.id || '__none'

  // ── Viewpoint capture ─────────────────────────────────────────────────────────
  const handleCaptureViewpoint = () => {
    const state = cameraStateRef.current
    if (!state) return
    setVpName(`Điểm ${room.viewpoints.length + 1}`)
    setVpIsEntry(room.viewpoints.length === 0)
    setVpDialog({ state })
  }

  const handleSaveViewpoint = () => {
    if (!vpDialog || !vpName.trim()) return
    const vpId = nanoid()
    const vp: Viewpoint = {
      id: vpId,
      name: vpName.trim(),
      position: vpDialog.state.position,
      lookAt:   vpDialog.state.lookAt,
    }
    addViewpoint(room.id, vp)
    if (vpIsEntry) setEntryViewpoint(room.id, vpId)
    setActiveVpId(vpId)
    setVpDialog(null)
  }

  // ── Portal placement ──────────────────────────────────────────────────────────
  const handlePortalPlace = useCallback((pos: { x: number; z: number }) => {
    setEditMode('none')
    setPortalLabel('')
    setPortalTargetId(otherRooms[0]?.id ?? '')
    setPortalDialog(pos)
  }, [otherRooms])

  const handleSavePortal = () => {
    if (!portalDialog || !portalLabel.trim() || !portalTargetId) return
    const portal: RoomPortal = {
      id:           nanoid(),
      targetRoomId: portalTargetId,
      label:        portalLabel.trim(),
      position:     { x: portalDialog.x, y: 0, z: portalDialog.z },
      rotation:     { x: 0, y: 0, z: 0 },
    }
    addPortal(room.id, portal)
    setPortalDialog(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={styles.root}>

      {/* ── Left panel ── */}
      <div style={styles.panel}>
        <div style={styles.panelHeader}>
          <button style={styles.backBtn} onClick={() => navigate('/rooms')}>← Phòng</button>
          <h2 style={styles.roomTitle}>{room.title}</h2>
        </div>

        <div style={styles.panelScroll}>

          <Section title="Model 3D">
            <label style={styles.label}>URL file GLB / GLTF</label>
            <input
              style={styles.input}
              value={room.modelUrl ?? ''}
              onChange={(e) => updateRoom(room.id, { modelUrl: e.target.value.trim() || null })}
              placeholder="/content/hall.glb"
            />
            <div style={styles.hint}>Paste URL hoặc đường dẫn tương đối. Lưu draft → F5 để reload model.</div>
          </Section>

          <Section title="Điểm đứng (Viewpoints)">
            <button style={styles.btnPrimary} onClick={handleCaptureViewpoint}>
              + Lưu vị trí hiện tại
            </button>
            <div style={styles.hint}>Đi vào phòng, nhìn hướng muốn lưu, rồi nhấn nút trên.</div>

            {room.viewpoints.length === 0 && (
              <div style={styles.empty}>Chưa có điểm đứng nào.</div>
            )}

            {room.viewpoints.map((vp) => {
              const isEntry = vp.id === room.entryViewpointId
              return (
                <div key={vp.id} style={styles.listRow}>
                  <button
                    style={{ ...styles.listLabel, fontWeight: isEntry ? 700 : 400, color: isEntry ? '#c8a85a' : '#c0b8a8' }}
                    onClick={() => setActiveVpId(vp.id)}
                    title="Click để nhảy tới điểm này"
                  >
                    {isEntry ? '★ ' : '◎ '}{vp.name}
                  </button>
                  <div style={styles.listActions}>
                    {!isEntry && (
                      <button
                        style={styles.iconBtn}
                        title="Đặt làm điểm vào mặc định"
                        onClick={() => setEntryViewpoint(room.id, vp.id)}
                      >★</button>
                    )}
                    <button
                      style={styles.iconBtnDanger}
                      onClick={() => removeViewpoint(room.id, vp.id)}
                    >×</button>
                  </div>
                </div>
              )
            })}
          </Section>

          <Section title="Cổng chuyển phòng (Portals)">
            {editMode === 'place-portal' ? (
              <div style={styles.placingHint}>
                <span>Click vào sàn để đặt cổng...</span>
                <button style={styles.btnCancel} onClick={() => setEditMode('none')}>Hủy</button>
              </div>
            ) : (
              <button style={styles.btnPrimary} onClick={() => setEditMode('place-portal')}>
                + Đặt cổng trên sàn
              </button>
            )}

            {otherRooms.length === 0 && (
              <div style={styles.empty}>Cần ít nhất 2 phòng để tạo portal.</div>
            )}

            {(room.portals ?? []).map((portal) => {
              const target = content.rooms.find((r) => r.id === portal.targetRoomId)
              return (
                <div key={portal.id} style={styles.listRow}>
                  <div style={styles.portalInfo}>
                    <span style={styles.listLabel}>{portal.label}</span>
                    <span style={styles.portalTarget}>→ {target?.title ?? portal.targetRoomId}</span>
                  </div>
                  <button style={styles.iconBtnDanger} onClick={() => removePortal(room.id, portal.id)}>×</button>
                </div>
              )
            })}
          </Section>

        </div>
      </div>

      {/* ── 3D canvas ── */}
      <div style={styles.canvasWrap}>
        <SceneCanvas>
          <RoomScene
            room={room}
            items={items}
            textures={textures}
            activeViewpointId={currentVpId}
            hideLabels
            onSlotSelect={() => {}}
            cameraStateRef={cameraStateRef}
            portalPlaceMode={editMode === 'place-portal'}
            onPortalPlace={handlePortalPlace}
            {...(room.modelUrl ? { boundsOverride: EDIT_BOUNDS } : {})}
          />
        </SceneCanvas>

        {editMode === 'place-portal' && (
          <div style={styles.canvasOverlay}>Click vào sàn để đặt vị trí cổng</div>
        )}

        <div style={styles.canvasTip}>WASD / click sàn để di chuyển · kéo chuột để nhìn</div>
      </div>

      {/* ── Viewpoint dialog ── */}
      {vpDialog && (
        <Dialog title="Lưu điểm đứng" onClose={() => setVpDialog(null)}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Tên điểm đứng</label>
            <input
              style={styles.input}
              value={vpName}
              onChange={(e) => setVpName(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSaveViewpoint()}
              placeholder="Ví dụ: Cửa vào, Trung tâm, Góc phải..."
            />
          </div>
          <label style={styles.checkRow}>
            <input
              type="checkbox"
              checked={vpIsEntry}
              onChange={(e) => setVpIsEntry(e.target.checked)}
            />
            Đặt làm điểm vào mặc định
          </label>
          <div style={{ fontSize: '12px', color: '#6a5a40' }}>
            Vị trí: ({vpDialog.state.position.x.toFixed(2)}, {vpDialog.state.position.z.toFixed(2)})
          </div>
          <div style={styles.dialogActions}>
            <button style={styles.btnSecondary} onClick={() => setVpDialog(null)}>Hủy</button>
            <button style={styles.btnPrimary} onClick={handleSaveViewpoint} disabled={!vpName.trim()}>Lưu</button>
          </div>
        </Dialog>
      )}

      {/* ── Portal dialog ── */}
      {portalDialog && (
        <Dialog title="Thêm cổng chuyển phòng" onClose={() => setPortalDialog(null)}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Nhãn hiển thị</label>
            <input
              style={styles.input}
              value={portalLabel}
              onChange={(e) => setPortalLabel(e.target.value)}
              autoFocus
              placeholder="Phòng tiếp theo, Lối ra..."
            />
          </div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Dẫn đến phòng</label>
            <select
              style={styles.input}
              value={portalTargetId}
              onChange={(e) => setPortalTargetId(e.target.value)}
            >
              {otherRooms.map((r) => (
                <option key={r.id} value={r.id}>{r.title}</option>
              ))}
            </select>
          </div>
          <div style={{ fontSize: '12px', color: '#6a5a40' }}>
            Vị trí trên sàn: ({portalDialog.x.toFixed(2)}, {portalDialog.z.toFixed(2)})
          </div>
          <div style={styles.dialogActions}>
            <button style={styles.btnSecondary} onClick={() => setPortalDialog(null)}>Hủy</button>
            <button
              style={styles.btnPrimary}
              onClick={handleSavePortal}
              disabled={!portalLabel.trim() || !portalTargetId}
            >
              Lưu
            </button>
          </div>
        </Dialog>
      )}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    height: '100%',
    overflow: 'hidden',
  },

  // Panel
  panel: {
    width: '270px',
    flexShrink: 0,
    borderRight: '1px solid #2a1e10',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: '#0d0906',
  },
  panelHeader: {
    padding: '14px 16px',
    borderBottom: '1px solid #2a1e10',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#6a5a40',
    fontSize: '12px',
    cursor: 'pointer',
    textAlign: 'left',
    padding: 0,
  },
  roomTitle: { fontSize: '15px', fontWeight: 700, color: '#f0e8d8', margin: 0 },
  panelScroll: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },

  // Canvas
  canvasWrap: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  canvasOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: 'rgba(0,0,0,0.75)',
    color: '#f0d060',
    padding: '10px 20px',
    borderRadius: '8px',
    fontSize: '14px',
    pointerEvents: 'none',
    border: '1px solid #c8a85a',
  },
  canvasTip: {
    position: 'absolute',
    bottom: '12px',
    right: '16px',
    fontSize: '11px',
    color: 'rgba(200,168,90,0.5)',
    pointerEvents: 'none',
  },

  // Form elements
  label: { fontSize: '12px', color: '#9a9080', display: 'block' },
  input: {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid #3a2e1e',
    borderRadius: '6px',
    color: '#f0e8d8',
    fontSize: '13px',
    padding: '7px 10px',
    boxSizing: 'border-box',
  },
  hint: { fontSize: '11px', color: '#5a4a2a', lineHeight: 1.5 },
  empty: { fontSize: '12px', color: '#5a4a2a', fontStyle: 'italic' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },

  // List rows
  listRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '6px',
    padding: '6px 8px',
  },
  listLabel: {
    flex: 1,
    fontSize: '13px',
    color: '#c0b8a8',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    padding: 0,
  },
  listActions: { display: 'flex', gap: '4px' },
  portalInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' },
  portalTarget: { fontSize: '11px', color: '#6a5a40' },

  // Buttons
  btnPrimary: {
    padding: '8px 12px',
    background: 'rgba(200,168,90,0.12)',
    border: '1px solid #c8a85a',
    borderRadius: '6px',
    color: '#c8a85a',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  btnSecondary: {
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid #3a2e1e',
    borderRadius: '6px',
    color: '#9a9080',
    fontSize: '12px',
    cursor: 'pointer',
  },
  btnCancel: {
    padding: '4px 10px',
    background: 'none',
    border: '1px solid #3a2e1e',
    borderRadius: '6px',
    color: '#9a9080',
    fontSize: '11px',
    cursor: 'pointer',
  },
  iconBtn: {
    width: '24px',
    height: '24px',
    background: 'none',
    border: '1px solid #3a2e1e',
    borderRadius: '4px',
    color: '#c8a85a',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  iconBtnDanger: {
    width: '24px',
    height: '24px',
    background: 'none',
    border: '1px solid #3a2e1e',
    borderRadius: '4px',
    color: '#c85a5a',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    lineHeight: 1,
  },
  placingHint: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 10px',
    background: 'rgba(240,208,96,0.08)',
    border: '1px solid #c8a85a',
    borderRadius: '6px',
    color: '#c8a85a',
    fontSize: '12px',
  },
  checkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#c0b8a8',
    cursor: 'pointer',
  },
  dialogActions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
    paddingTop: '4px',
  },
}
