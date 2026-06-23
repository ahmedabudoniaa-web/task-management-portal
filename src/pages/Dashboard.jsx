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
import { isMBM, isDirector, peopleVisibleForTeam, peopleIManage, managedTeamIds } from '../lib/permissions'

const MY_STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'initiated', label: 'To Do' },
  { key: 'pending_acceptance', label: 'Pending acceptance' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'completed', label: 'Completed' },
]

const TEAM_STATUS_FILTERS = MY_STATUS_FILTERS


function isTaskOverdue(task) {
  return !['completed', 'done', 'cancelled', 'canceled'].includes(task.status) && task.target_date && new Date(task.target_date) < new Date()
}

function isDueThisWeek(task) {
  if (!task.target_date || ['completed', 'done', 'cancelled', 'canceled'].includes(task.status)) return false
  const now = new Date()
  const due = new Date(task.target_date)
  const weekAhead = new Date(now)
  weekAhead.setDate(now.getDate() + 7)
  return due >= now && due <= weekAhead
}

function getPriorityRank(priority) {
  const ranks = { urgent: 0, high: 1, medium: 2, low: 3 }
  return ranks[priority] ?? 4
}

function sortTasksForWork(tasks) {
  return [...tasks].sort((a, b) => {
    const overdueDiff = Number(isTaskOverdue(b)) - Number(isTaskOverdue(a))
    if (overdueDiff) return overdueDiff

    const completedDiff = Number(a.status === 'completed') - Number(b.status === 'completed')
    if (completedDiff) return completedDiff

    const priorityDiff = getPriorityRank(a.priority) - getPriorityRank(b.priority)
    if (priorityDiff) return priorityDiff

    const aDate = a.target_date ? new Date(a.target_date).getTime() : Number.MAX_SAFE_INTEGER
    const bDate = b.target_date ? new Date(b.target_date).getTime() : Number.MAX_SAFE_INTEGER
    if (aDate !== bDate) return aDate - bDate

    return new Date(b.created_at || 0) - new Date(a.created_at || 0)
  })
}

function buildTaskSections(tasks) {
  const sorted = sortTasksForWork(tasks)
  const sections = [
    { key: 'overdue', title: 'Overdue', icon: '🔥', tone: 'danger', tasks: [] },
    { key: 'urgent', title: 'Urgent & high priority', icon: '⚡', tone: 'warning', tasks: [] },
    { key: 'this_week', title: 'Due this week', icon: '📅', tone: 'info', tasks: [] },
    { key: 'in_progress', title: 'In progress', icon: '🚀', tone: 'info', tasks: [] },
    { key: 'other', title: 'To Do', icon: '📌', tone: 'neutral', tasks: [] },
    { key: 'completed', title: 'Completed / cancelled', icon: '✅', tone: 'success', tasks: [] },
  ]

  for (const task of sorted) {
    if (['completed', 'done', 'cancelled', 'canceled'].includes(task.status)) sections[5].tasks.push(task)
    else if (isTaskOverdue(task)) sections[0].tasks.push(task)
    else if (task.priority === 'urgent' || task.priority === 'high') sections[1].tasks.push(task)
    else if (isDueThisWeek(task)) sections[2].tasks.push(task)
    else if (task.status === 'in_progress' || task.status === 'blocked' || task.status === 'pending_acceptance') sections[3].tasks.push(task)
    else sections[4].tasks.push(task)
  }

  return sections.filter((section) => section.tasks.length > 0)
}

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

  const canViewTeamTasks = isMBM(profile) || isDirector(profile)
  const managedTeams = managedTeamIds(profile)
  const activeTasks = view === 'mine' ? myTasks : teamTasks

  const filteredTasks = useMemo(() => {
    if (statusFilter === 'all') return activeTasks
    return activeTasks.filter((t) => t.status === statusFilter)
  }, [activeTasks, statusFilter])

  const taskSections = useMemo(() => buildTaskSections(filteredTasks), [filteredTasks])

  const taskSummary = useMemo(() => {
    const open = filteredTasks.filter((t) => !['completed', 'done', 'cancelled', 'canceled'].includes(t.status)).length
    const overdue = filteredTasks.filter(isTaskOverdue).length
    const dueThisWeek = filteredTasks.filter(isDueThisWeek).length
    const completed = filteredTasks.filter((t) => ['completed', 'done'].includes(t.status)).length
    const cancelled = filteredTasks.filter((t) => ['cancelled', 'canceled'].includes(t.status)).length
    return { open, overdue, dueThisWeek, completed, cancelled }
  }, [filteredTasks])

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
    const done = myTasks.filter((t) => ['completed', 'done'].includes(t.status)).length
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
        {canViewTeamTasks && (
          <button onClick={() => { setView('team'); setStatusFilter('all') }} style={{ ...styles.viewTab, ...(view === 'team' ? styles.viewTabActive : {}) }}>
            {isMBM(profile) ? 'All teams tasks' : 'My team tasks'}
          </button>
        )}
      </div>

      {view === 'team' && !isMBM(profile) && managedTeams.length > 0 && (
        <p style={styles.scopeNote}>Showing only teams you manage. Engineering and Operations can share the same director.</p>
      )}

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
            {peopleIManage(profile, people).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
          {employeeFilter && (
            <button onClick={() => setEmployeeFilter('')} style={styles.clearEmployeeBtn}>Clear</button>
          )}
        </div>
      )}

      <div style={styles.summaryGrid}>
        <SummaryCard label="Open tasks" value={taskSummary.open} icon="📋" />
        <SummaryCard label="Overdue" value={taskSummary.overdue} icon="🔥" tone="danger" />
        <SummaryCard label="Due this week" value={taskSummary.dueThisWeek} icon="📅" tone="info" />
        <SummaryCard label="Completed" value={taskSummary.completed} icon="✅" tone="success" />
        <SummaryCard label="Cancelled" value={taskSummary.cancelled} icon="⊘" />
      </div>

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
        <div style={styles.sectionsWrap}>
          {taskSections.map((section) => (
            <TaskSection
              key={section.key}
              section={section}
              onSelectTask={(id) => setSelectedTaskId(id)}
            />
          ))}
        </div>
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

function SummaryCard({ label, value, icon, tone }) {
  return (
    <div style={{ ...styles.summaryCard, ...(tone === 'danger' ? styles.summaryDanger : {}), ...(tone === 'info' ? styles.summaryInfo : {}), ...(tone === 'success' ? styles.summarySuccess : {}) }}>
      <span style={styles.summaryIcon}>{icon}</span>
      <div>
        <p style={styles.summaryLabel}>{label}</p>
        <p style={styles.summaryValue}>{value}</p>
      </div>
    </div>
  )
}

function TaskSection({ section, onSelectTask }) {
  return (
    <section style={styles.taskSection}>
      <div style={styles.sectionHeader}>
        <div style={styles.sectionTitleWrap}>
          <span style={styles.sectionIcon}>{section.icon}</span>
          <div>
            <h3 style={styles.sectionTitle}>{section.title}</h3>
            <p style={styles.sectionSub}>{section.tasks.length} task{section.tasks.length === 1 ? '' : 's'}</p>
          </div>
        </div>
        <span style={{ ...styles.sectionCount, ...(section.tone === 'danger' ? styles.countDanger : {}), ...(section.tone === 'warning' ? styles.countWarning : {}), ...(section.tone === 'success' ? styles.countSuccess : {}) }}>
          {section.tasks.length}
        </span>
      </div>
      <div style={styles.taskList}>
        {section.tasks.map((t) => (
          <TaskCard key={t.id} task={t} onClick={() => onSelectTask(t.id)} />
        ))}
      </div>
    </section>
  )
}

const styles = {
  viewTabRow: { display: 'flex', gap: 4, marginBottom: 18, background: 'var(--surface-2)', borderRadius: 999, padding: 4, width: 'fit-content' },
  viewTab: { fontSize: 13, fontWeight: 700, padding: '7px 18px', borderRadius: 999, border: 'none', background: 'none', color: 'var(--text-2)' },
  viewTabActive: { background: 'var(--surface)', color: 'var(--bupa-blue)', boxShadow: '0 1px 4px rgba(0,80,160,0.1)' },
  scopeNote: { fontSize: 12.5, color: 'var(--text-3)', margin: '-8px 0 14px' },
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
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 18 },
  summaryCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 8px rgba(0,80,160,0.05)' },
  summaryDanger: { background: 'var(--danger-light)' },
  summaryInfo: { background: 'var(--info-light)' },
  summarySuccess: { background: 'var(--success-light)' },
  summaryIcon: { width: 34, height: 34, borderRadius: 12, background: 'rgba(255,255,255,0.75)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 },
  summaryLabel: { fontSize: 11.5, color: 'var(--text-3)', margin: '0 0 3px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' },
  summaryValue: { fontSize: 22, lineHeight: 1, fontWeight: 900, color: 'var(--text)', margin: 0 },
  sectionsWrap: { display: 'flex', flexDirection: 'column', gap: 18 },
  taskSection: { background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '14px 14px 4px', border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,80,160,0.04)' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10 },
  sectionTitleWrap: { display: 'flex', alignItems: 'center', gap: 10 },
  sectionIcon: { width: 36, height: 36, borderRadius: 12, background: 'var(--surface-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 },
  sectionTitle: { fontSize: 15, fontWeight: 900, margin: 0, color: 'var(--text)' },
  sectionSub: { fontSize: 11.5, color: 'var(--text-3)', margin: '2px 0 0' },
  sectionCount: { minWidth: 30, height: 30, borderRadius: 999, background: 'var(--surface-2)', color: 'var(--text-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900 },
  countDanger: { background: 'var(--danger-light)', color: 'var(--danger)' },
  countWarning: { background: 'var(--warning-light)', color: 'var(--warning)' },
  countSuccess: { background: 'var(--success-light)', color: 'var(--success)' },
  taskList: { display: 'flex', flexDirection: 'column' },
}
