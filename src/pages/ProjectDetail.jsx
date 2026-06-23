import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { fetchProjectDetail, updateProjectHealth, createMilestone, updateMilestone, archiveProject, cancelProject, closeProject, deleteProject, addProjectTeam, removeProjectTeam } from '../lib/projects'
import { createTask, moveTaskToPhase, fetchTeams, fetchProfiles, fetchNotifications } from '../lib/tasks'
import { requestStageAdvance, resolveStageAdvance } from '../lib/governance'
import { supabase } from '../lib/supabase'
import { healthColor } from '../lib/teamColors'
import { peopleVisibleForTeam } from '../lib/permissions'
import Shell from '../components/Shell'
import TaskDetail from '../components/TaskDetail'
import AutoGrowTextarea from '../components/AutoGrowTextarea'

const STATUS_FLOW = ['initiation', 'planning', 'execution', 'final_review', 'closure', 'closed']
const STATUS_LABELS = {
  initiation: 'Initiation', planning: 'Planning', execution: 'Execution',
  final_review: 'Final review', closure: 'Closure', closed: 'Closed',
  cancelled: 'Cancelled', archived: 'Archived',
}

export default function ProjectDetail() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [project, setProject] = useState(null)
  const [teams, setTeams] = useState([])
  const [people, setPeople] = useState([])
  const [selectedTaskId, setSelectedTaskId] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [showHealthForm, setShowHealthForm] = useState(false)
  const [newHealth, setNewHealth] = useState('green')
  const [healthReason, setHealthReason] = useState('')
  const [showPhaseForm, setShowPhaseForm] = useState(false)
  const [phaseName, setPhaseName] = useState('')
  const [phaseOwner, setPhaseOwner] = useState('')
  const [phaseDate, setPhaseDate] = useState('')
  const [phaseTaskForms, setPhaseTaskForms] = useState({})
  const [newTeam, setNewTeam] = useState({ teamId: '', role: 'contributing' })
  const [pendingStageRequest, setPendingStageRequest] = useState(null)
  const [showAdvanceForm, setShowAdvanceForm] = useState(false)
  const [advanceNote, setAdvanceNote] = useState('')
  const [showLifecycleMenu, setShowLifecycleMenu] = useState(false)
  const [confirmingAction, setConfirmingAction] = useState(null) // 'cancel' | 'delete' | 'close' | null
  const [lifecycleReason, setLifecycleReason] = useState('')

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

      const { data: pendingReq } = await supabase
        .from('stage_advance_requests')
        .select('*, requester:profiles!stage_advance_requests_requested_by_fkey(id, full_name)')
        .eq('project_id', projectId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setPendingStageRequest(pendingReq || null)
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

  function submitHealthChange(e) {
    e.preventDefault()
    if (!healthReason.trim()) return
    runAction(async () => {
      await updateProjectHealth({ projectId: project.id, newHealth, oldHealth: project.health, reason: healthReason, changedBy: profile.id })
      setShowHealthForm(false)
      setHealthReason('')
      await load()
    })
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

  function handleArchive() {
    runAction(async () => {
      await archiveProject(project.id, profile.id)
      await load()
    })
  }

  function handleCancelConfirmed() {
    if (!lifecycleReason.trim()) return
    setConfirmingAction(null)
    runAction(async () => {
      await cancelProject(project.id, profile.id, lifecycleReason)
      setLifecycleReason('')
      await load()
    })
  }

  function handleCloseConfirmed() {
    if (!lifecycleReason.trim()) return
    setConfirmingAction(null)
    runAction(async () => {
      await closeProject(project.id, profile.id, lifecycleReason)
      setLifecycleReason('')
      await load()
    })
  }

  function handleDeleteConfirmed() {
    if (!lifecycleReason.trim()) return
    setConfirmingAction(null)
    runAction(async () => {
      await deleteProject({ projectId: project.id, actorId: profile.id, reason: lifecycleReason })
      navigate('/projects')
    })
  }

  function submitPhase(e) {
    e.preventDefault()
    runAction(async () => {
      await createMilestone({
        projectId: project.id,
        name: phaseName,
        ownerId: phaseOwner || null,
        plannedDate: phaseDate || null,
        sortOrder: project.milestones?.length || 0,
        createdBy: profile.id,
      })
      setShowPhaseForm(false)
      setPhaseName(''); setPhaseOwner(''); setPhaseDate('')
      await load()
    })
  }

  function updatePhaseTaskForm(phaseId, field, value) {
    setPhaseTaskForms((forms) => ({
      ...forms,
      [phaseId]: {
        name: '', description: '', assigneeId: profile.id, targetDate: '', priority: 'medium',
        ...(forms[phaseId] || {}),
        [field]: value,
      },
    }))
  }

  function submitPhaseTask(e, phase) {
    e.preventDefault()
    const form = phaseTaskForms[phase.id]
    if (!form?.name?.trim()) return
    runAction(async () => {
      const created = await createTask({
        name: form.name,
        description: form.description || '',
        teamId: project.team_id,
        projectId: project.id,
        milestoneId: phase.id,
        ownerId: profile.id,
        assigneeId: form.assigneeId || null,
        targetDate: form.targetDate || phase.planned_date || null,
        priority: form.priority || 'medium',
        subActions: [],
      })
      setPhaseTaskForms((forms) => ({ ...forms, [phase.id]: { name: '', description: '', assigneeId: profile.id, targetDate: '', priority: 'medium' } }))
      await load()
      if (created?.id) setSelectedTaskId(created.id)
    })
  }

  function handleMoveToPhase(taskId, milestoneId) {
    if (!milestoneId) return
    runAction(async () => {
      await moveTaskToPhase(taskId, milestoneId)
      await load()
    })
  }

  function handleAddTeam(e) {
    e.preventDefault()
    if (!newTeam.teamId) return
    runAction(async () => {
      await addProjectTeam({ projectId: project.id, teamId: newTeam.teamId, role: newTeam.role, actorId: profile.id })
      setNewTeam({ teamId: '', role: 'contributing' })
      await load()
    })
  }

  function handleRemoveTeam(id) {
    runAction(async () => {
      await removeProjectTeam({ id, projectId: project.id, actorId: profile.id })
      await load()
    })
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  if (loadError) {
    return (
      <Shell teams={teams} teamFilter={null} setTeamFilter={() => {}} notifCount={unreadCount} onBellClick={() => {}}>
        <button onClick={() => navigate('/projects')} style={styles.backLink}>← Back to projects</button>
        <div style={styles.emptyState}><p style={{ ...styles.emptyTitle, color: 'var(--danger)' }}>Couldn't load this project</p><p style={styles.emptySub}>{loadError}</p><button onClick={load} style={styles.retryBtn}>Try again</button></div>
      </Shell>
    )
  }

  if (loading || !project) {
    return (
      <Shell teams={teams} teamFilter={null} setTeamFilter={() => {}} notifCount={unreadCount} onBellClick={() => {}}>
        <button onClick={() => navigate('/projects')} style={styles.backLink}>← Back to projects</button>
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>Loading…</p>
      </Shell>
    )
  }

  const h = healthColor(project.health)
  const isPM = project.project_manager_id === profile.id
  const isSponsor = project.sponsor_id === profile.id
  const isCoordinator = project.project_coordinator_id === profile.id
  const canEdit = profile.is_mbm || isPM || isSponsor || isCoordinator
  // Per the original design: the PM requests a stage advance, and either
  // the sponsor or MBM approves it — not the PM themselves.
  const canApproveStage = profile.is_mbm || isSponsor
  // Per the audit decision: delete/archive/cancel/close all share the
  // SAME restricted access — owner (creator), PM, or MBM. Distinct from
  // canEdit above, which also includes the sponsor for lighter edits.
  const isOwner = project.created_by === profile.id
  const canManageLifecycle = profile.is_mbm || isPM || isOwner
  const isTerminal = ['closed', 'cancelled', 'archived'].includes(project.status)
  const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(project.status) + 1]

  return (
    <Shell teams={teams} teamFilter={null} setTeamFilter={() => {}} notifCount={unreadCount} onBellClick={() => {}}>
      <button onClick={() => navigate('/projects')} style={styles.backLink}>← Back to projects</button>

      {actionError && <div style={styles.actionErrorBox}><p style={styles.actionErrorText}>{actionError}</p></div>}

      <div style={styles.headerCard}>
        <div style={styles.headerTop}>
          <div>
            <p style={styles.teamLabel}>{project.team?.name}</p>
            <h1 style={styles.title}>{project.name}</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => navigate(`/projects/${project.id}/dashboard`)} style={styles.dashboardLinkBtn}>
              <i className="ti ti-chart-donut" style={{ fontSize: 14 }} aria-hidden="true" /> Dashboard
            </button>
            <span style={{ ...styles.healthBadge, background: h.bg, color: h.text }}><span style={{ ...styles.healthDot, background: h.text }} />{h.label}</span>
            {canManageLifecycle && project.status !== 'archived' && (
              <div style={{ position: 'relative' }}>
                <button onClick={() => setShowLifecycleMenu((s) => !s)} style={styles.lifecycleMenuBtn} aria-label="Project actions">
                  <i className="ti ti-dots-vertical" style={{ fontSize: 16 }} aria-hidden="true" />
                </button>
                {showLifecycleMenu && (
                  <div style={styles.lifecycleMenu} onMouseLeave={() => setShowLifecycleMenu(false)}>
                    {(project.status === 'closed' || project.status === 'cancelled') && (
                      <button onClick={() => { setShowLifecycleMenu(false); handleArchive() }} style={styles.lifecycleMenuItem}>
                        <i className="ti ti-archive" style={{ fontSize: 14 }} aria-hidden="true" /> Archive
                      </button>
                    )}
                    {project.status !== 'closed' && project.status !== 'cancelled' && (
                      <>
                        <button onClick={() => { setShowLifecycleMenu(false); setConfirmingAction('close') }} style={styles.lifecycleMenuItem}>
                          <i className="ti ti-flag-check" style={{ fontSize: 14 }} aria-hidden="true" /> Close project
                        </button>
                        <button onClick={() => { setShowLifecycleMenu(false); setConfirmingAction('cancel') }} style={styles.lifecycleMenuItem}>
                          <i className="ti ti-ban" style={{ fontSize: 14 }} aria-hidden="true" /> Cancel project
                        </button>
                      </>
                    )}
                    <button onClick={() => { setShowLifecycleMenu(false); setConfirmingAction('delete') }} style={styles.lifecycleMenuItemDanger}>
                      <i className="ti ti-trash" style={{ fontSize: 14 }} aria-hidden="true" /> Delete project
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {confirmingAction && (
          <div style={styles.confirmBox}>
            <p style={styles.confirmTitle}>
              {confirmingAction === 'cancel' && 'Cancel this project?'}
              {confirmingAction === 'close' && 'Close this project?'}
              {confirmingAction === 'delete' && 'Delete this project?'}
            </p>
            <p style={styles.confirmDetail}>
              {confirmingAction === 'cancel' && 'The project will stop progressing. This can be undone only by an MBM, via direct database access.'}
              {confirmingAction === 'close' && 'All phases must be done and all tasks completed before a project can close — this will be checked automatically.'}
              {confirmingAction === 'delete' && 'The project will be hidden from everyone, including you. Nothing is permanently erased, but recovering it requires a database administrator.'}
            </p>
            <AutoGrowTextarea
              value={lifecycleReason} onChange={(e) => setLifecycleReason(e.target.value)}
              placeholder={confirmingAction === 'close' ? 'Closure note (required)' : 'Reason (required)'}
              style={styles.textarea}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                onClick={() => {
                  if (confirmingAction === 'cancel') handleCancelConfirmed()
                  else if (confirmingAction === 'close') handleCloseConfirmed()
                  else if (confirmingAction === 'delete') handleDeleteConfirmed()
                }}
                disabled={busy || !lifecycleReason.trim()}
                style={confirmingAction === 'delete' ? styles.dangerBtn : styles.smallBtn}
              >
                {busy ? 'Working…' : 'Confirm'}
              </button>
              <button onClick={() => { setConfirmingAction(null); setLifecycleReason('') }} disabled={busy} style={styles.smallBtnOutline}>Cancel</button>
            </div>
          </div>
        )}

        <div style={styles.peopleRow}>
          <Field label="Sponsor" value={project.sponsor?.full_name || '—'} />
          <Field label="Project manager" value={project.project_manager?.full_name || '—'} />
          <Field label="Project coordinator" value={project.coordinator?.full_name || '—'} />
          <Field label="Start date" value={formatDate(project.start_date)} />
          <Field label="Target completion" value={formatDate(project.target_completion_date)} />
          <Field label="Stage" value={STATUS_LABELS[project.status] || project.status} />
        </div>

        <div style={styles.progressSection}>
          <div style={styles.progressTrack}><div style={{ ...styles.progressFill, width: `${project.percent_complete || 0}%` }} /></div>
          <span style={styles.progressLabel}>{project.percent_complete || 0}% complete</span>
        </div>

        <div style={styles.infoGrid}>
          <InfoBox title="Strategic objective" text={project.strategic_objective} />
          <InfoBox title="Business justification" text={project.business_justification} />
          <InfoBox title="Expected outcome" text={project.expected_outcome} />
          <InfoBox title="Success criteria" text={project.success_criteria} />
        </div>

        <div style={styles.teamsBlock}>
          <p style={styles.teamsLabel}>Teams</p>
          <div style={styles.teamChips}>
            <span style={styles.teamChipOwner}>{project.team?.name || 'Owner team'} · Owner</span>
            {(project.project_teams || []).map((pt) => (
              <span key={pt.id} style={styles.teamChip}>
                {pt.team?.name} · <span style={{ textTransform: 'capitalize' }}>{pt.role}</span>
                {canEdit && !isTerminal && (
                  <button onClick={() => handleRemoveTeam(pt.id)} disabled={busy} style={styles.teamChipRemove} title="Remove team" aria-label="Remove team">×</button>
                )}
              </span>
            ))}
          </div>
          {canEdit && !isTerminal && (
            <form onSubmit={handleAddTeam} style={styles.addTeamForm}>
              <select value={newTeam.teamId} onChange={(e) => setNewTeam((s) => ({ ...s, teamId: e.target.value }))} style={styles.input}>
                <option value="">Add a team…</option>
                {teams
                  .filter((t) => t.id !== project.team_id && !(project.project_teams || []).some((pt) => pt.team_id === t.id))
                  .map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <select value={newTeam.role} onChange={(e) => setNewTeam((s) => ({ ...s, role: e.target.value }))} style={styles.input}>
                <option value="contributing">Contributing</option>
                <option value="supporting">Supporting</option>
                <option value="approver">Approver</option>
              </select>
              <button type="submit" disabled={busy || !newTeam.teamId} style={styles.smallBtn}>Add</button>
            </form>
          )}
        </div>

        {pendingStageRequest && (
          <div style={styles.pendingStageBox}>
            <p style={styles.pendingStageTitle}>
              Stage advance requested: {STATUS_LABELS[pendingStageRequest.from_status]} → {STATUS_LABELS[pendingStageRequest.to_status]}
            </p>
            <p style={styles.pendingStageDetail}>
              Requested by {pendingStageRequest.requester?.full_name}
              {typeof pendingStageRequest.milestone_completion_snapshot === 'number'
                ? ` · phases ${pendingStageRequest.milestone_completion_snapshot}% complete at time of request`
                : ''}
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

        {canEdit && !isTerminal && (
          <div style={styles.actionRow}>
            {nextStatus && !pendingStageRequest && (
              <button onClick={() => setShowAdvanceForm(true)} disabled={busy} style={styles.smallBtn}>
                Request advance to {STATUS_LABELS[nextStatus]}
              </button>
            )}
            <button onClick={() => { setShowHealthForm(true); setNewHealth(project.health) }} disabled={busy} style={styles.smallBtnOutline}>Update health status</button>
          </div>
        )}

        {showAdvanceForm && (
          <form onSubmit={submitAdvanceRequest} style={styles.healthForm}>
            <AutoGrowTextarea
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
                return <button key={opt} type="button" onClick={() => setNewHealth(opt)} style={{ ...styles.healthOption, background: newHealth === opt ? oc.bg : 'var(--surface-2)', color: newHealth === opt ? oc.text : 'var(--text-2)', borderColor: newHealth === opt ? oc.text : 'transparent' }}>{oc.label}</button>
              })}
            </div>
            <AutoGrowTextarea value={healthReason} onChange={(e) => setHealthReason(e.target.value)} required placeholder="Reason for this status" style={styles.textarea} />
            <div style={{ display: 'flex', gap: 8 }}><button type="submit" disabled={busy} style={styles.smallBtn}>Save</button><button type="button" onClick={() => setShowHealthForm(false)} disabled={busy} style={styles.smallBtnOutline}>Cancel</button></div>
          </form>
        )}
      </div>

      <div style={styles.sectionHeader}>
        <h2 style={styles.sectionTitle}>Phases</h2>
        {canEdit && !isTerminal && <button onClick={() => setShowPhaseForm(true)} style={styles.addLink}>+ Add phase</button>}
      </div>

      {showPhaseForm && (
        <form onSubmit={submitPhase} style={styles.phaseForm}>
          <input value={phaseName} onChange={(e) => setPhaseName(e.target.value)} placeholder="Phase name" required style={styles.input} />
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={phaseOwner} onChange={(e) => setPhaseOwner(e.target.value)} style={{ ...styles.input, flex: 1 }}><option value="">Unassigned</option>{peopleVisibleForTeam(profile, people, project.team_id).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select>
            <input type="date" value={phaseDate} onChange={(e) => setPhaseDate(e.target.value)} style={{ ...styles.input, flex: 1 }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}><button type="submit" disabled={busy} style={styles.smallBtn}>Add phase</button><button type="button" onClick={() => setShowPhaseForm(false)} disabled={busy} style={styles.smallBtnOutline}>Cancel</button></div>
        </form>
      )}

      {(!project.milestones || project.milestones.length === 0) ? (
        <div style={styles.emptyState}><p style={styles.emptyTitle}>No phases yet</p><p style={styles.emptySub}>Break this project into phases, then add tasks under each phase.</p></div>
      ) : project.milestones.map((phase) => {
        const form = phaseTaskForms[phase.id] || { name: '', description: '', assigneeId: profile.id, targetDate: '', priority: 'medium' }
        const phaseTasks = phase.tasks || []
        const incompleteCount = phaseTasks.filter((t) => t.status !== 'completed').length
        const canMarkDone = phaseTasks.length === 0 || incompleteCount === 0
        return (
          <div key={phase.id} style={styles.phaseCard}>
            <div style={styles.phaseTop}>
              <div><p style={styles.phaseName}>{phase.name}</p><p style={styles.phaseMeta}>{phase.owner?.full_name || 'Unassigned'}{phase.planned_date ? ` · due ${formatDate(phase.planned_date)}` : ''}</p></div>
              <select
                value={phase.status}
                onChange={(e) => runAction(async () => { await updateMilestone(phase.id, { status: e.target.value }); await load() })}
                disabled={!canEdit || busy}
                title={!canMarkDone ? `${incompleteCount} task(s) still not completed — finish them to mark this phase done` : undefined}
                style={styles.phaseStatusSelect}
              >
                <option value="not_started">Not started</option>
                <option value="in_progress">In progress</option>
                <option value="blocked">Blocked</option>
                <option value="done" disabled={!canMarkDone}>Done{!canMarkDone ? ` (${incompleteCount} task${incompleteCount === 1 ? '' : 's'} open)` : ''}</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div style={styles.phaseProgressTrack}><div style={{ ...styles.phaseProgressFill, width: `${phase.percent_complete || 0}%` }} /></div>
            <div style={styles.phaseTasks}>
              {phaseTasks.length === 0 && <p style={styles.emptySub}>No tasks in this phase yet.</p>}
              {phaseTasks.map((t) => <button key={t.id} type="button" onClick={() => setSelectedTaskId(t.id)} style={styles.phaseTaskRow}><span style={styles.phaseTaskName}>{t.name}</span><span style={styles.phaseTaskMeta}>{t.assignee?.full_name || 'Unassigned'} · {t.status?.replaceAll('_', ' ')}</span></button>)}
            </div>
            {canEdit && !isTerminal && (
              <form onSubmit={(e) => submitPhaseTask(e, phase)} style={styles.phaseTaskForm}>
                <input value={form.name} onChange={(e) => updatePhaseTaskForm(phase.id, 'name', e.target.value)} placeholder="Add task under this phase" style={{ ...styles.input, flex: 1 }} />
                <select value={form.assigneeId} onChange={(e) => updatePhaseTaskForm(phase.id, 'assigneeId', e.target.value)} style={styles.input}><option value="">Unassigned</option>{peopleVisibleForTeam(profile, people, project.team_id).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select>
                <select value={form.priority} onChange={(e) => updatePhaseTaskForm(phase.id, 'priority', e.target.value)} style={styles.input} title="Priority">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
                <input type="date" value={form.targetDate} onChange={(e) => updatePhaseTaskForm(phase.id, 'targetDate', e.target.value)} style={styles.input} />
                <button type="submit" disabled={busy || !form.name.trim()} style={styles.smallBtn}>Add task</button>
              </form>
            )}
          </div>
        )
      })}

      {project.direct_tasks && project.direct_tasks.length > 0 && (
        <>
          <div style={styles.sectionHeader}><h2 style={styles.sectionTitle}>Tasks without phase</h2></div>
          <p style={styles.directTaskHint}>
            These tasks belong to the project but aren&apos;t filed under a phase yet.
            {canEdit && !isTerminal && (project.milestones || []).length > 0 ? ' File each one under a phase to keep the plan organized.' : ''}
          </p>
          {project.direct_tasks.map((t) => (
            <div key={t.id} style={styles.directTaskRow}>
              <button type="button" onClick={() => setSelectedTaskId(t.id)} style={styles.directTaskOpen}>
                <span style={styles.directTaskName}>{t.name}</span>
                <span style={styles.directTaskMeta}>{t.assignee?.full_name || 'Unassigned'} · {t.status?.replaceAll('_', ' ')}</span>
              </button>
              {canEdit && !isTerminal && (project.milestones || []).length > 0 && (
                <select
                  value=""
                  onChange={(e) => handleMoveToPhase(t.id, e.target.value)}
                  disabled={busy}
                  style={styles.moveSelect}
                  title="Move this task under a phase"
                >
                  <option value="">Move to phase…</option>
                  {(project.milestones || []).map((ph) => <option key={ph.id} value={ph.id}>{ph.name}</option>)}
                </select>
              )}
            </div>
          ))}
        </>
      )}

      {selectedTaskId && (
        <TaskDetail
          taskId={selectedTaskId}
          people={people}
          allTasks={project?.tasks || []}
          onClose={() => setSelectedTaskId(null)}
          onChanged={() => { load() }}
        />
      )}
    </Shell>
  )
}

function Field({ label, value }) {
  return <div><p style={styles.fieldLabel}>{label}</p><p style={styles.fieldValue}>{value || '—'}</p></div>
}

function InfoBox({ title, text }) {
  return <div style={styles.infoBox}><p style={styles.infoTitle}>{title}</p><p style={styles.infoText}>{text || '—'}</p></div>
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

const styles = {
  backLink: { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-2)', fontSize: 13, fontWeight: 600, padding: '4px 0', marginBottom: 16 },
  actionErrorBox: { background: 'var(--danger-light)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 16 },
  actionErrorText: { fontSize: 13, color: 'var(--danger)', margin: 0 },
  headerCard: { background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '22px 24px', marginBottom: 24, boxShadow: '0 2px 8px rgba(0,80,160,0.05)' },
  headerTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, gap: 12 },
  teamLabel: { fontSize: 11.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 4px' },
  title: { fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--text)' },
  healthBadge: { fontSize: 12, fontWeight: 700, padding: '5px 13px 5px 9px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, whiteSpace: 'nowrap' },
  lifecycleMenuBtn: { background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '6px 8px', color: 'var(--text-2)', cursor: 'pointer' },
  dashboardLinkBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '7px 12px', color: 'var(--bupa-blue)', fontWeight: 750, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap' },
  lifecycleMenu: {
    position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: 'var(--surface)',
    borderRadius: 'var(--radius)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 6,
    minWidth: 180, zIndex: 20,
  },
  lifecycleMenuItem: {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
    background: 'none', border: 'none', padding: '9px 12px', fontSize: 13, fontWeight: 600,
    color: 'var(--text)', borderRadius: 'var(--radius)', cursor: 'pointer',
  },
  lifecycleMenuItemDanger: {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
    background: 'none', border: 'none', padding: '9px 12px', fontSize: 13, fontWeight: 600,
    color: 'var(--danger)', borderRadius: 'var(--radius)', cursor: 'pointer',
  },
  confirmBox: { background: 'var(--danger-light)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 18 },
  confirmTitle: { fontSize: 14, fontWeight: 700, color: 'var(--danger)', margin: '0 0 4px' },
  confirmDetail: { fontSize: 12.5, color: 'var(--danger)', margin: '0 0 10px', lineHeight: 1.5 },
  dangerBtn: { fontSize: 13, padding: '8px 14px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--danger)', color: '#fff', fontWeight: 700 },
  healthDot: { width: 7, height: 7, borderRadius: '50%', display: 'inline-block' },
  peopleRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, paddingBottom: 18, marginBottom: 18, borderBottom: '1px solid var(--border)' },
  fieldLabel: { fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.03em', margin: '0 0 3px' },
  fieldValue: { fontSize: 13.5, fontWeight: 700, margin: 0, color: 'var(--text)' },
  progressSection: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 },
  progressTrack: { flex: 1, height: 7, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', background: 'linear-gradient(90deg, #0050A0, #2D8FE0)' },
  progressLabel: { fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)', whiteSpace: 'nowrap' },
  infoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 14 },
  infoBox: { background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: '12px 14px' },
  infoTitle: { fontSize: 11.5, fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', margin: '0 0 6px' },
  infoText: { fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' },
  actionRow: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  pendingStageBox: { background: 'var(--warning-light)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 16 },
  pendingStageTitle: { fontSize: 13, fontWeight: 700, color: 'var(--warning)', margin: '0 0 4px' },
  pendingStageDetail: { fontSize: 12.5, color: 'var(--warning)', margin: '0 0 10px', lineHeight: 1.5 },
  waitingText: { fontSize: 12, color: 'var(--warning)', margin: 0, fontStyle: 'italic' },
  healthForm: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14, padding: 14, background: 'var(--surface-2)', borderRadius: 'var(--radius)' },
  healthOption: { flex: 1, fontSize: 12.5, fontWeight: 700, padding: '8px 0', borderRadius: 'var(--radius)', border: '2px solid transparent' },
  textarea: { fontSize: 13, padding: '9px 11px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: '#fff', minHeight: 56, fontFamily: 'inherit', resize: 'vertical' },
  input: { fontSize: 13, padding: '8px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: '#fff', color: 'var(--text)' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--text)' },
  addLink: { background: 'none', border: 'none', color: 'var(--bupa-blue)', fontSize: 12.5, fontWeight: 800 },
  phaseForm: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14, padding: 14, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', boxShadow: '0 2px 8px rgba(0,80,160,0.05)' },
  phaseCard: { background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '16px 18px', marginBottom: 12, boxShadow: '0 2px 8px rgba(0,80,160,0.05)' },
  phaseTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 12 },
  phaseName: { fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--text)' },
  phaseMeta: { fontSize: 12, color: 'var(--text-3)', margin: '3px 0 0' },
  phaseStatusSelect: { fontSize: 12, fontWeight: 700, border: '1px solid var(--border)', borderRadius: 999, padding: '6px 10px', color: 'var(--bupa-blue)', background: '#fff' },
  phaseProgressTrack: { height: 5, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden', marginBottom: 10 },
  phaseProgressFill: { height: '100%', background: 'var(--bupa-blue)' },
  phaseTasks: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 },
  phaseTaskRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: '8px 10px', gap: 10, border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' },
  phaseTaskName: { fontSize: 13, fontWeight: 700, color: 'var(--text)' },
  phaseTaskMeta: { fontSize: 12, color: 'var(--text-3)' },
  phaseTaskForm: { display: 'grid', gridTemplateColumns: '1.4fr 1fr 0.9fr 0.8fr auto', gap: 8, alignItems: 'center', marginTop: 10 },
  directTaskRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 8, boxShadow: '0 1px 4px rgba(0,80,160,0.04)' },
  directTaskOpen: { minWidth: 0, flex: 1, border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', padding: 0 },
  directTaskName: { display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--text)' },
  directTaskMeta: { display: 'block', fontSize: 12, color: 'var(--text-3)', marginTop: 2, textTransform: 'capitalize' },
  directTaskHint: { fontSize: 12.5, color: 'var(--text-3)', margin: '0 0 12px', maxWidth: 620 },
  moveSelect: { fontSize: 12.5, padding: '6px 9px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-2)', flexShrink: 0, cursor: 'pointer' },
  teamsBlock: { marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' },
  teamsLabel: { fontSize: 11.5, fontWeight: 900, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.03em', margin: '0 0 10px' },
  teamChips: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  teamChipOwner: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 800, borderRadius: 999, padding: '5px 11px', background: 'var(--info-light)', color: 'var(--info)', textTransform: 'capitalize' },
  teamChip: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, borderRadius: 999, padding: '5px 11px', background: 'var(--surface-2)', color: 'var(--text-2)' },
  teamChipRemove: { border: 'none', background: 'transparent', color: 'var(--text-3)', fontSize: 15, lineHeight: 1, cursor: 'pointer', padding: 0, marginLeft: 2 },
  addTeamForm: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  smallBtn: { fontSize: 13, padding: '8px 14px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--bupa-blue)', color: '#fff', fontWeight: 700 },
  smallBtnOutline: { fontSize: 13, padding: '8px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'none', color: 'var(--text)', fontWeight: 600 },
  emptyState: { textAlign: 'center', padding: '50px 0', color: 'var(--text-3)' },
  emptyTitle: { fontSize: 15, fontWeight: 700, color: 'var(--text-2)', margin: '0 0 4px' },
  emptySub: { fontSize: 13, margin: 0, color: 'var(--text-3)' },
  retryBtn: { marginTop: 14, fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--bupa-blue)', color: '#fff' },
}
