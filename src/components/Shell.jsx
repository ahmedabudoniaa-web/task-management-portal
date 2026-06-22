import { useAuth } from '../lib/AuthContext'

export default function Shell({ children, teams, teamFilter, setTeamFilter, notifCount, onBellClick }) {
  const { profile, signOut } = useAuth()

  return (
    <div style={{ minHeight: '100vh' }}>
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <p style={styles.logo}>Task portal</p>
            {profile?.is_mbm && (
              <select
                value={teamFilter || ''}
                onChange={(e) => setTeamFilter(e.target.value || null)}
                style={styles.teamSelect}
              >
                <option value="">All teams</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={onBellClick} style={styles.bellButton} aria-label="Notifications">
              <i className="ti ti-bell" style={{ fontSize: 18 }} aria-hidden="true" />
              {notifCount > 0 && <span style={styles.bellDot}>{notifCount}</span>}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
            <button onClick={signOut} style={styles.signOut}>Sign out</button>
          </div>
        </div>
      </header>
      <main style={styles.main}>{children}</main>
    </div>
  )
}

const styles = {
  header: {
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  headerInner: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '14px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: { fontSize: 15, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' },
  teamSelect: {
    fontSize: 13,
    padding: '6px 10px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
  },
  bellButton: {
    position: 'relative',
    background: 'none',
    border: 'none',
    color: 'var(--text-2)',
    padding: 6,
  },
  bellDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    background: 'var(--danger)',
    color: '#fff',
    fontSize: 10,
    fontWeight: 700,
    borderRadius: 999,
    minWidth: 16,
    height: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 3px',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: 'var(--accent-light)',
    color: 'var(--accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
  },
  name: { fontSize: 13, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 6 },
  mbmTag: {
    fontSize: 10,
    fontWeight: 700,
    background: 'var(--accent)',
    color: '#fff',
    padding: '1px 6px',
    borderRadius: 4,
  },
  team: { fontSize: 12, color: 'var(--text-3)', margin: 0 },
  signOut: {
    fontSize: 13,
    color: 'var(--text-2)',
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '7px 14px',
  },
  main: { maxWidth: 1100, margin: '0 auto', padding: '28px 24px 60px' },
}
