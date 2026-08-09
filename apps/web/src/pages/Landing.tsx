import type { ContentIndex } from '@vm/shared'
import { brand } from '../ui/theme.js'

interface Props {
  content: ContentIndex
  onEnter: () => void
}

export function Landing({ content, onEnter }: Props) {
  const yearStart = Math.min(...content.periods.map((p) => p.yearStart))
  const yearEnd = Math.max(...content.periods.map((p) => p.yearEnd))

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

        .landing-title-main-wrap {
          display: table;
          margin: clamp(14px, 2vw, 20px) auto 0;
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

        .badge-container {
          display: flex;
          justify-content: center;
          width: 100%;
          margin-top: 30px;
          margin-bottom: 20px;
        }

        .landing-welcome-badge {
          border-radius: 3px;
          padding: 9px 38px;
          color: #ffffff;
          font-size: 12px;
          font-weight: 650;
          line-height: 1.4;
          max-width: 95%;
          width: fit-content;
          text-align: center;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
          box-shadow:
            0 7px 18px rgba(204, 0, 0, 0.18),
            inset 0 0 12px rgba(255, 255, 255, 0.10);
        }

        .landing-welcome-badge:hover {
          transform: scale(1.02);
          border-color: #f3d489;
          box-shadow: 
            0 12px 32px rgba(204, 0, 0, 0.38);
        }

        .sparkle-icon {
          width: 14px;
          height: 14px;
          flex-shrink: 0;
          color: #e5b13a;
          filter: drop-shadow(0 0 2px rgba(229, 177, 58, 0.4));
        }

        .sparkle-icon-left {
          animation: sparkle-right 6s linear infinite;
        }

        .sparkle-icon-right {
          animation: sparkle-left 6s linear infinite;
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

        @media (max-height: 720px) {
          .landing-logo {
            top: 12px;
            height: 43px;
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

          .landing-title-main-wrap {
            margin-top: 12px;
          }

          .landing-title-main {
            font-size: clamp(20px, 5.8vw, 27px);
            padding-top: 8px;
            padding-bottom: 12px;
            line-height: 1.3;
            letter-spacing: 0.035em;
            white-space: nowrap;
          }


          .timeline {
            margin-top: 8px;
            gap: 10px;
          }

          .timeline-line {
            width: 24px;
            height: 1.5px;
          }

          .timeline-year {
            font-size: 13.5px;
            letter-spacing: 0.1em;
          }

          .cta-button {
            height: 44px;
            font-size: 13.5px;
            padding: 0 20px;
            margin-top: 18px;
            border-radius: 10px;
            gap: 10px;
          }

          .cta-button-chevron {
            width: 14px;
            height: 14px;
          }

          .badge-container {
            margin-top: 22px;
            margin-bottom: 14px;
          }

          .landing-welcome-badge {
            font-size: 10.5px;
            padding: 9px 22px;
            max-width: 95%;
            gap: 8px;
            border-width: 1px;
          }

          .sparkle-icon {
            width: 11px;
            height: 11px;
          }

          .landing-logo {
            top: 14px;
            height: 43px;
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
            margin-top: 18px;
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
            margin-top: 26px;
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

          .badge-container {
            margin-top: 28px;
            margin-bottom: 24px;
          }

          .landing-welcome-badge {
            font-size: 13px;
            padding: 10px 46px;
            letter-spacing: 0.025em;
            box-shadow:
              0 7px 18px rgba(204, 0, 0, 0.16),
              inset 0 0 14px rgba(255, 255, 255, 0.08);
          }

          .sparkle-icon {
            width: 18px;
            height: 18px;
          }

          .landing-logo {
            top: clamp(24px, 4vh, 48px);
            height: 81px;
          }
        }
      `}</style>
      <div style={styles.bg} />

      <img src="/logo.webp" alt="NSMO A2 Logo" className="landing-logo" />
      <main style={styles.content}>
        <h1 className="landing-title">
          <span className="landing-title-org">TRUNG TÂM ĐIỀU ĐỘ</span>
          <span className="landing-title-org">HỆ THỐNG ĐIỆN MIỀN NAM</span>
          <span className="landing-title-main-wrap">
            <span className="landing-title-main">PHÒNG TRUYỀN THỐNG SỐ</span>
          </span>
        </h1>

        <div className="timeline">
          <span className="timeline-line" />
          <span className="timeline-year">{yearStart} – {yearEnd}</span>
          <span className="timeline-line" />
        </div>

        <button className="cta-button" onClick={onEnter}>
          <span>Bắt đầu tham quan</span>
          <ChevronRight className="cta-button-chevron" />
        </button>

        <div className="badge-container">
          <div className="golden-badge landing-welcome-badge">
            <StarIcon className="sparkle-icon sparkle-icon-left" />
            <span>Nhiệt liệt chào mừng kỷ niệm 50 năm thành lập Trung tâm Điều hợp điện năng</span>
            <StarIcon className="sparkle-icon sparkle-icon-right" />
          </div>
        </div>
      </main>
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
  },
}
