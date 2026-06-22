import { useAuth } from '../lib/AuthContext'

export default function Shell({ children, teams, teamFilter, setTeamFilter, notifCount, onBellClick }) {
  const { profile, signOut } = useAuth()

  return (
    <div style={{ minHeight: '100vh' }}>
      <style>{`
        @keyframes dashHeader { to { stroke-dashoffset: -300; } }
        @keyframes ringPing { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(2.2); opacity: 0; } }
        .shell-header { animation: fadeIn 0.4s ease both; }
        .pulse-bar { animation: dashHeader 4s linear infinite; }
        .bell-btn { position: relative; transition: color 0.2s; }
        .bell-btn:hover { color: var(--pulse) !important; }
        .bell-ring { position: absolute; inset: -2px; border-radius: 50%; border: 1px solid var(--pulse); animation: ringPing 1.8s ease-out infinite; }
        .team-select:focus { outline: none; border-color: var(--border-strong) !important; }
        .signout-btn:hover { border-color: var(--border-strong) !important; color: var(--pulse) !important; }
      `}</style>
      <header className="shell-header" style={styles.header}>
        <svg width="100%" height="2" viewBox="0 0 1100 2" preserveAspectRatio="none" style={styles.pulseSvg} aria-hidden="true">
          <line className="pulse-bar" x1="0" y1="1" x2="1100" y2="1" stroke="var(--pulse)" strokeWidth="2" strokeDasharray="40 200" opacity="0.7" />
        </svg>
        <div style={styles.headerInner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <div style={styles.logoWrap}>
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                <polyline points="0,12 6,12 9,4 13,20 17,12 24,12" fill="none" stroke="var(--pulse)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p style={styles.logo}>Task control</p>
            </div>
            {profile?.is_mbm && (
              <select
                value={teamFilter || ''}
                onChange={(e) => setTeamFilter(e.target.value || null)}
                className="team-select"
                style={styles.teamSelect}
              >
                <option value="">All teams</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <button onClick={onBellClick} className="bell-btn" style={styles.bellButton} aria-label="Notifications">
              <i className="ti ti-bell" style={{ fontSize: 18 }} aria-hidden="true" />
              {notifCount > 0 && (
                <>
                  <span className="bell-ring" aria-hidden="true" />
                  <span style={styles.bellDot}>{notifCount}</span>
                </>
              )}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={styles.avatar}>
                {profile?.full_name?.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p style={styles.name}>
                  {profile?.full_name}
                  {profile?.is_mbm && <span style={styles.mbmTag}>MBM</span>}
                </p>
                <p style={styles.team}>{profile?.team?.name}</p>
              </div>
            </div>
            <button onClick={signOut} className="signout-btn" style={styles.signOut}>Sign out</button>
          </div>
        </div>
      </header>
      <main style={styles.main}>{children}</main>
    </div>
  )
}

const styles = {
  header: {
    background: 'var(--surface)', backdropFilter: 'blur(20px)',
    borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10,
  },
  pulseSvg: { display: 'block', position: 'absolute', top: 0, left: 0 },
  headerInner: {
    maxWidth: 1100, margin: '0 auto', padding: '16px 24px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  logoWrap: { display: 'flex', alignItems: 'center', gap: 9 },
  logo: { fontSize: 15, fontWeight: 600, margin: 0, letterSpacing: '-0.01em', fontFamily: 'var(--font-display)' },
  teamSelect: {
    fontSize: 13, padding: '7px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
    background: 'rgba(6,9,18,0.5)', color: 'var(--text)', transition: 'border-color 0.2s',
  },
  bellButton: { position: 'relative', background: 'none', border: 'none', color: 'var(--text-2)', padding: 6, transition: 'color 0.2s' },
  bellDot: {
    position: 'absolute', top: -2, right: -2, background: 'var(--danger)', color: '#fff',
    fontSize: 10, fontWeight: 700, borderRadius: 999, minWidth: 16, height: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
  },
  avatar: {
    width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(0,229,199,0.25), rgba(61,169,252,0.2))',
    border: '1px solid var(--border-strong)', color: 'var(--pulse)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
  },
  name: { fontSize: 13, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 6 },
  mbmTag: {
    fontSize: 10, fontWeight: 700, background: 'var(--pulse)', color: '#04342C',
    padding: '1px 6px', borderRadius: 4, letterSpacing: '0.02em',
  },
  team: { fontSize: 12, color: 'var(--text-3)', margin: 0 },
  signOut: {
    fontSize: 13, color: 'var(--text-2)', background: 'none', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', padding: '7px 14px', transition: 'all 0.2s',
  },
  main: { maxWidth: 1100, margin: '0 auto', padding: '28px 24px 60px' },
}
