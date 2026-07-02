import { useState } from 'react'
import { SceneCanvas, RoomScene, buildRoomProps } from '@vm/viewer'
import { useDraftStore } from '../store.js'

const ASSET_BASE_URL = (import.meta.env.VITE_ASSET_BASE_URL ?? '').replace(/\/+$/, '')

export function Preview() {
  const content = useDraftStore((s) => s.content)
  const [roomId, setRoomId] = useState<string>('')

  if (!content) return <div style={styles.center}>Đang tải...</div>

  const activeRoomId = roomId || content.rooms[0]?.id || ''
  const roomProps = buildRoomProps(content, activeRoomId)

  return (
    <div style={styles.root}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <span style={styles.label}>Xem trước phòng:</span>
        <select
          style={styles.select}
          value={activeRoomId}
          onChange={(e) => setRoomId(e.target.value)}
        >
          {content.rooms.map((r) => {
            const period = content.periods.find((p) => p.id === r.periodId)
            return (
              <option key={r.id} value={r.id}>
                {r.title} — {period?.title ?? ''}
              </option>
            )
          })}
        </select>
        <span style={styles.hint}>
          Kéo để nhìn quanh · WASD để di chuyển · Click ảnh để xem chi tiết
        </span>
      </div>

      {/* 3D canvas */}
      <div style={styles.canvas}>
        {!roomProps ? (
          <div style={styles.center}>Không tìm thấy phòng.</div>
        ) : (
          <SceneCanvas style={{ width: '100%', height: '100%' }}>
            <RoomScene
              room={roomProps.room}
              items={roomProps.items}
              textures={roomProps.textures}
              activeViewpointId={roomProps.room.entryViewpointId}
              onSlotSelect={() => {}}
              assetBaseUrl={ASSET_BASE_URL}
            />
          </SceneCanvas>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '12px 20px',
    borderBottom: '1px solid #2a1e10',
    flexShrink: 0,
    background: '#0d0906',
  },
  label: { fontSize: '13px', color: '#9a9080', flexShrink: 0 },
  select: {
    padding: '7px 12px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid #3a2e1e',
    borderRadius: '6px',
    color: '#f0e8d8',
    outline: 'none',
    fontSize: '13px',
    minWidth: '280px',
  },
  hint: { fontSize: '12px', color: '#4a3a20', marginLeft: 'auto' },
  canvas: { flex: 1, position: 'relative' },
  center: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#6a5a40',
  },
}
