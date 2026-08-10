import { useEffect, useRef, useState } from 'react'
import {
  resolveAssetUrl,
  resolveDocumentImageVariantUrl,
  type ContentIndex,
  type DocumentIndexItem,
} from '@vm/shared'
import {
  SceneCanvas,
  RoomScene,
  buildRoomDataProps,
  useGyroToggle,
  shouldUseFallback,
  preloadUrls,
  isBackdropSlotId,
  useMuseumAudio,
} from '@vm/viewer'
import { useMuseumStore, useCurrentRoomStub } from '../store.js'
import { useRoom } from '../content/useRoom.js'
import { fetchDocumentDetails } from '../content/documents.js'
import { InfoModal } from '../ui/InfoModal.js'
import { ViewpointNav } from '../ui/ViewpointNav.js'
import { MobileControls } from '../ui/MobileControls.js'
import { ScreenControls } from '../ui/ScreenControls.js'
import { Gallery2D } from './Gallery2D.js'
import { brand, glassPanel } from '../ui/theme.js'
import { GuideModal } from '../ui/GuideModal.js'

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
    selectedSlotId,
    navigateToRoom,
    selectSlot,
    closeModal,
    setViewpoint,
    setIndex,
    setActiveViewpoint,
    navigationMode,
    setNavigationMode,
  } = useMuseumStore()

  const {
    muted,
    setMuted,
    playAmbientPlaylist,
    stopAmbient,
    playItemPlaylist,
    stopItemAudio,
    stopAll,
  } = useMuseumAudio()

  const { gyroEnabled, toggleGyro } = useGyroToggle()
  const isMobile = /Mobi|Android|iPhone|iPad/.test(navigator.userAgent)
  const useFallback = shouldUseFallback()
  const mobileMoveRef = useRef<{ dx: number; dz: number }>({ dx: 0, dz: 0 })
  const screenLookRef = useRef<{ dyaw: number; dpitch: number }>({ dyaw: 0, dpitch: 0 })

  // States for Gyro tooltip and pulse hint on mobile
  const [showTooltip, setShowTooltip] = useState(isMobile)
  const [showPulse, setShowPulse] = useState(isMobile)
  const [showGuide, setShowGuide] = useState(true)

  // Auto-hide hints after 6 seconds
  useEffect(() => {
    if (!isMobile) return
    const timer = setTimeout(() => {
      setShowTooltip(false)
      setShowPulse(false)
    }, 6000)
    return () => clearTimeout(timer)
  }, [isMobile])

  const handleGyroClick = () => {
    toggleGyro()
    setShowTooltip(false)
    setShowPulse(false)
  }

  // Sync content into the navigation store. Published content can change while the
  // tab stays open, so refresh the store when updatedAt changes.
  useEffect(() => {
    if (!index || index.updatedAt !== content.updatedAt) setIndex(content)
  }, [content, index, setIndex])

  const roomStub = useCurrentRoomStub()
  const roomState = useRoom(roomStub)

  const [sceneReady, setSceneReady] = useState(false)

  // Reset scene ready state on room change
  useEffect(() => {
    setSceneReady(false)
  }, [currentRoomId])

  // Preload textures when room data becomes available
  useEffect(() => {
    if (roomState.status === 'ok') {
      const { room, documents, textures } = buildRoomDataProps(roomState.data, content.textures)
      const urls: string[] = []

      // 1. Preload wall, floor, ceiling textures
      if (room.wallTextureId && textures[room.wallTextureId]) {
        const url = resolveAssetUrl(textures[room.wallTextureId], { assetBaseUrl: ASSET_BASE_URL })
        if (url) urls.push(url)
      }
      if (room.floorTextureId && textures[room.floorTextureId]) {
        const url = resolveAssetUrl(textures[room.floorTextureId], { assetBaseUrl: ASSET_BASE_URL })
        if (url) urls.push(url)
      }
      if (room.ceilingTextureId && textures[room.ceilingTextureId]) {
        const url = resolveAssetUrl(textures[room.ceilingTextureId], { assetBaseUrl: ASSET_BASE_URL })
        if (url) urls.push(url)
      }

      // 2. Preload slot images
      room.slots.forEach((slot) => {
        const firstId = slot.documentIds?.[0]
        const doc = firstId ? documents[firstId] : null
        if (doc) {
          const variant = isBackdropSlotId(slot.id) ? 'full' : (slot.viewerVariant ?? 'wall')
          const texUrl = resolveDocumentImageVariantUrl(doc.documentKey ?? null, doc.viewerImageId ?? null, variant, { assetBaseUrl: ASSET_BASE_URL })
          if (texUrl) {
            urls.push(texUrl)
          }
        }
      })

      if (urls.length > 0) {
        preloadUrls(urls)
      }
    }
  }, [roomState.status, roomState.status === 'ok' ? roomState.data : null, content.textures])

  // Once room data loads, set the entry viewpoint (if not already set)
  // Once room data loads, set the entry viewpoint (if not already set)
  useEffect(() => {
    if (roomState.status === 'ok' && !activeViewpointId) {
      setActiveViewpoint(roomState.data.entryViewpointId)
    }
  }, [roomState.status, activeViewpointId, setActiveViewpoint, roomState])

  // 1. Play ambient audio when room changes
  useEffect(() => {
    if (roomState.status === 'ok') {
      const { room } = buildRoomDataProps(roomState.data, content.textures)
      const ambientUrls = room.ambientAudioUrls?.length
        ? room.ambientAudioUrls
        : room.ambientAudioUrl
          ? [room.ambientAudioUrl]
          : []
      if (ambientUrls.length > 0) {
        playAmbientPlaylist(ambientUrls.map((url) => ({
          url,
          loop: room.ambientAudioLoop ?? true,
          volume: room.ambientAudioVolume ?? 0.25,
        })))
        return
      }
    }
    stopAmbient()
  }, [
    roomState.status,
    roomState.status === 'ok' ? roomState.data.id : null,
    roomState.status === 'ok' ? roomState.data.ambientAudioUrl : null,
    roomState.status === 'ok' ? roomState.data.ambientAudioUrls?.join('\\n') : null,
    roomState.status === 'ok' ? roomState.data.ambientAudioLoop : null,
    roomState.status === 'ok' ? roomState.data.ambientAudioVolume : null,
    content.textures
  ])

  // 2. Play item audio playlist when document details are opened
  useEffect(() => {
    const playlist = selectedDocuments
      .filter((doc) => doc.audioUrl)
      .map((doc) => ({
        url: doc.audioUrl!,
        volume: doc.audioVolume,
        loop: doc.audioLoop,
      }))

    if (playlist.length > 0) {
      playItemPlaylist(playlist)
    } else {
      stopItemAudio()
    }
  }, [selectedSlotId, selectedDocuments])

  // 3. Stop all audio when page unmounts (leaving tour page)
  useEffect(() => {
    return () => {
      stopAll()
    }
  }, [])

  if (!currentRoomId || !roomStub) return null

  const handleSlotSelect = (slotId: string, documents: DocumentIndexItem[]) => {
    void fetchDocumentDetails(documents).then((details) => selectSlot(slotId, details))
  }

  const handleViewpointSelect = (vpId: string) => {
    setViewpoint(vpId)
    window.dispatchEvent(new CustomEvent('vm:snap-viewpoint', { detail: vpId }))
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


  const currentSlot = room.slots.find((s) => s.id === selectedSlotId)
  const currentZone = currentSlot?.zone
  const activeSlots = room.slots.filter(
    (s) => s.visible !== false && (s.documentIds ?? []).length > 0 && s.zone === currentZone
  )
  const currentSlotIndex = selectedSlotId ? activeSlots.findIndex((s) => s.id === selectedSlotId) : -1



  const handlePrevSlot = () => {
    if (currentSlotIndex > 0) {
      const prev = activeSlots[currentSlotIndex - 1]
      if (!prev) return
      const docsToFetch = (prev.documentIds ?? [])
        .map((id) => documents[id])
        .filter((d): d is DocumentIndexItem => !!d)
      void fetchDocumentDetails(docsToFetch).then((details) => selectSlot(prev.id, details))
    }
  }

  const handleNextSlot = () => {
    if (currentSlotIndex < activeSlots.length - 1) {
      const next = activeSlots[currentSlotIndex + 1]
      if (!next) return
      const docsToFetch = (next.documentIds ?? [])
        .map((id) => documents[id])
        .filter((d): d is DocumentIndexItem => !!d)
      void fetchDocumentDetails(docsToFetch).then((details) => selectSlot(next.id, details))
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', fontFamily: brand.fontFamily }}>
      {/* 3D Scene */}
      <SceneCanvas style={{ position: 'absolute', inset: 0 }}>
        <RoomScene
          room={room}
          documents={documents}
          textures={textures}
          activeViewpointId={activeViewpointId ?? ''}
          gyroEnabled={gyroEnabled}
          mobileMoveRef={mobileMoveRef}
          screenLookRef={screenLookRef}
          hideLabels={selectedDocuments.length > 0}
          onSlotSelect={handleSlotSelect}
          onNavigate={navigateToRoom}
          assetBaseUrl={ASSET_BASE_URL}
          assetVersion={import.meta.env.VITE_ASSET_VERSION ?? ''}
          navigationMode={navigationMode}
          onViewpointSelect={handleViewpointSelect}
        />
        <SceneReadyNotifier onReady={() => setSceneReady(true)} />
      </SceneCanvas>

      {/* Top-right action buttons */}
      <div style={topRightContainer}>
        {/* Âm thanh */}
        <button
          style={{
            ...homeBtn,
            background: muted ? 'rgba(255, 255, 255, 0.45)' : brand.blue,
            borderColor: muted ? glassPanel.borderColor : brand.blueDark,
            color: muted ? brand.blue : '#ffffff',
            boxShadow: muted ? '0 4px 12px rgba(8,47,109,0.15)' : '0 4px 12px rgba(16,80,160,0.35)',
          }}
          onClick={() => setMuted(!muted)}
          title={muted ? "Bật âm thanh" : "Tắt âm thanh"}
          aria-label={muted ? "Bật âm thanh" : "Tắt âm thanh"}
        >
          {muted ? <MutedIcon /> : <VolumeIcon />}
          <span>{muted ? 'Bật âm' : 'Âm thanh'}</span>
        </button>

        {/* Hướng dẫn */}
        <button style={homeBtn} onClick={() => setShowGuide(true)} title="Hướng dẫn sử dụng" aria-label="Hướng dẫn sử dụng">
          <HelpIcon />
          <span>Hướng dẫn</span>
        </button>

        {/* Di chuyển */}
        <button
          style={{
            ...homeBtn,
            background: navigationMode === 'point-to-point' ? brand.blue : glassPanel.background,
            borderColor: navigationMode === 'point-to-point' ? brand.blueDark : glassPanel.borderColor,
            color: navigationMode === 'point-to-point' ? '#ffffff' : brand.blue,
            boxShadow: navigationMode === 'point-to-point' ? '0 4px 12px rgba(16,80,160,0.35)' : '0 4px 12px rgba(8,47,109,0.15)',
          }}
          onClick={() => setNavigationMode(navigationMode === 'point-to-point' ? 'free' : 'point-to-point')}
          title={navigationMode === 'point-to-point' ? "Chuyển sang chế độ di chuyển tự do" : "Chuyển sang chế độ di chuyển theo điểm dừng (tránh kẹt tường)"}
          aria-label="Chế độ di chuyển"
        >
          {navigationMode === 'point-to-point' ? <PointIcon /> : <FreeIcon />}
          <span>
            {isMobile
              ? (navigationMode === 'point-to-point' ? 'Cố định' : 'Tự do')
              : (navigationMode === 'point-to-point' ? 'Di chuyển: Theo điểm cố định' : 'Di chuyển: Tự do')}
          </span>
        </button>

        {/* Mobile: Gyroscope Sensor Toggle */}
        {isMobile && (
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <button
              style={{
                ...gyroBtn,
                ...(gyroEnabled ? gyroBtnOn : {}),
              }}
              onClick={handleGyroClick}
              title={gyroEnabled ? "Tắt xoay 360°" : "Bật xoay 360°"}
              aria-label="Cảm biến xoay"
            >
              <PhoneGyroIcon />
            </button>

            {showTooltip && (
              <div style={tooltip}>
                Chạm để xoay nhìn quanh bằng cảm biến điện thoại
                <div style={tooltipArrow} />
              </div>
            )}
            {showPulse && <span style={pulseBadge} />}
          </div>
        )}
      </div>

      {/* Viewpoint nav (bottom center) */}
      <ViewpointNav
        viewpoints={room.viewpoints}
        activeId={activeViewpointId ?? ''}
        onSelect={handleViewpointSelect}
        gyroEnabled={gyroEnabled}
        onGyroToggle={toggleGyro}
        showGyro={false}
      />

      {/* Mobile: Joystick movement */}
      {isMobile && navigationMode === 'free' && (
        <MobileControls
          moveRef={mobileMoveRef}
        />
      )}

      {/* Desktop: Screen buttons for Move/Look - Temporarily hidden per user request */}
      {/* {!isMobile && navigationMode === 'free' && (
        <ScreenControls
          moveRef={mobileMoveRef}
          lookRef={screenLookRef}
        />
      )} */}

      {/* Drag hint — fades out after 4s */}
      <DragHint isMobile={isMobile} navigationMode={navigationMode} />

      {/* Info modal */}
      {selectedDocuments.length > 0 && (
        <InfoModal
          documents={selectedDocuments}
          onClose={closeModal}
          hasPrev={currentSlotIndex > 0}
          hasNext={currentSlotIndex < activeSlots.length - 1}
          onPrev={handlePrevSlot}
          onNext={handleNextSlot}
        />
      )}

      {/* Guide modal */}
      {showGuide && (
        <GuideModal
          content={content}
          currentRoomId={currentRoomId}
          onClose={() => {
            if (sceneReady) {
              setShowGuide(false)
            }
          }}
          sceneReady={sceneReady}
        />
      )}
    </div>
  )
}


function HelpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="3" />
    </svg>
  )
}

function MutedIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  )
}

function VolumeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
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

function DragHint({ isMobile, navigationMode }: { isMobile: boolean; navigationMode: 'point-to-point' | 'free' }) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 5000)
    return () => clearTimeout(t)
  }, [])
  if (!visible) return null

  const text = navigationMode === 'point-to-point'
    ? (isMobile
      ? 'Kéo để nhìn quanh · Chạm các vòng tròn vàng trên sàn để di chuyển'
      : 'Kéo để nhìn quanh · Click điểm sáng vàng dưới sàn để di chuyển · Click khung ảnh để xem chi tiết')
    : (isMobile
      ? 'Kéo để nhìn quanh · D-pad bên trái để di chuyển · Bật gyro trong nút điều khiển'
      : 'Kéo để nhìn quanh · Click sàn để di chuyển · WASD hoặc phím di chuyển để đi bộ · Click khung ảnh để xem chi tiết')

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
      {text}
    </div>
  )
}

function PointIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  )
}

function FreeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M15 3h6v6" />
      <path d="M9 21H3v-6" />
      <path d="M21 3l-7 7" />
      <path d="M3 21l7-7" />
      <path d="M18 14l3 3-3 3" />
      <path d="M6 10l-3-3 3-3" />
      <path d="M3 7h8m10 10h-8" />
    </svg>
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

const topRightContainer: React.CSSProperties = {
  position: 'absolute',
  top: 12,
  right: 12,
  zIndex: 10,
  display: 'flex',
  gap: 8,
  alignItems: 'center',
}

const homeBtn: React.CSSProperties = {
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
  boxShadow: '0 4px 12px rgba(8,47,109,0.15)',
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

function PhoneGyroIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <path d="M12 18h.01" />
      <path d="M17 12h.01" />
      <path d="M7 12h.01" />
      <path d="M3 8c0-2 1.5-4 4-4" strokeWidth="1.5" />
      <path d="M21 16c0 2-1.5 4-4 4" strokeWidth="1.5" />
    </svg>
  )
}


const gyroBtn: React.CSSProperties = {
  ...glassPanel,
  width: 38,
  height: 38,
  borderRadius: '50%',
  color: brand.blue,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  transition: 'all 0.2s ease',
  boxShadow: '0 4px 12px rgba(8,47,109,0.15)',
}

const gyroBtnOn: React.CSSProperties = {
  background: brand.blue,
  borderColor: brand.blueDark,
  color: '#ffffff',
  boxShadow: '0 4px 12px rgba(16,80,160,0.35)',
}

const pulseBadge: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  right: 0,
  width: 10,
  height: 10,
  borderRadius: '50%',
  background: '#ff3b30',
  border: '2.5px solid #ffffff',
  pointerEvents: 'none',
  animation: 'pulse 1.6s infinite',
}

const tooltip: React.CSSProperties = {
  position: 'absolute',
  top: 48,
  right: 0,
  width: 170,
  background: 'rgba(16, 80, 160, 0.94)',
  color: '#ffffff',
  padding: '8px 12px',
  borderRadius: '8px',
  fontSize: '11px',
  lineHeight: '1.35',
  textAlign: 'center',
  boxShadow: '0 8px 24px rgba(8,47,109,0.22)',
  pointerEvents: 'none',
  backdropFilter: 'blur(5px)',
  zIndex: 12,
  fontWeight: '600',
  border: '1px solid rgba(255,255,255,0.15)',
}

const tooltipArrow: React.CSSProperties = {
  position: 'absolute',
  top: -5,
  right: 14,
  width: 0,
  height: 0,
  borderLeft: '5px solid transparent',
  borderRight: '5px solid transparent',
  borderBottom: '5px solid rgba(16, 80, 160, 0.94)',
}

function SceneReadyNotifier({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady()
  }, [onReady])
  return null
}
