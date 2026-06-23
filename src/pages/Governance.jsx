import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../lib/AuthContext'
import { fetchRisks, createRisk, updateRiskStatus, overrideRiskSeverity } from '../lib/risks'
import { fetchIssues, createIssue, updateIssueStatus } from '../lib/risks'
import { fetchDecisions, createDecision } from '../lib/risks'
import { fetchTeams, fetchProfiles, fetchNotifications, markNotificationRead } from '../lib/tasks'
import { fetchProjects } from '../lib/projects'
import Shell from '../components/Shell'
import RiskBadge from '../components/RiskBadge'
import NotificationsPanel from '../components/NotificationsPanel'
import AutoGrowTextarea from '../components/AutoGrowTextarea'

const TABS = [
  { key: 'risks', label: 'Risks' },
  { key: 'issues', label: 'Issues' },
  { key: 'decisions', label: 'Decisions' },
]

export default function Governance() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('risks')
  const [risks, setRisks] = useState([])
  const [issues, setIssues] = useState([])
  const [decisions, setDecisions] = useState([])
  const [teams, setTeams] = useState([])
  const [people, setPeople] = useState([])
  const [projects, setProjects] = useState([])
  const [notifications, setNotifications] = useState([])
  const [teamFilter, setTeamFilter] = useState(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function loadAll() {
    setLoading(true)
    setLoadError(null)
    try {
      const [r, i, d, tm, ppl, proj, n] = await Promise.all([
        fetchRisks({ profile, teamFilter }),
        fetchIssues({ profile, teamFilter }),
        fetchDecisions({ profile, teamFilter }),
        fetchTeams(),
        fetchProfiles(),
        fetchProjects({ profile, teamFilter: null }),
        fetchNotifications(profile.id),
      ])
      setRisks(r); setIssues(i); setDecisions(d)
      setTeams(tm); setPeople(ppl); setProjects(proj); setNotifications(n)
    } catch (err) {
      setLoadError(err.message || 'Could not load this data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [teamFilter])

  async function runAction(fn) {
    setActionError(null)
    setBusy(true)
    try { await fn() } catch (err) { setActionError(err.message || 'Something went wrong.') } finally { setBusy(false) }
  }

  const riskCounts = useMemo(() => ({
    open: risks.filter((r) => r.status === 'open').length,
    high: risks.filter((r) => r.severity === 'high' || r.severity === 'critical').length,
    mitigated: risks.filter((r) => r.status === 'mitigated').length,
  }), [risks])

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <Shell teams={teams} teamFilter={teamFilter} setTeamFilter={setTeamFilter} notifCount={unreadCount} onBellClick={() => setShowNotifs((s) => !s)}>
      <div style={styles.topBar}>
        <h1 style={styles.pageTitle}>Governance</h1>
        <button onClick={() => setShowNewForm(true)} style={styles.newBtn}>
          <i className="ti ti-plus" style={{ fontSize: 14 }} aria-hidden="true" /> New {tab === 'risks' ? 'risk' : tab === 'issues' ? 'issue' : 'decision'}
        </button>
      </div>

      <div style={styles.tabRow}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); setShowNewForm(false) }} style={{ ...styles.tabBtn, ...(tab === t.key ? styles.tabBtnActive : {}) }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'risks' && (
        <div style={styles.metricsRow}>
          <div style={styles.metricCard}><p style={styles.metricLabel}>Open risks</p><p style={styles.metricValue}>{riskCounts.open}</p></div>
          <div style={styles.metricCard}><p style={styles.metricLabel}>High / critical</p><p style={{ ...styles.metricValue, color: 'var(--danger)' }}>{riskCounts.high}</p></div>
          <div style={styles.metricCard}><p style={styles.metricLabel}>Mitigated</p><p style={{ ...styles.metricValue, color: 'var(--success)' }}>{riskCounts.mitigated}</p></div>
        </div>
      )}

      {actionError && (
        <div style={styles.actionErrorBox}>
          <p style={styles.actionErrorText}>{actionError}</p>
          <button onClick={() => setActionError(null)} style={styles.actionErrorDismiss} aria-label="Dismiss"><i className="ti ti-x" style={{ fontSize: 13 }} aria-hidden="true" /></button>
        </div>
      )}

      {showNewForm && tab === 'risks' && (
        <NewRiskForm teams={teams} people={people} projects={projects} profile={profile} busy={busy} runAction={runAction} onDone={() => { setShowNewForm(false); loadAll() }} onCancel={() => setShowNewForm(false)} />
      )}
      {showNewForm && tab === 'issues' && (
        <NewIssueForm teams={teams} people={people} projects={projects} profile={profile} busy={busy} runAction={runAction} onDone={() => { setShowNewForm(false); loadAll() }} onCancel={() => setShowNewForm(false)} />
      )}
      {showNewForm && tab === 'decisions' && (
        <NewDecisionForm teams={teams} people={people} projects={projects} profile={profile} busy={busy} runAction={runAction} onDone={() => { setShowNewForm(false); loadAll() }} onCancel={() => setShowNewForm(false)} />
      )}

      {loadError ? (
        <div style={styles.emptyState}>
          <p style={{ ...styles.emptyTitle, color: 'var(--danger)' }}>Couldn't load this data</p>
          <p style={styles.emptySub}>{loadError}</p>
          <button onClick={loadAll} style={styles.retryBtn}>Try again</button>
        </div>
      ) : loading ? (
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>Loading…</p>
      ) : tab === 'risks' ? (
        risks.length === 0 ? <EmptyState label="risks" /> : risks.map((r) => (
          <RiskRow key={r.id} risk={r} busy={busy} runAction={runAction} onChanged={loadAll} profile={profile} />
        ))
      ) : tab === 'issues' ? (
        issues.length === 0 ? <EmptyState label="issues" /> : issues.map((i) => (
          <IssueRow key={i.id} issue={i} busy={busy} runAction={runAction} onChanged={loadAll} profile={profile} />
        ))
      ) : (
        decisions.length === 0 ? <EmptyState label="decisions" /> : decisions.map((d) => (
          <DecisionRow key={d.id} decision={d} />
        ))
      )}

      {showNotifs && (
        <NotificationsPanel
          notifications={notifications}
          onClose={() => setShowNotifs(false)}
          onMarkRead={async (id) => { await markNotificationRead(id); setNotifications((ns) => ns.map((n) => (n.id === id ? { ...n, is_read: true } : n))) }}
        />
      )}
    </Shell>
  )
}

function EmptyState({ label }) {
  return (
    <div style={styles.emptyState}>
      <p style={styles.emptyTitle}>No {label} logged yet</p>
      <p style={styles.emptySub}>Create one to start tracking.</p>
    </div>
  )
}

function RiskRow({ risk, busy, runAction, onChanged, profile }) {
  const [showOverride, setShowOverride] = useState(false)
  const [overrideSeverity, setOverrideSeverity] = useState(risk.severity)
  const [overrideReason, setOverrideReason] = useState('')
  const canEdit = profile.is_mbm || risk.owner_id === profile.id || risk.created_by === profile.id

  function submitOverride(e) {
    e.preventDefault()
    if (!overrideReason.trim()) return
    runAction(async () => {
      await overrideRiskSeverity({ riskId: risk.id, severity: overrideSeverity, reason: overrideReason, actorId: profile.id })
      setShowOverride(false); setOverrideReason('')
      await onChanged()
    })
  }

  return (
    <div style={styles.registerCard}>
      <div style={styles.registerTop}>
        <div style={{ flex: 1 }}>
          <p style={styles.registerDesc}>{risk.description}</p>
          <p style={styles.registerMeta}>
            {risk.team?.name}{risk.project ? ` · ${risk.project.name}` : ''} · {risk.owner?.full_name || 'Unassigned'}
          </p>
        </div>
        <RiskBadge severity={risk.severity} overridden={risk.severity_overridden} />
      </div>
      {risk.mitigation_plan && <p style={styles.mitigationText}><strong style={{ fontWeight: 700 }}>Mitigation:</strong> {risk.mitigation_plan}</p>}
      {canEdit && (
        <div style={styles.registerActions}>
          <select
            value={risk.status} disabled={busy}
            onChange={(e) => runAction(async () => { await updateRiskStatus({ riskId: risk.id, status: e.target.value, actorId: profile.id }); await onChanged() })}
            style={styles.statusSelect}
          >
            <option value="open">Open</option>
            <option value="mitigated">Mitigated</option>
            <option value="accepted">Accepted</option>
            <option value="closed">Closed</option>
          </select>
          <button onClick={() => setShowOverride((s) => !s)} style={styles.miniLink}>Override severity</button>
        </div>
      )}
      {showOverride && (
        <form onSubmit={submitOverride} style={styles.overrideForm}>
          <select value={overrideSeverity} onChange={(e) => setOverrideSeverity(e.target.value)} style={styles.input}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <input value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Reason for override (required)" required style={{ ...styles.input, flex: 1 }} />
          <button type="submit" disabled={busy} style={styles.smallBtn}>Save</button>
        </form>
      )}
    </div>
  )
}

function IssueRow({ issue, busy, runAction, onChanged, profile }) {
  const canEdit = profile.is_mbm || issue.owner_id === profile.id || issue.created_by === profile.id
  return (
    <div style={styles.registerCard}>
      <div style={styles.registerTop}>
        <div style={{ flex: 1 }}>
          <p style={styles.registerDesc}>{issue.description}</p>
          <p style={styles.registerMeta}>
            {issue.team?.name}{issue.project ? ` · ${issue.project.name}` : ''} · {issue.owner?.full_name || 'Unassigned'} · raised {new Date(issue.date_raised).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </p>
        </div>
        <span style={{ ...styles.statusBadge, ...(issue.status === 'resolved' || issue.status === 'closed' ? styles.statusBadgeDone : {}) }}>
          {issue.status.replace('_', ' ')}
        </span>
      </div>
      {issue.resolution_plan && <p style={styles.mitigationText}><strong style={{ fontWeight: 700 }}>Resolution plan:</strong> {issue.resolution_plan}</p>}
      {canEdit && (
        <div style={styles.registerActions}>
          <select
            value={issue.status} disabled={busy}
            onChange={(e) => runAction(async () => { await updateIssueStatus({ issueId: issue.id, status: e.target.value, actorId: profile.id }); await onChanged() })}
            style={styles.statusSelect}
          >
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      )}
    </div>
  )
}

function DecisionRow({ decision }) {
  return (
    <div style={styles.registerCard}>
      <div style={styles.registerTop}>
        <div style={{ flex: 1 }}>
          <p style={styles.registerDesc}>{decision.decision}</p>
          <p style={styles.registerMeta}>
            {decision.team?.name}{decision.project ? ` · ${decision.project.name}` : ''} · {decision.decision_owner?.full_name || 'Unassigned'} · {new Date(decision.decision_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>
      {decision.reason && <p style={styles.mitigationText}><strong style={{ fontWeight: 700 }}>Reason:</strong> {decision.reason}</p>}
      {decision.impact && <p style={styles.mitigationText}><strong style={{ fontWeight: 700 }}>Impact:</strong> {decision.impact}</p>}
    </div>
  )
}

function NewRiskForm({ teams, people, projects, profile, busy, runAction, onDone, onCancel }) {
  const [description, setDescription] = useState('')
  const [impact, setImpact] = useState('medium')
  const [likelihood, setLikelihood] = useState('medium')
  const [mitigationPlan, setMitigationPlan] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [teamId, setTeamId] = useState(profile.team_id)
  const [projectId, setProjectId] = useState('')

  function submit(e) {
    e.preventDefault()
    runAction(async () => {
      await createRisk({ description, impact, likelihood, mitigationPlan, ownerId, teamId, projectId, createdBy: profile.id })
      onDone()
    })
  }

  return (
    <form onSubmit={submit} style={styles.formCard}>
      <AutoGrowTextarea value={description} onChange={(e) => setDescription(e.target.value)} required placeholder="Risk description" style={styles.textarea} />
      <div style={styles.formRow}>
        <select value={impact} onChange={(e) => setImpact(e.target.value)} style={styles.input}><option value="low">Low impact</option><option value="medium">Medium impact</option><option value="high">High impact</option></select>
        <select value={likelihood} onChange={(e) => setLikelihood(e.target.value)} style={styles.input}><option value="low">Low likelihood</option><option value="medium">Medium likelihood</option><option value="high">High likelihood</option></select>
      </div>
      <AutoGrowTextarea value={mitigationPlan} onChange={(e) => setMitigationPlan(e.target.value)} placeholder="Mitigation plan (optional)" style={{ ...styles.textarea, minHeight: 50 }} />
      <div style={styles.formRow}>
        <select value={teamId} onChange={(e) => setTeamId(e.target.value)} style={styles.input}>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} style={styles.input}><option value="">Unassigned owner</option>{people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={styles.input}><option value="">No project (standing risk)</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={busy} style={styles.smallBtn}>{busy ? 'Saving…' : 'Log risk'}</button>
        <button type="button" onClick={onCancel} disabled={busy} style={styles.smallBtnOutline}>Cancel</button>
      </div>
    </form>
  )
}

function NewIssueForm({ teams, people, projects, profile, busy, runAction, onDone, onCancel }) {
  const [description, setDescription] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [teamId, setTeamId] = useState(profile.team_id)
  const [projectId, setProjectId] = useState('')
  const [resolutionPlan, setResolutionPlan] = useState('')

  function submit(e) {
    e.preventDefault()
    runAction(async () => {
      await createIssue({ description, ownerId, teamId, projectId, resolutionPlan, createdBy: profile.id })
      onDone()
    })
  }

  return (
    <form onSubmit={submit} style={styles.formCard}>
      <AutoGrowTextarea value={description} onChange={(e) => setDescription(e.target.value)} required placeholder="Issue description" style={styles.textarea} />
      <AutoGrowTextarea value={resolutionPlan} onChange={(e) => setResolutionPlan(e.target.value)} placeholder="Resolution plan (optional)" style={{ ...styles.textarea, minHeight: 50 }} />
      <div style={styles.formRow}>
        <select value={teamId} onChange={(e) => setTeamId(e.target.value)} style={styles.input}>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} style={styles.input}><option value="">Unassigned owner</option>{people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={styles.input}><option value="">No project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={busy} style={styles.smallBtn}>{busy ? 'Saving…' : 'Raise issue'}</button>
        <button type="button" onClick={onCancel} disabled={busy} style={styles.smallBtnOutline}>Cancel</button>
      </div>
    </form>
  )
}

function NewDecisionForm({ teams, people, projects, profile, busy, runAction, onDone, onCancel }) {
  const [decision, setDecision] = useState('')
  const [reason, setReason] = useState('')
  const [impact, setImpact] = useState('')
  const [decisionOwnerId, setDecisionOwnerId] = useState('')
  const [teamId, setTeamId] = useState(profile.team_id)
  const [projectId, setProjectId] = useState('')

  function submit(e) {
    e.preventDefault()
    runAction(async () => {
      await createDecision({ decision, reason, impact, decisionOwnerId, teamId, projectId, createdBy: profile.id })
      onDone()
    })
  }

  return (
    <form onSubmit={submit} style={styles.formCard}>
      <AutoGrowTextarea value={decision} onChange={(e) => setDecision(e.target.value)} required placeholder="Decision (e.g. Vendor selection approved)" style={styles.textarea} />
      <AutoGrowTextarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" style={{ ...styles.textarea, minHeight: 50 }} />
      <AutoGrowTextarea value={impact} onChange={(e) => setImpact(e.target.value)} placeholder="Impact (optional)" style={{ ...styles.textarea, minHeight: 50 }} />
      <div style={styles.formRow}>
        <select value={teamId} onChange={(e) => setTeamId(e.target.value)} style={styles.input}>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <select value={decisionOwnerId} onChange={(e) => setDecisionOwnerId(e.target.value)} style={styles.input}><option value="">Unassigned owner</option>{people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={styles.input}><option value="">No project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      </div>
      <p style={styles.permanentNote}><i className="ti ti-info-circle" style={{ fontSize: 13 }} aria-hidden="true" /> Decisions are permanent once logged and can't be edited — this preserves full history.</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={busy} style={styles.smallBtn}>{busy ? 'Saving…' : 'Log decision'}</button>
        <button type="button" onClick={onCancel} disabled={busy} style={styles.smallBtnOutline}>Cancel</button>
      </div>
    </form>
  )
}

const styles = {
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 16, flexWrap: 'wrap' },
  pageTitle: { fontSize: 19, fontWeight: 700, margin: 0, color: 'var(--text)' },
  newBtn: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, padding: '9px 18px', borderRadius: 'var(--radius)', border: 'none', background: 'linear-gradient(135deg, #0050A0, #2D8FE0)', color: '#fff', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,80,160,0.2)' },
  tabRow: { display: 'flex', gap: 6, marginBottom: 18 },
  tabBtn: { fontSize: 13, fontWeight: 700, padding: '8px 18px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)' },
  tabBtnActive: { background: 'var(--bupa-blue)', color: '#fff', borderColor: 'var(--bupa-blue)' },
  metricsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 },
  metricCard: { background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '14px 16px', boxShadow: '0 2px 8px rgba(0,80,160,0.05)' },
  metricLabel: { fontSize: 12, color: 'var(--text-3)', margin: '0 0 4px' },
  metricValue: { fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--text)' },
  actionErrorBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, background: 'var(--danger-light)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 16 },
  actionErrorText: { fontSize: 13, color: 'var(--danger)', margin: 0 },
  actionErrorDismiss: { background: 'none', border: 'none', color: 'var(--danger)', flexShrink: 0 },
  formCard: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16, padding: 16, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', boxShadow: '0 2px 8px rgba(0,80,160,0.05)' },
  formRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  textarea: { fontSize: 13.5, padding: '9px 11px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: '#fff', minHeight: 64, fontFamily: 'inherit', resize: 'vertical' },
  input: { fontSize: 13, padding: '8px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: '#fff', color: 'var(--text)', flex: 1 },
  permanentNote: { fontSize: 12, color: 'var(--text-3)', margin: 0, display: 'flex', alignItems: 'center', gap: 5 },
  registerCard: { background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', marginBottom: 10, boxShadow: '0 2px 8px rgba(0,80,160,0.05)' },
  registerTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  registerDesc: { fontSize: 14, fontWeight: 600, margin: 0, color: 'var(--text)', lineHeight: 1.5 },
  registerMeta: { fontSize: 11.5, color: 'var(--text-3)', margin: '4px 0 0' },
  mitigationText: { fontSize: 12.5, color: 'var(--text-2)', margin: '0 0 8px', lineHeight: 1.5 },
  registerActions: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  statusSelect: { fontSize: 12.5, padding: '6px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: '#fff', color: 'var(--text)' },
  statusBadge: { fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.7)', color: 'var(--text-2)', textTransform: 'capitalize', flexShrink: 0 },
  statusBadgeDone: { background: 'var(--success-light)', color: 'var(--success)' },
  miniLink: { fontSize: 12, color: 'var(--bupa-blue)', background: 'none', border: 'none', fontWeight: 600 },
  overrideForm: { display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  smallBtn: { fontSize: 13, padding: '8px 14px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--bupa-blue)', color: '#fff', fontWeight: 700 },
  smallBtnOutline: { fontSize: 13, padding: '8px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'none', color: 'var(--text)', fontWeight: 600 },
  emptyState: { textAlign: 'center', padding: '50px 0', color: 'var(--text-3)' },
  emptyTitle: { fontSize: 15, fontWeight: 700, color: 'var(--text-2)', margin: '0 0 4px' },
  emptySub: { fontSize: 13, margin: 0 },
  retryBtn: { marginTop: 14, fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--bupa-blue)', color: '#fff' },
}
