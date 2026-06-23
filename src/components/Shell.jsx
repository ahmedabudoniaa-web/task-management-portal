import { useAuth } from '../lib/AuthContext'
import { teamColor } from '../lib/teamColors'
import { Link, useLocation } from 'react-router-dom'
import HeaderSearch from './HeaderSearch'
import { isMBM, profileTeamIds } from '../lib/permissions'

export default function Shell({ children, teams, teamFilter, setTeamFilter, notifCount, onBellClick, progressPercent, searchSlot }) {
  const { profile, signOut } = useAuth()
  const visibleTeamIds = new Set(profileTeamIds(profile))
  const visibleTeamTabs = isMBM(profile) ? teams : teams.filter((t) => visibleTeamIds.has(t.id))
  const location = useLocation()
  const onPortfolio = location.pathname.startsWith('/portfolio')
  const onTeams = location.pathname.startsWith('/teams')
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
        .signout-btn:hover { background: var(--surface-2) !important; color: var(--bupa-blue) !important; }
        .header-card { animation: fadeIn 0.35s ease both; }
        .nav-link { text-decoration: none; transition: all 0.15s; flex-shrink: 0; }
        .nav-scroll, .tab-scroll {
          display: flex; gap: 4px; overflow-x: auto; -webkit-overflow-scrolling: touch;
          scrollbar-width: none; -ms-overflow-style: none;
        }
        .nav-scroll::-webkit-scrollbar, .tab-scroll::-webkit-scrollbar { display: none; }

        /* ---- Responsive breakpoints ---- */
        .shell-top-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
        .shell-right-stack { display: flex; flex-direction: column; align-items: flex-end; gap: 9px; min-width: 320px; max-width: 430px; flex-shrink: 0; }
        .shell-brand-text { display: block; }

        @media (max-width: 760px) {
          .shell-header-inner { padding: 14px 14px 12px !important; }
          .shell-top-row { flex-direction: column; align-items: stretch; gap: 12px; }
          .shell-right-stack { min-width: 0; max-width: none; width: 100%; align-items: stretch; }
          .shell-user-row { justify-content: space-between; width: 100%; }
          .shell-brand-text { display: none; }
          .nav-link { font-size: 12.5px; padding: 6px 11px; }
          .shell-tab-btn { font-size: 11.5px !important; padding: 6px 11px !important; }
          .shell-main { padding: 16px 14px 40px !important; }
        }
        @media (max-width: 420px) {
          .shell-signout-text { display: none; }
          .shell-signout-btn { padding: 7px 10px !important; }
        }
      `}</style>

      <header className="header-card" style={styles.header}>
        <div style={styles.blobLayer}>
          <div className="shell-blob" style={{ width: 130, height: 130, top: -45, right: 40 }} />
          <div className="shell-blob" style={{ width: 60, height: 60, bottom: -30, left: 200 }} />
        </div>
        <div className="shell-header-inner" style={styles.headerInner}>
          <div className="shell-top-row">
            <div style={styles.brandRow}>
              <img src="/logo.png" alt="FM Task Management" style={styles.logo} />
              <div className="shell-brand-text">
                <p style={styles.brandName}>FM Task Management</p>
                <p style={styles.greeting}>Hey {profile?.full_name?.split(' ')[0]}, here's today</p>
              </div>
            </div>

            <div className="shell-right-stack">
              <div className="shell-user-row" style={styles.userRow}>
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
                <button onClick={signOut} className="signout-btn shell-signout-btn" style={styles.signOut}>
                  <span className="shell-signout-text">Sign out</span>
                  <i className="ti ti-logout" style={{ fontSize: 14 }} aria-hidden="true" />
                </button>
              </div>
              <div style={styles.searchUnderSignOut}>{searchSlot || <HeaderSearch />}</div>
            </div>
          </div>

          <nav className="nav-scroll" style={styles.navGroup} aria-label="Main navigation">
            <Link to="/portfolio" className="nav-link" style={{ ...styles.navLink, ...(onPortfolio ? styles.navLinkActive : {}) }}>
              Portfolio
            </Link>
            <Link to="/teams" className="nav-link" style={{ ...styles.navLink, ...(onTeams ? styles.navLinkActive : {}) }}>
              Teams Dashboard
            </Link>
            <Link to="/" className="nav-link" style={{ ...styles.navLink, ...(!onPortfolio && !onTeams && !onProjects && !onActions && !onGovernance && !onInbox && !onProfile ? styles.navLinkActive : {}) }}>
              Tasks
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
          </nav>

          <div className="tab-scroll" style={styles.tabRow}>
            <button
              onClick={() => setTeamFilter(null)}
              className="shell-tab shell-tab-btn"
              style={{ ...styles.tab, ...(!teamFilter ? styles.tabActive : {}) }}
            >
              <i className="ti ti-apps" style={{ fontSize: 14 }} aria-hidden="true" /> All teams
            </button>
            {visibleTeamTabs.length > 0 && visibleTeamTabs.map((t) => {
              const c = teamColor(t.name)
              const active = teamFilter === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTeamFilter(t.id)}
                  className="shell-tab shell-tab-btn"
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
      <main className="shell-main" style={styles.main}>{children}</main>
    </div>
  )
}

const styles = {
  header: { background: 'linear-gradient(135deg, #0050A0, #2D8FE0)', position: 'relative' },
  blobLayer: { position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' },
  headerInner: { maxWidth: 1200, margin: '0 auto', padding: '20px 24px 18px', position: 'relative' },
  brandRow: { display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flexShrink: 0 },
  navGroup: { marginTop: 14, marginBottom: 10, paddingBottom: 2 },
  navLink: { fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.75)', padding: '6px 12px', borderRadius: 999, whiteSpace: 'nowrap' },
  navLinkActive: { color: '#fff', background: 'rgba(255,255,255,0.18)' },
  logo: { width: 36, height: 36, borderRadius: 11, objectFit: 'cover', flexShrink: 0 },
  brandName: { margin: 0, color: '#fff', fontSize: 15.5, fontWeight: 700, whiteSpace: 'nowrap' },
  greeting: { margin: '1px 0 0', color: 'rgba(255,255,255,0.78)', fontSize: 11.5, whiteSpace: 'nowrap' },
  userRow: { display: 'flex', alignItems: 'center', gap: 14 },
  searchUnderSignOut: { width: '100%' },
  bellButton: { position: 'relative', background: 'none', border: 'none', padding: 4, cursor: 'pointer', flexShrink: 0 },
  bellDot: { position: 'absolute', top: -3, right: -4, background: '#FF5C72', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 999, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', border: '1.5px solid #0050A0' },
  ringWrap: { position: 'relative', width: 42, height: 42, flexShrink: 0 },
  ringLabel: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff' },
  avatarLink: { textDecoration: 'none', flexShrink: 0 },
  avatar: { width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.22)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 },
  signOut: { fontSize: 12.5, color: '#fff', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 'var(--radius)', padding: '7px 14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, whiteSpace: 'nowrap' },
  tabRow: { paddingBottom: 2 },
  tab: { padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.18)', color: '#fff', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 },
  tabActive: { background: '#fff', color: 'var(--bupa-blue)' },
  tabDot: { width: 7, height: 7, borderRadius: '50%', display: 'inline-block', flexShrink: 0 },
  main: { maxWidth: 1200, margin: '0 auto', padding: '24px 24px 60px' },
}
