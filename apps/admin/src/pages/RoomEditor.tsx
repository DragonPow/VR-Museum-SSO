import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDraftStore } from '../store.js'
import { SceneCanvas, RoomScene } from '@vm/viewer'
import type { RoomBounds, CameraState } from '@vm/viewer'
import { uploadModel } from '../api.js'
import { nanoid } from '../util/nanoid.js'
import type { Viewpoint, RoomPortal } from '@vm/shared'

type EditMode = 'none' | 'place-portal'

const EDIT_BOUNDS: RoomBounds = { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }
const ASSET_BASE_URL = (import.meta.env.VITE_ASSET_BASE_URL ?? '').replace(/\/+$/, '')

class SceneErrorBoundary extends React.Component<
  { resetKey: string; children: React.ReactNode; fallback: (message: string) => React.ReactNode },
  { error: string | null }
> {
  override state = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error: error.message }
  }

  override componentDidUpdate(prevProps: Readonly<{ resetKey: string }>) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  override render() {
    if (this.state.error) {
      return this.props.fallback(this.state.error)
    }
    return this.props.children
  }
}

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
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    paddingBottom: '16px',
    borderBottom: '1px solid #1a1008',
  },
  title: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#6a5a40',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
}

function Dialog({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div style={dlgStyles.overlay} onClick={onClose}>
      <div style={dlgStyles.box} onClick={(e) => e.stopPropagation()}>
        <div style={dlgStyles.header}>
          <span style={dlgStyles.title}>{title}</span>
          <button style={dlgStyles.closeBtn} onClick={onClose}>
            ×
          </button>
        </div>
        <div style={dlgStyles.body}>{children}</div>
      </div>
    </div>
  )
}

const dlgStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  box: {
    background: '#120d07',
    border: '1px solid #3a2e1e',
    borderRadius: '12px',
    width: '360px',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #2a1e10',
  },
  title: { fontSize: '15px', fontWeight: 600, color: '#f0e8d8' },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#9a9080',
    fontSize: '20px',
    cursor: 'pointer',
    lineHeight: 1,
  },
  body: { padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' },
}

function snapshotViewpointState(state: CameraState): CameraState {
  return {
    position: {
      x: state.groundPosition.x,
      y: state.position.y,
      z: state.groundPosition.z,
    },
    groundPosition: state.groundPosition,
    lookAt: state.lookAt,
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RoomEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const content = useDraftStore((s) => s.content)
  const updateRoom = useDraftStore((s) => s.updateRoom)
  const addViewpoint = useDraftStore((s) => s.addViewpoint)
  const updateViewpoint = useDraftStore((s) => s.updateViewpoint)
  const removeViewpoint = useDraftStore((s) => s.removeViewpoint)
  const setEntryViewpoint = useDraftStore((s) => s.setEntryViewpoint)
  const addPortal = useDraftStore((s) => s.addPortal)
  const updatePortal = useDraftStore((s) => s.updatePortal)
  const removePortal = useDraftStore((s) => s.removePortal)

  const room = content?.rooms.find((r) => r.id === id)
  const otherRooms = content?.rooms.filter((r) => r.id !== id) ?? []

  const [activeVpId, setActiveVpId] = useState<string>('')
  const [editMode, setEditMode] = useState<EditMode>('none')

  // Viewpoint dialog
  const [vpDialog, setVpDialog] = useState<{ state: CameraState; vpId?: string } | null>(null)
  const [vpName, setVpName] = useState('')
  const [vpIsEntry, setVpIsEntry] = useState(false)

  // Portal dialog
  const [portalDialog, setPortalDialog] = useState<{
    x: number
    z: number
    portalId?: string
  } | null>(null)
  const [portalLabel, setPortalLabel] = useState('')
  const [portalTargetId, setPortalTargetId] = useState('')
  const [modelUrlInput, setModelUrlInput] = useState('')
  const [modelUrlError, setModelUrlError] = useState<string | null>(null)
  const [roomTitleInput, setRoomTitleInput] = useState('')
  const [modelOffsetInput, setModelOffsetInput] = useState<[number, number, number]>([0, 0, 0])

  const cameraStateRef = useRef<CameraState | null>(null)
  const modelFileInputRef = useRef<HTMLInputElement | null>(null)

  // ── Guard ────────────────────────────────────────────────────────────────────
  if (!room || !content)
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#9a9080',
        }}
      >
        Phòng không tồn tại.
      </div>
    )

  const items = Object.fromEntries(content.items.map((it) => [it.id, it]))
  const textures = Object.fromEntries(content.textures.map((t) => [t.id, t.url]))

  useEffect(() => {
    setModelUrlInput(room.modelUrl ?? '')
    setModelUrlError(null)
  }, [room.id, room.modelUrl])

  useEffect(() => {
    setRoomTitleInput(room.title)
  }, [room.id, room.title])

  useEffect(() => {
    setModelOffsetInput(room.modelOffset ?? [0, 0, 0])
  }, [room.id, room.modelOffset])

  const currentVpId = activeVpId || room.entryViewpointId || room.viewpoints[0]?.id || '__none'

  // ── Viewpoint capture ─────────────────────────────────────────────────────────
  const handleCaptureViewpoint = () => {
    const state = cameraStateRef.current
    if (!state) return
    setVpName(`Điểm ${room.viewpoints.length + 1}`)
    setVpIsEntry(room.viewpoints.length === 0)
    setVpDialog({ state: snapshotViewpointState(state) })
  }

  const handleEditViewpoint = (vp: Viewpoint) => {
    setVpName(vp.name)
    setVpIsEntry(vp.id === room.entryViewpointId)
    setVpDialog({
      vpId: vp.id,
      state: {
        position: vp.position,
        groundPosition: { x: vp.position.x, y: 0, z: vp.position.z },
        lookAt: vp.lookAt,
      },
    })
  }

  const handleUseCurrentCameraForViewpoint = () => {
    const state = cameraStateRef.current
    if (!vpDialog || !state) return
    setVpDialog({ ...vpDialog, state: snapshotViewpointState(state) })
  }

  const handleApplyRoomTitle = () => {
    const nextTitle = roomTitleInput.trim()
    if (!nextTitle || nextTitle === room.title) return
    updateRoom(room.id, { title: nextTitle })
  }

  const handleApplyModelOffset = () => {
    updateRoom(room.id, { modelOffset: [...modelOffsetInput] })
  }

  const handleClearModelOffset = () => {
    setModelOffsetInput([0, 0, 0])
    updateRoom(room.id, { modelOffset: [0, 0, 0] })
  }

  const handleSaveViewpoint = () => {
    if (!vpDialog || !vpName.trim()) return
    const nextVp: Viewpoint = {
      id: vpDialog.vpId ?? nanoid(),
      name: vpName.trim(),
      position: vpDialog.state.position,
      lookAt: vpDialog.state.lookAt,
    }

    if (vpDialog.vpId) {
      updateViewpoint(room.id, vpDialog.vpId, nextVp)
    } else {
      addViewpoint(room.id, nextVp)
    }

    if (vpIsEntry) {
      setEntryViewpoint(room.id, nextVp.id)
    } else if (room.entryViewpointId === nextVp.id) {
      const fallbackId = room.viewpoints.find((vp) => vp.id !== nextVp.id)?.id ?? ''
      setEntryViewpoint(room.id, fallbackId)
    }

    setActiveVpId(nextVp.id)
    setVpDialog(null)
  }

  // ── Portal placement ──────────────────────────────────────────────────────────
  const handlePortalPlace = useCallback(
    (pos: { x: number; z: number }) => {
      setEditMode('none')
      setPortalLabel('')
      setPortalTargetId(otherRooms[0]?.id ?? '')
      setPortalDialog(pos)
    },
    [otherRooms],
  )

  const handleEditPortal = (portal: RoomPortal) => {
    setPortalLabel(portal.label)
    setPortalTargetId(portal.targetRoomId)
    setPortalDialog({ x: portal.position.x, z: portal.position.z, portalId: portal.id })
  }

  const handleSavePortal = () => {
    if (!portalDialog || !portalLabel.trim() || !portalTargetId) return
    const portal: RoomPortal = {
      id: portalDialog.portalId ?? nanoid(),
      targetRoomId: portalTargetId,
      label: portalLabel.trim(),
      position: { x: portalDialog.x, y: 0, z: portalDialog.z },
      rotation: { x: 0, y: 0, z: 0 },
    }

    if (portalDialog.portalId) {
      updatePortal(room.id, portalDialog.portalId, portal)
    } else {
      addPortal(room.id, portal)
    }

    setPortalDialog(null)
  }

  const handleUploadModel = async (file: File) => {
    const nextUrl = await uploadModel(file)
    updateRoom(room.id, { modelUrl: nextUrl })
    setModelUrlInput(nextUrl)
    setModelUrlError(null)
  }

  const handleApplyModelUrl = () => {
    const nextUrl = modelUrlInput.trim()

    if (!nextUrl) {
      updateRoom(room.id, { modelUrl: null })
      setModelUrlError(null)
      return
    }

    if (!/\.(glb|gltf)(\?.*)?$/i.test(nextUrl)) {
      setModelUrlError('Model URL phải kết thúc bằng .glb hoặc .gltf')
      return
    }

    updateRoom(room.id, { modelUrl: nextUrl })
    setModelUrlError(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={styles.root}>
      {/* ── Left panel ── */}
      <div style={styles.panel}>
        <div style={styles.panelHeader}>
          <button style={styles.backBtn} onClick={() => navigate('/rooms')}>
            ← Phòng
          </button>
          <h2 style={styles.roomTitle}>{room.title}</h2>
        </div>

        <div style={styles.panelScroll}>
          <Section title="Model 3D">
            <label style={styles.label}>Tên phòng</label>
            <div style={styles.inlineActions}>
              <input
                style={{ ...styles.input, flex: 1 }}
                value={roomTitleInput}
                onChange={(e) => setRoomTitleInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleApplyRoomTitle()}
                placeholder="Nhập tên phòng"
              />
              <button
                style={styles.btnSecondary}
                onClick={handleApplyRoomTitle}
                disabled={!roomTitleInput.trim() || roomTitleInput.trim() === room.title}
              >
                Lưu tên
              </button>
            </div>

            <label style={styles.label}>URL file GLB / GLTF</label>
            <input
              style={styles.input}
              value={modelUrlInput}
              onChange={(e) => {
                setModelUrlInput(e.target.value)
                if (modelUrlError) setModelUrlError(null)
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyModelUrl()}
              placeholder="/content/models/hall.glb"
            />
            <div style={styles.hint}>
              URL chỉ được áp dụng khi bấm nút bên dưới, tránh làm hỏng preview khi đang gõ.
            </div>
            {modelUrlError && <div style={styles.errorText}>{modelUrlError}</div>}
            <div style={styles.inlineActions}>
              <button style={styles.btnPrimary} onClick={handleApplyModelUrl}>
                Áp dụng model URL
              </button>
              <button
                style={styles.btnSecondary}
                onClick={() => modelFileInputRef.current?.click()}
              >
                Upload model
              </button>
              {room.modelUrl && (
                <button
                  style={styles.btnCancel}
                  onClick={() => {
                    setModelUrlInput('')
                    updateRoom(room.id, { modelUrl: null })
                    setModelUrlError(null)
                  }}
                >
                  Bỏ model
                </button>
              )}
            </div>
            <input
              ref={modelFileInputRef}
              type="file"
              accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                try {
                  await handleUploadModel(file)
                } catch (err) {
                  window.alert(String(err))
                } finally {
                  e.currentTarget.value = ''
                }
              }}
            />

            <label style={styles.label}>Model offset (X / Y / Z)</label>
            <div style={styles.fieldRow3}>
              {modelOffsetInput.map((value, index) => (
                <input
                  key={index}
                  style={styles.input}
                  type="number"
                  step="0.1"
                  value={value}
                  onChange={(e) => {
                    const next = [...modelOffsetInput] as [number, number, number]
                    next[index] = Number(e.target.value)
                    setModelOffsetInput(next)
                  }}
                />
              ))}
            </div>
            <div style={styles.hint}>
              Neu model xuat tu Blender khong nam o gan goc toa do, can nhap offset de keo phong ve
              dung vi tri. Vi du `side.glb` sample dung `-40, 0, 0`.
            </div>
            <div style={styles.inlineActions}>
              <button style={styles.btnSecondary} onClick={handleApplyModelOffset}>
                Áp dụng offset
              </button>
              <button style={styles.btnCancel} onClick={handleClearModelOffset}>
                Xóa offset
              </button>
            </div>
          </Section>

          <Section title="Điểm đứng (Viewpoints)">
            <button style={styles.btnPrimary} onClick={handleCaptureViewpoint}>
              + Lưu vị trí hiện tại
            </button>
            <div style={styles.hint}>Đi vào phòng, nhìn hướng muốn lưu, rồi nhấn nút trên.</div>

            {room.viewpoints.length === 0 && <div style={styles.empty}>Chưa có điểm đứng nào.</div>}

            {room.viewpoints.map((vp) => {
              const isEntry = vp.id === room.entryViewpointId
              return (
                <div key={vp.id} style={styles.listRow}>
                  <button
                    style={{
                      ...styles.listLabel,
                      fontWeight: isEntry ? 700 : 400,
                      color: isEntry ? '#c8a85a' : '#c0b8a8',
                    }}
                    onClick={() => setActiveVpId(vp.id)}
                    title="Click để nhảy tới điểm này"
                  >
                    {isEntry ? '★ ' : '◎ '}
                    {vp.name}
                  </button>
                  <div style={styles.listActions}>
                    <button
                      style={styles.iconBtn}
                      title="Sửa tên/vị trí điểm đứng"
                      onClick={() => handleEditViewpoint(vp)}
                    >
                      ✎
                    </button>
                    {!isEntry && (
                      <button
                        style={styles.iconBtn}
                        title="Đặt làm điểm vào mặc định"
                        onClick={() => setEntryViewpoint(room.id, vp.id)}
                      >
                        ★
                      </button>
                    )}
                    <button
                      style={styles.iconBtnDanger}
                      onClick={() => removeViewpoint(room.id, vp.id)}
                    >
                      ×
                    </button>
                  </div>
                </div>
              )
            })}
          </Section>

          <Section title="Cổng chuyển phòng (Portals)">
            {editMode === 'place-portal' ? (
              <div style={styles.placingHint}>
                <span>Click vào sàn để đặt cổng...</span>
                <button style={styles.btnCancel} onClick={() => setEditMode('none')}>
                  Hủy
                </button>
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
                    <span style={styles.portalTarget}>
                      → {target?.title ?? portal.targetRoomId}
                    </span>
                  </div>
                  <button
                    style={styles.iconBtn}
                    title="Sửa cổng chuyển phòng"
                    onClick={() => handleEditPortal(portal)}
                  >
                    ✎
                  </button>
                  <button
                    style={styles.iconBtnDanger}
                    onClick={() => removePortal(room.id, portal.id)}
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </Section>
        </div>
      </div>

      {/* ── 3D canvas ── */}
      <div style={styles.canvasWrap}>
        <SceneErrorBoundary
          resetKey={room.modelUrl ?? '__no-model__'}
          fallback={(message) => (
            <div style={styles.canvasError}>
              <div style={styles.canvasErrorTitle}>Khong the tai model 3D</div>
              <div style={styles.canvasErrorText}>{message}</div>
              <div style={styles.canvasErrorHint}>
                Ban van co the sua Model URL, bo model, hoac upload lai file dung o cot ben trai.
              </div>
            </div>
          )}
        >
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
              assetBaseUrl={ASSET_BASE_URL}
              {...(room.modelUrl ? { boundsOverride: EDIT_BOUNDS } : {})}
            />
          </SceneCanvas>
        </SceneErrorBoundary>

        {editMode === 'place-portal' && (
          <div style={styles.canvasOverlay}>Click vào sàn để đặt vị trí cổng</div>
        )}

        <div style={styles.canvasTip}>WASD / click sàn để di chuyển · kéo chuột để nhìn</div>
      </div>

      {/* ── Viewpoint dialog ── */}
      {vpDialog && (
        <Dialog
          title={vpDialog.vpId ? 'Sửa điểm đứng' : 'Lưu điểm đứng'}
          onClose={() => setVpDialog(null)}
        >
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
          <button style={styles.btnSecondary} onClick={handleUseCurrentCameraForViewpoint}>
            Lấy vị trí đứng/hướng nhìn hiện tại
          </button>
          <label style={styles.checkRow}>
            <input
              type="checkbox"
              checked={vpIsEntry}
              onChange={(e) => setVpIsEntry(e.target.checked)}
            />
            Đặt làm điểm vào mặc định
          </label>
          <div style={{ fontSize: '12px', color: '#6a5a40' }}>
            Vị trí đứng: ({vpDialog.state.groundPosition.x.toFixed(2)},{' '}
            {vpDialog.state.groundPosition.z.toFixed(2)})
          </div>
          <div style={styles.dialogActions}>
            <button style={styles.btnSecondary} onClick={() => setVpDialog(null)}>
              Hủy
            </button>
            <button
              style={styles.btnPrimary}
              onClick={handleSaveViewpoint}
              disabled={!vpName.trim()}
            >
              Lưu
            </button>
          </div>
        </Dialog>
      )}

      {/* ── Portal dialog ── */}
      {portalDialog && (
        <Dialog
          title={portalDialog.portalId ? 'Sửa cổng chuyển phòng' : 'Thêm cổng chuyển phòng'}
          onClose={() => setPortalDialog(null)}
        >
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
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </div>
          <div style={styles.fieldRow2}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Tọa độ X</label>
              <input
                style={styles.input}
                type="number"
                step="0.1"
                value={portalDialog.x}
                onChange={(e) =>
                  setPortalDialog((prev) => (prev ? { ...prev, x: Number(e.target.value) } : prev))
                }
              />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Tọa độ Z</label>
              <input
                style={styles.input}
                type="number"
                step="0.1"
                value={portalDialog.z}
                onChange={(e) =>
                  setPortalDialog((prev) => (prev ? { ...prev, z: Number(e.target.value) } : prev))
                }
              />
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#6a5a40' }}>
            Vị trí trên sàn: ({portalDialog.x.toFixed(2)}, {portalDialog.z.toFixed(2)})
          </div>
          <div style={styles.dialogActions}>
            <button style={styles.btnSecondary} onClick={() => setPortalDialog(null)}>
              Hủy
            </button>
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
  canvasError: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '24px',
    textAlign: 'center',
    background: '#050505',
    color: '#d8d0c0',
  },
  canvasErrorTitle: { fontSize: '18px', fontWeight: 700, color: '#f0e8d8' },
  canvasErrorText: {
    fontSize: '12px',
    color: '#d07070',
    maxWidth: '560px',
    wordBreak: 'break-word',
  },
  canvasErrorHint: {
    fontSize: '12px',
    color: '#8a7a60',
    maxWidth: '560px',
    lineHeight: 1.6,
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
  errorText: { fontSize: '12px', color: '#d07070' },
  empty: { fontSize: '12px', color: '#5a4a2a', fontStyle: 'italic' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  fieldRow2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  fieldRow3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' },
  inlineActions: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },

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
