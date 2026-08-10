import { useState, useEffect } from 'react'
import { getVisitorStats } from '../api.js'
import type { VisitorStats } from '../api.js'

export function Analytics() {
  const [visitorStats, setVisitorStats] = useState<VisitorStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getVisitorStats()
      .then((data) => {
        setVisitorStats(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Error fetching visitor stats:', err)
        setError('Không thể kết nối tới D1 database. Vui lòng kiểm tra lại cấu hình Cloudflare.')
        setLoading(false)
      })
  }, [])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />

  const stats = [
    { 
      label: 'Người tham quan (UV)', 
      value: visitorStats !== null ? visitorStats.totalUv.toLocaleString() : '...', 
      icon: '👥',
      sub: 'Số lượng thiết bị/trình duyệt độc bản đã truy cập.',
      peak: visitorStats?.peakDay ? `Peak: ${visitorStats.peakDay.count} lượt (ngày ${visitorStats.peakDay.day})` : undefined
    },
    { 
      label: 'Tổng lượt xem (PV)', 
      value: visitorStats !== null ? visitorStats.totalPv.toLocaleString() : '...', 
      icon: '👁️',
      sub: 'Tổng số lượt tải trang (gồm cả tải lại trang).',
      peak: visitorStats?.peakHour ? `Peak: ${visitorStats.peakHour.count} lượt (khung giờ ${visitorStats.peakHour.hour})` : undefined
    },
  ]

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <h1 style={styles.title}>Thống kê truy cập</h1>
        <p style={styles.subtitle}>Giám sát số lượng khách tham quan phòng truyền thống số</p>
      </div>

      {/* Stats row */}
      <div style={styles.statsRow}>
        {stats.map(({ label, value, icon, sub, peak }) => (
          <div key={label} style={styles.statCard}>
            <div style={styles.statIcon}>{icon}</div>
            <div style={styles.statValue}>{value}</div>
            <div style={styles.statLabel}>{label}</div>
            <div style={styles.statSub}>{sub}</div>
            {peak && <div style={styles.statPeak}>{peak}</div>}
          </div>
        ))}
      </div>

      {/* Chart */}
      {visitorStats && visitorStats.dailyHistory.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Lượng truy cập 7 ngày gần đây</div>
          <div style={styles.chartContainer}>
            <div style={styles.chartBars}>
              {visitorStats.dailyHistory.map((day) => {
                const maxCount = Math.max(
                  ...visitorStats.dailyHistory.map((d) => d.total_count),
                  1
                )
                const pvHeight = `${(day.total_count / maxCount) * 100}%`
                const uvHeight = `${(day.unique_count / Math.max(day.total_count, 1)) * 100}%`
                
                return (
                  <div key={day.day} style={styles.chartColumn}>
                    <div 
                      style={styles.barStack}
                      title={`Ngày: ${day.day}\nTổng lượt xem (PV): ${day.total_count}\nNgười xem (UV): ${day.unique_count}`}
                    >
                      {/* PV bar */}
                      <div style={{ ...styles.barPv, height: pvHeight }}>
                        {/* UV bar (overlay inside PV bar) */}
                        <div style={{ ...styles.barUv, height: uvHeight }} />
                      </div>
                    </div>
                    <div style={styles.chartDate}>
                      {day.day.substring(5)}
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Chart Legend */}
            <div style={styles.chartLegend}>
              <span style={styles.legendItem}>
                <span style={{ ...styles.legendColor, background: 'rgba(29, 124, 230, 0.7)' }} />
                Tổng lượt xem (PV)
              </span>
              <span style={styles.legendItem}>
                <span style={{ ...styles.legendColor, background: '#c8a85a' }} />
                Người xem độc bản (UV)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Explanation */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Giải thích chỉ số</div>
        <div style={styles.explanationBox}>
          <p style={styles.explanationText}>
            💡 <strong>Unique Visitors (UV):</strong> Sử dụng cơ chế ghi nhận mã Visitor ID ngẫu nhiên lưu tại trình duyệt của khách hàng. Mỗi thiết bị chỉ được ghi nhận là 1 visitor độc bản trên các thống kê tổng thể và ngày/giờ.
          </p>
          <p style={styles.explanationText}>
            💡 <strong>Page Views (PV):</strong> Ghi nhận mọi lượt tải trang chủ (kể cả khi cùng một người dùng tải lại trang nhiều lần).
          </p>
        </div>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9a9080' }}>
      <div>Đang kết nối tới D1 database...</div>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px', color: '#c85a5a', padding: '24px' }}>
      <div style={{ fontSize: '32px' }}>⚠️</div>
      <div style={{ fontSize: '14px', textAlign: 'center', maxWidth: '400px', lineHeight: 1.5 }}>{message}</div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    padding: '24px',
    overflowY: 'auto',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  header: { borderBottom: '1px solid #2a1e10', paddingBottom: '16px' },
  title: { fontSize: '22px', fontWeight: 700, color: '#f0e8d8' },
  subtitle: { fontSize: '13px', color: '#6a5a40', marginTop: '4px' },
  statsRow: { display: 'flex', gap: '16px', flexWrap: 'wrap' },
  statCard: {
    flex: '1 1 240px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid #2a1e10',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  statIcon: { fontSize: '24px' },
  statValue: { fontSize: '28px', fontWeight: 700, color: '#c8a85a', lineHeight: 1.2 },
  statLabel: { fontSize: '14px', color: '#f0e8d8', fontWeight: 600 },
  statSub: { fontSize: '11px', color: '#9a9080', lineHeight: 1.4 },
  statPeak: { fontSize: '11px', color: '#5a8a5a', fontWeight: 600, marginTop: '4px', borderTop: '1px dashed #2a1e10', paddingTop: '4px' },
  section: { display: 'flex', flexDirection: 'column', gap: '12px' },
  sectionTitle: { fontSize: '13px', fontWeight: 600, color: '#9a9080', textTransform: 'uppercase', letterSpacing: '0.05em' },
  chartContainer: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid #2a1e10',
    borderRadius: '12px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  chartBars: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: '160px',
    paddingBottom: '8px',
    borderBottom: '1px solid #2a1e10',
  },
  chartColumn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  barStack: {
    position: 'relative',
    width: '36px',
    height: '100%',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  barPv: {
    width: '100%',
    background: 'rgba(29, 124, 230, 0.25)',
    border: '1px solid rgba(29, 124, 230, 0.6)',
    borderRadius: '4px 4px 0 0',
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-end',
    transition: 'all 0.3s ease',
  },
  barUv: {
    width: '100%',
    background: 'linear-gradient(180deg, #ffd700 0%, #c8a85a 100%)',
    borderRadius: '3px 3px 0 0',
    transition: 'all 0.3s ease',
  },
  chartDate: {
    fontSize: '11px',
    color: '#9a9080',
  },
  chartLegend: {
    display: 'flex',
    gap: '24px',
    justifyContent: 'center',
    fontSize: '12px',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#9a9080',
  },
  legendColor: {
    width: '12px',
    height: '12px',
    borderRadius: '3px',
  },
  explanationBox: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid #2a1e10',
    borderRadius: '12px',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  explanationText: {
    fontSize: '12px',
    color: '#9a9080',
    lineHeight: 1.5,
    margin: 0,
  },
}
