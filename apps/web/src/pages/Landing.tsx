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
          PHÒNG TRUYỀN THỐNG SỐ
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
          Hỗ trợ cảm biến xoay trên thiết bị di động · Tương thích mọi trình duyệt
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
    textAlign: 'center', padding: '28px 24px', maxWidth: '660px',
  },
  badge: {
    background: 'rgba(16,80,160,0.1)', border: `1px solid ${brand.line}`,
    color: brand.blue, borderRadius: '999px',
    padding: '6px 16px', fontSize: '12px', fontWeight: 800,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    marginBottom: '18px',
  },
  title: {
    fontSize: 'clamp(30px, 5vw, 54px)',
    fontWeight: 900, color: brand.text,
    letterSpacing: '0.04em',
    lineHeight: 1.08, marginBottom: '8px',
    textShadow: '0 10px 30px rgba(16,80,160,0.18)',
  },
  years: {
    fontSize: '18px', color: brand.blue, fontWeight: 700,
    letterSpacing: '0.28em', marginBottom: '20px',
  },
  desc: {
    fontSize: '15px', color: brand.muted, lineHeight: 1.7,
    marginBottom: '34px', maxWidth: '520px',
  },
  enterBtn: {
    background: `linear-gradient(135deg, ${brand.blue}, ${brand.blueDark})`,
    border: 'none', borderRadius: '8px',
    color: '#ffffff', fontWeight: 800,
    fontSize: '16px', letterSpacing: 0, fontFamily: brand.fontFamily, lineHeight: 1.25,
    padding: '14px 34px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '10px',
    boxShadow: '0 16px 34px rgba(16,80,160,0.32)',
    transition: 'transform 0.15s, box-shadow 0.15s',
    marginBottom: '16px',
  },
  hint: { fontSize: '12px', color: brand.muted },
}
