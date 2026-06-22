import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../lib/AuthContext'
import { fetchTasks, fetchTeams, fetchProfiles, fetchNotifications, markNotificationRead } from '../lib/tasks'
import Shell from '../components/Shell'
import TaskCard from '../components/TaskCard'
import TaskDetail from '../components/TaskDetail'
import NewTaskModal from '../components/NewTaskModal'
import RejectionBanner from '../components/RejectionBanner'
import NotificationsPanel from '../components/NotificationsPanel'

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unassigned', label: 'Unassigned' },
  { key: 'pending_acceptance', label: 'Pending acceptance' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'done', label: 'Done' },
]

export default function Dashboard() {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState([])
  const [teams, setTeams] = useState([])
  const [people, setPeople] = useState([])
  const [notifications, setNotifications] = useState([])
  const [teamFilter, setTeamFilter] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedTaskId, setSelectedTaskId] = useState(null)
  const [showNewTask, setShowNewTask] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)
  const [loading, setLoading] = useState(true)

  async function loadAll() {
    setLoading(true)
    const [t, tm, p, n] = await Promise.all([
      fetchTasks({ profile, teamFilter }),
      fetchTeams(),
      fetchProfiles(),
      fetchNotifications(profile.id),
    ])
    setTasks(t)
    setTeams(tm)
    setPeople(p)
    setNotifications(n)
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [teamFilter])

  const filteredTasks = useMemo(() => {
    if (statusFilter === 'all') return tasks
    return tasks.filter((t) => t.status === statusFilter)
  }, [tasks, statusFilter])

  const rejectedForMe = useMemo(
    () =>
      tasks
        .filter((t) => t.status === 'unassigned' && t.owner_id === profile.id)
        .map((t) => ({ ...t, assigneeName: null })),
    [tasks, profile.id]
  )

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <Shell
      teams={teams}
      teamFilter={teamFilter}
      setTeamFilter={setTeamFilter}
      notifCount={unreadCount}
      onBellClick={() => setShowNotifs((s) => !s)}
    >
      <RejectionBanner tasks={rejectedForMe} onDismiss={() => {}} />

      <div style={styles.topBar}>
        <div style={styles.filters}>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              style={{
                ...styles.filterBtn,
                ...(statusFilter === f.key ? styles.filterBtnActive : {}),
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={() => setShowNewTask(true)} style={styles.newBtn}>
          <i className="ti ti-plus" style={{ fontSize: 14 }} aria-hidden="true" /> New task
        </button>
      </div>

      {loading ? (
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
          onClose={() => setSelectedTaskId(null)}
          onChanged={loadAll}
        />
      )}

      {showNewTask && (
        <NewTaskModal
          teams={teams}
          people={people}
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
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 16, flexWrap: 'wrap' },
  filters: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  filterBtn: {
    fontSize: 13, padding: '6px 14px', borderRadius: 999, border: '1px solid var(--border)',
    background: 'var(--surface)', color: 'var(--text-2)',
  },
  filterBtnActive: { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' },
  newBtn: {
    display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, padding: '8px 16px',
    borderRadius: 'var(--radius)', border: 'none', background: 'var(--accent)', color: '#fff', flexShrink: 0,
  },
  emptyState: { textAlign: 'center', padding: '60px 0', color: 'var(--text-3)' },
  emptyTitle: { fontSize: 15, fontWeight: 600, color: 'var(--text-2)', margin: '0 0 4px' },
  emptySub: { fontSize: 13, margin: 0 },
}
