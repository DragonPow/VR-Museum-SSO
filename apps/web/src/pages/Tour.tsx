import { useEffect, useRef, useState } from 'react'
import type { ContentIndex, DocumentIndexItem } from '@vm/shared'
import {
  SceneCanvas,
  RoomScene,
  buildRoomDataProps,
  useGyroToggle,
  shouldUseFallback,
} from '@vm/viewer'
import { useMuseumStore, useCurrentRoomStub } from '../store.js'
import { useRoom } from '../content/useRoom.js'
import { fetchDocumentDetails } from '../content/documents.js'
import { InfoModal } from '../ui/InfoModal.js'
import { ViewpointNav } from '../ui/ViewpointNav.js'
import { MobileControls } from '../ui/MobileControls.js'
import { Gallery2D } from './Gallery2D.js'
import { brand, glassPanel } from '../ui/theme.js'

const ASSET_BASE_URL = (import.meta.env.VITE_ASSET_BASE_URL ?? '').replace(/\/+$/, '')

interface Props {
  content: ContentIndex
  onBack: () => void
}

export function Tour({ content, onBack }: Props) {
  const {
    index,
    currentRoomId,
    activeViewpointId,
    selectedDocuments,
    navigateToRoom,
    selectSlot,
    closeModal,
    setViewpoint,
    setIndex,
    setActiveViewpoint,
  } = useMuseumStore()

  const { gyroEnabled, toggleGyro } = useGyroToggle()
  const isMobile = /Mobi|Android|iPhone|iPad/.test(navigator.userAgent)
  const useFallback = shouldUseFallback()
  const mobileMoveRef = useRef<{ dx: number; dz: number }>({ dx: 0, dz: 0 })

  // Sync content into the navigation store. Published content can change while the
  // tab stays open, so refresh the store when updatedAt changes.
  useEffect(() => {
    if (!index || index.updatedAt !== content.updatedAt) setIndex(content)
  }, [content, index, setIndex])

  const roomStub = useCurrentRoomStub()
  const roomState = useRoom(roomStub)

  // Once room data loads, set the entry viewpoint (if not already set)
  useEffect(() => {
    if (roomState.status === 'ok' && !activeViewpointId) {
      setActiveViewpoint(roomState.data.entryViewpointId)
    }
  }, [roomState.status, activeViewpointId, setActiveViewpoint, roomState])

  if (!currentRoomId || !roomStub) return null

  const handleSlotSelect = (slotId: string, documents: DocumentIndexItem[]) => {
    void fetchDocumentDetails(documents).then((details) => selectSlot(slotId, details))
  }

  if (useFallback) {
    if (roomState.status !== 'ok') return <RoomLoadingScreen />
    return (
      <Gallery2D
        content={content}
        roomData={roomState.data}
        currentRoomId={currentRoomId}
        onNavigate={navigateToRoom}
        onBack={onBack}
      />
    )
  }

  if (roomState.status === 'loading' || roomState.status === 'idle') {
    return <RoomLoadingScreen />
  }
  if (roomState.status === 'error') {
    return (
      <div
        style={{ ...centerStyle, color: '#b3261e', fontSize: 14, flexDirection: 'column', gap: 8 }}
      >
        <p>Không thể tải phòng: {roomState.message}</p>
        <button style={retryBtn} onClick={() => navigateToRoom(currentRoomId)}>
          Thử lại
        </button>
      </div>
    )
  }

  if (!activeViewpointId) return <RoomLoadingScreen />

  const { room, documents, textures } = buildRoomDataProps(roomState.data, content.textures)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', fontFamily: brand.fontFamily }}>
      {/* 3D Scene */}
      <SceneCanvas style={{ position: 'absolute', inset: 0 }}>
        <RoomScene
          room={room}
          documents={documents}
          textures={textures}
          activeViewpointId={activeViewpointId}
          gyroEnabled={gyroEnabled}
          mobileMoveRef={mobileMoveRef}
          hideLabels={selectedDocuments.length > 0}
          onSlotSelect={handleSlotSelect}
          onNavigate={navigateToRoom}
          assetBaseUrl={ASSET_BASE_URL}
        />
      </SceneCanvas>

      <button style={homeBtn} onClick={onBack} title="Về trang chủ" aria-label="Về trang chủ">
        <HomeIcon />
        <span>Trang chủ</span>
      </button>

      {/* Viewpoint nav (bottom center) */}
      <ViewpointNav
        viewpoints={room.viewpoints}
        activeId={activeViewpointId}
        onSelect={setViewpoint}
        gyroEnabled={gyroEnabled}
        onGyroToggle={toggleGyro}
        showGyro={false}
      />

      {/* Mobile: D-pad movement + gyro toggle (bottom left) */}
      {isMobile && (
        <MobileControls
          moveRef={mobileMoveRef}
          gyroEnabled={gyroEnabled}
          onGyroToggle={toggleGyro}
        />
      )}

      {/* Drag hint — fades out after 4s */}
      <DragHint isMobile={isMobile} />

      {/* Info modal */}
      {selectedDocuments.length > 0 && <InfoModal documents={selectedDocuments} onClose={closeModal} />}
    </div>
  )
}

function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M3 10.8 12 3l9 7.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 9.5V20h13V9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 20v-6h5v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function RoomLoadingScreen() {
  return (
    <div style={{ ...centerStyle, flexDirection: 'column', gap: 12 }}>
      <div style={spinnerStyle} />
      <p style={{ color: brand.muted, fontSize: 13 }}>Đang tải phòng…</p>
    </div>
  )
}

function DragHint({ isMobile }: { isMobile: boolean }) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 5000)
    return () => clearTimeout(t)
  }, [])
  if (!visible) return null
  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%,-50%)',
        background: 'rgba(255,255,255,0.9)',
        border: `1px solid ${brand.line}`,
        color: brand.blue,
        borderRadius: '12px',
        padding: '10px 20px',
        fontSize: '13px',
        pointerEvents: 'none',
        zIndex: 5,
        textAlign: 'center',
        backdropFilter: 'blur(6px)',
        animation: 'fadeout 1s 4s forwards',
        maxWidth: '320px',
      }}
    >
      {isMobile
        ? 'Kéo để nhìn quanh · D-pad bên trái để di chuyển · Bật gyro trong nút điều khiển'
        : 'Kéo để nhìn quanh · Click sàn để di chuyển · WASD hoặc phím điều hướng để đi bộ · Click khung ảnh để xem chi tiết'}
    </div>
  )
}

const centerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: `linear-gradient(135deg, ${brand.sky}, #d8e8f8)`,
}

const homeBtn: React.CSSProperties = {
  position: 'absolute',
  top: 12,
  left: 12,
  zIndex: 10,
  ...glassPanel,
  color: brand.blue,
  borderRadius: 8,
  padding: '7px 13px',
  fontSize: 12,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  fontWeight: 800,
  fontFamily: brand.fontFamily,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
}

const spinnerStyle: React.CSSProperties = {
  width: '36px',
  height: '36px',
  border: '3px solid rgba(16,80,160,0.18)',
  borderTop: `3px solid ${brand.blue}`,
  borderRadius: '50%',
  animation: 'spin 1s linear infinite',
}

const retryBtn: React.CSSProperties = {
  padding: '8px 20px',
  background: brand.blue,
  border: `1px solid ${brand.blueDark}`,
  color: '#ffffff',
  borderRadius: 6,
  cursor: 'pointer',
}
