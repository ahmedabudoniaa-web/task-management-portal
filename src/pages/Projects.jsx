import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { fetchProjects } from '../lib/projects'
import { fetchTeams, fetchProfiles, fetchNotifications, markNotificationRead } from '../lib/tasks'
import Shell from '../components/Shell'
import ProjectCard from '../components/ProjectCard'
import NewProjectModal from '../components/NewProjectModal'
import NotificationsPanel from '../components/NotificationsPanel'

export default function Projects() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [teams, setTeams] = useState([])
  const [people, setPeople] = useState([])
  const [notifications, setNotifications] = useState([])
  const [teamFilter, setTeamFilter] = useState(null)
  const [showNewProject, setShowNewProject] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  async function loadAll() {
    setLoading(true)
    setLoadError(null)
    try {
      const [p, tm, ppl, n] = await Promise.all([
        fetchProjects({ profile, teamFilter }),
        fetchTeams(),
        fetchProfiles(),
        fetchNotifications(profile.id),
      ])
      setProjects(p)
      setTeams(tm)
      setPeople(ppl)
      setNotifications(n)
    } catch (err) {
      setLoadError(err.message || 'Could not load projects.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [teamFilter])

  const unreadCount = notifications.filter((n) => !n.is_read).length

  const progressPercent = projects.length === 0
    ? 0
    : projects.reduce((sum, p) => sum + p.percent_complete, 0) / projects.length

  return (
    <Shell
      teams={teams}
      teamFilter={teamFilter}
      setTeamFilter={setTeamFilter}
      notifCount={unreadCount}
      onBellClick={() => setShowNotifs((s) => !s)}
      progressPercent={progressPercent}
    >
      <div style={styles.topBar}>
        <h1 style={styles.pageTitle}>Projects</h1>
        <button onClick={() => setShowNewProject(true)} style={styles.newBtn}>
          <i className="ti ti-plus" style={{ fontSize: 14 }} aria-hidden="true" /> New project
        </button>
      </div>

      {loadError ? (
        <div style={styles.emptyState}>
          <p style={{ ...styles.emptyTitle, color: 'var(--danger)' }}>Couldn't load projects</p>
          <p style={styles.emptySub}>{loadError}</p>
          <button onClick={loadAll} style={styles.retryBtn}>Try again</button>
        </div>
      ) : loading ? (
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>Loading projects…</p>
      ) : projects.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={styles.emptyTitle}>No projects yet</p>
          <p style={styles.emptySub}>Create your first project to start tracking milestones.</p>
        </div>
      ) : (
        projects.map((p) => (
          <ProjectCard key={p.id} project={p} onClick={() => navigate(`/projects/${p.id}`)} />
        ))
      )}

      {showNewProject && (
        <NewProjectModal
          teams={teams}
          people={people}
          onClose={() => setShowNewProject(false)}
          onCreated={() => { setShowNewProject(false); loadAll() }}
        />
      )}

      {showNotifs && (
        <NotificationsPanel
          notifications={notifications}
          onClose={() => setShowNotifs(false)}
          onMarkRead={async (id) => {
            await markNotificationRead(id)
            setNotifications((ns) => ns.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
          }}
        />
      )}
    </Shell>
  )
}

const styles = {
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 16, flexWrap: 'wrap' },
  pageTitle: { fontSize: 19, fontWeight: 700, margin: 0, color: 'var(--text)' },
  newBtn: {
    display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, padding: '9px 18px',
    borderRadius: 'var(--radius)', border: 'none',
    background: 'linear-gradient(135deg, #0050A0, #2D8FE0)',
    color: '#fff', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,80,160,0.2)',
  },
  emptyState: { textAlign: 'center', padding: '60px 0', color: 'var(--text-3)' },
  emptyTitle: { fontSize: 15, fontWeight: 700, color: 'var(--text-2)', margin: '0 0 4px' },
  emptySub: { fontSize: 13, margin: 0 },
  retryBtn: { marginTop: 14, fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--bupa-blue)', color: '#fff' },
}
