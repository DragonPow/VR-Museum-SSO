import { NavLink, useLocation } from 'react-router-dom'
import { useDraftStore } from '../store.js'

const NAV = [
  { to: '/',         label: 'Dashboard',         icon: '🏠' },
  { to: '/library',  label: 'Thư viện ảnh',      icon: '🖼' },
  { to: '/assign',   label: 'Gán ảnh vào slot',  icon: '📌' },
  { to: '/preview',  label: 'Xem trước 3D',      icon: '👁' },
  { to: '/publish',  label: 'Xuất bản',          icon: '🚀' },
]

interface Props {
  children: React.ReactNode
}

export function Layout({ children }: Props) {
  const dirty = useDraftStore((s) => s.dirty)
  const location = useLocation()

  return (
    <div style={styles.root}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <span style={styles.brandIcon}>🏛</span>
          <div>
            <div style={styles.brandName}>Admin CMS</div>
            <div style={styles.brandSub}>Phòng Truyền Thống</div>
          </div>
        </div>

        <nav style={styles.nav}>
          {NAV.map(({ to, label, icon }) => {
            const active = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
            return (
              <NavLink
                key={to}
                to={to}
                style={{
                  ...styles.navItem,
                  ...(active ? styles.navItemActive : {}),
                }}
              >
                <span style={styles.navIcon}>{icon}</span>
                <span>{label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div style={styles.sidebarBottom}>
          {dirty && (
            <div style={styles.dirtyBadge}>
              <span style={styles.dirtyDot} />
              Có thay đổi chưa lưu
            </div>
          )}
          <div style={styles.version}>v0.1.0 — dev</div>
        </div>
      </aside>

      {/* Main */}
      <main style={styles.main}>
        {children}
      </main>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    height: '100%',
    overflow: 'hidden',
    background: '#0a0804',
  },
  sidebar: {
    width: '220px',
    flexShrink: 0,
    background: '#0d0906',
    borderRight: '1px solid #2a1e10',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '20px 16px',
    borderBottom: '1px solid #2a1e10',
  },
  brandIcon: { fontSize: '28px', lineHeight: 1 },
  brandName: { fontSize: '13px', fontWeight: 700, color: '#c8a85a' },
  brandSub: { fontSize: '11px', color: '#6a5a40', marginTop: '1px' },
  nav: {
    flex: 1,
    padding: '12px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    overflowY: 'auto',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '9px 12px',
    borderRadius: '8px',
    color: '#9a9080',
    textDecoration: 'none',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'all 0.15s',
  },
  navItemActive: {
    background: 'rgba(200,168,90,0.12)',
    color: '#c8a85a',
  },
  navIcon: { fontSize: '16px', width: '20px', textAlign: 'center' },
  sidebarBottom: {
    padding: '12px 16px',
    borderTop: '1px solid #2a1e10',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  dirtyBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    color: '#c8a85a',
  },
  dirtyDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: '#c8a85a',
    animation: 'pulse 1.5s infinite',
    flexShrink: 0,
  },
  version: { fontSize: '11px', color: '#4a3a20' },
  main: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
}
