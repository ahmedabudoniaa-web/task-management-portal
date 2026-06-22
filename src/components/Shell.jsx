import { useAuth } from '../lib/AuthContext'
import { teamColor } from '../lib/teamColors'
import { Link, useLocation } from 'react-router-dom'
import HeaderSearch from './HeaderSearch'

export default function Shell({ children, teams, teamFilter, setTeamFilter, notifCount, onBellClick, progressPercent, searchSlot }) {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const onPortfolio = location.pathname.startsWith('/portfolio')
  const onProjects = location.pathname.startsWith('/projects')
  const onActions = location.pathname.startsWith('/actions')
  const onGovernance = location.pathname.startsWith('/governance')
  const onInbox = location.pathname.startsWith('/inbox')
  const onProfile = location.pathname.startsWith('/profile')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <style>{`
        .shell-blob { position: absolute; border-radius: 50%; opacity: 0.13; background: white; }
        .shell-tab { transition: all 0.15s; }
        .shell-tab:hover { transform: translateY(-1px); }
        .bell-btn { position: relative; transition: opacity 0.2s; }
        .bell-btn:hover { opacity: 0.75; }
        .signout-btn { transition: all 0.15s; }
        .signout-btn:hover { background: var(--surface-2) !important; }
        .header-card { animation: fadeIn 0.35s ease both; }
        .nav-link { text-decoration: none; transition: all 0.15s; }
      `}</style>

      <header className="header-card" style={styles.header}>
        <div style={styles.blobLayer}>
          <div className="shell-blob" style={{ width: 130, height: 130, top: -45, right: 40 }} />
          <div className="shell-blob" style={{ width: 60, height: 60, bottom: -30, left: 200 }} />
        </div>
        <div style={styles.headerInner}>
          <div style={styles.topRow}>
            <div style={styles.brandRow}>
              <img src="/logo.png" alt="FM Task Management" style={styles.logo} />
              <div>
                <p style={styles.brandName}>FM Task Management</p>
                <p style={styles.greeting}>Hey {profile?.full_name?.split(' ')[0]}, here's today</p>
              </div>
              <div style={styles.navGroup}>
                <Link to="/" className="nav-link" style={{ ...styles.navLink, ...(!onPortfolio && !onProjects && !onActions && !onGovernance ? styles.navLinkActive : {}) }}>
                  Tasks
                </Link>
                <Link to="/portfolio" className="nav-link" style={{ ...styles.navLink, ...(onPortfolio ? styles.navLinkActive : {}) }}>
                  Portfolio
                </Link>
                <Link to="/projects" className="nav-link" style={{ ...styles.navLink, ...(onProjects ? styles.navLinkActive : {}) }}>
                  Projects
                </Link>
                <Link to="/actions" className="nav-link" style={{ ...styles.navLink, ...(onActions ? styles.navLinkActive : {}) }}>
                  Actions
                </Link>
                <Link to="/governance" className="nav-link" style={{ ...styles.navLink, ...(onGovernance ? styles.navLinkActive : {}) }}>
                  Governance
                </Link>
                <Link to="/inbox" className="nav-link" style={{ ...styles.navLink, ...(onInbox ? styles.navLinkActive : {}) }}>
                  Inbox
                </Link>
                <Link to="/profile" className="nav-link" style={{ ...styles.navLink, ...(onProfile ? styles.navLinkActive : {}) }}>
                  Profile
                </Link>
              </div>
            </div>

            <div style={styles.searchSlotWrap}>{searchSlot || <HeaderSearch />}</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button onClick={onBellClick} className="bell-btn" style={styles.bellButton} aria-label="Notifications">
                <i className="ti ti-bell" style={{ fontSize: 18, color: '#fff' }} aria-hidden="true" />
                {notifCount > 0 && <span style={styles.bellDot}>{notifCount}</span>}
              </button>
              {typeof progressPercent === 'number' && (
                <div style={styles.ringWrap}>
                  <svg width="42" height="42" viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r="17" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="5" />
                    <circle
                      cx="20" cy="20" r="17" fill="none" stroke="#fff" strokeWidth="5"
                      strokeDasharray={`${Math.round(progressPercent * 1.07)} 107`}
                      strokeLinecap="round" transform="rotate(-90 20 20)"
                    />
                  </svg>
                  <span style={styles.ringLabel}>{Math.round(progressPercent)}%</span>
                </div>
              )}
              <Link to="/profile" style={styles.avatarLink} title="Profile">
                <div style={styles.avatar}>
                  {profile?.full_name?.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                </div>
              </Link>
              <button onClick={signOut} className="signout-btn" style={styles.signOut}>Sign out</button>
            </div>
          </div>

          <div style={styles.tabRow}>
            <button
              onClick={() => setTeamFilter(null)}
              className="shell-tab"
              style={{ ...styles.tab, ...(!teamFilter ? styles.tabActive : {}) }}
            >
              <i className="ti ti-apps" style={{ fontSize: 14 }} aria-hidden="true" /> All teams
            </button>
            {profile?.is_mbm && teams.map((t) => {
              const c = teamColor(t.name)
              const active = teamFilter === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTeamFilter(t.id)}
                  className="shell-tab"
                  style={{ ...styles.tab, ...(active ? styles.tabActive : {}) }}
                >
                  <span style={{ ...styles.tabDot, background: active ? 'var(--bupa-blue)' : c.dot }} />
                  {t.name}
                </button>
              )
            })}
          </div>
        </div>
      </header>
      <main style={styles.main}>{children}</main>
    </div>
  )
}

const styles = {
  header: {
    background: 'linear-gradient(135deg, #0050A0, #2D8FE0)',
    position: 'relative',
  },
  blobLayer: { position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' },
  headerInner: { maxWidth: 1100, margin: '0 auto', padding: '20px 24px 18px', position: 'relative' },
  topRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 20 },
  searchSlotWrap: { flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0 },
  brandRow: { display: 'flex', alignItems: 'center', gap: 12 },
  navGroup: { display: 'flex', gap: 4, marginLeft: 12, paddingLeft: 16, borderLeft: '1px solid rgba(255,255,255,0.25)' },
  navLink: {
    fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.75)',
    padding: '6px 12px', borderRadius: 999,
  },
  navLinkActive: { color: '#fff', background: 'rgba(255,255,255,0.18)' },
  logo: { width: 36, height: 36, borderRadius: 11, objectFit: 'cover' },
  brandName: { margin: 0, color: '#fff', fontSize: 15.5, fontWeight: 700 },
  greeting: { margin: '1px 0 0', color: 'rgba(255,255,255,0.78)', fontSize: 11.5 },
  bellButton: { position: 'relative', background: 'none', border: 'none', padding: 4 },
  bellDot: {
    position: 'absolute', top: -3, right: -4, background: '#FF5C72', color: '#fff',
    fontSize: 10, fontWeight: 700, borderRadius: 999, minWidth: 16, height: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
    border: '1.5px solid #0050A0',
  },
  ringWrap: { position: 'relative', width: 42, height: 42 },
  ringLabel: {
    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 800, color: '#fff',
  },
  avatarLink: { textDecoration: 'none' },
  avatar: {
    width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.22)',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
  },
  signOut: {
    fontSize: 12.5, color: '#fff', background: 'rgba(255,255,255,0.15)', border: 'none',
    borderRadius: 'var(--radius)', padding: '7px 14px', fontWeight: 600,
  },
  tabRow: { display: 'flex', gap: 8, flexWrap: 'wrap', position: 'relative' },
  tab: {
    padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700,
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'rgba(255,255,255,0.18)', color: '#fff', border: 'none',
  },
  tabActive: { background: '#fff', color: 'var(--bupa-blue)' },
  tabDot: { width: 7, height: 7, borderRadius: '50%', display: 'inline-block' },
  main: { maxWidth: 1100, margin: '0 auto', padding: '24px 24px 60px' },
}
