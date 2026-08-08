import type { ContentIndex } from '@vm/shared'
import { useState, useEffect } from 'react'
import { useProgress } from '@react-three/drei'
import { brand } from './theme.js'
import { useMuseumStore } from '../store.js'
import { RoomMap } from './RoomMap.js'

interface Props {
  content: ContentIndex
  onClose: () => void
  currentRoomId: string | null
  sceneReady?: boolean
}

export function GuideModal({ content, onClose, currentRoomId, sceneReady = true }: Props) {
  const { progress, active } = useProgress()
  const navigationMode = useMuseumStore((s) => s.navigationMode)
  const setNavigationMode = useMuseumStore((s) => s.setNavigationMode)
  const [isMobile, setIsMobile] = useState(false)
  const [activeTab, setActiveTab] = useState<'map' | 'controls'>('map')

  const handleSelectMode = (mode: 'point-to-point' | 'free') => {
    setNavigationMode(mode)
    onClose()
  }

  useEffect(() => {
    const checkDevice = () => {
      setIsMobile(/Mobi|Android|iPhone|iPad/.test(navigator.userAgent) || window.innerWidth < 900)
    }
    checkDevice()
    window.addEventListener('resize', checkDevice)
    return () => window.removeEventListener('resize', checkDevice)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sceneReady) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, sceneReady])

  return (
    <div className="guide-overlay" onClick={sceneReady ? onClose : undefined}>
      <style>{`
        .guide-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(8, 24, 48, 0.6);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          animation: guideFadeIn 0.22s ease-out;
          font-family: ${brand.fontFamily};
        }
        .guide-container {
          width: 94%;
          max-width: 1080px;
          max-height: 90vh;
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid rgba(16, 80, 160, 0.25);
          border-radius: 18px;
          box-shadow: 0 24px 64px rgba(8, 47, 109, 0.28);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: guideSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .guide-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
          border-bottom: 1px solid rgba(16, 80, 160, 0.12);
        }
        .guide-title {
          font-size: 18px;
          font-weight: 800;
          color: ${brand.blue};
          letter-spacing: 0.5px;
          text-transform: uppercase;
          margin: 0;
        }
        .guide-close {
          background: none;
          border: none;
          cursor: pointer;
          color: ${brand.muted};
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 50%;
        }
        .guide-close:hover {
          color: ${brand.blue};
          background: rgba(16, 80, 160, 0.08);
          transform: rotate(90deg);
        }
        
        /* Tab styles for mobile */
        .guide-tabs {
          display: flex;
          background: rgba(16, 80, 160, 0.05);
          border: 1px solid rgba(16, 80, 160, 0.1);
          border-radius: 10px;
          padding: 4px;
          margin: 16px 24px 0 24px;
        }
        .guide-tab-btn {
          flex: 1;
          padding: 10px;
          background: none;
          border: none;
          border-radius: 7px;
          font-size: 13px;
          font-weight: 700;
          color: ${brand.muted};
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
        }
        .guide-tab-btn.active {
          background: ${brand.blue};
          color: #ffffff;
          box-shadow: 0 3px 10px rgba(16, 80, 160, 0.2);
        }

        .guide-body {
          padding: 20px 24px;
          overflow-y: auto;
          display: grid;
          grid-template-columns: 1fr 1.4fr;
          gap: 24px;
          flex-grow: 1;
        }
        .guide-column {
          display: flex;
          flex-direction: column;
          gap: 14px;
          background: rgba(248, 251, 255, 0.5);
          border: 1px solid rgba(16, 80, 160, 0.08);
          border-radius: 12px;
          padding: 16px;
        }
        .guide-col-title {
          font-size: 13.5px;
          font-weight: 800;
          color: ${brand.blue};
          margin: 0 0 6px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          border-bottom: 1.5px solid rgba(16, 80, 160, 0.12);
          padding-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .guide-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .guide-icon-wrapper {
          width: 40px;
          height: 40px;
          background: rgba(16, 80, 160, 0.06);
          border: 1px solid rgba(16, 80, 160, 0.12);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: ${brand.blue};
        }
        .guide-text-wrap {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .guide-label {
          font-size: 12.5px;
          font-weight: 700;
          color: ${brand.text};
        }
        .guide-desc {
          font-size: 11.5px;
          color: ${brand.muted};
          line-height: 1.45;
        }



        .guide-footer-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 18px 24px;
          border-top: 1px solid rgba(16, 80, 160, 0.12);
          background: rgba(248, 251, 255, 0.9);
        }
        .guide-footer-title {
          font-size: 13px;
          font-weight: 800;
          color: ${brand.blue};
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 2px;
        }
        .guide-mode-options {
          display: flex;
          gap: 16px;
          width: 100%;
          max-width: 720px;
        }
        .guide-mode-btn {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: center;
          text-align: center;
          padding: 12px 20px;
          border-radius: 10px;
          border: 1.5px solid rgba(16, 80, 160, 0.15);
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
          background: #ffffff;
        }
        .guide-mode-btn.mode-ptp {
          border-color: rgba(200, 168, 90, 0.4);
          background: linear-gradient(to bottom, #ffffff, rgba(200, 168, 90, 0.04));
        }
        .guide-mode-btn.mode-ptp:hover {
          border-color: #c8a85a;
          background: linear-gradient(to bottom, #ffffff, rgba(200, 168, 90, 0.08));
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(200, 168, 90, 0.18);
        }
        .guide-mode-btn.mode-free {
          border-color: rgba(16, 80, 160, 0.15);
          background: linear-gradient(to bottom, #ffffff, rgba(16, 80, 160, 0.03));
        }
        .guide-mode-btn.mode-free:hover {
          border-color: ${brand.blue};
          background: linear-gradient(to bottom, #ffffff, rgba(16, 80, 160, 0.06));
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(8, 47, 109, 0.15);
        }
        .mode-btn-title {
          font-size: 13.5px;
          font-weight: 800;
        }
        .guide-mode-btn.mode-ptp .mode-btn-title {
          color: #a68030;
        }
        .guide-mode-btn.mode-free .mode-btn-title {
          color: ${brand.blue};
        }
        .mode-btn-desc {
          font-size: 11.5px;
          color: ${brand.muted};
          line-height: 1.45;
        }

        @media (max-width: 600px) {
          .guide-mode-options {
            flex-direction: column;
            gap: 10px;
          }
          .guide-mode-btn {
            padding: 10px 14px;
          }
        }
        
        .guide-zones-list::-webkit-scrollbar {
          width: 5px;
        }
        .guide-zones-list::-webkit-scrollbar-track {
          background: transparent;
        }
        .guide-zones-list::-webkit-scrollbar-thumb {
          background: rgba(16, 80, 160, 0.15);
          border-radius: 99px;
        }
        .guide-zones-list::-webkit-scrollbar-thumb:hover {
          background: rgba(16, 80, 160, 0.3);
        }

        @keyframes guideFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes guideSlideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        /* Tablet/Mobile Responsive adjustments */
        @media (max-width: 900px) {
          .guide-container {
            width: 94%;
            max-height: 92vh;
          }
          .guide-body {
            grid-template-columns: 1fr;
            padding: 16px;
            gap: 16px;
          }
          .guide-zones-list {
            grid-template-columns: 1fr;
            max-height: 180px;
          }
        }
        
        .guide-loading-spinner {
          width: 22px;
          height: 22px;
          border: 2.5px solid rgba(16, 80, 160, 0.15);
          border-top: 2.5px solid ${brand.blue};
          border-radius: 50%;
          animation: guideSpinner 0.8s linear infinite;
          margin-right: 5px;
        }
        @keyframes guideSpinner {
          to { transform: rotate(360deg); }
        }
        
        .guide-loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          width: 100%;
          max-width: 480px;
          padding: 8px 0;
          animation: guideFadeIn 0.3s ease-out;
        }
        .guide-loading-text {
          font-size: 13.5px;
          font-weight: 700;
          color: ${brand.blue};
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .guide-loading-progress-bar {
          width: 100%;
          height: 6px;
          background: rgba(16, 80, 160, 0.08);
          border-radius: 99px;
          overflow: hidden;
          position: relative;
        }
        .guide-loading-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, ${brand.blue}, #5cc3f6);
          border-radius: 99px;
          transition: width 0.25s ease-out;
        }
      `}</style>

      <div className="guide-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="guide-header">
          <h2 className="guide-title">Hướng dẫn sử dụng</h2>
          {sceneReady ? (
            <button className="guide-close" onClick={onClose} aria-label="Đóng hướng dẫn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          ) : (
            <div className="guide-loading-spinner" title="Đang tải dữ liệu phòng..." />
          )}
        </div>

        {/* Tab switcher for mobile */}
        {isMobile && (
          <div className="guide-tabs">
            <button
              className={`guide-tab-btn ${activeTab === 'map' ? 'active' : ''}`}
              onClick={() => setActiveTab('map')}
            >
              Sơ đồ khu vực
            </button>
            <button
              className={`guide-tab-btn ${activeTab === 'controls' ? 'active' : ''}`}
              onClick={() => setActiveTab('controls')}
            >
              {!isMobile ? 'Hướng dẫn thao tác' : 'Các thao tác'}
            </button>
          </div>
        )}

        {/* Body */}
        <div className="guide-body" style={{ display: isMobile ? 'block' : 'grid' }}>

          {/* Column 1: Controls (shown if not mobile, or if mobile and activeTab is 'controls') */}
          {(!isMobile || (isMobile && activeTab === 'controls')) && (
            <div className="guide-column" style={{ marginBottom: isMobile ? '16px' : 0 }}>
              {!isMobile ? (
                <>
                  <h3 className="guide-col-title">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                    Điều khiển máy tính (PC)
                  </h3>

                  <div className="guide-item">
                    <div className="guide-icon-wrapper">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2v20M5 9a7 7 0 0 1 14 0v6a7 7 0 0 1-14 0V9z" />
                        <path d="M5 9c0-3.87 3.13-7 7-7v7H5z" fill="rgba(16, 80, 160, 0.25)" stroke="none" />
                        <path d="M7 6c-1.5 1-2.5 3-2.5 5" strokeWidth="1.2" />
                        <path d="M12 9H5" />
                      </svg>
                    </div>
                    <div className="guide-text-wrap">
                      <span className="guide-label">Xoay hướng nhìn (360°)</span>
                      <span className="guide-desc">Nhấp giữ chuột trái và kéo rê chuột để quay nhìn xung quanh phòng ảo.</span>
                    </div>
                  </div>

                  <div className="guide-item">
                    <div className="guide-icon-wrapper">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="7" y="3" width="10" height="8" rx="1.5" />
                        <text x="12" y="9" fontSize="6.5" fontWeight="900" textAnchor="middle" fill="currentColor" stroke="none">W</text>
                        <rect x="2" y="12" width="9" height="9" rx="1.5" />
                        <text x="6.5" y="18" fontSize="6.5" fontWeight="900" textAnchor="middle" fill="currentColor" stroke="none">A</text>
                        <rect x="12" y="12" width="10" height="9" rx="1.5" />
                        <text x="17" y="18" fontSize="6.5" fontWeight="900" textAnchor="middle" fill="currentColor" stroke="none">S</text>
                        <rect x="23" y="12" width="9" height="9" rx="1.5" />
                        <text x="27.5" y="18" fontSize="6.5" fontWeight="900" textAnchor="middle" fill="currentColor" stroke="none">D</text>
                      </svg>
                    </div>
                    <div className="guide-text-wrap">
                      <span className="guide-label">Di chuyển trong phòng</span>
                      <span className="guide-desc">
                        {navigationMode === 'point-to-point'
                          ? 'Click chuột trái vào các điểm sáng màu vàng dưới sàn để di chuyển tới các góc tham quan cố định.'
                          : 'Sử dụng phím mũi tên / WASD để đi bộ, hoặc click chuột vào sàn để di chuyển tự do.'}
                      </span>
                    </div>
                  </div>

                  <div className="guide-item">
                    <div className="guide-icon-wrapper">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="14" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 12 16 7 5 17" />
                        <path d="M12 18l1.5-1.5" />
                        <polygon points="12,18 16,13 18,17" fill="currentColor" />
                      </svg>
                    </div>
                    <div className="guide-text-wrap">
                      <span className="guide-label">Xem chi tiết tư liệu</span>
                      <span className="guide-desc">Nhấp chuột trái vào các khung ảnh hoặc hiện vật trưng bày để phóng to và xem thông tin chi tiết.</span>
                    </div>
                  </div>

                  <div className="guide-item">
                    <div className="guide-icon-wrapper">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2v20M5 9a7 7 0 0 1 14 0v6a7 7 0 0 1-14 0V9z" />
                        <rect x="10.5" y="5" width="3" height="6" rx="1.5" fill="currentColor" />
                        <path d="M12 14v4M12 18l-2-2M12 18l2-2" strokeWidth="1.2" />
                      </svg>
                    </div>
                    <div className="guide-text-wrap">
                      <span className="guide-label">Thu phóng góc nhìn (Zoom)</span>
                      <span className="guide-desc">Cuộn con lăn chuột giữa (scroll wheel) lên hoặc xuống để phóng to/thu nhỏ tầm nhìn.</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="guide-col-title">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                      <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="3" />
                    </svg>
                    Điều khiển điện thoại / Tablet
                  </h3>

                  <div className="guide-item">
                    <div className="guide-icon-wrapper">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" strokeDasharray="2 2" strokeWidth="1" />
                        <path d="M7 12h10M7 12l3-3M7 12l3 3M17 12l-3-3M17 12l-3 3" />
                      </svg>
                    </div>
                    <div className="guide-text-wrap">
                      <span className="guide-label">Xoay hướng nhìn (360°)</span>
                      <span className="guide-desc">Chạm vuốt ngón tay trên màn hình, hoặc bật cảm biến xoay (Gyro) ở góc trên và xoay nghiêng điện thoại.</span>
                    </div>
                  </div>

                  <div className="guide-item">
                    <div className="guide-icon-wrapper">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="9" />
                        <circle cx="12" cy="12" r="5" strokeDasharray="2 2" />
                        <circle cx="15" cy="9" r="3.5" fill="currentColor" />
                      </svg>
                    </div>
                    <div className="guide-text-wrap">
                      <span className="guide-label">Di chuyển trong phòng</span>
                      <span className="guide-desc">
                        {navigationMode === 'point-to-point'
                          ? 'Chạm ngón tay vào các điểm sáng màu vàng dưới sàn để di chuyển tới các góc tham quan cố định.'
                          : 'Sử dụng nút Joystick tròn ở góc dưới màn hình để di chuyển tiến, lùi hoặc qua trái/phải.'}
                      </span>
                    </div>
                  </div>

                  <div className="guide-item">
                    <div className="guide-icon-wrapper">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="14" rx="2" ry="2" />
                        <circle cx="12" cy="12" r="3" fill="rgba(16, 80, 160, 0.2)" />
                        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                      </svg>
                    </div>
                    <div className="guide-text-wrap">
                      <span className="guide-label">Xem chi tiết tư liệu</span>
                      <span className="guide-desc">Chạm ngón tay trực tiếp vào các khung ảnh, tiêu đề hoặc hiện vật để hiển thị bài viết chi tiết.</span>
                    </div>
                  </div>

                  <div className="guide-item">
                    <div className="guide-icon-wrapper">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="18" cy="6" r="2" />
                        <circle cx="6" cy="18" r="2" />
                        <path d="M18 10v3" />
                        <path d="M6 14v-3" />
                        <path d="M8 6h6" />
                        <path d="M16 18h-6" />
                        <path d="M10 10l4 4" />
                      </svg>
                    </div>
                    <div className="guide-text-wrap">
                      <span className="guide-label">Thu phóng góc nhìn (Zoom)</span>
                      <span className="guide-desc">Dùng hai ngón tay chạm màn hình và kéo dãn ra hoặc khép lại (pinch zoom) để thu phóng tầm nhìn.</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Column 2: Room Map Panel (shown if not mobile, or if mobile and activeTab is 'map') */}
          {(!isMobile || (isMobile && activeTab === 'map')) && (
            <RoomMap isMobile={isMobile} />
          )}
        </div>

        {/* Footer */}
        <div className="guide-footer-content">
          {sceneReady ? (
            <>
              <div className="guide-footer-title">{!isMobile ? 'Vui lòng chọn chế độ di chuyển để bắt đầu' : 'Vui lòng chọn chế độ di chuyển'}</div>
              <div className="guide-mode-options">
                <button className="guide-mode-btn mode-ptp" onClick={() => handleSelectMode('point-to-point')}>
                  <div className="mode-btn-title">Tham quan theo khu vực cố định</div>
                </button>
                <button className="guide-mode-btn mode-free" onClick={() => handleSelectMode('free')}>
                  <div className="mode-btn-title">Tham quan di chuyển tự do</div>
                </button>
              </div>
            </>
          ) : (
            <div className="guide-loading-container">
              <div className="guide-loading-text">
                Đang chuẩn bị không gian 3D... {Math.round(progress)}%
              </div>
              <div className="guide-loading-progress-bar">
                <div className="guide-loading-progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
