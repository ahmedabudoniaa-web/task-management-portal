import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../lib/AuthContext'
import { fetchTasks, fetchTeams, fetchProfiles, fetchNotifications, markNotificationRead } from '../lib/tasks'
import { fetchProjects } from '../lib/projects'
import Shell from '../components/Shell'
import TaskCard from '../components/TaskCard'
import TaskDetail from '../components/TaskDetail'
import NewTaskModal from '../components/NewTaskModal'
import RejectionBanner from '../components/RejectionBanner'
import NotificationsPanel from '../components/NotificationsPanel'

const MY_STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'initiated', label: 'Initiated' },
  { key: 'pending_acceptance', label: 'Pending acceptance' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'completed', label: 'Completed' },
]

const TEAM_STATUS_FILTERS = MY_STATUS_FILTERS

export default function Dashboard() {
  const { profile } = useAuth()
  const [view, setView] = useState('mine') // 'mine' | 'team'
  const [myTasks, setMyTasks] = useState([])
  const [teamTasks, setTeamTasks] = useState([])
  const [teams, setTeams] = useState([])
  const [people, setPeople] = useState([])
  const [projects, setProjects] = useState([])
  const [notifications, setNotifications] = useState([])
  const [teamFilter, setTeamFilter] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState(null)
  const [showNewTask, setShowNewTask] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  async function loadAll() {
    setLoading(true)
    setLoadError(null)
    try {
      const [mine, team, tm, p, proj, n] = await Promise.all([
        fetchTasks({ profile, scope: 'mine' }),
        fetchTasks({ profile, teamFilter, assigneeFilter: employeeFilter || null, scope: 'team' }),
        fetchTeams(),
        fetchProfiles(),
        fetchProjects({ profile, teamFilter: null }),
        fetchNotifications(profile.id),
      ])
      setMyTasks(mine)
      setTeamTasks(team)
      setTeams(tm)
      setPeople(p)
      setProjects(proj)
      setNotifications(n)
    } catch (err) {
      setLoadError(err.message || 'Could not load tasks.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [teamFilter, employeeFilter])

  const activeTasks = view === 'mine' ? myTasks : teamTasks

  const filteredTasks = useMemo(() => {
    if (statusFilter === 'all') return activeTasks
    return activeTasks.filter((t) => t.status === statusFilter)
  }, [activeTasks, statusFilter])

  const rejectedForMe = useMemo(
    () =>
      myTasks
        .filter((t) => t.status === 'initiated' && t.owner_id === profile.id)
        .map((t) => ({ ...t, assigneeName: null })),
    [myTasks, profile.id]
  )

  const unreadCount = notifications.filter((n) => !n.is_read).length

  const progressPercent = useMemo(() => {
    if (myTasks.length === 0) return 0
    const done = myTasks.filter((t) => t.status === 'completed').length
    return (done / myTasks.length) * 100
  }, [myTasks])

  return (
    <Shell
      teams={teams}
      teamFilter={teamFilter}
      setTeamFilter={setTeamFilter}
      notifCount={unreadCount}
      onBellClick={() => setShowNotifs((s) => !s)}
      progressPercent={progressPercent}
    >
      <RejectionBanner tasks={rejectedForMe} onDismiss={() => {}} />

      <div style={styles.viewTabRow}>
        <button onClick={() => { setView('mine'); setStatusFilter('all') }} style={{ ...styles.viewTab, ...(view === 'mine' ? styles.viewTabActive : {}) }}>
          My tasks
        </button>
        <button onClick={() => { setView('team'); setStatusFilter('all') }} style={{ ...styles.viewTab, ...(view === 'team' ? styles.viewTabActive : {}) }}>
          Team tasks
        </button>
      </div>

      <div style={styles.topBar}>
        <div style={styles.filters}>
          {(view === 'mine' ? MY_STATUS_FILTERS : TEAM_STATUS_FILTERS).map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              style={{ ...styles.filterBtn, ...(statusFilter === f.key ? styles.filterBtnActive : {}) }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={() => setShowNewTask(true)} style={styles.newBtn}>
          <i className="ti ti-plus" style={{ fontSize: 14 }} aria-hidden="true" /> New task
        </button>
      </div>

      {view === 'team' && (
        <div style={styles.employeeFilterRow}>
          <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} style={styles.employeeSelect}>
            <option value="">All employees</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
          {employeeFilter && (
            <button onClick={() => setEmployeeFilter('')} style={styles.clearEmployeeBtn}>Clear</button>
          )}
        </div>
      )}

      {loadError ? (
        <div style={styles.emptyState}>
          <p style={{ ...styles.emptyTitle, color: 'var(--danger)' }}>Couldn't load tasks</p>
          <p style={styles.emptySub}>{loadError}</p>
          <button onClick={loadAll} style={styles.retryBtn}>Try again</button>
        </div>
      ) : loading ? (
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>Loading tasks…</p>
      ) : filteredTasks.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={styles.emptyTitle}>No tasks here</p>
          <p style={styles.emptySub}>Create one to get started.</p>
        </div>
      ) : (
        filteredTasks.map((t) => (
          <TaskCard key={t.id} task={t} onClick={() => setSelectedTaskId(t.id)} />
        ))
      )}

      {selectedTaskId && (
        <TaskDetail
          taskId={selectedTaskId}
          people={people}
          allTasks={activeTasks}
          onClose={() => setSelectedTaskId(null)}
          onChanged={loadAll}
        />
      )}

      {showNewTask && (
        <NewTaskModal
          teams={teams}
          people={people}
          projects={projects}
          onClose={() => setShowNewTask(false)}
          onCreated={() => { setShowNewTask(false); loadAll() }}
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
  viewTabRow: { display: 'flex', gap: 4, marginBottom: 18, background: 'var(--surface-2)', borderRadius: 999, padding: 4, width: 'fit-content' },
  viewTab: { fontSize: 13, fontWeight: 700, padding: '7px 18px', borderRadius: 999, border: 'none', background: 'none', color: 'var(--text-2)' },
  viewTabActive: { background: 'var(--surface)', color: 'var(--bupa-blue)', boxShadow: '0 1px 4px rgba(0,80,160,0.1)' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 16, flexWrap: 'wrap' },
  filters: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  filterBtn: {
    fontSize: 13, padding: '6px 14px', borderRadius: 999, border: '1px solid var(--border)',
    background: 'var(--surface)', color: 'var(--text-2)', transition: 'all 0.15s', fontWeight: 600,
  },
  filterBtnActive: {
    background: 'var(--bupa-blue)', color: '#fff', borderColor: 'var(--bupa-blue)',
  },
  newBtn: {
    display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, padding: '9px 18px',
    borderRadius: 'var(--radius)', border: 'none',
    background: 'linear-gradient(135deg, #0050A0, #2D8FE0)',
    color: '#fff', flexShrink: 0, transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,80,160,0.2)',
  },
  employeeFilterRow: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 18 },
  employeeSelect: { fontSize: 12.5, padding: '7px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-2)' },
  clearEmployeeBtn: { fontSize: 12.5, padding: '7px 12px', borderRadius: 'var(--radius)', border: 'none', background: 'none', color: 'var(--bupa-blue)', fontWeight: 600 },
  emptyState: { textAlign: 'center', padding: '60px 0', color: 'var(--text-3)' },
  emptyTitle: { fontSize: 15, fontWeight: 700, color: 'var(--text-2)', margin: '0 0 4px' },
  emptySub: { fontSize: 13, margin: 0 },
  retryBtn: { marginTop: 14, fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--bupa-blue)', color: '#fff' },
}
