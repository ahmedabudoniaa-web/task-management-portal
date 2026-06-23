import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { fetchProjects } from '../lib/projects'
import { fetchActions } from '../lib/governance'
import { fetchTeams, fetchProfiles, fetchNotifications, markNotificationRead } from '../lib/tasks'
import { computeExecutiveMetrics } from '../lib/dashboard'
import { supabase } from '../lib/supabase'
import { healthColor } from '../lib/teamColors'
import Shell from '../components/Shell'
import ProjectCard from '../components/ProjectCard'
import NewProjectModal from '../components/NewProjectModal'
import NotificationsPanel from '../components/NotificationsPanel'
import ExecutiveDashboard from '../components/ExecutiveDashboard'
import GlobalSearch from '../components/GlobalSearch'
import { fetchRisks, fetchDecisions } from '../lib/risks'
import { fetchTasks } from '../lib/tasks'

export default function Projects() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [actions, setActions] = useState([])
  const [searchTasks, setSearchTasks] = useState([])
  const [searchRisks, setSearchRisks] = useState([])
  const [searchDecisions, setSearchDecisions] = useState([])
  const [pendingDecisionCount, setPendingDecisionCount] = useState(0)
  const [teams, setTeams] = useState([])
  const [people, setPeople] = useState([])
  const [notifications, setNotifications] = useState([])
  const [teamFilter, setTeamFilter] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [healthFilter, setHealthFilter] = useState('')
  const [sponsorFilter, setSponsorFilter] = useState('')
  const [pmFilter, setPmFilter] = useState('')
  const [showNewProject, setShowNewProject] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  async function loadAll() {
    setLoading(true)
    setLoadError(null)
    try {
      const [p, a, tm, ppl, n] = await Promise.all([
        fetchProjects({ profile, teamFilter }),
        fetchActions({ profile, teamFilter }),
        fetchTeams(),
        fetchProfiles(),
        fetchNotifications(profile.id),
      ])
      setProjects(p)
      setActions(a)
      setTeams(tm)
      setPeople(ppl)
      setNotifications(n)

      const [tasksForSearch, risksForSearch, decisionsForSearch] = await Promise.all([
        fetchTasks({ profile, teamFilter }),
        fetchRisks({ profile, teamFilter }),
        fetchDecisions({ profile, teamFilter }),
      ])
      setSearchTasks(tasksForSearch)
      setSearchRisks(risksForSearch)
      setSearchDecisions(decisionsForSearch)

      const { count } = await supabase
        .from('stage_advance_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
      setPendingDecisionCount(count || 0)
    } catch (err) {
      setLoadError(err.message || 'Could not load projects.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [teamFilter])

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false
      if (healthFilter && p.health !== healthFilter) return false
      if (sponsorFilter && p.sponsor_id !== sponsorFilter) return false
      if (pmFilter && p.project_manager_id !== pmFilter) return false
      return true
    })
  }, [projects, statusFilter, healthFilter, sponsorFilter, pmFilter])

  const unreadCount = notifications.filter((n) => !n.is_read).length

  const progressPercent = projects.length === 0
    ? 0
    : projects.reduce((sum, p) => sum + p.percent_complete, 0) / projects.length

  const metrics = useMemo(() => computeExecutiveMetrics({ projects, actions }), [projects, actions])

  const hasActiveFilters = statusFilter || healthFilter || sponsorFilter || pmFilter

  return (
    <Shell
      teams={teams}
      teamFilter={teamFilter}
      setTeamFilter={setTeamFilter}
      notifCount={unreadCount}
      onBellClick={() => setShowNotifs((s) => !s)}
      progressPercent={progressPercent}
      searchSlot={
        <GlobalSearch
          projects={projects} tasks={searchTasks} actions={actions}
          risks={searchRisks} decisions={searchDecisions}
          onSelectTask={() => navigate('/')}
        />
      }
    >
      <div style={styles.topBar}>
        <h1 style={styles.pageTitle}>Projects</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/trash')} style={styles.trashLink}>
            <i className="ti ti-trash" style={{ fontSize: 14 }} aria-hidden="true" /> Deleted
          </button>
          <button onClick={() => setShowNewProject(true)} style={styles.newBtn}>
            <i className="ti ti-plus" style={{ fontSize: 14 }} aria-hidden="true" /> New project
          </button>
        </div>
      </div>

      {!loading && !loadError && (
        <ExecutiveDashboard metrics={metrics} pendingDecisionCount={pendingDecisionCount} />
      )}

      <div style={styles.filterBar}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={styles.filterSelect}>
          <option value="">All statuses</option>
          <option value="initiation">Initiation</option>
          <option value="planning">Planning</option>
          <option value="execution">Execution</option>
          <option value="final_review">Final review</option>
          <option value="closure">Closure</option>
          <option value="closed">Closed</option>
        </select>
        <select value={healthFilter} onChange={(e) => setHealthFilter(e.target.value)} style={styles.filterSelect}>
          <option value="">All health</option>
          <option value="green">{healthColor('green').label}</option>
          <option value="amber">{healthColor('amber').label}</option>
          <option value="red">{healthColor('red').label}</option>
        </select>
        <select value={sponsorFilter} onChange={(e) => setSponsorFilter(e.target.value)} style={styles.filterSelect}>
          <option value="">All sponsors</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
        <select value={pmFilter} onChange={(e) => setPmFilter(e.target.value)} style={styles.filterSelect}>
          <option value="">All project managers</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
        {hasActiveFilters && (
          <button onClick={() => { setStatusFilter(''); setHealthFilter(''); setSponsorFilter(''); setPmFilter('') }} style={styles.clearFiltersBtn}>
            Clear filters
          </button>
        )}
      </div>

      {loadError ? (
        <div style={styles.emptyState}>
          <p style={{ ...styles.emptyTitle, color: 'var(--danger)' }}>Couldn't load projects</p>
          <p style={styles.emptySub}>{loadError}</p>
          <button onClick={loadAll} style={styles.retryBtn}>Try again</button>
        </div>
      ) : loading ? (
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>Loading projects…</p>
      ) : filteredProjects.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={styles.emptyTitle}>{projects.length === 0 ? 'No projects yet' : 'No projects match these filters'}</p>
          <p style={styles.emptySub}>{projects.length === 0 ? 'Create your first project to start tracking milestones.' : 'Try clearing a filter.'}</p>
        </div>
      ) : (
        filteredProjects.map((p) => (
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
  trashLink: {
    display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, padding: '9px 14px',
    borderRadius: 'var(--radius)', border: '1px solid var(--border)',
    background: 'var(--surface)', color: 'var(--text-2)', flexShrink: 0,
  },
  filterBar: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 },
  filterSelect: { fontSize: 12.5, padding: '7px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-2)' },
  clearFiltersBtn: { fontSize: 12.5, padding: '7px 12px', borderRadius: 'var(--radius)', border: 'none', background: 'none', color: 'var(--bupa-blue)', fontWeight: 600 },
  emptyState: { textAlign: 'center', padding: '60px 0', color: 'var(--text-3)' },
  emptyTitle: { fontSize: 15, fontWeight: 700, color: 'var(--text-2)', margin: '0 0 4px' },
  emptySub: { fontSize: 13, margin: 0 },
  retryBtn: { marginTop: 14, fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--bupa-blue)', color: '#fff' },
}
