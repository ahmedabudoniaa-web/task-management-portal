import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { fetchProjectDetail, updateProjectHealth, createMilestone, updateMilestone } from '../lib/projects'
import { requestStageAdvance, resolveStageAdvance, fetchAuditLog } from '../lib/governance'
import { fetchTeams, fetchProfiles, fetchNotifications, markNotificationRead } from '../lib/tasks'
import { supabase } from '../lib/supabase'
import { healthColor } from '../lib/teamColors'
import Shell from '../components/Shell'

const STATUS_FLOW = ['initiation', 'planning', 'execution', 'final_review', 'closure', 'closed']
const STATUS_LABELS = {
  initiation: 'Initiation', planning: 'Planning', execution: 'Execution',
  final_review: 'Final review', closure: 'Closure', closed: 'Closed',
}

export default function ProjectDetail() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [project, setProject] = useState(null)
  const [pendingStageRequest, setPendingStageRequest] = useState(null)
  const [auditLog, setAuditLog] = useState([])
  const [teams, setTeams] = useState([])
  const [people, setPeople] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [showHealthForm, setShowHealthForm] = useState(false)
  const [newHealth, setNewHealth] = useState('green')
  const [healthReason, setHealthReason] = useState('')
  const [showMilestoneForm, setShowMilestoneForm] = useState(false)
  const [milestoneName, setMilestoneName] = useState('')
  const [milestoneOwner, setMilestoneOwner] = useState('')
  const [milestoneDate, setMilestoneDate] = useState('')
  const [showAdvanceForm, setShowAdvanceForm] = useState(false)
  const [advanceNote, setAdvanceNote] = useState('')
  const [showNotifs, setShowNotifs] = useState(false)

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const [p, tm, ppl, n] = await Promise.all([
        fetchProjectDetail(projectId),
        fetchTeams(),
        fetchProfiles(),
        fetchNotifications(profile.id),
      ])
      setProject(p)
      setTeams(tm)
      setPeople(ppl)
      setNotifications(n)

      const { data: stageReqs } = await supabase
        .from('stage_advance_requests')
        .select('*, requester:profiles!stage_advance_requests_requested_by_fkey(id, full_name)')
        .eq('project_id', projectId)
        .eq('status', 'pending')
        .maybeSingle()
      setPendingStageRequest(stageReqs || null)

      const log = await fetchAuditLog({ entityType: 'project', entityId: projectId })
      setAuditLog(log)
    } catch (err) {
      setLoadError(err.message || 'Could not load this project.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [projectId])

  async function runAction(fn) {
    setActionError(null)
    setBusy(true)
    try {
      await fn()
    } catch (err) {
      setActionError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  function submitAdvanceRequest(e) {
    e.preventDefault()
    const idx = STATUS_FLOW.indexOf(project.status)
    const next = STATUS_FLOW[idx + 1]
    if (!next) return
    runAction(async () => {
      await requestStageAdvance({
        projectId: project.id, requestedBy: profile.id,
        fromStatus: project.status, toStatus: next, note: advanceNote,
      })
      setShowAdvanceForm(false)
      setAdvanceNote('')
      await load()
    })
  }

  function handleResolveAdvance(approve) {
    runAction(async () => {
      await resolveStageAdvance({
        requestId: pendingStageRequest.id, approve, resolverId: profile.id,
        projectId: project.id, toStatus: pendingStageRequest.to_status,
      })
      await load()
    })
  }

  function submitHealthChange(e) {
    e.preventDefault()
    if (!healthReason.trim()) return
    runAction(async () => {
      await updateProjectHealth({
        projectId: project.id, newHealth, oldHealth: project.health,
        reason: healthReason, changedBy: profile.id,
      })
      setShowHealthForm(false)
      setHealthReason('')
      await load()
    })
  }

  function submitMilestone(e) {
    e.preventDefault()
    runAction(async () => {
      await createMilestone({
        projectId: project.id, name: milestoneName, ownerId: milestoneOwner || null,
        plannedDate: milestoneDate || null, sortOrder: (project.milestones?.length || 0),
        createdBy: profile.id,
      })
      setShowMilestoneForm(false)
      setMilestoneName(''); setMilestoneOwner(''); setMilestoneDate('')
      await load()
    })
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  if (loadError) {
    return (
      <Shell teams={teams} teamFilter={null} setTeamFilter={() => {}} notifCount={unreadCount} onBellClick={() => setShowNotifs((s) => !s)}>
        <button onClick={() => navigate('/projects')} style={styles.backLink}>
          <i className="ti ti-arrow-left" style={{ fontSize: 14 }} aria-hidden="true" /> Back to projects
        </button>
        <div style={styles.emptyState}>
          <p style={{ ...styles.emptyTitle, color: 'var(--danger)' }}>Couldn't load this project</p>
          <p style={styles.emptySub}>{loadError}</p>
          <button onClick={load} style={styles.retryBtn}>Try again</button>
        </div>
      </Shell>
    )
  }

  if (loading || !project) {
    return (
      <Shell teams={teams} teamFilter={null} setTeamFilter={() => {}} notifCount={unreadCount} onBellClick={() => setShowNotifs((s) => !s)}>
        <button onClick={() => navigate('/projects')} style={styles.backLink}>
          <i className="ti ti-arrow-left" style={{ fontSize: 14 }} aria-hidden="true" /> Back to projects
        </button>
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>Loading…</p>
      </Shell>
    )
  }

  const h = healthColor(project.health)
  const isPM = project.project_manager_id === profile.id
  const isSponsor = project.sponsor_id === profile.id
  const canEdit = profile.is_mbm || isPM || isSponsor
  const canApproveStage = profile.is_mbm || isSponsor
  const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(project.status) + 1]

  return (
    <Shell teams={teams} teamFilter={null} setTeamFilter={() => {}} notifCount={unreadCount} onBellClick={() => setShowNotifs((s) => !s)}>
      <button onClick={() => navigate('/projects')} style={styles.backLink}>
        <i className="ti ti-arrow-left" style={{ fontSize: 14 }} aria-hidden="true" /> Back to projects
      </button>

      {actionError && (
        <div style={styles.actionErrorBox}>
          <p style={styles.actionErrorText}>{actionError}</p>
          <button onClick={() => setActionError(null)} style={styles.actionErrorDismiss} aria-label="Dismiss">
            <i className="ti ti-x" style={{ fontSize: 13 }} aria-hidden="true" />
          </button>
        </div>
      )}

      <div style={styles.headerCard}>
        <div style={styles.headerTop}>
          <div>
            <p style={styles.teamLabel}>{project.team?.name}</p>
            <h1 style={styles.title}>{project.name}</h1>
          </div>
          <span style={{ ...styles.healthBadge, background: h.bg, color: h.text }}>
            <span style={{ ...styles.healthDot, background: h.text }} />
            {h.label}
          </span>
        </div>

        <div style={styles.peopleRow}>
          <div><p style={styles.fieldLabel}>Sponsor</p><p style={styles.fieldValue}>{project.sponsor?.full_name || '—'}</p></div>
          <div><p style={styles.fieldLabel}>Project manager</p><p style={styles.fieldValue}>{project.project_manager?.full_name || '—'}</p></div>
          <div><p style={styles.fieldLabel}>Target date</p><p style={styles.fieldValue}>
            {project.target_completion_date ? new Date(project.target_completion_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
          </p></div>
        </div>

        <div style={styles.progressSection}>
          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressFill, width: `${project.percent_complete}%` }} />
          </div>
          <span style={styles.progressLabel}>{project.percent_complete}% complete</span>
        </div>

        <div style={styles.stageRow}>
          {STATUS_FLOW.map((s, i) => (
            <div key={s} style={styles.stageStep}>
              <div style={{
                ...styles.stageDot,
                background: i <= STATUS_FLOW.indexOf(project.status) ? 'var(--bupa-blue)' : 'var(--surface-2)',
                color: i <= STATUS_FLOW.indexOf(project.status) ? '#fff' : 'var(--text-3)',
              }}>
                {i < STATUS_FLOW.indexOf(project.status) ? <i className="ti ti-check" style={{ fontSize: 12 }} aria-hidden="true" /> : i + 1}
              </div>
              <p style={styles.stageLabel}>{STATUS_LABELS[s]}</p>
            </div>
          ))}
        </div>

        {pendingStageRequest && (
          <div style={styles.pendingStageBox}>
            <p style={styles.pendingStageTitle}>
              Stage advance requested: {STATUS_LABELS[pendingStageRequest.from_status]} → {STATUS_LABELS[pendingStageRequest.to_status]}
            </p>
            <p style={styles.pendingStageDetail}>
              Requested by {pendingStageRequest.requester?.full_name} · milestones {pendingStageRequest.milestone_completion_snapshot}% complete at time of request
              {pendingStageRequest.note ? ` — "${pendingStageRequest.note}"` : ''}
            </p>
            {canApproveStage ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleResolveAdvance(true)} disabled={busy} style={styles.smallBtn}>Approve advance</button>
                <button onClick={() => handleResolveAdvance(false)} disabled={busy} style={styles.smallBtnOutline}>Decline</button>
              </div>
            ) : (
              <p style={styles.waitingText}>Waiting on sponsor or MBM approval.</p>
            )}
          </div>
        )}

        {canEdit && (
          <div style={styles.actionRow}>
            {nextStatus && !pendingStageRequest && (
              <button onClick={() => setShowAdvanceForm(true)} disabled={busy} style={styles.smallBtn}>
                Request advance to {STATUS_LABELS[nextStatus]}
              </button>
            )}
            <button onClick={() => { setShowHealthForm(true); setNewHealth(project.health) }} disabled={busy} style={styles.smallBtnOutline}>
              Update health status
            </button>
          </div>
        )}

        {showAdvanceForm && (
          <form onSubmit={submitAdvanceRequest} style={styles.healthForm}>
            <p style={styles.advanceFormNote}>
              Milestones are currently {project.milestones?.length
                ? Math.round((project.milestones.filter((m) => m.status === 'done').length / project.milestones.length) * 100)
                : 0}% complete. This will be shown to the approver.
            </p>
            <textarea
              value={advanceNote} onChange={(e) => setAdvanceNote(e.target.value)}
              placeholder="Optional note for the approver" style={styles.textarea}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={busy} style={styles.smallBtn}>{busy ? 'Sending…' : 'Send request'}</button>
              <button type="button" onClick={() => setShowAdvanceForm(false)} disabled={busy} style={styles.smallBtnOutline}>Cancel</button>
            </div>
          </form>
        )}

        {showHealthForm && (
          <form onSubmit={submitHealthChange} style={styles.healthForm}>
            <div style={{ display: 'flex', gap: 8 }}>
              {['green', 'amber', 'red'].map((opt) => {
                const oc = healthColor(opt)
                return (
                  <button
                    key={opt} type="button" onClick={() => setNewHealth(opt)}
                    style={{
                      ...styles.healthOption,
                      background: newHealth === opt ? oc.bg : 'var(--surface-2)',
                      color: newHealth === opt ? oc.text : 'var(--text-2)',
                      borderColor: newHealth === opt ? oc.text : 'transparent',
                    }}
                  >
                    {oc.label}
                  </button>
                )
              })}
            </div>
            <textarea
              value={healthReason} onChange={(e) => setHealthReason(e.target.value)} required
              placeholder="Reason for this status (required)" style={styles.textarea}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={busy} style={styles.smallBtn}>{busy ? 'Saving…' : 'Save'}</button>
              <button type="button" onClick={() => setShowHealthForm(false)} disabled={busy} style={styles.smallBtnOutline}>Cancel</button>
            </div>
          </form>
        )}
      </div>

      {project.milestones && project.milestones.length > 0 && (
        <details style={{ marginBottom: 24 }}>
          <summary style={styles.logSummary}>Timeline view</summary>
          <div style={styles.timelineWrap}>
            {[
              project.start_date && { date: project.start_date, label: 'Project start', kind: 'project' },
              ...project.milestones
                .filter((m) => m.planned_date)
                .map((m) => ({ date: m.planned_date, label: m.name, kind: m.status === 'done' ? 'done' : 'milestone' })),
              project.target_completion_date && { date: project.target_completion_date, label: 'Target completion', kind: 'target' },
            ]
              .filter(Boolean)
              .sort((a, b) => new Date(a.date) - new Date(b.date))
              .map((item, i) => (
                <div key={i} style={styles.timelineRow}>
                  <div style={{
                    ...styles.timelineDot,
                    background: item.kind === 'done' ? 'var(--success)' : item.kind === 'target' ? 'var(--bupa-blue)' : item.kind === 'project' ? 'var(--text-3)' : 'var(--warning)',
                  }} />
                  <div style={styles.timelineContent}>
                    <p style={styles.timelineDate}>{new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    <p style={styles.timelineLabel}>{item.label}</p>
                  </div>
                </div>
              ))}
          </div>
        </details>
      )}

      <div style={styles.sectionHeader}>
        <h2 style={styles.sectionTitle}>Milestones</h2>
        {canEdit && (
          <button onClick={() => setShowMilestoneForm(true)} style={styles.addLink}>
            <i className="ti ti-plus" style={{ fontSize: 13 }} aria-hidden="true" /> Add milestone
          </button>
        )}
      </div>

      {showMilestoneForm && (
        <form onSubmit={submitMilestone} style={styles.milestoneForm}>
          <input value={milestoneName} onChange={(e) => setMilestoneName(e.target.value)} placeholder="Milestone name" required style={styles.input} />
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={milestoneOwner} onChange={(e) => setMilestoneOwner(e.target.value)} style={{ ...styles.input, flex: 1 }}>
              <option value="">Unassigned</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
            <input type="date" value={milestoneDate} onChange={(e) => setMilestoneDate(e.target.value)} style={{ ...styles.input, flex: 1 }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={busy} style={styles.smallBtn}>{busy ? 'Adding…' : 'Add milestone'}</button>
            <button type="button" onClick={() => setShowMilestoneForm(false)} disabled={busy} style={styles.smallBtnOutline}>Cancel</button>
          </div>
        </form>
      )}

      {(!project.milestones || project.milestones.length === 0) ? (
        <div style={styles.emptyState}>
          <p style={styles.emptyTitle}>No milestones yet</p>
          <p style={styles.emptySub}>Break this project into milestones to track progress.</p>
        </div>
      ) : (
        project.milestones.map((m) => (
          <div key={m.id} style={styles.milestoneCard}>
            <div style={styles.milestoneTop}>
              <div>
                <p style={styles.milestoneName}>{m.name}</p>
                <p style={styles.milestoneMeta}>
                  {m.owner?.full_name || 'Unassigned'}
                  {m.planned_date ? ` · due ${new Date(m.planned_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}
                </p>
              </div>
              <span style={styles.milestoneStatus}>{m.percent_complete}%</span>
            </div>
            <div style={styles.milestoneProgressTrack}>
              <div style={{ ...styles.milestoneProgressFill, width: `${m.percent_complete}%` }} />
            </div>
            {m.tasks && m.tasks.length > 0 && (
              <div style={styles.milestoneTasks}>
                {m.tasks.map((t) => (
                  <span key={t.id} style={styles.milestoneTaskChip}>
                    {t.status === 'completed' && <i className="ti ti-check" style={{ fontSize: 11, marginRight: 3 }} aria-hidden="true" />}
                    {t.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))
      )}

      {project.direct_tasks && project.direct_tasks.length > 0 && (
        <>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Tasks</h2>
          </div>
          {project.direct_tasks.map((t) => (
            <div key={t.id} style={styles.directTaskRow}>
              <span style={styles.directTaskName}>
                {t.status === 'completed' && <i className="ti ti-check" style={{ fontSize: 12, marginRight: 5, color: 'var(--success)' }} aria-hidden="true" />}
                {t.name}
              </span>
              <span style={styles.directTaskMeta}>{t.assignee?.full_name || 'Unassigned'}</span>
            </div>
          ))}
        </>
      )}

      <details style={{ marginTop: 24 }}>
        <summary style={styles.logSummary}>Audit trail</summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
          {auditLog.length === 0 && <p style={styles.emptySub}>No activity logged yet.</p>}
          {auditLog.map((entry) => (
            <p key={entry.id} style={styles.logLine}>
              <span style={styles.logTime}>
                {new Date(entry.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
              {' — '}{entry.actor?.full_name} {entry.detail}
            </p>
          ))}
        </div>
      </details>
    </Shell>
  )
}

const styles = {
  backLink: { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-2)', fontSize: 13, fontWeight: 600, padding: '4px 0', marginBottom: 16 },
  actionErrorBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, background: 'var(--danger-light)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 16 },
  actionErrorText: { fontSize: 13, color: 'var(--danger)', margin: 0 },
  actionErrorDismiss: { background: 'none', border: 'none', color: 'var(--danger)', flexShrink: 0 },
  headerCard: { background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '22px 24px', marginBottom: 24, boxShadow: '0 2px 8px rgba(0,80,160,0.05)' },
  headerTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, gap: 12 },
  teamLabel: { fontSize: 11.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 4px' },
  title: { fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--text)' },
  healthBadge: { fontSize: 12, fontWeight: 700, padding: '5px 13px 5px 9px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, whiteSpace: 'nowrap' },
  healthDot: { width: 7, height: 7, borderRadius: '50%', display: 'inline-block' },
  peopleRow: { display: 'flex', gap: 32, paddingBottom: 18, marginBottom: 18, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' },
  fieldLabel: { fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.03em', margin: '0 0 3px' },
  fieldValue: { fontSize: 13.5, fontWeight: 700, margin: 0, color: 'var(--text)' },
  progressSection: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 },
  progressTrack: { flex: 1, height: 7, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', background: 'linear-gradient(90deg, #0050A0, #2D8FE0)' },
  progressLabel: { fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)', whiteSpace: 'nowrap' },
  stageRow: { display: 'flex', justifyContent: 'space-between', marginBottom: 18 },
  stageStep: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 },
  stageDot: { width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 },
  stageLabel: { fontSize: 10.5, color: 'var(--text-3)', margin: 0, textAlign: 'center' },
  actionRow: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  pendingStageBox: { background: 'var(--warning-light)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 16 },
  pendingStageTitle: { fontSize: 13, fontWeight: 700, color: 'var(--warning)', margin: '0 0 4px' },
  pendingStageDetail: { fontSize: 12.5, color: 'var(--warning)', margin: '0 0 10px', lineHeight: 1.5 },
  waitingText: { fontSize: 12, color: 'var(--warning)', margin: 0, fontStyle: 'italic' },
  advanceFormNote: { fontSize: 12.5, color: 'var(--text-2)', margin: 0 },
  logSummary: { fontSize: 12, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.03em', cursor: 'pointer' },
  timelineWrap: { marginTop: 14, paddingLeft: 4 },
  timelineRow: { display: 'flex', gap: 12, alignItems: 'flex-start', paddingBottom: 14, position: 'relative' },
  timelineDot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0, marginTop: 4 },
  timelineContent: { flex: 1 },
  timelineDate: { fontSize: 11.5, color: 'var(--text-3)', margin: '0 0 2px', fontWeight: 600 },
  timelineLabel: { fontSize: 13.5, color: 'var(--text)', margin: 0, fontWeight: 600 },
  logLine: { fontSize: 12, color: 'var(--text-2)', margin: 0 },
  logTime: { color: 'var(--text-3)' },
  healthForm: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14, padding: 14, background: 'var(--surface-2)', borderRadius: 'var(--radius)' },
  healthOption: { flex: 1, fontSize: 12.5, fontWeight: 700, padding: '8px 0', borderRadius: 'var(--radius)', border: '2px solid transparent' },
  textarea: { fontSize: 13, padding: '9px 11px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: '#fff', minHeight: 56, fontFamily: 'inherit', resize: 'vertical' },
  input: { fontSize: 13, padding: '8px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: '#fff', color: 'var(--text)' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text)' },
  addLink: { display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--bupa-blue)', fontSize: 12.5, fontWeight: 700 },
  milestoneForm: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14, padding: 14, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', boxShadow: '0 2px 8px rgba(0,80,160,0.05)' },
  milestoneCard: { background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '16px 18px', marginBottom: 10, boxShadow: '0 2px 8px rgba(0,80,160,0.05)' },
  milestoneTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  milestoneName: { fontSize: 14.5, fontWeight: 700, margin: 0, color: 'var(--text)' },
  milestoneMeta: { fontSize: 12, color: 'var(--text-3)', margin: '3px 0 0' },
  milestoneStatus: { fontSize: 13, fontWeight: 700, color: 'var(--bupa-blue)' },
  milestoneProgressTrack: { height: 5, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden', marginBottom: 10 },
  milestoneProgressFill: { height: '100%', background: 'var(--bupa-blue)' },
  milestoneTasks: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  milestoneTaskChip: { fontSize: 11.5, color: 'var(--text-2)', background: 'var(--surface-2)', padding: '3px 9px', borderRadius: 999 },
  directTaskRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 8, boxShadow: '0 1px 4px rgba(0,80,160,0.04)' },
  directTaskName: { fontSize: 13.5, fontWeight: 600, color: 'var(--text)' },
  directTaskMeta: { fontSize: 12, color: 'var(--text-3)' },
  smallBtn: { fontSize: 13, padding: '8px 14px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--bupa-blue)', color: '#fff', fontWeight: 700 },
  smallBtnOutline: { fontSize: 13, padding: '8px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'none', color: 'var(--text)', fontWeight: 600 },
  emptyState: { textAlign: 'center', padding: '50px 0', color: 'var(--text-3)' },
  emptyTitle: { fontSize: 15, fontWeight: 700, color: 'var(--text-2)', margin: '0 0 4px' },
  emptySub: { fontSize: 13, margin: 0 },
  retryBtn: { marginTop: 14, fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--bupa-blue)', color: '#fff' },
}
