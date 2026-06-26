import { useEffect, useState } from 'react'
import type { Content } from '@vm/shared'
import { SceneCanvas, RoomScene, buildRoomProps, useGyroToggle, shouldUseFallback } from '@vm/viewer'
import type { Item } from '@vm/shared'
import { useMuseumStore } from '../store.js'
import { TimelineNav } from '../ui/TimelineNav.js'
import { InfoModal } from '../ui/InfoModal.js'
import { ViewpointNav } from '../ui/ViewpointNav.js'
import { Minimap } from '../ui/Minimap.js'
import { Gallery2D } from './Gallery2D.js'

interface Props {
  content: Content
  onBack: () => void
}

export function Tour({ content, onBack }: Props) {
  const {
    currentRoomId, activeViewpointId,
    selectedItem, selectedSlotId,
    navigateToRoom, selectSlot, closeModal, setViewpoint, setContent,
  } = useMuseumStore()

  const { gyroEnabled, toggleGyro } = useGyroToggle()
  const isMobile = /Mobi|Android|iPhone|iPad/.test(navigator.userAgent)
  const useFallback = shouldUseFallback()

  useEffect(() => {
    setContent(content)
  }, [content])

  if (!currentRoomId || !activeViewpointId) return null

  const roomProps = buildRoomProps(content, currentRoomId)
  if (!roomProps) return null

  const { room, items, textures } = roomProps

  const handleSlotSelect = (slotId: string, item: Item | null) => {
    selectSlot(slotId, item)
  }

  if (useFallback) {
    return (
      <Gallery2D
        content={content}
        currentRoomId={currentRoomId}
        onNavigate={navigateToRoom}
        onBack={onBack}
      />
    )
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* 3D Scene */}
      <SceneCanvas style={{ position: 'absolute', inset: 0 }}>
        <RoomScene
          room={room}
          items={items}
          textures={textures}
          activeViewpointId={activeViewpointId}
          onSlotSelect={handleSlotSelect}
        />
      </SceneCanvas>

      {/* Timeline nav (top) */}
      <TimelineNav
        periods={content.periods}
        rooms={content.rooms}
        currentRoomId={currentRoomId}
        onNavigate={navigateToRoom}
        onBack={onBack}
      />

      {/* Viewpoint nav + gyro (bottom center) */}
      <ViewpointNav
        viewpoints={room.viewpoints}
        activeId={activeViewpointId}
        onSelect={setViewpoint}
        gyroEnabled={gyroEnabled}
        onGyroToggle={toggleGyro}
        showGyro={isMobile}
      />

      {/* Minimap (bottom right) */}
      <Minimap
        rooms={content.rooms}
        periods={content.periods}
        currentRoomId={currentRoomId}
        onNavigate={navigateToRoom}
      />

      {/* Room title badge */}
      <div style={styles.roomBadge}>
        <span style={styles.periodLabel}>
          {content.periods.find((p) => p.id === room.periodId)?.title}
        </span>
        <span style={styles.roomTitle}>{room.title}</span>
      </div>

      {/* Drag hint — fades out after 4s */}
      <DragHint />

      {/* Info modal */}
      {selectedItem && (
        <InfoModal item={selectedItem} onClose={closeModal} />
      )}
    </div>
  )
}

function DragHint() {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 4000)
    return () => clearTimeout(t)
  }, [])
  if (!visible) return null
  return (
    <div style={{
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%,-50%)',
      background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(200,168,90,0.3)',
      color: '#c8a85a', borderRadius: '12px',
      padding: '10px 20px', fontSize: '13px',
      pointerEvents: 'none', zIndex: 5,
      textAlign: 'center', backdropFilter: 'blur(6px)',
      animation: 'fadeout 1s 3s forwards',
    }}>
      🖱 Kéo để nhìn quanh · Click khung ảnh để xem chi tiết
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  roomBadge: {
    position: 'absolute', top: '64px', right: '16px',
    background: 'rgba(15,10,5,0.75)', border: '1px solid #5a4a30',
    borderRadius: '8px', padding: '8px 14px',
    backdropFilter: 'blur(6px)', zIndex: 10,
    display: 'flex', flexDirection: 'column', gap: '2px',
    maxWidth: '200px',
  },
  periodLabel: { fontSize: '11px', color: '#c8a85a', fontWeight: 600 },
  roomTitle: { fontSize: '14px', color: '#f5e6c8', fontWeight: 700 },
}
