import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../lib/AuthContext'
import { fetchActions } from '../lib/governance'
import { fetchTeams, fetchProfiles, fetchNotifications, markNotificationRead } from '../lib/tasks'
import Shell from '../components/Shell'
import ActionCard from '../components/ActionCard'
import ActionDetail from '../components/ActionDetail'
import NewActionModal from '../components/NewActionModal'
import NotificationsPanel from '../components/NotificationsPanel'

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'done', label: 'Done' },
]

export default function Actions() {
  const { profile } = useAuth()
  const [actions, setActions] = useState([])
  const [teams, setTeams] = useState([])
  const [people, setPeople] = useState([])
  const [notifications, setNotifications] = useState([])
  const [teamFilter, setTeamFilter] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedActionId, setSelectedActionId] = useState(null)
  const [showNewAction, setShowNewAction] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  async function loadAll() {
    setLoading(true)
    setLoadError(null)
    try {
      const [a, tm, ppl, n] = await Promise.all([
        fetchActions({ profile, teamFilter }),
        fetchTeams(),
        fetchProfiles(),
        fetchNotifications(profile.id),
      ])
      setActions(a)
      setTeams(tm)
      setPeople(ppl)
      setNotifications(n)
    } catch (err) {
      setLoadError(err.message || 'Could not load actions.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [teamFilter])

  const filteredActions = useMemo(() => {
    if (statusFilter === 'all') return actions
    if (statusFilter === 'overdue') {
      return actions.filter((a) => a.due_date && new Date(a.due_date) < new Date() && a.status !== 'done' && a.status !== 'cancelled')
    }
    return actions.filter((a) => a.status === statusFilter)
  }, [actions, statusFilter])

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <Shell teams={teams} teamFilter={teamFilter} setTeamFilter={setTeamFilter} notifCount={unreadCount} onBellClick={() => setShowNotifs((s) => !s)}>
      <div style={styles.topBar}>
        <h1 style={styles.pageTitle}>Action tracker</h1>
        <button onClick={() => setShowNewAction(true)} style={styles.newBtn}>
          <i className="ti ti-plus" style={{ fontSize: 14 }} aria-hidden="true" /> New action
        </button>
      </div>

      <div style={styles.filters}>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key} onClick={() => setStatusFilter(f.key)}
            style={{ ...styles.filterBtn, ...(statusFilter === f.key ? styles.filterBtnActive : {}) }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loadError ? (
        <div style={styles.emptyState}>
          <p style={{ ...styles.emptyTitle, color: 'var(--danger)' }}>Couldn't load actions</p>
          <p style={styles.emptySub}>{loadError}</p>
          <button onClick={loadAll} style={styles.retryBtn}>Try again</button>
        </div>
      ) : loading ? (
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>Loading actions…</p>
      ) : filteredActions.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={styles.emptyTitle}>No actions here</p>
          <p style={styles.emptySub}>Create one to track a leadership or committee follow-up.</p>
        </div>
      ) : (
        filteredActions.map((a) => (
          <ActionCard key={a.id} action={a} onClick={() => setSelectedActionId(a.id)} />
        ))
      )}

      {selectedActionId && (
        <ActionDetail actionId={selectedActionId} onClose={() => setSelectedActionId(null)} onChanged={loadAll} />
      )}

      {showNewAction && (
        <NewActionModal teams={teams} people={people} onClose={() => setShowNewAction(false)} onCreated={() => { setShowNewAction(false); loadAll() }} />
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
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 16, flexWrap: 'wrap' },
  pageTitle: { fontSize: 19, fontWeight: 700, margin: 0, color: 'var(--text)' },
  filters: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 },
  filterBtn: { fontSize: 13, padding: '6px 14px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)', fontWeight: 600 },
  filterBtnActive: { background: 'var(--bupa-blue)', color: '#fff', borderColor: 'var(--bupa-blue)' },
  newBtn: {
    display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, padding: '9px 18px',
    borderRadius: 'var(--radius)', border: 'none', background: 'linear-gradient(135deg, #0050A0, #2D8FE0)',
    color: '#fff', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,80,160,0.2)',
  },
  emptyState: { textAlign: 'center', padding: '60px 0', color: 'var(--text-3)' },
  emptyTitle: { fontSize: 15, fontWeight: 700, color: 'var(--text-2)', margin: '0 0 4px' },
  emptySub: { fontSize: 13, margin: 0 },
  retryBtn: { marginTop: 14, fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--bupa-blue)', color: '#fff' },
}
