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
    <div style={styles.wrap}>
      <div style={styles.bg} />

      <main style={styles.content}>
        <div style={styles.badge}>Kỷ niệm 50 năm thành lập</div>

        <h1 style={styles.title}>
          <span style={styles.titleMain}>TRUNG TÂM ĐIỀU ĐỘ HỆ THỐNG ĐIỆN MIỀN NAM</span>
          <span style={styles.titleSub}>PHÒNG TRUYỀN THỐNG SỐ</span>
        </h1>

        <div style={styles.years}>{yearStart} - {yearEnd}</div>

        <p style={styles.desc}>
          Hành trình nửa thế kỷ xây dựng và phát triển được tái hiện qua những hình ảnh,
          tư liệu quý giá và không gian trưng bày số hiện đại.
        </p>

        <button style={styles.enterBtn} onClick={onEnter}>
          <span>Bắt đầu tham quan</span>
          <ChevronRight />
        </button>

        <div style={styles.hint}>
          Tối ưu cho mọi thiết bị
        </div>
      </main>
    </div>
  )
}

function ChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
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
  badge: {
    background: 'rgba(16,80,160,0.1)', border: `1px solid ${brand.line}`,
    color: brand.blue, borderRadius: '999px',
    padding: 'clamp(5px, 1.5vw, 6px) clamp(12px, 4vw, 16px)', fontSize: 'clamp(10px, 2.8vw, 12px)', fontWeight: 800,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    marginBottom: '18px',
  },
  title: {
    width: '100%',
    maxWidth: '100%',
    fontWeight: 900, color: brand.text,
    lineHeight: 1.08, margin: '0 0 clamp(18px, 5vw, 28px)',
    textShadow: '0 10px 30px rgba(16,80,160,0.18)',
  },
  titleMain: {
    display: 'block',
    maxWidth: '900px',
    margin: '0 auto clamp(6px, 1.8vw, 10px)',
    color: brand.blue,
    fontSize: 'clamp(24px, 6.2vw, 48px)',
    letterSpacing: 0,
    lineHeight: 1.12,
    overflowWrap: 'normal',
  },
  titleSub: {
    display: 'block',
    fontSize: 'clamp(20px, 5.4vw, 40px)',
    letterSpacing: '0.01em',
    whiteSpace: 'nowrap',
  },
  years: {
    fontSize: 'clamp(13px, 4vw, 18px)', color: brand.blue, fontWeight: 700,
    letterSpacing: 'clamp(0.14em, 0.8vw, 0.28em)', marginBottom: 'clamp(14px, 4vw, 20px)',
  },
  desc: {
    fontSize: 'clamp(12px, 3vw, 15px)', color: brand.muted, lineHeight: 1.65,
    marginBottom: 'clamp(24px, 7vw, 34px)', maxWidth: '520px',
  },
  enterBtn: {
    background: `linear-gradient(135deg, ${brand.blue}, ${brand.blueDark})`,
    border: 'none', borderRadius: '8px',
    color: '#ffffff', fontWeight: 800,
    fontSize: 'clamp(13px, 3.8vw, 16px)', letterSpacing: 0, fontFamily: brand.fontFamily, lineHeight: 1.25,
    padding: 'clamp(11px, 3.4vw, 14px) clamp(22px, 8vw, 34px)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '10px',
    boxShadow: '0 16px 34px rgba(16,80,160,0.32)',
    transition: 'transform 0.15s, box-shadow 0.15s',
    marginBottom: 'clamp(14px, 4vw, 20px)',
  },
  hint: { fontSize: 'clamp(10px, 2.8vw, 12px)', color: brand.muted },
}
