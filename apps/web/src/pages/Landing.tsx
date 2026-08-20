import { useState, useEffect } from 'react'
import type { ContentIndex } from '@vm/shared'
import { brand } from '../ui/theme.js'
import { useMuseumAudio } from '@vm/viewer'

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

function getOrCreateVisitorId(): string {
  const key = 'visitor_id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 15)
    localStorage.setItem(key, id)
  }
  return id
}

interface Props {
  content: ContentIndex
  onEnter: () => void
}

export function Landing({ content, onEnter }: Props) {
  const { unlockAudio } = useMuseumAudio()

  const handleEnterClick = () => {
    unlockAudio()
    onEnter()
  }

  const [visitorCount, setVisitorCount] = useState<number | null>(null)

  useEffect(() => {
    const visitorId = getOrCreateVisitorId()

    // 1. Register current visit (Always register visit for PV count)
    fetch(`${API_BASE}/api/visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId })
    })
      .then((res) => {
        if (res.ok) {
          localStorage.setItem('has_visited_museum', 'true')
        }
      })
      .catch((err) => {
        console.error('Error registering visit:', err)
      })
      .finally(() => {
        // 2. Fetch updated visitor count (UV count)
        fetch(`${API_BASE}/api/visitor-count`)
          .then((res) => {
            if (!res.ok) throw new Error('Failed to fetch visitor count')
            return res.json() as Promise<{ count: number }>
          })
          .then((data) => {
            setVisitorCount(data.count)
          })
          .catch((err) => {
            console.error('Error fetching visitor count, using local simulation:', err)
            const stored = localStorage.getItem('fake_visitor_count')
            let fakeCountVal = 1548
            if (stored) {
              fakeCountVal = parseInt(stored, 10) + 1
            } else {
              fakeCountVal = 1548 + Math.floor(Math.random() * 82)
            }
            localStorage.setItem('fake_visitor_count', fakeCountVal.toString())
            setVisitorCount(fakeCountVal)
          })
      })
  }, [])

  return (
    <div style={styles.wrap} className="landing-content-wrap">
      <style>{`
        @keyframes flag-folds {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        @keyframes gold-shine-border {
          0%, 100% {
            border-color: rgba(212, 175, 55, 0.85);
            box-shadow: 
              0 0 6px rgba(212, 175, 55, 0.4),
              0 7px 18px rgba(204, 0, 0, 0.18),
              inset 0 0 12px rgba(255, 255, 255, 0.1);
          }
          50% {
            border-color: #ffd700;
            box-shadow: 
              0 0 14px rgba(212, 175, 55, 0.85),
              0 7px 22px rgba(204, 0, 0, 0.28),
              inset 0 0 16px rgba(255, 255, 255, 0.2);
          }
        }

        @keyframes sparkle-left {
          0%, 100% { 
            opacity: 1; 
            color: #ffda73;
            filter: drop-shadow(0 0 6px rgba(229, 177, 58, 0.85));
          }
          15%, 85% { 
            opacity: 0.85; 
            color: #e5b13a;
            filter: drop-shadow(0 0 2px rgba(229, 177, 58, 0.4));
          }
        }

        @keyframes sparkle-right {
          0%, 100% { 
            opacity: 0.85; 
            color: #e5b13a;
            filter: drop-shadow(0 0 2px rgba(229, 177, 58, 0.4));
          }
          50% { 
            opacity: 1; 
            color: #ffda73;
            filter: drop-shadow(0 0 6px rgba(229, 177, 58, 0.85));
          }
        }

        .landing-content-wrap {
          --brand-sky: ${brand.sky};
          --brand-blue: ${brand.blue};
          --brand-blue-dark: ${brand.blueDark};
          --brand-text: ${brand.text};
          --brand-muted: ${brand.muted};
        }

        .golden-badge {
          background: linear-gradient(90deg, #b8070d 0%, #dc171c 25%, #ff5252 50%, #dc171c 75%, #b8070d 100%);
          background-size: 200% 100%;
          border: 1.5px solid rgba(212, 175, 55, 0.85);
          clip-path: polygon(0% 0%, 100% 0%, 97% 50%, 100% 100%, 0% 100%, 3% 50%);
          animation: flag-folds 6s linear infinite, gold-shine-border 3s ease-in-out infinite;
        }

        .landing-title {
          width: 100%;
          max-width: 100%;
          color: var(--brand-text);
          line-height: 1.08;
          margin: 0;
          padding: 6px 0 0;
        }

        .landing-title-org {
          display: block;
          font-size: clamp(14px, 3.2vw, 19px);
          font-weight: 700;
          color: #0d559e;
          letter-spacing: 0.035em;
          line-height: 1.32;
          text-transform: uppercase;
        }

        .mobile-only-br {
          display: none;
        }

        .landing-title-main-wrap {
          display: table;
          margin: 0 auto clamp(20px, 3.5vw, 38px);
          filter: 
            drop-shadow(-0.5px -0.5px 0px rgba(255, 255, 255, 0.95)) 
            drop-shadow(0.8px 0.8px 0px rgba(0, 15, 45, 0.9)) 
            drop-shadow(0 3px 6px rgba(0, 40, 100, 0.22))
            drop-shadow(0 8px 16px rgba(0, 40, 100, 0.08));
        }

        .landing-title-main {
          position: relative;
          display: block;
          transform: scaleX(0.92);
          transform-origin: center;
          padding: 12px 0 16px;
          font-family: "Be Vietnam Pro", sans-serif;
          font-size: clamp(35px, 5.8vw, 51px);
          font-weight: 800;
          background: linear-gradient(180deg, #4cd0ff 0%, #0088ff 25%, #0048b3 65%, #002054 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          letter-spacing: 0.035em;
          line-height: 1.35;
          text-transform: uppercase;
        }


        .timeline {
          display: flex;
          align-items: center;
          gap: 18px;
          margin-top: clamp(10px, 1.5vw, 14px);
        }

        .timeline-line {
          width: 48px;
          height: 2px;
          background: linear-gradient(90deg, transparent 5%, rgba(223, 186, 79, 0.75) 80%, #dfba4f 100%);
        }

        .timeline-line:last-child {
          transform: scaleX(-1);
        }

        .timeline-year {
          font-weight: 700;
          font-size: 15px;
          letter-spacing: 0.16em;
          color: #dfba4f;
        }

        .cta-button {
          height: 52px;
          margin-top: 24px;
          padding: 0 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          border: 0;
          border-radius: 12px;
          background: linear-gradient(180deg, #166ecc 0%, #07539a 100%);
          color: white;
          font-family: "Be Vietnam Pro", sans-serif;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          box-shadow:
            0 8px 20px rgba(7, 83, 154, 0.24),
            0 1px 2px rgba(7, 83, 154, 0.15),
            inset 0 1.5px 0 rgba(255, 255, 255, 0.35);
          transition:
            transform 180ms ease,
            box-shadow 180ms ease,
            background 180ms ease;
        }

        .cta-button:hover {
          transform: translateY(-2px);
          background: linear-gradient(180deg, #1d7ce6 0%, #064b8c 100%);
          box-shadow:
            0 12px 28px rgba(7, 83, 154, 0.32),
            0 1px 2px rgba(7, 83, 154, 0.15),
            inset 0 1.5px 0 rgba(255, 255, 255, 0.35);
        }

        .cta-button-chevron {
          width: 18px;
          height: 18px;
          transition: transform 180ms ease;
        }

        .cta-button:hover .cta-button-chevron {
          transform: translateX(2px);
        }

        @keyframes marquee-scroll {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }

        .unified-footer {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 48px;
          background: linear-gradient(180deg, rgba(235, 245, 255, 0.2) 0%, rgba(0, 136, 255, 0.55) 100%);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-top: 1px solid rgba(255, 255, 255, 0.3);
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 20;
          box-shadow: 0 -3px 15px rgba(0, 0, 0, 0.1);
          font-family: "Be Vietnam Pro", sans-serif;
          overflow: hidden;
        }

        .footer-left {
          display: flex;
          align-items: center;
          height: 100%;
          padding-left: 20px;
          padding-right: 15px;
          z-index: 22;
          background: transparent;
        }

        .footer-right {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          height: 100%;
          z-index: 22;
          background: transparent;
        }

        .footer-center {
          flex: 1;
          overflow: hidden;
          display: flex;
          align-items: center;
          height: 100%;
          position: relative;
          z-index: 21;
        }

        .footer-visitor-count {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.45);
          border: 1px solid rgba(0, 32, 84, 0.15);
          padding: 5px 14px;
          border-radius: 20px;
          color: #002054;
          font-size: 12.5px;
          font-weight: 500;
          white-space: nowrap;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
          transition: all 0.2s ease;
        }

        .footer-visitor-count strong {
          color: #0055d4;
          font-weight: 700;
        }

        .footer-visitor-count:hover {
          background: rgba(255, 255, 255, 0.6);
          border-color: rgba(0, 32, 84, 0.25);
        }

        .footer-icon {
          width: 14px;
          height: 14px;
          color: #002054;
          opacity: 0.95;
          flex-shrink: 0;
        }

        .visitor-text-mobile {
          display: none;
        }

        .footer-copyright-logo {
          height: 100%;
          display: flex;
          align-items: center;
        }

        .copyright-logo-img {
          height: 48px;
          width: auto;
          display: block;
          object-fit: contain;
          background-color: #fdfdff;
        }

        .marquee-text-container {
          display: inline-block;
          white-space: nowrap;
          animation: marquee-scroll 30s linear infinite;
        }

        .marquee-text {
          font-family: "Be Vietnam Pro", sans-serif;
          color: #002054;
          font-size: 12.5px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          padding-right: 48px;
        }

        .marquee-star {
          color: #d97706;
          margin-right: 6px;
          font-size: 13px;
        }

        .highlight-blue {
          color: #0055d4;
          font-weight: 700;
        }

        .highlight-red {
          color: #c41217;
          font-weight: 700;
        }

        .landing-logo {
          position: absolute;
          top: clamp(16px, 3.5vw, 32px);
          left: 50%;
          transform: translateX(-50%);
          height: 65px;
          width: auto;
          opacity: 1;
          filter: drop-shadow(0 2px 8px rgba(16, 80, 160, 0.06));
          z-index: 10;
        }

        .anniversary-logo {
          position: absolute;
          top: clamp(6px, 1.8vw, 16px);
          right: clamp(16px, 3.5vw, 32px);
          height: 78px;
          width: auto;
          opacity: 1;
          filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.08));
          z-index: 10;
        }

        .visitor-badge-icon {
          width: 15px;
          height: 15px;
          flex-shrink: 0;
          color: #1d7ce6;
          opacity: 0.85;
        }
        @media (max-height: 720px) {
          .landing-logo {
            top: 12px;
            height: 43px;
          }
          .anniversary-logo {
            top: 4px;
            height: 52px;
          }
        }

        /* --- MOBILE VIEWS (< 768px): More compact and neat --- */
        @media (max-width: 767px) {
          .landing-title {
            margin: 0;
            padding-top: 4px;
          }

          .landing-title-org {
            font-size: 13px;
            font-weight: 700;
            line-height: 1.3;
            letter-spacing: 0.04em;
          }

          .mobile-only-br {
            display: inline;
          }

          .landing-title-main-wrap {
            margin-top: 0;
            margin-bottom: 18px;
          }

          .unified-footer {
            height: 38px;
          }
          
          .footer-left {
            padding-left: 10px;
            padding-right: 6px;
            background: transparent;
          }
          
          .footer-right {
            padding: 0;
            background: transparent;
          }

          .visitor-text-desktop {
            display: none;
          }

          .visitor-text-mobile {
            display: inline;
          }

          .footer-visitor-count {
            font-size: 11px;
            gap: 4px;
            padding: 4px 10px;
            border-radius: 14px;
          }

          .footer-icon {
            width: 12px;
            height: 12px;
          }

          .footer-copyright-logo {
            height: 100%;
          }

          .copyright-logo-img {
            height: 38px;
            border-width: 0;
          }

          .marquee-text {
            font-size: 11.5px;
            padding-right: 24px;
          }

          .landing-logo {
            top: 14px;
            height: 43px;
          }
          .anniversary-logo {
            top: 6px;
            right: 14px;
            height: 52px;
          }
        }

        /* --- LAPTOP / PC VIEWS (>= 1024px): 1.2x to 1.5x larger --- */
        @media (min-width: 1024px) {
          .landing-title {
            margin-bottom: 0;
            padding-top: 10px;
          }

          .landing-title-org {
            font-size: 24px;
            letter-spacing: 0.035em;
          }

          .landing-title-main-wrap {
            margin-top: 0;
            margin-bottom: 32px;
          }

          .landing-title-main {
            font-size: clamp(49px, 4.1vw, 59px);
            padding-top: 14px;
            padding-bottom: 18px;
            letter-spacing: 0.035em;
            white-space: nowrap;
          }


          .timeline {
            margin-top: 12px;
            gap: 22px;
          }

          .timeline-line {
            width: 90px;
            height: 2px;
          }

          .timeline-year {
            font-size: 20px;
            letter-spacing: 0.18em;
          }

          .cta-button {
            height: 58px;
            font-size: 17px;
            padding: 0 42px;
            margin-top: 28px;
            border-radius: 14px;
            gap: 20px;
            background: linear-gradient(180deg, #166ecc 0%, #07539a 100%);
            box-shadow:
              0 12px 26px rgba(7, 83, 154, 0.28),
              0 1px 2px rgba(7, 83, 154, 0.15),
              inset 0 1.5px 0 rgba(255, 255, 255, 0.38);
          }

          .cta-button:hover {
            transform: translateY(-3px);
            background: linear-gradient(180deg, #1d7ce6 0%, #064b8c 100%);
            box-shadow:
              0 18px 38px rgba(7, 83, 154, 0.38),
              0 1px 2px rgba(7, 83, 154, 0.15),
              inset 0 1.5px 0 rgba(255, 255, 255, 0.38);
          }

          .cta-button-chevron {
            width: 22px;
            height: 22px;
            stroke-width: 2.8;
          }

          .unified-footer {
            height: 54px;
          }
          .footer-left {
            background: transparent;
          }
          .footer-right {
            background: transparent;
          }
          .footer-visitor-count {
            font-size: 13px;
            gap: 8px;
            padding: 6px 18px;
          }
          .footer-icon {
            width: 15px;
            height: 15px;
          }
          .footer-copyright-logo {
            height: 100%;
          }
          .copyright-logo-img {
            height: 54px;
          }
          .marquee-text {
            font-size: 13px;
          }

          .landing-logo {
            top: clamp(24px, 4vh, 48px);
            height: 81px;
          }
          .anniversary-logo {
            top: clamp(10px, 2.5vh, 24px);
            right: clamp(24px, 4vh, 48px);
            height: 98px;
          }
        }
      `}</style>
      <div style={styles.bg} />

      <img src="/logo.webp" alt="NSMO A2 Logo" className="landing-logo" />
      <img src="/logo-50-nam.webp" alt="50 Years Anniversary Logo" className="anniversary-logo" />
      <main style={styles.content}>
        <h1 className="landing-title">
          <span className="landing-title-main-wrap">
            <span className="landing-title-main">PHÒNG TRUYỀN THỐNG SỐ</span>
          </span>
          <span className="landing-title-org">
            TRUNG TÂM ĐIỀU ĐỘ <br className="mobile-only-br" /> HỆ THỐNG ĐIỆN MIỀN NAM
          </span>
        </h1>

        <div className="timeline">
          <span className="timeline-line" />
          <span className="timeline-year">Từ 1976 - đến nay</span>
          <span className="timeline-line" />
        </div>

        <button className="cta-button" onClick={handleEnterClick}>
          <span>Bắt đầu tham quan</span>
          <ChevronRight className="cta-button-chevron" />
        </button>
      </main>

      <div className="unified-footer">
        <div className="footer-left">
          {visitorCount !== null && (
            <div className="footer-visitor-count">
              <svg className="footer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span className="visitor-text-desktop">Số lượt truy cập: <strong>{visitorCount.toLocaleString()}</strong> lượt</span>
              <span className="visitor-text-mobile"><strong>{visitorCount.toLocaleString()}</strong> lượt</span>
            </div>
          )}
        </div>

        <div className="footer-center">
          <div className="marquee-text-container">
            <span className="marquee-text">
              <span className="marquee-star">★</span> CHÀO MỪNG BẠN ĐẾN VỚI <strong className="highlight-blue">PHÒNG TRUYỀN THỐNG SỐ</strong> TRUNG TÂM ĐIỀU ĐỘ HỆ THỐNG ĐIỆN MIỀN NAM <span className="marquee-star">★</span>
            </span>
            <span className="marquee-text">
              <span className="marquee-star">★</span> NHIỆT LIỆT CHÀO MỪNG KỶ NIỆM <strong className="highlight-red">50 NĂM THÀNH LẬP</strong> TRUNG TÂM ĐIỀU HỢP ĐIỆN NĂNG <span className="marquee-star">★</span>
            </span>
            <span className="marquee-text">
              <span className="marquee-star">★</span> CHÀO MỪNG BẠN ĐẾN VỚI <strong className="highlight-blue">PHÒNG TRUYỀN THỐNG SỐ</strong> TRUNG TÂM ĐIỀU ĐỘ HỆ THỐNG ĐIỆN MIỀN NAM <span className="marquee-star">★</span>
            </span>
            <span className="marquee-text">
              <span className="marquee-star">★</span> NHIỆT LIỆT CHÀO MỪNG KỶ NIỆM <strong className="highlight-red">50 NĂM THÀNH LẬP</strong> TRUNG TÂM ĐIỀU HỢP ĐIỆN NĂNG <span className="marquee-star">★</span>
            </span>
          </div>
        </div>

        <div className="footer-right">
          <div className="footer-copyright-logo">
            <picture>
              <source media="(max-width: 767px)" srcSet="/logo-truyenthong-white-mobile.webp" />
              <img src="/logo-truyenthong-white.webp" alt="SSO Copyright Logo" className="copyright-logo-img" />
            </picture>
          </div>
        </div>
      </div>
    </div>
  )
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.787 1.4 8.168L12 18.896l-7.334 3.857 1.4-8.168L.132 9.21l8.2-1.192L12 .587z" />
    </svg>
  )
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'relative', width: '100%', height: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'radial-gradient(circle at center, #ffffff 0%, #f0f7ff 35%, #d0e5fc 70%, #9fc8f5 100%)',
    overflow: 'hidden',
  },
  bg: {
    position: 'absolute', inset: 0,
    background: 'radial-gradient(circle at center, transparent 30%, rgba(13, 85, 158, 0.08) 80%)',
    pointerEvents: 'none',
  },
  content: {
    position: 'relative', zIndex: 1,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    textAlign: 'center', padding: 'clamp(20px, 6vw, 32px) 14px', width: '100%', maxWidth: '1120px', boxSizing: 'border-box',
    transform: 'translateY(-36px)',
  },
}
