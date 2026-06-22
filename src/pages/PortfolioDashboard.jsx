import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { fetchProjects } from '../lib/projects'
import { fetchTasks, fetchTeams, fetchNotifications, markNotificationRead } from '../lib/tasks'
import { fetchActions } from '../lib/governance'
import { fetchRisks, fetchIssues, fetchDecisions } from '../lib/risks'
import Shell from '../components/Shell'
import NotificationsPanel from '../components/NotificationsPanel'

const CLOSED_PROJECT_STATUSES = ['closed']
const DONE_TASK_STATUSES = ['completed', 'done', 'cancelled', 'canceled']
const OPEN_ACTION_STATUSES = ['open', 'in_progress']
const OPEN_RISK_STATUSES = ['open', 'monitoring', 'active']
const OPEN_ISSUE_STATUSES = ['open', 'in_progress', 'active']

function isPast(date) {
  if (!date) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d < today
}

function daysUntil(date) {
  if (!date) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
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

function groupCount(items, key, values) {
  return values.map((value) => ({ value, count: items.filter((item) => item[key] === value).length }))
}

function calculateProjectProgress(project) {
  if (typeof project.percent_complete === 'number') return project.percent_complete
  const phases = project.milestones || []
  if (phases.length === 0) return 0
  const total = phases.reduce((sum, phase) => sum + (phase.percent_complete || 0), 0)
  return total / phases.length
}

export default function PortfolioDashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [teamFilter, setTeamFilter] = useState(null)
  const [teams, setTeams] = useState([])
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [actions, setActions] = useState([])
  const [risks, setRisks] = useState([])
  const [issues, setIssues] = useState([])
  const [decisions, setDecisions] = useState([])
  const [notifications, setNotifications] = useState([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  async function loadAll() {
    setLoading(true)
    setLoadError(null)
    try {
      const [tm, proj, taskData, actionData, riskData, issueData, decisionData, notifData] = await Promise.all([
        fetchTeams(),
        fetchProjects({ profile, teamFilter }),
        fetchTasks({ profile, teamFilter, scope: 'team' }),
        fetchActions({ profile, teamFilter }),
        fetchRisks({ profile, teamFilter }),
        fetchIssues({ profile, teamFilter }),
        fetchDecisions({ profile, teamFilter }),
        fetchNotifications(profile.id),
      ])
      setTeams(tm)
      setProjects(proj)
      setTasks(taskData)
      setActions(actionData)
      setRisks(riskData)
      setIssues(issueData)
      setDecisions(decisionData)
      setNotifications(notifData)
    } catch (err) {
      setLoadError(err.message || 'Could not load portfolio dashboard.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [teamFilter])

  const metrics = useMemo(() => {
    const activeProjects = projects.filter((p) => !CLOSED_PROJECT_STATUSES.includes(p.status))
    const closedProjects = projects.filter((p) => CLOSED_PROJECT_STATUSES.includes(p.status))
    const delayedProjects = activeProjects.filter((p) => isPast(p.target_completion_date) && calculateProjectProgress(p) < 100)
    const atRiskProjects = activeProjects.filter((p) => ['red', 'amber'].includes(p.health))
    const openTasks = tasks.filter((t) => !DONE_TASK_STATUSES.includes(t.status))
    const overdueTasks = openTasks.filter((t) => isPast(t.target_date))
    const openActions = actions.filter((a) => OPEN_ACTION_STATUSES.includes(a.status))
    const overdueActions = openActions.filter((a) => isPast(a.due_date))
    const openRisks = risks.filter((r) => OPEN_RISK_STATUSES.includes(r.status || 'open'))
    const openIssues = issues.filter((i) => OPEN_ISSUE_STATUSES.includes(i.status || 'open'))
    const pendingDecisions = decisions.filter((d) => !['done', 'closed', 'approved'].includes(d.status || 'open')).length

    const totalProgress = activeProjects.length
      ? activeProjects.reduce((sum, p) => sum + calculateProjectProgress(p), 0) / activeProjects.length
      : 0

    const healthScore = projects.length
      ? ((projects.length - delayedProjects.length - atRiskProjects.length * 0.6) / projects.length) * 100
      : 0

    return {
      totalProjects: projects.length,
      activeProjects: activeProjects.length,
      closedProjects: closedProjects.length,
      delayedProjects: delayedProjects.length,
      atRiskProjects: atRiskProjects.length,
      openTasks: openTasks.length,
      overdueTasks: overdueTasks.length,
      openActions: openActions.length,
      overdueActions: overdueActions.length,
      openRisks: openRisks.length,
      openIssues: openIssues.length,
      pendingDecisions,
      totalProgress: pct(totalProgress),
      healthScore: pct(healthScore),
    }
  }, [projects, tasks, actions, risks, issues, decisions])

  const healthBreakdown = useMemo(() => groupCount(projects, 'health', ['green', 'amber', 'red']), [projects])
  const statusBreakdown = useMemo(() => groupCount(projects, 'status', ['initiation', 'planning', 'execution', 'final_review', 'closure', 'closed']), [projects])

  const upcomingPhases = useMemo(() => {
    const phases = []
    for (const project of projects) {
      for (const phase of project.milestones || []) {
        if (phase.status !== 'done' && phase.planned_date) {
          phases.push({ ...phase, projectName: project.name, projectId: project.id, days: daysUntil(phase.planned_date) })
        }
      }
    }
    return phases.sort((a, b) => new Date(a.planned_date) - new Date(b.planned_date)).slice(0, 6)
  }, [projects])

  const topRisks = useMemo(() => {
    const severityRank = { critical: 0, high: 1, medium: 2, low: 3 }
    return [...risks]
      .filter((r) => OPEN_RISK_STATUSES.includes(r.status || 'open'))
      .sort((a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9))
      .slice(0, 5)
  }, [risks])

  const recentProjects = useMemo(() => [...projects].slice(0, 6), [projects])

  const timelineProjects = useMemo(() => {
    return [...projects]
      .filter((p) => p.start_date || p.target_completion_date)
      .slice(0, 5)
      .map((p) => ({
        ...p,
        progress: pct(calculateProjectProgress(p)),
        daysLeft: p.target_completion_date ? daysUntil(p.target_completion_date) : null,
      }))
  }, [projects])

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <Shell
      teams={teams}
      teamFilter={teamFilter}
      setTeamFilter={setTeamFilter}
      notifCount={unreadCount}
      onBellClick={() => setShowNotifs((s) => !s)}
      progressPercent={metrics.healthScore}
    >
      <div style={styles.heroRow}>
        <div>
          <p style={styles.eyebrow}>Strategic Portfolio</p>
          <h1 style={styles.pageTitle}>Portfolio Dashboard</h1>
          <p style={styles.pageSub}>Executive view across projects, phases, tasks, risks, actions, and decisions.</p>
        </div>
        <div style={styles.heroActions}>
          <button onClick={() => navigate('/projects')} style={styles.secondaryBtn}>View projects</button>
          <button onClick={() => navigate('/governance')} style={styles.primaryBtn}>Governance</button>
        </div>
      </div>

      {loadError ? (
        <div style={styles.emptyState}>
          <p style={styles.errorTitle}>Couldn&apos;t load portfolio dashboard</p>
          <p style={styles.emptySub}>{loadError}</p>
          <button onClick={loadAll} style={styles.primaryBtn}>Try again</button>
        </div>
      ) : loading ? (
        <p style={styles.loadingText}>Loading portfolio dashboard…</p>
      ) : (
        <>
          <div style={styles.kpiGrid}>
            <KpiCard label="Total projects" value={metrics.totalProjects} sub={`${metrics.activeProjects} active`} icon="▣" />
            <KpiCard label="Portfolio health" value={`${metrics.healthScore}%`} sub="overall score" icon="◉" tone="success" />
            <KpiCard label="At risk" value={metrics.atRiskProjects} sub="amber / red projects" icon="▲" tone="warning" />
            <KpiCard label="Delayed" value={metrics.delayedProjects} sub="past target date" icon="!" tone="danger" />
            <KpiCard label="Open actions" value={metrics.openActions} sub={`${metrics.overdueActions} overdue`} icon="→" tone="info" />
            <KpiCard label="Open risks / issues" value={`${metrics.openRisks}/${metrics.openIssues}`} sub="risks / issues" icon="◇" tone="purple" />
          </div>

          <div style={styles.mainGrid}>
            <Panel title="Projects by Health" action={`${projects.length} total`}>
              <HealthBars breakdown={healthBreakdown} total={projects.length} />
            </Panel>

            <Panel title="Projects by Status" action="lifecycle">
              <StatusList breakdown={statusBreakdown} total={projects.length} />
            </Panel>

            <Panel title="Delivery Overview" action={`${metrics.totalProgress}% avg progress`}>
              <ProgressOverview metrics={metrics} />
            </Panel>
          </div>

          <div style={styles.twoColGrid}>
            <Panel title="Upcoming Phases" action="next milestones">
              {upcomingPhases.length === 0 ? <EmptyLine text="No upcoming phases." /> : upcomingPhases.map((phase) => (
                <button key={phase.id} onClick={() => navigate(`/projects/${phase.projectId}`)} style={styles.listRow}>
                  <span style={styles.phaseIcon}>◆</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <strong style={styles.rowTitle}>{phase.name}</strong>
                    <span style={styles.rowSub}>{phase.projectName}</span>
                  </span>
                  <span style={phase.days !== null && phase.days < 0 ? styles.badgeDanger : styles.badgeInfo}>{formatDate(phase.planned_date)}</span>
                </button>
              ))}
            </Panel>

            <Panel title="Top Risks" action="highest severity">
              {topRisks.length === 0 ? <EmptyLine text="No open risks." /> : topRisks.map((risk) => (
                <button key={risk.id} onClick={() => navigate('/governance')} style={styles.listRow}>
                  <Severity severity={risk.severity} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <strong style={styles.rowTitle}>{risk.description}</strong>
                    <span style={styles.rowSub}>{risk.project?.name || risk.team?.name || 'Portfolio risk'}</span>
                  </span>
                </button>
              ))}
            </Panel>
          </div>

          <div style={styles.twoColGridWide}>
            <Panel title="Recent Projects" action="delivery status">
              {recentProjects.length === 0 ? <EmptyLine text="No projects yet." /> : (
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th>Project</th>
                        <th>Health</th>
                        <th>Progress</th>
                        <th>Target</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentProjects.map((project) => {
                        const progress = pct(calculateProjectProgress(project))
                        return (
                          <tr key={project.id} onClick={() => navigate(`/projects/${project.id}`)} style={styles.tableRow}>
                            <td><strong>{project.name}</strong><span style={styles.tableSub}>{project.team?.name}</span></td>
                            <td><HealthPill health={project.health} /></td>
                            <td><InlineProgress value={progress} /></td>
                            <td>{formatDate(project.target_completion_date)}</td>
                            <td><span style={styles.badgeNeutral}>{project.status?.replaceAll('_', ' ') || '—'}</span></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel title="Portfolio Timeline" action="project horizon">
              {timelineProjects.length === 0 ? <EmptyLine text="No dated projects." /> : timelineProjects.map((project) => (
                <button key={project.id} onClick={() => navigate(`/projects/${project.id}`)} style={styles.timelineRow}>
                  <div style={styles.timelineTop}>
                    <strong style={styles.rowTitle}>{project.name}</strong>
                    <span style={project.daysLeft !== null && project.daysLeft < 0 ? styles.badgeDanger : styles.badgeNeutral}>{project.daysLeft === null ? 'No target' : `${project.daysLeft} days`}</span>
                  </div>
                  <div style={styles.timelineDates}>
                    <span>{formatDate(project.start_date)}</span>
                    <span>{formatDate(project.target_completion_date)}</span>
                  </div>
                  <InlineProgress value={project.progress} />
                </button>
              ))}
            </Panel>
          </div>

          <div style={styles.kpiGridSmall}>
            <MiniInsight label="Open tasks" value={metrics.openTasks} />
            <MiniInsight label="Overdue tasks" value={metrics.overdueTasks} tone="danger" />
            <MiniInsight label="Pending decisions" value={metrics.pendingDecisions} tone="warning" />
            <MiniInsight label="Closed projects" value={metrics.closedProjects} tone="success" />
          </div>
        </>
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

function HealthBars({ breakdown, total }) {
  const labels = { green: 'On track', amber: 'At risk', red: 'Critical' }
  const tones = { green: 'var(--success)', amber: 'var(--warning)', red: 'var(--danger)' }
  return (
    <div style={styles.barList}>
      {breakdown.map((item) => {
        const width = total ? pct((item.count / total) * 100) : 0
        return (
          <div key={item.value}>
            <div style={styles.barLabelRow}><span>{labels[item.value]}</span><strong>{item.count}</strong></div>
            <div style={styles.barTrack}><div style={{ ...styles.barFill, width: `${width}%`, background: tones[item.value] }} /></div>
          </div>
        )
      })}
    </div>
  )
}

function StatusList({ breakdown, total }) {
  return (
    <div style={styles.statusList}>
      {breakdown.map((item) => (
        <div key={item.value} style={styles.statusItem}>
          <span style={styles.statusDot} />
          <span style={styles.statusLabel}>{item.value.replaceAll('_', ' ')}</span>
          <strong>{item.count}</strong>
          <span style={styles.statusPct}>{total ? pct((item.count / total) * 100) : 0}%</span>
        </div>
      ))}
    </div>
  )
}

function ProgressOverview({ metrics }) {
  return (
    <div>
      <div style={styles.bigProgressTrack}><div style={{ ...styles.bigProgressFill, width: `${metrics.totalProgress}%` }} /></div>
      <div style={styles.overviewGrid}>
        <div><p style={styles.overviewValue}>{metrics.totalProgress}%</p><p style={styles.overviewLabel}>Avg progress</p></div>
        <div><p style={styles.overviewValue}>{metrics.openActions}</p><p style={styles.overviewLabel}>Open actions</p></div>
        <div><p style={styles.overviewValue}>{metrics.openTasks}</p><p style={styles.overviewLabel}>Open tasks</p></div>
      </div>
    </div>
  )
}

function Severity({ severity }) {
  const map = {
    critical: styles.badgeDanger,
    high: styles.badgeDanger,
    medium: styles.badgeWarning,
    low: styles.badgeSuccess,
  }
  return <span style={map[severity] || styles.badgeNeutral}>{severity || 'medium'}</span>
}

function HealthPill({ health }) {
  const map = {
    green: { label: 'On track', style: styles.badgeSuccess },
    amber: { label: 'At risk', style: styles.badgeWarning },
    red: { label: 'Critical', style: styles.badgeDanger },
  }
  const value = map[health] || map.green
  return <span style={value.style}>{value.label}</span>
}

function InlineProgress({ value }) {
  return (
    <div style={styles.inlineProgressWrap}>
      <div style={styles.inlineProgressTrack}><div style={{ ...styles.inlineProgressFill, width: `${pct(value)}%` }} /></div>
      <span style={styles.inlineProgressText}>{pct(value)}%</span>
    </div>
  )
}

function EmptyLine({ text }) {
  return <p style={styles.emptyLine}>{text}</p>
}

function MiniInsight({ label, value, tone }) {
  return (
    <div style={{ ...styles.miniInsight, ...(tone === 'danger' ? styles.miniDanger : {}), ...(tone === 'warning' ? styles.miniWarning : {}), ...(tone === 'success' ? styles.miniSuccess : {}) }}>
      <p style={styles.miniLabel}>{label}</p>
      <p style={styles.miniValue}>{value}</p>
    </div>
  )
}

const styles = {
  heroRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, marginBottom: 20, flexWrap: 'wrap' },
  eyebrow: { fontSize: 11.5, fontWeight: 900, color: 'var(--bupa-blue)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 5px' },
  pageTitle: { fontSize: 28, fontWeight: 900, color: 'var(--text)', margin: 0 },
  pageSub: { fontSize: 13.5, color: 'var(--text-2)', margin: '6px 0 0' },
  heroActions: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  primaryBtn: { border: 'none', borderRadius: 'var(--radius)', background: 'linear-gradient(135deg, #0050A0, #2D8FE0)', color: '#fff', fontWeight: 800, fontSize: 13, padding: '10px 16px' },
  secondaryBtn: { border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 750, fontSize: 13, padding: '10px 16px' },
  loadingText: { color: 'var(--text-2)', fontSize: 14 },
  emptyState: { textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 40 },
  errorTitle: { fontSize: 16, color: 'var(--danger)', fontWeight: 900, margin: '0 0 6px' },
  emptySub: { fontSize: 13, color: 'var(--text-2)', margin: '0 0 16px' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 14 },
  kpiCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 17px', boxShadow: '0 2px 10px rgba(0,80,160,0.06)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' },
  kpi_success: { background: 'linear-gradient(135deg, var(--surface), var(--success-light))' },
  kpi_warning: { background: 'linear-gradient(135deg, var(--surface), var(--warning-light))' },
  kpi_danger: { background: 'linear-gradient(135deg, var(--surface), var(--danger-light))' },
  kpi_info: { background: 'linear-gradient(135deg, var(--surface), var(--info-light))' },
  kpi_purple: { background: 'linear-gradient(135deg, var(--surface), rgba(123,92,255,0.12))' },
  kpiLabel: { fontSize: 11.5, color: 'var(--text-3)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.03em', margin: '0 0 6px' },
  kpiValue: { fontSize: 27, fontWeight: 950, color: 'var(--text)', lineHeight: 1, margin: 0 },
  kpiSub: { fontSize: 12, color: 'var(--text-2)', margin: '6px 0 0' },
  kpiIcon: { width: 42, height: 42, borderRadius: 14, background: 'rgba(255,255,255,0.72)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bupa-blue)', fontWeight: 900, fontSize: 18, flexShrink: 0 },
  mainGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 14 },
  twoColGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginBottom: 14 },
  twoColGridWide: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 0.8fr)', gap: 14, marginBottom: 14 },
  panel: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 18px', boxShadow: '0 2px 10px rgba(0,80,160,0.05)' },
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14 },
  panelTitle: { fontSize: 15, color: 'var(--text)', fontWeight: 900, margin: 0 },
  panelAction: { fontSize: 11.5, color: 'var(--text-3)', fontWeight: 750, background: 'var(--surface-2)', padding: '4px 9px', borderRadius: 999, whiteSpace: 'nowrap' },
  barList: { display: 'flex', flexDirection: 'column', gap: 13 },
  barLabelRow: { display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-2)', marginBottom: 6 },
  barTrack: { height: 9, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },
  statusList: { display: 'flex', flexDirection: 'column', gap: 9 },
  statusItem: { display: 'grid', gridTemplateColumns: '12px 1fr auto auto', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-2)' },
  statusDot: { width: 8, height: 8, borderRadius: 999, background: 'var(--bupa-blue)' },
  statusLabel: { textTransform: 'capitalize' },
  statusPct: { color: 'var(--text-3)', fontSize: 11.5 },
  bigProgressTrack: { height: 14, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden', marginBottom: 18 },
  bigProgressFill: { height: '100%', borderRadius: 999, background: 'linear-gradient(135deg, #0050A0, #2DA86A)' },
  overviewGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 },
  overviewValue: { fontSize: 20, fontWeight: 900, margin: 0 },
  overviewLabel: { fontSize: 11.5, color: 'var(--text-3)', margin: '3px 0 0' },
  listRow: { width: '100%', display: 'flex', alignItems: 'center', gap: 10, border: 'none', background: 'transparent', borderBottom: '1px solid var(--border)', padding: '10px 0', textAlign: 'left' },
  phaseIcon: { color: 'var(--bupa-blue)', fontSize: 13 },
  rowTitle: { display: 'block', fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowSub: { display: 'block', fontSize: 11.5, color: 'var(--text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  badgeNeutral: { fontSize: 11.5, fontWeight: 800, borderRadius: 999, padding: '4px 8px', background: 'var(--surface-2)', color: 'var(--text-2)', textTransform: 'capitalize', whiteSpace: 'nowrap' },
  badgeInfo: { fontSize: 11.5, fontWeight: 800, borderRadius: 999, padding: '4px 8px', background: 'var(--info-light)', color: 'var(--info)', whiteSpace: 'nowrap' },
  badgeSuccess: { fontSize: 11.5, fontWeight: 800, borderRadius: 999, padding: '4px 8px', background: 'var(--success-light)', color: 'var(--success)', whiteSpace: 'nowrap' },
  badgeWarning: { fontSize: 11.5, fontWeight: 800, borderRadius: 999, padding: '4px 8px', background: 'var(--warning-light)', color: 'var(--warning)', whiteSpace: 'nowrap' },
  badgeDanger: { fontSize: 11.5, fontWeight: 800, borderRadius: 999, padding: '4px 8px', background: 'var(--danger-light)', color: 'var(--danger)', whiteSpace: 'nowrap' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12.5 },
  tableRow: { cursor: 'pointer', borderTop: '1px solid var(--border)' },
  tableSub: { display: 'block', fontSize: 11.2, color: 'var(--text-3)', marginTop: 2 },
  inlineProgressWrap: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 },
  inlineProgressTrack: { flex: 1, height: 7, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' },
  inlineProgressFill: { height: '100%', borderRadius: 999, background: 'linear-gradient(135deg, #0050A0, #2DA86A)' },
  inlineProgressText: { fontSize: 11.5, color: 'var(--text-2)', fontWeight: 800 },
  timelineRow: { width: '100%', display: 'block', textAlign: 'left', border: 'none', background: 'transparent', borderBottom: '1px solid var(--border)', padding: '10px 0' },
  timelineTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 5 },
  timelineDates: { display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-3)', marginBottom: 7 },
  kpiGridSmall: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 },
  miniInsight: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '13px 14px' },
  miniDanger: { background: 'var(--danger-light)' },
  miniWarning: { background: 'var(--warning-light)' },
  miniSuccess: { background: 'var(--success-light)' },
  miniLabel: { fontSize: 11.5, fontWeight: 800, color: 'var(--text-3)', margin: '0 0 5px', textTransform: 'uppercase', letterSpacing: '0.03em' },
  miniValue: { fontSize: 23, fontWeight: 950, margin: 0, color: 'var(--text)' },
  emptyLine: { fontSize: 13, color: 'var(--text-3)', margin: 0, fontStyle: 'italic' },
}
