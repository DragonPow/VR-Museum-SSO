import type { Content } from '@vm/shared'

interface Props {
  content: Content
  onEnter: () => void
}

export function Landing({ content, onEnter }: Props) {
  const totalItems = content.items.length
  const totalRooms = content.rooms.length
  const totalPeriods = content.periods.length
  const yearStart = Math.min(...content.periods.map((p) => p.yearStart))
  const yearEnd = Math.max(...content.periods.map((p) => p.yearEnd))

  return (
    <div style={styles.wrap}>
      {/* Background texture overlay */}
      <div style={styles.bg} />

      <div style={styles.content}>
        <div style={styles.badge}>Kỷ niệm 50 năm thành lập</div>

        <h1 style={styles.title}>
          PHÒNG TRUYỀN THỐNG ẢO
        </h1>

        <div style={styles.years}>{yearStart} — {yearEnd}</div>

        <p style={styles.desc}>
          Hành trình nửa thế kỷ xây dựng và phát triển — được tái hiện qua những hình ảnh,
          tư liệu quý giá trải dài qua {totalPeriods} giai đoạn lịch sử.
        </p>

        <div style={styles.stats}>
          <div style={styles.stat}>
            <div style={styles.statNum}>{totalPeriods}</div>
            <div style={styles.statLabel}>Giai đoạn</div>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.stat}>
            <div style={styles.statNum}>{totalRooms}</div>
            <div style={styles.statLabel}>Phòng trưng bày</div>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.stat}>
            <div style={styles.statNum}>{totalItems}</div>
            <div style={styles.statLabel}>Hiện vật & Ảnh</div>
          </div>
        </div>

        <div style={styles.periods}>
          {content.periods.map((p) => (
            <div key={p.id} style={{ ...styles.periodChip, borderColor: p.themeColor + '60' }}>
              <div style={{ ...styles.periodDot, background: p.themeColor }} />
              <span style={styles.periodText}>{p.yearStart}–{p.yearEnd}</span>
            </div>
          ))}
        </div>

        <button style={styles.enterBtn} onClick={onEnter}>
          <span>Bắt đầu tham quan</span>
          <span style={styles.arrow}>→</span>
        </button>

        <div style={styles.hint}>
          Hỗ trợ cảm biến xoay trên thiết bị di động · Tương thích mọi trình duyệt
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'relative', width: '100%', height: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #0f0a05 0%, #1e1408 40%, #0a0f1e 100%)',
    overflow: 'hidden',
  },
  bg: {
    position: 'absolute', inset: 0,
    background: 'radial-gradient(ellipse at 30% 40%, rgba(200,168,90,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 60%, rgba(26,79,122,0.12) 0%, transparent 60%)',
    pointerEvents: 'none',
  },
  content: {
    position: 'relative', zIndex: 1,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    textAlign: 'center', padding: '24px', maxWidth: '600px',
  },
  badge: {
    background: 'rgba(200,168,90,0.15)', border: '1px solid rgba(200,168,90,0.4)',
    color: '#c8a85a', borderRadius: '20px',
    padding: '5px 16px', fontSize: '12px', fontWeight: 600,
    letterSpacing: '0.1em', textTransform: 'uppercase',
    marginBottom: '20px',
  },
  title: {
    fontSize: 'clamp(28px, 5vw, 52px)',
    fontWeight: 800, color: '#f5e6c8',
    letterSpacing: '0.06em',
    lineHeight: 1.1, marginBottom: '8px',
    textShadow: '0 2px 20px rgba(200,168,90,0.3)',
  },
  years: {
    fontSize: '18px', color: '#c8a85a', fontWeight: 300,
    letterSpacing: '0.3em', marginBottom: '20px',
  },
  desc: {
    fontSize: '15px', color: '#b0a898', lineHeight: 1.7,
    marginBottom: '28px', maxWidth: '480px',
  },
  stats: {
    display: 'flex', alignItems: 'center', gap: '0',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px', padding: '16px 24px',
    marginBottom: '24px',
  },
  stat: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 20px' },
  statNum: { fontSize: '28px', fontWeight: 800, color: '#c8a85a', lineHeight: 1 },
  statLabel: { fontSize: '11px', color: '#7a7060', marginTop: '4px', whiteSpace: 'nowrap' },
  statDivider: { width: '1px', height: '40px', background: 'rgba(255,255,255,0.1)' },
  periods: {
    display: 'flex', flexWrap: 'wrap', gap: '8px',
    justifyContent: 'center', marginBottom: '32px',
  },
  periodChip: {
    display: 'flex', alignItems: 'center', gap: '6px',
    background: 'rgba(255,255,255,0.04)', border: '1px solid',
    borderRadius: '20px', padding: '4px 12px',
  },
  periodDot: { width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0 },
  periodText: { fontSize: '12px', color: '#9a9080' },
  enterBtn: {
    background: 'linear-gradient(135deg, #c8a85a, #a07830)',
    border: 'none', borderRadius: '8px',
    color: '#1a1008', fontWeight: 800,
    fontSize: '16px', letterSpacing: '0.03em',
    padding: '14px 36px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '10px',
    boxShadow: '0 4px 24px rgba(200,168,90,0.35)',
    transition: 'transform 0.15s, box-shadow 0.15s',
    marginBottom: '16px',
  },
  arrow: { fontSize: '20px' },
  hint: { fontSize: '12px', color: '#5a5040' },
}
