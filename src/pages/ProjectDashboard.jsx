import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { fetchProjectDetail } from '../lib/projects'
import { fetchTeams } from '../lib/tasks'
import { fetchRisks, fetchIssues, fetchDecisions } from '../lib/risks'
import { isActiveProject } from '../lib/dashboard'
import Shell from '../components/Shell'

const TASK_DONE_STATUSES = ['completed', 'done', 'cancelled', 'canceled']
const TASK_STATUS_ORDER = ['initiated', 'pending_acceptance', 'in_progress', 'blocked', 'completed', 'cancelled']
const PHASE_STATUS_ORDER = ['not_started', 'in_progress', 'blocked', 'done']
const OPEN_RISK_STATUSES = ['open', 'monitoring', 'active']
const OPEN_ISSUE_STATUSES = ['open', 'in_progress', 'active']

function isPast(date) {
  if (!date) return false
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(date); d.setHours(0, 0, 0, 0)
  return d < today
}
function daysUntil(date) {
  if (!date) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(date); d.setHours(0, 0, 0, 0)
  return Math.ceil((d - today) / (1000 * 60 * 60 * 24))
}
function formatDate(date) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function pct(value) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}
function projectProgress(project) {
  if (typeof project?.percent_complete === 'number') return project.percent_complete
  const phases = project?.milestones || []
  if (phases.length === 0) return 0
  return phases.reduce((s, ph) => s + (ph.percent_complete || 0), 0) / phases.length
}

export default function ProjectDashboard() {
  const { projectId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [teams, setTeams] = useState([])
  const [project, setProject] = useState(null)
  const [risks, setRisks] = useState([])
  const [issues, setIssues] = useState([])
  const [decisions, setDecisions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  async function loadAll() {
    setLoading(true); setLoadError(null)
    try {
      const [tm, proj, riskData, issueData, decisionData] = await Promise.all([
        fetchTeams(),
        fetchProjectDetail(projectId),
        fetchRisks({ profile, projectId }),
        fetchIssues({ profile, projectId }),
        fetchDecisions({ profile, projectId }),
      ])
      setTeams(tm); setProject(proj); setRisks(riskData); setIssues(issueData); setDecisions(decisionData)
    } catch (err) {
      setLoadError(err.message || 'Could not load project dashboard.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { loadAll() }, [projectId])

  const metrics = useMemo(() => {
    if (!project) return null
    const phases = project.milestones || []
    const tasks = project.tasks || []
    const donePhases = phases.filter((p) => p.status === 'done').length
    const openTasks = tasks.filter((t) => !TASK_DONE_STATUSES.includes(t.status))
    const overdueTasks = openTasks.filter((t) => isPast(t.target_date))
    const completedTasks = tasks.filter((t) => t.status === 'completed' || t.status === 'done').length
    const openRisks = risks.filter((r) => OPEN_RISK_STATUSES.includes(r.status || 'open')).length
    const openIssues = issues.filter((i) => OPEN_ISSUE_STATUSES.includes(i.status || 'open')).length
    const pendingDecisions = decisions.filter((d) => !['done', 'closed', 'approved'].includes(d.status || 'open')).length
    const daysLeft = daysUntil(project.target_completion_date)
    return {
      progress: pct(projectProgress(project)),
      phases: phases.length,
      donePhases,
      totalTasks: tasks.length,
      openTasks: openTasks.length,
      overdueTasks: overdueTasks.length,
      completedTasks,
      openRisks,
      openIssues,
      pendingDecisions,
      daysLeft,
      onTrack: daysLeft === null ? null : daysLeft >= 0 || !isActiveProject(project),
    }
  }, [project, risks, issues, decisions])

  const phaseRows = useMemo(() => {
    if (!project) return []
    return [...(project.milestones || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  }, [project])

  const taskBreakdown = useMemo(() => {
    if (!project) return []
    const tasks = project.tasks || []
    return TASK_STATUS_ORDER
      .map((value) => ({ value, count: tasks.filter((t) => t.status === value).length }))
      .filter((row) => row.count > 0)
  }, [project])

  const healthHistory = useMemo(() => {
    if (!project) return []
    return [...(project.project_health_log || [])]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 6)
  }, [project])

  const h = healthMap(project?.health)

  return (
    <Shell teams={teams} teamFilter={null} setTeamFilter={() => {}} notifCount={0} onBellClick={() => {}}>
      <button onClick={() => navigate(`/projects/${projectId}`)} style={styles.backLink}>← Back to project</button>

      {loadError ? (
        <div style={styles.emptyState}>
          <p style={styles.errorTitle}>Couldn&apos;t load project dashboard</p>
          <p style={styles.emptySub}>{loadError}</p>
          <button onClick={loadAll} style={styles.primaryBtn}>Try again</button>
        </div>
      ) : loading || !metrics ? (
        <p style={styles.loadingText}>Loading project dashboard…</p>
      ) : (
        <>
          <div style={styles.heroRow}>
            <div>
              <p style={styles.eyebrow}>{project.team?.name || 'Project'} · Dashboard</p>
              <h1 style={styles.pageTitle}>{project.name}</h1>
              <p style={styles.pageSub}>
                {project.status?.replaceAll('_', ' ')} · target {formatDate(project.target_completion_date)}
              </p>
            </div>
            <div style={styles.heroActions}>
              <span style={{ ...styles.healthBadge, background: h.bg, color: h.text }}>
                <span style={{ ...styles.healthDot, background: h.text }} />{h.label}
              </span>
              <button onClick={() => navigate(`/projects/${projectId}`)} style={styles.secondaryBtn}>Open project</button>
            </div>
          </div>

          <div style={styles.kpiGrid}>
            <KpiCard label="Progress" value={`${metrics.progress}%`} sub="overall completion" icon="◉" tone="info" />
            <KpiCard label="Phases" value={`${metrics.donePhases}/${metrics.phases}`} sub="completed" icon="◆" />
            <KpiCard label="Open tasks" value={metrics.openTasks} sub={`${metrics.overdueTasks} overdue`} icon="▣" tone={metrics.overdueTasks ? 'danger' : undefined} />
            <KpiCard
              label="Schedule"
              value={metrics.daysLeft === null ? 'No target' : metrics.daysLeft < 0 ? `${Math.abs(metrics.daysLeft)}d over` : `${metrics.daysLeft}d left`}
              sub={metrics.onTrack === false ? 'past target' : 'to target date'}
              icon="!"
              tone={metrics.onTrack === false ? 'danger' : 'success'}
            />
            <KpiCard label="Risks / Issues" value={`${metrics.openRisks}/${metrics.openIssues}`} sub="open" icon="◇" tone="purple" />
            <KpiCard label="Pending decisions" value={metrics.pendingDecisions} sub="awaiting" icon="→" tone={metrics.pendingDecisions ? 'warning' : undefined} />
          </div>

          <div style={styles.bigProgressTrack}><div style={{ ...styles.bigProgressFill, width: `${metrics.progress}%` }} /></div>

          <div style={styles.twoColGrid}>
            <Panel title="Phase Progress" action={`${metrics.phases} phases`}>
              {phaseRows.length === 0 ? <EmptyLine text="No phases yet." /> : phaseRows.map((phase) => (
                <div key={phase.id} style={styles.phaseRow}>
                  <div style={styles.phaseTop}>
                    <strong style={styles.rowTitle}>{phase.name}</strong>
                    <span style={phase.status === 'done' ? styles.badgeSuccess : phase.status === 'blocked' ? styles.badgeDanger : styles.badgeNeutral}>
                      {phase.status?.replaceAll('_', ' ')}
                    </span>
                  </div>
                  <div style={styles.barTrack}><div style={{ ...styles.barFill, width: `${pct(phase.percent_complete)}%` }} /></div>
                </div>
              ))}
            </Panel>

            <Panel title="Tasks by Status" action={`${metrics.totalTasks} total`}>
              {taskBreakdown.length === 0 ? <EmptyLine text="No tasks yet." /> : (
                <div style={styles.statusList}>
                  {taskBreakdown.map((row) => (
                    <div key={row.value} style={styles.statusItem}>
                      <span style={styles.statusDot} />
                      <span style={styles.statusLabel}>{row.value.replaceAll('_', ' ')}</span>
                      <strong>{row.count}</strong>
                      <span style={styles.statusPct}>{metrics.totalTasks ? pct((row.count / metrics.totalTasks) * 100) : 0}%</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <Panel title="Health History" action="reason log">
            {healthHistory.length === 0 ? <EmptyLine text="No health changes recorded." /> : healthHistory.map((entry) => {
              const eh = healthMap(entry.new_health || entry.health)
              return (
                <div key={entry.id} style={styles.historyRow}>
                  <span style={{ ...styles.healthDotSm, background: eh.text }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <strong style={styles.rowTitle}>{entry.reason || 'No reason given'}</strong>
                    <span style={styles.rowSub}>
                      {eh.label}{entry.changer?.full_name ? ` · ${entry.changer.full_name}` : ''} · {formatDate(entry.created_at)}
                    </span>
                  </span>
                </div>
              )
            })}
          </Panel>
        </>
      )}
    </Shell>
  )
}

function healthMap(health) {
  const map = {
    green: { label: 'On track', bg: 'var(--success-light)', text: 'var(--success)' },
    amber: { label: 'At risk', bg: 'var(--warning-light)', text: 'var(--warning)' },
    red: { label: 'Critical', bg: 'var(--danger-light)', text: 'var(--danger)' },
  }
  return map[health] || map.green
}

function KpiCard({ label, value, sub, icon, tone }) {
  return (
    <div style={{ ...styles.kpiCard, ...(tone ? styles[`kpi_${tone}`] : {}) }}>
      <div>
        <p style={styles.kpiLabel}>{label}</p>
        <p style={styles.kpiValue}>{value}</p>
        <p style={styles.kpiSub}>{sub}</p>
      </div>
      <span style={styles.kpiIcon}>{icon}</span>
    </div>
  )
}
function Panel({ title, action, children }) {
  return (
    <section style={styles.panel}>
      <div style={styles.panelHeader}>
        <h2 style={styles.panelTitle}>{title}</h2>
        {action && <span style={styles.panelAction}>{action}</span>}
      </div>
      {children}
    </section>
  )
}
function EmptyLine({ text }) { return <p style={styles.emptyLine}>{text}</p> }

const styles = {
  backLink: { border: 'none', background: 'transparent', color: 'var(--bupa-blue)', fontWeight: 750, fontSize: 13, padding: 0, marginBottom: 14, cursor: 'pointer' },
  heroRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, marginBottom: 20, flexWrap: 'wrap' },
  eyebrow: { fontSize: 11.5, fontWeight: 900, color: 'var(--bupa-blue)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 5px' },
  pageTitle: { fontSize: 28, fontWeight: 900, color: 'var(--text)', margin: 0 },
  pageSub: { fontSize: 13.5, color: 'var(--text-2)', margin: '6px 0 0', textTransform: 'capitalize' },
  heroActions: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  secondaryBtn: { border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 750, fontSize: 13, padding: '10px 16px', cursor: 'pointer' },
  primaryBtn: { border: 'none', borderRadius: 'var(--radius)', background: 'linear-gradient(135deg, #0050A0, #2D8FE0)', color: '#fff', fontWeight: 800, fontSize: 13, padding: '10px 16px', cursor: 'pointer' },
  loadingText: { color: 'var(--text-2)', fontSize: 14 },
  emptyState: { textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 40 },
  errorTitle: { fontSize: 16, color: 'var(--danger)', fontWeight: 900, margin: '0 0 6px' },
  emptySub: { fontSize: 13, color: 'var(--text-2)', margin: '0 0 16px' },
  healthBadge: { display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 800, borderRadius: 999, padding: '7px 13px' },
  healthDot: { width: 8, height: 8, borderRadius: 999 },
  healthDotSm: { width: 8, height: 8, borderRadius: 999, flexShrink: 0 },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 14 },
  kpiCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 17px', boxShadow: '0 2px 10px rgba(0,80,160,0.06)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' },
  kpi_success: { background: 'linear-gradient(135deg, var(--surface), var(--success-light))' },
  kpi_warning: { background: 'linear-gradient(135deg, var(--surface), var(--warning-light))' },
  kpi_danger: { background: 'linear-gradient(135deg, var(--surface), var(--danger-light))' },
  kpi_info: { background: 'linear-gradient(135deg, var(--surface), var(--info-light))' },
  kpi_purple: { background: 'linear-gradient(135deg, var(--surface), rgba(123,92,255,0.12))' },
  kpiLabel: { fontSize: 11.5, color: 'var(--text-3)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.03em', margin: '0 0 6px' },
  kpiValue: { fontSize: 25, fontWeight: 950, color: 'var(--text)', lineHeight: 1, margin: 0 },
  kpiSub: { fontSize: 12, color: 'var(--text-2)', margin: '6px 0 0' },
  kpiIcon: { width: 42, height: 42, borderRadius: 14, background: 'rgba(255,255,255,0.72)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bupa-blue)', fontWeight: 900, fontSize: 18, flexShrink: 0 },
  bigProgressTrack: { height: 14, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden', marginBottom: 18 },
  bigProgressFill: { height: '100%', borderRadius: 999, background: 'linear-gradient(135deg, #0050A0, #2DA86A)' },
  twoColGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginBottom: 14 },
  panel: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 18px', boxShadow: '0 2px 10px rgba(0,80,160,0.05)', marginBottom: 14 },
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14 },
  panelTitle: { fontSize: 15, color: 'var(--text)', fontWeight: 900, margin: 0 },
  panelAction: { fontSize: 11.5, color: 'var(--text-3)', fontWeight: 750, background: 'var(--surface-2)', padding: '4px 9px', borderRadius: 999, whiteSpace: 'nowrap' },
  phaseRow: { padding: '9px 0', borderBottom: '1px solid var(--border)' },
  phaseTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 7 },
  barTrack: { height: 9, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999, background: 'linear-gradient(135deg, #0050A0, #2DA86A)' },
  statusList: { display: 'flex', flexDirection: 'column', gap: 9 },
  statusItem: { display: 'grid', gridTemplateColumns: '12px 1fr auto auto', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-2)' },
  statusDot: { width: 8, height: 8, borderRadius: 999, background: 'var(--bupa-blue)' },
  statusLabel: { textTransform: 'capitalize' },
  statusPct: { color: 'var(--text-3)', fontSize: 11.5 },
  historyRow: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' },
  rowTitle: { display: 'block', fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis' },
  rowSub: { display: 'block', fontSize: 11.5, color: 'var(--text-3)', marginTop: 2, textTransform: 'capitalize' },
  badgeNeutral: { fontSize: 11.5, fontWeight: 800, borderRadius: 999, padding: '4px 8px', background: 'var(--surface-2)', color: 'var(--text-2)', textTransform: 'capitalize', whiteSpace: 'nowrap' },
  badgeSuccess: { fontSize: 11.5, fontWeight: 800, borderRadius: 999, padding: '4px 8px', background: 'var(--success-light)', color: 'var(--success)', textTransform: 'capitalize', whiteSpace: 'nowrap' },
  badgeDanger: { fontSize: 11.5, fontWeight: 800, borderRadius: 999, padding: '4px 8px', background: 'var(--danger-light)', color: 'var(--danger)', textTransform: 'capitalize', whiteSpace: 'nowrap' },
  emptyLine: { fontSize: 13, color: 'var(--text-3)', margin: 0, fontStyle: 'italic' },
}
