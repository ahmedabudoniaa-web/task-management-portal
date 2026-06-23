import { useEffect, useState } from 'react'
import { StatusBadge, PriorityBadge } from './Badges'
import { useAuth } from '../lib/AuthContext'
import {
  fetchTaskDetail, acceptTask, rejectTask, requestDateChange, resolveDateChange,
  createSubAction, updateSubActionStatus, addNote, editNote, markTaskDone,
  assignTask, deleteTask, setTaskBlocked, cancelTask,
} from '../lib/tasks'
import { fetchTaskDependencies, addDependency, removeDependency, getMentionSuggestions, insertMention } from '../lib/dependencies'
import MentionText from './MentionText'
import AutoGrowTextarea from './AutoGrowTextarea'

export default function TaskDetail({ taskId, people, allTasks, onClose, onChanged }) {
  const { profile } = useAuth()
  const [task, setTask] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirmingReject, setConfirmingReject] = useState(false)
  const [noteBody, setNoteBody] = useState('')
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [editingBody, setEditingBody] = useState('')
  const [showPushForm, setShowPushForm] = useState(null)
  const [pushDate, setPushDate] = useState('')
  const [pushReason, setPushReason] = useState('')
  const [showSubForm, setShowSubForm] = useState(false)
  const [subName, setSubName] = useState('')
  const [subDeadline, setSubDeadline] = useState('')
  const [subAssignee, setSubAssignee] = useState('')
  const [dependencies, setDependencies] = useState([])
  const [showDependencyForm, setShowDependencyForm] = useState(false)
  const [newBlockerId, setNewBlockerId] = useState('')
  const [showAssignForm, setShowAssignForm] = useState(false)
  const [newAssigneeId, setNewAssigneeId] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [subDescription, setSubDescription] = useState('')
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  async function loadDependencies() {
    try {
      const deps = await fetchTaskDependencies(taskId)
      setDependencies(deps)
    } catch {
      // Non-critical: dependencies failing to load shouldn't block the rest of the panel
    }
  }

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await fetchTaskDetail(taskId)
      setTask(data)
      await loadDependencies()
    } catch (err) {
      setLoadError(err.message || 'Could not load this task.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [taskId])

  // Escape key always closes the panel, regardless of loading/error state
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function refresh() {
    await load()
    onChanged?.()
  }

  // Wraps any mutating action so failures show a message instead of silently doing nothing,
  // and disables buttons while in flight to prevent double-submits.
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

  // Close button + header rendered identically across loading/error/error states so there's
  // always a way out without refreshing the page.
  function ClosePanelHeader() {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={styles.closeBtn} aria-label="Close task detail">
          <i className="ti ti-x" style={{ fontSize: 18 }} aria-hidden="true" />
        </button>
      </div>
    )
  }

  if (loadError) {
    return (
      <div style={styles.overlay} onClick={onClose}>
        <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
          <ClosePanelHeader />
          <p style={{ color: 'var(--danger)', fontSize: 14, fontWeight: 600 }}>Couldn't load this task</p>
          <p style={{ color: 'var(--text-2)', fontSize: 13 }}>{loadError}</p>
          <button onClick={load} style={styles.smallBtn}>Try again</button>
        </div>
      </div>
    )
  }

  if (loading || !task) {
    return (
      <div style={styles.overlay} onClick={onClose}>
        <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
          <ClosePanelHeader />
          <p style={{ color: 'var(--text-2)' }}>Loading…</p>
        </div>
      </div>
    )
  }

  const isOwner = task.owner_id === profile.id
  const isAssignee = task.assignee_id === profile.id
  const canApprove = isOwner || profile.is_mbm
  const canEditFreely = isOwner || isAssignee || profile.is_mbm
  const isUnassigned = !task.assignee_id
  const isDelayed = task.status !== 'completed' && task.target_date && new Date(task.target_date) < new Date()

  const pendingTaskRequest = task.date_change_requests?.find((r) => r.status === 'pending' && r.sub_action_id === null)

  function handleAccept() {
    runAction(async () => {
      await acceptTask(task.id, profile.id)
      await refresh()
    })
  }

  function handleRejectConfirmed() {
    setConfirmingReject(false)
    runAction(async () => {
      await rejectTask(task.id, profile.id, task.owner_id, task.name)
      await refresh()
    })
  }

  function submitPush(e) {
    e.preventDefault()
    runAction(async () => {
      if (showPushForm === 'task') {
        await requestDateChange({
          taskId: task.id,
          requestedBy: profile.id,
          oldDate: task.target_date,
          newDate: pushDate,
          reason: pushReason,
        })
      } else {
        await requestDateChange({
          subActionId: showPushForm,
          requestedBy: profile.id,
          oldDate: task.sub_actions.find((s) => s.id === showPushForm)?.deadline,
          newDate: pushDate,
          reason: pushReason,
        })
      }
      setShowPushForm(null)
      setPushDate('')
      setPushReason('')
      await refresh()
    })
  }

  function handleResolve(requestId, approve) {
    runAction(async () => {
      await resolveDateChange({ requestId, approve, resolverId: profile.id })
      await refresh()
    })
  }

  function submitSubAction(e) {
    e.preventDefault()
    runAction(async () => {
      await createSubAction({
        taskId: task.id,
        name: subName,
        description: subDescription,
        deadline: subDeadline || null,
        assigneeId: subAssignee || null,
        createdBy: profile.id,
      })
      setShowSubForm(false)
      setSubName(''); setSubDescription(''); setSubDeadline(''); setSubAssignee('')
      await refresh()
    })
  }

  function submitNote(e) {
    e.preventDefault()
    if (!noteBody.trim()) return
    runAction(async () => {
      await addNote({ taskId: task.id, authorId: profile.id, body: noteBody, people })
      setNoteBody('')
      await refresh()
    })
  }

  function saveEditedNote(noteId) {
    runAction(async () => {
      await editNote(noteId, editingBody)
      setEditingNoteId(null)
      await refresh()
    })
  }

  function toggleSubActionStatus(sa) {
    runAction(async () => {
      await updateSubActionStatus(sa.id, sa.status === 'done' ? 'pending' : 'done')
      await refresh()
    })
  }

  function handleMarkDone() {
    runAction(async () => {
      await markTaskDone(task.id)
      await refresh()
    })
  }

  function handleStartProgress() {
    runAction(async () => {
      await setTaskBlocked(task.id, false)
      await refresh()
    })
  }

  function handleSetBlocked(blocked) {
    runAction(async () => {
      await setTaskBlocked(task.id, blocked)
      await refresh()
    })
  }

  function handleCancelConfirmed() {
    setConfirmingCancel(false)
    runAction(async () => {
      await cancelTask(task.id, profile.id, task.owner_id, task.name)
      await refresh()
    })
  }

  function submitDependency(e) {
    e.preventDefault()
    if (!newBlockerId) return
    runAction(async () => {
      await addDependency({ blockedTaskId: task.id, blockingTaskId: newBlockerId, createdBy: profile.id })
      setShowDependencyForm(false)
      setNewBlockerId('')
      await loadDependencies()
    })
  }

  function handleRemoveDependency(dependencyId) {
    runAction(async () => {
      await removeDependency(dependencyId)
      await loadDependencies()
    })
  }

  function submitAssign(e) {
    e.preventDefault()
    if (!newAssigneeId) return
    runAction(async () => {
      await assignTask({ taskId: task.id, ownerId: task.owner_id, assigneeId: newAssigneeId, taskName: task.name })
      setShowAssignForm(false)
      setNewAssigneeId('')
      await refresh()
    })
  }

  function handleDeleteConfirmed() {
    setConfirmingDelete(false)
    runAction(async () => {
      await deleteTask(task.id)
      onClose()
      onChanged?.()
    })
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={styles.team}>{task.team?.name}</p>
            <h2 style={styles.title}>{task.name}</h2>
          </div>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {isOwner && !confirmingDelete && (
              <button
                onClick={() => setConfirmingDelete(true)}
                style={styles.deleteTextBtn}
                aria-label="Delete task"
                title="Delete task"
              >
                Delete
              </button>
            )}
            <button onClick={onClose} style={styles.closeBtn} aria-label="Close task detail">
              <i className="ti ti-x" style={{ fontSize: 18 }} aria-hidden="true" />
            </button>
          </div>
        </div>

        {confirmingDelete && (
          <div style={styles.deleteConfirmBox}>
            <p style={styles.deleteConfirmText}>Delete this task permanently? This removes all its sub-actions, notes, and history.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleDeleteConfirmed} disabled={busy} style={styles.deleteConfirmBtn}>{busy ? 'Deleting…' : 'Yes, delete it'}</button>
              <button onClick={() => setConfirmingDelete(false)} disabled={busy} style={styles.smallBtnOutline}>Cancel</button>
            </div>
          </div>
        )}

        {actionError && (
          <div style={styles.actionErrorBox}>
            <p style={styles.actionErrorText}>{actionError}</p>
            <button onClick={() => setActionError(null)} style={styles.actionErrorDismiss} aria-label="Dismiss error">
              <i className="ti ti-x" style={{ fontSize: 13 }} aria-hidden="true" />
            </button>
          </div>
        )}

        <div style={styles.badgeRow}>
          <StatusBadge status={task.status} isDelayed={isDelayed} />
          <PriorityBadge priority={task.priority} />
        </div>

        {task.description && <p style={styles.description}>{task.description}</p>}

        <div style={styles.peopleRow}>
          <Person label="Owner" person={task.owner} />
          <Person label="Assignee" person={task.assignee} placeholder="Unassigned" />
          <div>
            <p style={styles.personLabel}>Target date</p>
            <p style={styles.personName}>
              {task.target_date ? new Date(task.target_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
            </p>
          </div>
        </div>

        {task.project && (
          <p style={styles.projectLine}>
            <i className="ti ti-briefcase" style={{ fontSize: 13, marginRight: 5 }} aria-hidden="true" />
            Part of <strong style={{ fontWeight: 700 }}>{task.project.name}</strong>
          </p>
        )}

        {isOwner && isUnassigned && !showAssignForm && (
          <button onClick={() => setShowAssignForm(true)} style={styles.linkBtn}>
            <i className="ti ti-user-plus" style={{ fontSize: 14 }} aria-hidden="true" /> Assign this task
          </button>
        )}

        {isOwner && showAssignForm && (
          <form onSubmit={submitAssign} style={styles.pushForm}>
            <select value={newAssigneeId} onChange={(e) => setNewAssigneeId(e.target.value)} required style={{ ...styles.input, flex: 1 }}>
              <option value="">Choose a person…</option>
              <option value={task.owner_id}>Myself</option>
              {people.filter((p) => p.id !== task.owner_id).map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
            <button type="submit" disabled={busy} style={styles.smallBtn}>{busy ? 'Assigning…' : 'Assign'}</button>
            <button type="button" onClick={() => setShowAssignForm(false)} disabled={busy} style={styles.smallBtnOutline}>Cancel</button>
          </form>
        )}

        {isAssignee && task.status === 'pending_acceptance' && !confirmingReject && (
          <div style={styles.acceptBox}>
            <p style={styles.acceptText}>You've been assigned this task. Accept or reject it.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleAccept} disabled={busy} style={styles.acceptBtn}>Accept</button>
              <button onClick={() => setConfirmingReject(true)} disabled={busy} style={styles.rejectBtn}>Reject</button>
            </div>
          </div>
        )}

        {isAssignee && task.status === 'pending_acceptance' && confirmingReject && (
          <div style={styles.acceptBox}>
            <p style={styles.acceptText}>Reject this task? The owner will be notified and it will become unassigned.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleRejectConfirmed} disabled={busy} style={styles.rejectBtn}>
                {busy ? 'Rejecting…' : 'Yes, reject it'}
              </button>
              <button onClick={() => setConfirmingReject(false)} disabled={busy} style={styles.smallBtnOutline}>Cancel</button>
            </div>
          </div>
        )}


        {pendingTaskRequest && (
          <div style={styles.pendingBox}>
            <p style={styles.pendingTitle}>Deadline push requested</p>
            <p style={styles.pendingDetail}>
              {pendingTaskRequest.requester?.full_name} requests target date{' '}
              {pendingTaskRequest.old_date ? new Date(pendingTaskRequest.old_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
              {' → '}
              {new Date(pendingTaskRequest.new_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              {pendingTaskRequest.reason ? ` — ${pendingTaskRequest.reason}` : ''}
            </p>
            {canApprove ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleResolve(pendingTaskRequest.id, true)} disabled={busy} style={styles.smallBtn}>Approve</button>
                <button onClick={() => handleResolve(pendingTaskRequest.id, false)} disabled={busy} style={styles.smallBtnOutline}>Decline</button>
              </div>
            ) : (
              <p style={styles.waitingText}>Waiting on owner approval.</p>
            )}
          </div>
        )}

        {canEditFreely && task.status !== 'completed' && !pendingTaskRequest && (
          <button onClick={() => { setShowPushForm('task'); setPushDate(task.target_date || '') }} style={styles.linkBtn}>
            <i className="ti ti-calendar-due" style={{ fontSize: 14 }} aria-hidden="true" /> Request deadline push
          </button>
        )}

        {showPushForm === 'task' && (
          <form onSubmit={submitPush} style={styles.pushForm}>
            <input type="date" value={pushDate} onChange={(e) => setPushDate(e.target.value)} required style={styles.input} />
            <input value={pushReason} onChange={(e) => setPushReason(e.target.value)} placeholder="Reason" style={{ ...styles.input, flex: 1 }} />
            <button type="submit" disabled={busy} style={styles.smallBtn}>{busy ? 'Sending…' : 'Send'}</button>
            <button type="button" onClick={() => setShowPushForm(null)} disabled={busy} style={styles.smallBtnOutline}>Cancel</button>
          </form>
        )}

        {canEditFreely && task.status !== 'completed' && task.status !== 'cancelled' && task.status !== 'pending_acceptance' && (
          <div style={styles.statusButtonRow}>
            <p style={styles.sectionLabel}>Status</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                onClick={handleStartProgress}
                disabled={busy || task.status === 'in_progress'}
                style={{ ...styles.statusPillBtn, ...(task.status === 'in_progress' ? styles.statusPillActive : {}) }}
              >
                In progress
              </button>
              <button
                onClick={() => setConfirmingCancel(true)}
                disabled={busy}
                style={styles.statusPillCancel}
              >
                Cancel task
              </button>
              {task.status === 'blocked' && <span style={styles.statusPillBlockedActive}>Blocked</span>}
              {isDelayed && (
                <span style={styles.statusPillDelayed}>Delayed — past target date</span>
              )}
            </div>
          </div>
        )}

        {confirmingCancel && (
          <div style={styles.deleteConfirmBox}>
            <p style={styles.deleteConfirmText}>Cancel this task? It will stay in the history but will no longer be treated as active work.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleCancelConfirmed} disabled={busy} style={styles.deleteConfirmBtn}>{busy ? 'Cancelling…' : 'Yes, cancel it'}</button>
              <button onClick={() => setConfirmingCancel(false)} disabled={busy} style={styles.smallBtnOutline}>Keep task</button>
            </div>
          </div>
        )}

        {canEditFreely && task.status !== 'completed' && (
          <button onClick={handleMarkDone} disabled={busy} style={styles.markDoneBtn}>
            <i className="ti ti-circle-check" style={{ fontSize: 16 }} aria-hidden="true" /> {busy ? 'Marking done…' : 'Mark task as done'}
          </button>
        )}

        {task.status === 'completed' && (
          <div style={styles.doneBanner}>
            <i className="ti ti-circle-check-filled" style={{ fontSize: 16, color: 'var(--success)' }} aria-hidden="true" />
            <span style={styles.doneBannerText}>Completed</span>
          </div>
        )}

        <div style={styles.sectionHeader}>
          <p style={styles.sectionLabel}>Dependencies</p>
          {canEditFreely && allTasks && (
            <button onClick={() => setShowDependencyForm(true)} style={styles.addLink}>
              <i className="ti ti-plus" style={{ fontSize: 13 }} aria-hidden="true" /> Add
            </button>
          )}
        </div>

        {showDependencyForm && (
          <form onSubmit={submitDependency} style={styles.subForm}>
            <select value={newBlockerId} onChange={(e) => setNewBlockerId(e.target.value)} required style={styles.input}>
              <option value="">This task is blocked by…</option>
              {(allTasks || []).filter((t) => t.id !== task.id).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={busy} style={styles.smallBtn}>{busy ? 'Adding…' : 'Add dependency'}</button>
              <button type="button" onClick={() => setShowDependencyForm(false)} disabled={busy} style={styles.smallBtnOutline}>Cancel</button>
            </div>
          </form>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
          {dependencies.filter((d) => d.blocked_task.id === task.id).length === 0 && (
            <p style={styles.emptyText}>No blocking dependencies.</p>
          )}
          {dependencies
            .filter((d) => d.blocked_task.id === task.id)
            .map((d) => (
              <div key={d.id} style={styles.dependencyRow}>
                <span style={styles.dependencyText}>
                  <i className="ti ti-lock" style={{ fontSize: 13, marginRight: 6, color: d.blocking_task.status === 'done' ? 'var(--success)' : 'var(--warning)' }} aria-hidden="true" />
                  Blocked by <strong style={{ fontWeight: 700 }}>{d.blocking_task.name}</strong>
                  {d.blocking_task.status === 'done' ? ' (done)' : ' (not done yet)'}
                </span>
                {canEditFreely && (
                  <button onClick={() => handleRemoveDependency(d.id)} disabled={busy} style={styles.miniLink}>Remove</button>
                )}
              </div>
            ))}
          {dependencies.filter((d) => d.blocking_task.id === task.id).map((d) => (
            <div key={d.id} style={styles.dependencyRow}>
              <span style={styles.dependencyText}>
                <i className="ti ti-arrow-right" style={{ fontSize: 13, marginRight: 6, color: 'var(--text-3)' }} aria-hidden="true" />
                Blocking <strong style={{ fontWeight: 700 }}>{d.blocked_task.name}</strong>
              </span>
            </div>
          ))}
        </div>

        <div style={styles.sectionHeader}>
          <p style={styles.sectionLabel}>Sub-actions</p>
          {canEditFreely && (
            <button onClick={() => setShowSubForm(true)} style={styles.addLink}>
              <i className="ti ti-plus" style={{ fontSize: 13 }} aria-hidden="true" /> Add
            </button>
          )}
        </div>

        {showSubForm && (
          <form onSubmit={submitSubAction} style={styles.subForm}>
            <input value={subName} onChange={(e) => setSubName(e.target.value)} placeholder="Action name" required style={styles.input} />
            <AutoGrowTextarea value={subDescription} onChange={(e) => setSubDescription(e.target.value)} placeholder="Description (optional)" style={styles.textarea} />
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="date" value={subDeadline} onChange={(e) => setSubDeadline(e.target.value)} style={{ ...styles.input, flex: 1 }} />
              <select value={subAssignee} onChange={(e) => setSubAssignee(e.target.value)} style={{ ...styles.input, flex: 1 }}>
                <option value="">Unassigned</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={busy} style={styles.smallBtn}>{busy ? 'Adding…' : 'Add action'}</button>
              <button type="button" onClick={() => setShowSubForm(false)} disabled={busy} style={styles.smallBtnOutline}>Cancel</button>
            </div>
          </form>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {task.sub_actions?.length === 0 && <p style={styles.emptyText}>No sub-actions yet.</p>}
          {task.sub_actions?.map((sa) => {
            const pendingSubRequest = task.date_change_requests?.find((r) => r.status === 'pending' && r.sub_action_id === sa.id)
            return (
              <div key={sa.id} style={styles.subRow}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1 }}>
                  <button onClick={() => toggleSubActionStatus(sa)} disabled={busy} style={{ ...styles.checkBtn, marginTop: 1 }} aria-label="Toggle done">
                    <i className={`ti ${sa.status === 'done' ? 'ti-square-rounded-check-filled' : 'ti-square-rounded'}`} style={{ fontSize: 18, color: sa.status === 'done' ? 'var(--accent)' : 'var(--text-3)' }} aria-hidden="true" />
                  </button>
                  <div>
                    <p style={{ ...styles.subName, textDecoration: sa.status === 'done' ? 'line-through' : 'none' }}>{sa.name}</p>
                    {sa.description && <p style={styles.subDescription}>{sa.description}</p>}
                    <p style={styles.subMeta}>
                      {sa.assignee?.full_name || 'Unassigned'}
                      {sa.deadline ? ` · ${new Date(sa.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}
                    </p>
                  </div>
                </div>
                {canEditFreely && sa.status !== 'done' && !pendingSubRequest && (
                  <button onClick={() => { setShowPushForm(sa.id); setPushDate(sa.deadline || '') }} style={styles.miniLink}>Push date</button>
                )}
                {pendingSubRequest && canApprove && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => handleResolve(pendingSubRequest.id, true)} disabled={busy} style={styles.tinyBtn}>Approve</button>
                    <button onClick={() => handleResolve(pendingSubRequest.id, false)} disabled={busy} style={styles.tinyBtnOutline}>Decline</button>
                  </div>
                )}
                {showPushForm === sa.id && (
                  <form onSubmit={submitPush} style={styles.pushFormInline}>
                    <input type="date" value={pushDate} onChange={(e) => setPushDate(e.target.value)} required style={styles.input} />
                    <button type="submit" disabled={busy} style={styles.tinyBtn}>{busy ? 'Sending…' : 'Send'}</button>
                  </form>
                )}
              </div>
            )
          })}
        </div>

        <p style={styles.sectionLabel}>Note log</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
          {task.notes?.length === 0 && <p style={styles.emptyText}>No notes yet.</p>}
          {task.notes
            ?.slice()
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .map((n) => (
              <div key={n.id} style={styles.noteRow}>
                <p style={styles.noteMeta}>
                  {new Date(n.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {n.author?.full_name}
                  {n.edited_at && ' (edited)'}
                </p>
                {editingNoteId === n.id ? (
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <input value={editingBody} onChange={(e) => setEditingBody(e.target.value)} style={{ ...styles.input, flex: 1 }} />
                    <button onClick={() => saveEditedNote(n.id)} disabled={busy} style={styles.tinyBtn}>Save</button>
                  </div>
                ) : (
                  <p style={styles.noteBody}>
                    <MentionText text={n.body} people={people} />
                    {(n.author_id === profile.id || profile.is_mbm) && (
                      <button onClick={() => { setEditingNoteId(n.id); setEditingBody(n.body) }} style={styles.editNoteLink}>edit</button>
                    )}
                  </p>
                )}
              </div>
            ))}
        </div>
        {canEditFreely && (
          <form onSubmit={submitNote} style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24, position: 'relative' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Add a note… type @ then a name"
                style={{ ...styles.input, flex: 1 }}
              />
              <button type="submit" disabled={busy} style={styles.smallBtn}>{busy ? 'Posting…' : 'Post'}</button>
            </div>
            {getMentionSuggestions(noteBody, people).length > 0 && (
              <div style={styles.mentionMenu}>
                {getMentionSuggestions(noteBody, people).map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => setNoteBody(insertMention(noteBody, person))}
                    style={styles.mentionOption}
                  >
                    @{person.full_name}
                  </button>
                ))}
              </div>
            )}
          </form>
        )}

        <details>
          <summary style={styles.logSummary}>Change log</summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {task.change_log
              ?.slice()
              .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
              .map((c) => (
                <p key={c.id} style={styles.logLine}>
                  <span style={styles.logTime}>{new Date(c.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  {' — '}{c.actor?.full_name} {c.detail}
                </p>
              ))}
          </div>
        </details>
      </div>
    </div>
  )
}

function Person({ label, person, placeholder }) {
  return (
    <div>
      <p style={styles.personLabel}>{label}</p>
      <p style={styles.personName}>{person?.full_name || placeholder || '—'}</p>
    </div>
  )
}

const styles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'flex-end', zIndex: 100 },
  panel: { background: 'var(--surface)', width: '100%', maxWidth: 560, height: '100%', overflowY: 'auto', overflowX: 'hidden', padding: '24px 20px', boxSizing: 'border-box' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 10 },
  team: { fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 4px' },
  title: { fontSize: 19, fontWeight: 700, margin: 0, wordBreak: 'break-word' },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text-2)', flexShrink: 0, padding: 4 },
  deleteIconBtn: { background: 'none', border: 'none', color: 'var(--text-3)', flexShrink: 0, padding: 4 },
  deleteTextBtn: {
    background: 'var(--danger)',
    border: 'none',
    color: '#fff',
    flexShrink: 0,
    padding: '7px 12px',
    borderRadius: 'var(--radius)',
    fontSize: 12.5,
    fontWeight: 700,
    cursor: 'pointer',
  },
  deleteConfirmBox: { background: 'var(--danger-light)', borderRadius: 'var(--radius)', padding: '12px 14px', marginBottom: 16 },
  deleteConfirmText: { fontSize: 13, color: 'var(--danger)', margin: '0 0 10px', lineHeight: 1.5 },
  deleteConfirmBtn: { padding: '8px 16px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--danger)', color: '#fff', fontSize: 13, fontWeight: 700 },
  badgeRow: { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  actionErrorBox: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10,
    background: 'var(--danger-light)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 16,
  },
  actionErrorText: { fontSize: 13, color: 'var(--danger)', margin: 0, lineHeight: 1.5 },
  actionErrorDismiss: { background: 'none', border: 'none', color: 'var(--danger)', flexShrink: 0, padding: 2 },
  description: { fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 20 },
  peopleRow: { display: 'flex', gap: 28, paddingBottom: 18, marginBottom: 18, borderBottom: '1px solid var(--border)' },
  projectLine: { fontSize: 12.5, color: 'var(--text-2)', margin: '-10px 0 18px' },
  personLabel: { fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.03em', margin: '0 0 3px' },
  personName: { fontSize: 13, fontWeight: 600, margin: 0 },
  acceptBox: { background: 'var(--warning-light)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 18 },
  acceptText: { fontSize: 13, color: 'var(--warning)', margin: '0 0 10px' },
  acceptBtn: { padding: '8px 18px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600 },
  rejectBtn: { padding: '8px 18px', borderRadius: 'var(--radius)', border: '1px solid var(--danger)', background: 'none', color: 'var(--danger)', fontSize: 13, fontWeight: 600 },
  pendingBox: { background: 'var(--warning-light)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 16 },
  pendingTitle: { fontSize: 13, fontWeight: 600, color: 'var(--warning)', margin: '0 0 4px' },
  pendingDetail: { fontSize: 13, color: 'var(--warning)', margin: '0 0 10px', lineHeight: 1.5 },
  waitingText: { fontSize: 12, color: 'var(--warning)', margin: 0, fontStyle: 'italic' },
  linkBtn: { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--info)', fontSize: 13, fontWeight: 500, padding: '4px 0', marginBottom: 12 },
  pushForm: { display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' },
  pushFormInline: { display: 'flex', gap: 8, marginTop: 8, width: '100%' },
  input: { fontSize: 13, padding: '8px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' },
  statusButtonRow: { marginBottom: 14 },
  statusPillBtn: {
    fontSize: 12.5, fontWeight: 600, padding: '6px 13px', borderRadius: 999, border: 'none',
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'var(--surface-2)', color: 'var(--text-2)',
  },
  statusPillActive: { background: 'var(--info-light)', color: 'var(--info)' },
  statusPillBlockedActive: { background: 'var(--danger-light)', color: 'var(--danger)', fontSize: 12.5, fontWeight: 700, padding: '6px 13px', borderRadius: 999 },
  statusPillCancel: { fontSize: 12.5, fontWeight: 700, padding: '6px 13px', borderRadius: 999, border: '1px solid var(--danger)', background: 'var(--danger-light)', color: 'var(--danger)' },
  statusPillDelayed: {
    fontSize: 12.5, fontWeight: 700, padding: '6px 13px', borderRadius: 999,
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'var(--danger-light)', color: 'var(--danger)',
  },
  markDoneBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
    fontSize: 14.5, fontWeight: 700, padding: '13px 0', borderRadius: 'var(--radius)', border: 'none',
    background: 'linear-gradient(135deg, #1A8754, #2DA86A)', color: '#fff', marginBottom: 20,
    boxShadow: '0 2px 10px rgba(26,135,84,0.25)',
  },
  doneBanner: {
    display: 'flex', alignItems: 'center', gap: 8, background: 'var(--success-light)',
    borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 20,
  },
  doneBannerText: { fontSize: 14, fontWeight: 700, color: 'var(--success)' },
  textarea: {
    fontSize: 13, padding: '8px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
    background: '#fff', color: 'var(--text)', minHeight: 56, fontFamily: 'inherit', resize: 'vertical',
  },
  subDescription: { fontSize: 12, color: 'var(--text-2)', margin: '2px 0 4px', lineHeight: 1.4 },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionLabel: { fontSize: 12, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.03em', margin: '0 0 10px' },
  addLink: { display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--info)', fontSize: 12, fontWeight: 600 },
  subForm: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, padding: 12, background: 'var(--surface-2)', borderRadius: 'var(--radius)' },
  emptyText: { fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic', margin: 0 },
  dependencyRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: '8px 12px', gap: 8 },
  dependencyText: { fontSize: 12.5, color: 'var(--text-2)' },
  subRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: '10px 12px', flexWrap: 'wrap', gap: 8 },
  checkBtn: { background: 'none', border: 'none', display: 'flex', flexShrink: 0 },
  subName: { fontSize: 13, fontWeight: 500, margin: 0 },
  subMeta: { fontSize: 12, color: 'var(--text-3)', margin: '2px 0 0' },
  miniLink: { fontSize: 12, color: 'var(--info)', background: 'none', border: 'none', fontWeight: 500 },
  tinyBtn: { fontSize: 12, padding: '5px 10px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600 },
  tinyBtnOutline: { fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--danger)', background: 'none', color: 'var(--danger)', fontWeight: 600 },
  smallBtn: { fontSize: 13, padding: '8px 14px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600 },
  smallBtnOutline: { fontSize: 13, padding: '8px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'none', color: 'var(--text)', fontWeight: 500 },
  noteRow: { padding: '0 0 10px', borderBottom: '1px solid var(--border)' },
  noteMeta: { fontSize: 11, color: 'var(--text-3)', margin: '0 0 3px' },
  noteBody: { fontSize: 13, margin: 0, lineHeight: 1.5 },
  editNoteLink: { fontSize: 11, color: 'var(--info)', background: 'none', border: 'none', marginLeft: 8 },
  mentionMenu: { position: 'absolute', left: 0, right: 88, bottom: 43, background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', padding: 6, zIndex: 5 },
  mentionOption: { display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '8px 10px', borderRadius: 8, color: 'var(--text)', fontSize: 13, fontWeight: 600 },
  logSummary: { fontSize: 12, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.03em', cursor: 'pointer' },
  logLine: { fontSize: 12, color: 'var(--text-2)', margin: 0 },
  logTime: { color: 'var(--text-3)' },
}
