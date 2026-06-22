import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { fetchProjectDetail, updateProjectStatus, updateProjectHealth, createMilestone, updateMilestone } from '../lib/projects'
import { fetchTeams, fetchProfiles, fetchNotifications, markNotificationRead } from '../lib/tasks'
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

  function handleStatusAdvance() {
    const idx = STATUS_FLOW.indexOf(project.status)
    const next = STATUS_FLOW[idx + 1]
    if (!next) return
    runAction(async () => {
      await updateProjectStatus(project.id, next)
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
  const canEdit = profile.is_mbm || project.project_manager_id === profile.id || project.sponsor_id === profile.id
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

        {canEdit && (
          <div style={styles.actionRow}>
            {nextStatus && (
              <button onClick={handleStatusAdvance} disabled={busy} style={styles.smallBtn}>
                Advance to {STATUS_LABELS[nextStatus]}
              </button>
            )}
            <button onClick={() => { setShowHealthForm(true); setNewHealth(project.health) }} disabled={busy} style={styles.smallBtnOutline}>
              Update health status
            </button>
          </div>
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
                    {t.status === 'done' && <i className="ti ti-check" style={{ fontSize: 11, marginRight: 3 }} aria-hidden="true" />}
                    {t.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))
      )}
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
  smallBtn: { fontSize: 13, padding: '8px 14px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--bupa-blue)', color: '#fff', fontWeight: 700 },
  smallBtnOutline: { fontSize: 13, padding: '8px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'none', color: 'var(--text)', fontWeight: 600 },
  emptyState: { textAlign: 'center', padding: '50px 0', color: 'var(--text-3)' },
  emptyTitle: { fontSize: 15, fontWeight: 700, color: 'var(--text-2)', margin: '0 0 4px' },
  emptySub: { fontSize: 13, margin: 0 },
  retryBtn: { marginTop: 14, fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--bupa-blue)', color: '#fff' },
}
