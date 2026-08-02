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
        @keyframes gold-shine {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .landing-content-wrap {
          --brand-sky: ${brand.sky};
          --brand-blue: ${brand.blue};
          --brand-blue-dark: ${brand.blueDark};
          --brand-text: ${brand.text};
          --brand-muted: ${brand.muted};
        }

        .golden-badge {
          background: linear-gradient(-45deg, #FAF7F0 0%, #F5ECD7 25%, #EBE1C5 50%, #F5ECD7 75%, #FAF7F0 100%);
          background-size: 200% auto;
          animation: gold-shine 6s linear infinite;
        }

        .landing-title {
          width: 100%;
          max-width: 100%;
          font-weight: 900;
          color: var(--brand-text);
          line-height: 1.08;
          margin: 0 0 16px;
          text-shadow: 0 10px 30px rgba(16,80,160,0.08);
        }

        .landing-title-org {
          display: block;
          font-size: clamp(15px, 3.5vw, 20px);
          font-weight: 600;
          color: var(--brand-blue);
          letter-spacing: 0.04em;
          line-height: 1.35;
          text-transform: uppercase;
        }

        .landing-title-main {
          display: block;
          font-size: clamp(28px, 6.5vw, 44px);
          font-weight: 800;
          color: var(--brand-text);
          letter-spacing: 0.02em;
          line-height: 1.15;
          margin-top: clamp(10px, 2vw, 14px);
          margin-bottom: clamp(6px, 1.5vw, 10px);
          text-transform: uppercase;
        }

        .timeline {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-top: 12px;
        }

        .timeline-line {
          width: 48px;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(7, 85, 165, 0.35)
          );
        }

        .timeline-line:last-child {
          transform: scaleX(-1);
        }

        .timeline-year {
          padding-left: 0.25em;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.25em;
          color: #0755a5;
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
          background: #0755a5;
          color: white;
          font-family: "Be Vietnam Pro", sans-serif;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          box-shadow:
            0 12px 30px rgba(0, 75, 155, 0.16),
            inset 0 1px 0 rgba(255, 255, 255, 0.18);
          transition:
            transform 180ms ease,
            box-shadow 180ms ease,
            background 180ms ease;
        }

        .cta-button:hover {
          transform: translateY(-2px);
          background: #064d97;
          box-shadow:
            0 16px 38px rgba(0, 75, 155, 0.23),
            inset 0 1px 0 rgba(255, 255, 255, 0.18);
        }

        .cta-button-chevron {
          width: 18px;
          height: 18px;
          transition: transform 180ms ease;
        }

        .cta-button:hover .cta-button-chevron {
          transform: translateX(2px);
        }

        .landing-welcome-badge {
          border: 1px solid rgba(197, 160, 89, 0.25);
          border-radius: 999px;
          padding: 10px 28px;
          color: #70590c;
          font-size: 14px;
          font-weight: 500;
          line-height: 1.4;
          max-width: 92%;
          width: fit-content;
          text-align: center;
          margin-top: 24px;
          margin-bottom: 24px;
          box-shadow: 0 4px 15px rgba(197, 160, 89, 0.06);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.3s ease;
        }

        .sparkle-icon {
          width: 14px;
          height: 14px;
          flex-shrink: 0;
        }

        /* --- MOBILE VIEWS (< 768px): More compact and neat --- */
        @media (max-width: 767px) {
          .landing-title {
            margin: 0 0 10px;
          }

          .landing-title-org {
            font-size: 13.5px;
            font-weight: 700;
            line-height: 1.3;
          }

          .landing-title-main {
            font-size: 24px;
            font-weight: 800;
            margin-top: 8px;
            margin-bottom: 4px;
            line-height: 1.2;
          }

          .timeline {
            margin-top: 8px;
            gap: 10px;
          }

          .timeline-line {
            width: 24px;
          }

          .timeline-year {
            font-size: 11.5px;
            letter-spacing: 0.15em;
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

          .landing-welcome-badge {
            font-size: 11px;
            padding: 8px 16px;
            margin-top: 16px;
            margin-bottom: 16px;
            border-radius: 20px;
            max-width: 95%;
            gap: 6px;
          }

          .sparkle-icon {
            width: 11px;
            height: 11px;
          }
        }

        /* --- LAPTOP / PC VIEWS (>= 1024px): 1.2x to 1.5x larger --- */
        @media (min-width: 1024px) {
          .landing-title {
            margin-bottom: 24px;
          }

          .landing-title-org {
            font-size: 28px;
            letter-spacing: 0.05em;
          }

          .landing-title-main {
            font-size: 64px;
            margin-top: 24px;
            margin-bottom: 16px;
            letter-spacing: 0.03em;
          }

          .timeline {
            margin-top: 20px;
            gap: 24px;
          }

          .timeline-line {
            width: 90px;
            height: 1.5px;
          }

          .timeline-year {
            font-size: 20px;
            letter-spacing: 0.3em;
          }

          .cta-button {
            height: 64px;
            font-size: 19px;
            padding: 0 48px;
            margin-top: 36px;
            border-radius: 14px;
            gap: 20px;
            box-shadow:
              0 16px 36px rgba(0, 75, 155, 0.22),
              inset 0 1px 0 rgba(255, 255, 255, 0.22);
          }

          .cta-button:hover {
            transform: translateY(-3px);
            box-shadow:
              0 22px 48px rgba(0, 75, 155, 0.32),
              inset 0 1px 0 rgba(255, 255, 255, 0.22);
          }

          .cta-button-chevron {
            width: 22px;
            height: 22px;
            stroke-width: 2.8;
          }

          .landing-welcome-badge {
            font-size: 17px;
            padding: 14px 44px;
            margin-top: 36px;
            margin-bottom: 36px;
            letter-spacing: 0.01em;
            box-shadow: 0 6px 20px rgba(197, 160, 89, 0.09);
          }

          .sparkle-icon {
            width: 18px;
            height: 18px;
          }
        }
      `}</style>
      <div style={styles.bg} />

      <main style={styles.content}>
        <h1 className="landing-title">
          <span className="landing-title-org">TRUNG TÂM ĐIỀU ĐỘ</span>
          <span className="landing-title-org">HỆ THỐNG ĐIỆN MIỀN NAM</span>
          <span className="landing-title-main">PHÒNG TRUYỀN THỐNG SỐ</span>
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

        <div className="golden-badge landing-welcome-badge">
          <SparkleIcon className="sparkle-icon" />
          <span>Nhiệt liệt chào mừng kỷ niệm 50 năm thành lập Trung tâm Điều độ hệ thống điện miền Nam</span>
          <SparkleIcon className="sparkle-icon" />
        </div>
      </main>
    </div>
  )
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c.5 6 5.5 11 11.5 11.5-6 .5-11 5.5-11.5 11.5-.5-6-5.5-11-11.5-11.5 6-.5 11-5.5 11.5-11.5z" />
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
    background: `linear-gradient(135deg, #f8fbff 0%, ${brand.sky} 42%, #d7e9fb 100%)`,
    overflow: 'hidden',
  },
  bg: {
    position: 'absolute', inset: 0,
    background: 'linear-gradient(115deg, rgba(16,80,160,0.12), transparent 48%), radial-gradient(ellipse at 20% 18%, rgba(255,255,255,0.9) 0%, transparent 44%), radial-gradient(ellipse at 82% 72%, rgba(16,80,160,0.16) 0%, transparent 52%)',
    pointerEvents: 'none',
  },
  content: {
    position: 'relative', zIndex: 1,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    textAlign: 'center', padding: 'clamp(20px, 6vw, 32px) 14px', width: '100%', maxWidth: '1120px', boxSizing: 'border-box',
  },
}
