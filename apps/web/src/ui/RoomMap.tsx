import { useState, useEffect } from 'react'
import { brand } from './theme.js'

interface Props {
  isMobile: boolean
}

interface ZoneConfig {
  id: number
  displayId: number
  name: string
  title: string
  desc: string
}

export function RoomMap({ isMobile }: Props) {
  const [zones, setZones] = useState<ZoneConfig[]>([])
  const [svgContent, setSvgContent] = useState<string>('')
  const [hoveredZone, setHoveredZone] = useState<number | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const base = import.meta.env.BASE_URL
    const joinBase = (path: string) => `${base}${path.replace(/^\/+/, '')}`

    Promise.all([
      fetch(joinBase('content/map.json')).then((res) => res.json()),
      fetch(joinBase('content/map.svg')).then((res) => res.text())
    ])
      .then(([jsonData, svgText]) => {
        if (jsonData && Array.isArray(jsonData.zones)) {
          setZones(jsonData.zones)
        }
        setSvgContent(svgText)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to load map assets:', err)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="guide-map-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '240px' }}>
        <span style={{ color: brand.muted, fontSize: '13px', fontWeight: 'bold' }}>Đang tải sơ đồ...</span>
      </div>
    )
  }

  if (zones.length === 0 || !svgContent) {
    return (
      <div className="guide-map-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '240px' }}>
        <span style={{ color: '#ef4444', fontSize: '13px', fontWeight: 'bold' }}>Không tải được cấu hình sơ đồ.</span>
      </div>
    )
  }

  const hoveredZoneObj = zones.find((z) => z.id === hoveredZone)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
  }

  const handleSvgMouseOver = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest('[data-zone-id]')
    if (target) {
      const zoneId = parseInt(target.getAttribute('data-zone-id') || '', 10)
      if (!isNaN(zoneId)) {
        setHoveredZone(zoneId)
      }
    }
  }

  const handleSvgMouseOut = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest('[data-zone-id]')
    if (target) {
      setHoveredZone(null)
    }
  }

  return (
    <div className="guide-map-panel">
      <style>{`
        .guide-map-panel {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .guide-col-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 15px;
          font-weight: 800;
          color: ${brand.blue};
          margin: 0 0 16px 0;
          padding-bottom: 10px;
          border-bottom: 1.5px solid rgba(16, 80, 160, 0.1);
        }
        .guide-map-canvas {
          position: relative;
          background: #f8fafc;
          border: 1px solid rgba(16, 80, 160, 0.1);
          border-radius: 12px;
          padding: 8px;
          box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.03);
          overflow: hidden;
        }

        /* SVG Inner Styling and Event Overrides */
        .guide-map-canvas g[data-zone-id] circle {
          fill: ${brand.blue};
          transition: fill 0.2s ease;
        }
        .guide-map-canvas [data-zone-id]:hover {
          fill: #ff8f00 !important;
        }
        .guide-map-canvas g[data-zone-id]:hover circle {
          fill: #ff8f00 !important;
        }

        /* Active highlight styling triggered from mobile zones list */
        .guide-map-canvas[data-hovered-zone="1"] [data-zone-id="1"],
        .guide-map-canvas[data-hovered-zone="2"] [data-zone-id="2"],
        .guide-map-canvas[data-hovered-zone="3"] [data-zone-id="3"],
        .guide-map-canvas[data-hovered-zone="4"] [data-zone-id="4"],
        .guide-map-canvas[data-hovered-zone="5"] [data-zone-id="5"],
        .guide-map-canvas[data-hovered-zone="6"] [data-zone-id="6"],
        .guide-map-canvas[data-hovered-zone="7"] [data-zone-id="7"],
        .guide-map-canvas[data-hovered-zone="8"] [data-zone-id="8"],
        .guide-map-canvas[data-hovered-zone="9"] [data-zone-id="9"],
        .guide-map-canvas[data-hovered-zone="10"] [data-zone-id="10"],
        .guide-map-canvas[data-hovered-zone="11"] [data-zone-id="11"] {
          fill: #ff8f00 !important;
        }
        .guide-map-canvas[data-hovered-zone="1"] g[data-zone-id="1"] circle,
        .guide-map-canvas[data-hovered-zone="2"] g[data-zone-id="2"] circle,
        .guide-map-canvas[data-hovered-zone="3"] g[data-zone-id="3"] circle,
        .guide-map-canvas[data-hovered-zone="4"] g[data-zone-id="4"] circle,
        .guide-map-canvas[data-hovered-zone="5"] g[data-zone-id="5"] circle,
        .guide-map-canvas[data-hovered-zone="6"] g[data-zone-id="6"] circle,
        .guide-map-canvas[data-hovered-zone="7"] g[data-zone-id="7"] circle,
        .guide-map-canvas[data-hovered-zone="8"] g[data-zone-id="8"] circle,
        .guide-map-canvas[data-hovered-zone="9"] g[data-zone-id="9"] circle,
        .guide-map-canvas[data-hovered-zone="10"] g[data-zone-id="10"] circle,
        .guide-map-canvas[data-hovered-zone="11"] g[data-zone-id="11"] circle {
          fill: #ff8f00 !important;
        }
        
        /* Floating hover tooltip for PC */
        .guide-map-tooltip {
          background: rgba(255, 255, 255, 0.96);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(16, 80, 160, 0.15);
          border-radius: 8px;
          padding: 8px 12px;
          box-shadow: 0 10px 25px -5px rgba(8, 47, 109, 0.15), 0 8px 16px -6px rgba(8, 47, 109, 0.1);
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          width: max-content;
          min-width: 180px;
          max-width: 250px;
          pointer-events: none;
          transition: transform 0.1s ease-out;
        }
        .tooltip-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
          text-align: left;
          width: 100%;
        }
        .tooltip-title {
          font-size: 12.5px;
          font-weight: 800;
          color: ${brand.blue};
          white-space: nowrap;
        }
        .tooltip-desc {
          font-size: 11px;
          color: ${brand.text};
          line-height: 1.35;
        }

        .guide-zones-container {
          display: flex;
          flex-direction: column;
          gap: 8px;
          animation: guideSlideUp 0.3s ease-out;
        }
        .guide-zones-title {
          font-size: 12px;
          font-weight: 800;
          color: ${brand.muted};
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
        }
        .guide-zones-list {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          max-height: 240px;
          overflow-y: auto;
          padding-right: 4px;
        }
        .zone-card {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 8px 12px;
          background: rgba(248, 251, 255, 0.4);
          border: 1px solid rgba(16, 80, 160, 0.05);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
        }
        .zone-card:hover, .zone-card.hovered {
          background: rgba(16, 80, 160, 0.06);
          border-color: rgba(16, 80, 160, 0.2);
          transform: translateY(-1px);
        }
        .zone-dot {
          width: 18px;
          height: 18px;
          background: rgba(16, 80, 160, 0.1);
          color: ${brand.blue};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 800;
          flex-shrink: 0;
          margin-top: 1px;
        }
        .zone-card:hover .zone-dot, .zone-card.hovered .zone-dot {
          background: ${brand.blue};
          color: #ffffff;
        }
        .zone-info {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .zone-title {
          font-size: 12px;
          font-weight: 800;
          color: ${brand.blue};
        }
        .zone-desc {
          font-size: 10px;
          color: ${brand.muted};
          line-height: 1.3;
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

        @media (max-width: 900px) {
          .guide-zones-list {
            grid-template-columns: 1fr;
            max-height: 180px;
          }
        }
      `}</style>

      <h3 className="guide-col-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        {!isMobile ? 'Bản đồ & Cấu trúc phòng truyền thống' : 'Bản đồ phòng truyền thống'}
      </h3>

      {/* Sơ đồ phòng truyền thống SVG */}
      <div
        className="guide-map-canvas"
        onMouseMove={handleMouseMove}
        onMouseOver={handleSvgMouseOver}
        onMouseOut={handleSvgMouseOut}
        data-hovered-zone={hoveredZone ?? ''}
      >
        <div
          dangerouslySetInnerHTML={{ __html: svgContent }}
          style={{ width: '100%', height: 'auto', display: 'block', maxHeight: isMobile ? '230px' : '345px' }}
        />

        {/* Floating Tooltip (shown on Desktop only when hoveredZoneObj exists) */}
        {!isMobile && hoveredZoneObj && (
          <div
            className="guide-map-tooltip animate-fade-in"
            style={{
              position: 'absolute',
              left: `${mousePos.x}px`,
              top: `${mousePos.y}px`,
              transform: mousePos.x > 220 ? 'translate(calc(-100% - 12px), -50%)' : 'translate(12px, -50%)',
              pointerEvents: 'none',
              zIndex: 10
            }}
          >
            <div className="tooltip-text">
              <span className="tooltip-title">{hoveredZoneObj.title}</span>
              <span className="tooltip-desc">{hoveredZoneObj.desc}</span>
            </div>
          </div>
        )}
      </div>

      {/* Mobile: Full list grid. Desktop/PC: Nothing below the map since it uses floating tooltip */}
      {isMobile && (
        <div className="guide-zones-container">
          <span className="guide-zones-title">Danh sách khu vực trưng bày:</span>
          <div className="guide-zones-list">
            {zones.map((zone) => {
              const isHovered = hoveredZone === zone.id
              return (
                <div
                  key={zone.id}
                  className={`zone-card ${isHovered ? 'hovered' : ''}`}
                  onClick={() => {
                    // On mobile, tap toggles highlight
                    setHoveredZone(hoveredZone === zone.id ? null : zone.id)
                  }}
                >
                  <div className="zone-dot">{zone.displayId}</div>
                  <div className="zone-info">
                    <span className="zone-title">{zone.title}</span>
                    <span className="zone-desc">{zone.desc}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
