import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { fetchDeletedProjects, restoreProject } from '../lib/projects'
import { fetchTeams } from '../lib/tasks'
import Shell from '../components/Shell'

function formatDate(date) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Trash() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [teams, setTeams] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState(null)

  async function loadAll() {
    setLoading(true); setLoadError(null)
    try {
      const [tm, proj] = await Promise.all([fetchTeams(), fetchDeletedProjects({ profile })])
      setTeams(tm); setProjects(proj)
    } catch (err) {
      setLoadError(err.message || 'Could not load deleted projects.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { loadAll() }, [])

  async function handleRestore(id) {
    setBusyId(id); setActionError(null)
    try {
      await restoreProject(id, profile.id)
      setProjects((ps) => ps.filter((p) => p.id !== id))
    } catch (err) {
      setActionError(err.message || 'Could not restore this project.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Shell teams={teams} teamFilter={null} setTeamFilter={() => {}} notifCount={0} onBellClick={() => {}}>
      <button onClick={() => navigate('/projects')} style={styles.backLink}>← Back to projects</button>

      <div style={styles.heroRow}>
        <div>
          <p style={styles.eyebrow}>Recoverable</p>
          <h1 style={styles.pageTitle}>Deleted Projects</h1>
          <p style={styles.pageSub}>Soft-deleted projects you can restore. Nothing here is permanently erased — restoring brings a project back exactly as it was.</p>
        </div>
      </div>

      {actionError && <div style={styles.errorBox}><p style={styles.errorBoxText}>{actionError}</p></div>}

      {loadError ? (
        <div style={styles.emptyState}>
          <p style={styles.errorTitle}>Couldn&apos;t load deleted projects</p>
          <p style={styles.emptySub}>{loadError}</p>
          <button onClick={loadAll} style={styles.primaryBtn}>Try again</button>
        </div>
      ) : loading ? (
        <p style={styles.loadingText}>Loading…</p>
      ) : projects.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={styles.emptyTitle}>Trash is empty</p>
          <p style={styles.emptySub}>No deleted projects to restore.</p>
        </div>
      ) : (
        <div style={styles.list}>
          {projects.map((p) => (
            <div key={p.id} style={styles.row}>
              <span style={{ minWidth: 0, flex: 1 }}>
                <strong style={styles.name}>{p.name}</strong>
                <span style={styles.meta}>
                  {p.team?.name || 'No team'} · deleted {formatDate(p.deleted_at)}
                  {p.deleter?.full_name ? ` by ${p.deleter.full_name}` : ''}
                  {p.deletion_reason ? ` · "${p.deletion_reason}"` : ''}
                </span>
              </span>
              <button onClick={() => handleRestore(p.id)} disabled={busyId === p.id} style={styles.restoreBtn}>
                <i className="ti ti-restore" style={{ fontSize: 14 }} aria-hidden="true" /> {busyId === p.id ? 'Restoring…' : 'Restore'}
              </button>
            </div>
          ))}
        </div>
      )}
    </Shell>
  )
}

const styles = {
  backLink: { border: 'none', background: 'transparent', color: 'var(--bupa-blue)', fontWeight: 750, fontSize: 13, padding: 0, marginBottom: 14, cursor: 'pointer' },
  heroRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, marginBottom: 20, flexWrap: 'wrap' },
  eyebrow: { fontSize: 11.5, fontWeight: 900, color: 'var(--bupa-blue)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 5px' },
  pageTitle: { fontSize: 28, fontWeight: 900, color: 'var(--text)', margin: 0 },
  pageSub: { fontSize: 13.5, color: 'var(--text-2)', margin: '6px 0 0', maxWidth: 600 },
  errorBox: { background: 'var(--danger-light)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 16 },
  errorBoxText: { fontSize: 13, color: 'var(--danger)', margin: 0 },
  emptyState: { textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: 900, color: 'var(--text)', margin: '0 0 6px' },
  errorTitle: { fontSize: 16, color: 'var(--danger)', fontWeight: 900, margin: '0 0 6px' },
  emptySub: { fontSize: 13, color: 'var(--text-2)', margin: '0 0 16px' },
  loadingText: { color: 'var(--text-2)', fontSize: 14 },
  primaryBtn: { border: 'none', borderRadius: 'var(--radius)', background: 'linear-gradient(135deg, #0050A0, #2D8FE0)', color: '#fff', fontWeight: 800, fontSize: 13, padding: '10px 16px', cursor: 'pointer' },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,80,160,0.04)' },
  name: { display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  meta: { display: 'block', fontSize: 12, color: 'var(--text-3)', marginTop: 3 },
  restoreBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--bupa-blue)', fontWeight: 800, fontSize: 13, padding: '9px 15px', cursor: 'pointer' },
}
