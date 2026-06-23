import { supabase } from './supabase'
import { recordMentions } from './dependencies'
import { isMBM, managedTeamIds, managedProfileIds, profileTeamIds } from './permissions'

// Wraps a Supabase call so a raw network failure ("Failed to fetch", which
// the browser throws with no further detail when a request can't reach the
// server at all — expired session, dropped connection, CORS, etc.) becomes
// an actionable message instead of a dead end.
async function withNetworkErrorHandling(fn) {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof TypeError && /fetch/i.test(err.message)) {
      throw new Error('Could not reach the server. Check your connection and try again — if this keeps happening, try signing out and back in.')
    }
    throw err
  }
}

// ---------- TASKS ----------

export async function fetchTasks({ profile, teamFilter, assigneeFilter, scope }) {
  let query = supabase
    .from('tasks')
    .select(`
      *,
      team:teams(id, name),
      project:projects(id, name),
      owner:profiles!tasks_owner_id_fkey(id, full_name),
      assignee:profiles!tasks_assignee_id_fkey(id, full_name),
      sub_actions(*, assignee:profiles!sub_actions_assignee_id_fkey(id, full_name))
    `)
    .order('target_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  // scope = 'mine' includes tasks owned/assigned to me. It is also merged
  // with parent tasks where one of the visible sub-actions is assigned to me,
  // so delegated sub-tasks appear in the assignee's dashboard too.
  if (scope === 'mine') {
    query = query.or(`owner_id.eq.${profile.id},assignee_id.eq.${profile.id}`)
  } else if (!isMBM(profile)) {
    const directorTeams = managedTeamIds(profile)
    const reportIds = managedProfileIds(profile)

    if (scope === 'team') {
      if (directorTeams.length > 0) {
        // Principal managers/directors: see the teams assigned to them
        // even when the team has managers below them.
        query = query.in('team_id', directorTeams)
      } else if (reportIds.length > 0) {
        // Middle managers: see only work owned/assigned to their reporting line.
        const ids = [profile.id, ...reportIds]
        query = query.or(`owner_id.in.(${ids.join(',')}),assignee_id.in.(${ids.join(',')})`)
      } else {
        query = query.or(`owner_id.eq.${profile.id},assignee_id.eq.${profile.id}`)
      }
    } else {
      const visibleTeams = profileTeamIds(profile)
      if (visibleTeams.length > 0) query = query.in('team_id', visibleTeams)
      else query = query.or(`owner_id.eq.${profile.id},assignee_id.eq.${profile.id}`)
    }
  }
  if (teamFilter) query = query.eq('team_id', teamFilter)
  if (assigneeFilter) query = query.eq('assignee_id', assigneeFilter)

  return withNetworkErrorHandling(async () => {
    const { data, error } = await query
    if (error) throw error

    if (scope !== 'mine') return sortTaskRows(data || [])

    const { data: subRows, error: subErr } = await supabase
      .from('sub_actions')
      .select(`
        *,
        task:tasks(
          *,
          team:teams(id, name),
          project:projects(id, name),
          owner:profiles!tasks_owner_id_fkey(id, full_name),
          assignee:profiles!tasks_assignee_id_fkey(id, full_name),
          sub_actions(*, assignee:profiles!sub_actions_assignee_id_fkey(id, full_name))
        )
      `)
      .eq('assignee_id', profile.id)
    if (subErr) throw subErr

    const merged = new Map()
    for (const task of data || []) merged.set(task.id, task)
    for (const row of subRows || []) {
      if (row.task) merged.set(row.task.id, { ...row.task, has_subtask_for_me: true })
    }
    return sortTaskRows([...merged.values()])
  })
}

function sortTaskRows(tasks) {
  const priorityRank = { urgent: 0, high: 1, medium: 2, low: 3 }
  const isClosed = (t) => ['completed', 'done', 'cancelled', 'canceled'].includes(t.status)
  const isOverdue = (t) => !isClosed(t) && t.target_date && new Date(t.target_date) < new Date()
  return [...tasks].sort((a, b) => {
    const overdueDiff = Number(isOverdue(b)) - Number(isOverdue(a))
    if (overdueDiff) return overdueDiff
    const closedDiff = Number(isClosed(a)) - Number(isClosed(b))
    if (closedDiff) return closedDiff
    const pDiff = (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9)
    if (pDiff) return pDiff
    const aDate = a.target_date ? new Date(a.target_date).getTime() : Number.MAX_SAFE_INTEGER
    const bDate = b.target_date ? new Date(b.target_date).getTime() : Number.MAX_SAFE_INTEGER
    if (aDate !== bDate) return aDate - bDate
    return new Date(b.created_at || 0) - new Date(a.created_at || 0)
  })
}

export async function fetchTaskDetail(taskId) {
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      team:teams(id, name),
      project:projects(id, name),
      owner:profiles!tasks_owner_id_fkey(id, full_name),
      assignee:profiles!tasks_assignee_id_fkey(id, full_name),
      sub_actions(*, assignee:profiles!sub_actions_assignee_id_fkey(id, full_name)),
      notes(*, author:profiles(id, full_name)),
      change_log(*, actor:profiles(id, full_name)),
      date_change_requests(*, requester:profiles!date_change_requests_requested_by_fkey(id, full_name))
    `)
    .eq('id', taskId)
    .single()
  if (error) throw error
  return data
}

export async function createTask({ name, description, teamId, projectId, milestoneId, ownerId, assigneeId, targetDate, priority, subActions }) {
  return withNetworkErrorHandling(async () => {
    const status = assigneeId && assigneeId !== ownerId ? 'pending_acceptance' : 'initiated'

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        name,
        description,
        team_id: teamId,
        project_id: projectId || null,
        milestone_id: milestoneId || null,
        owner_id: ownerId,
        assignee_id: assigneeId || null,
        target_date: targetDate || null,
        priority: priority || 'medium',
        status,
      })
      .select()
      .single()
    if (error) throw error

    await logChange(data.id, ownerId, 'created', `Task created${assigneeId ? ' and assigned' : ''}`)
    if (assigneeId && assigneeId !== ownerId) {
      await notify(assigneeId, data.id, 'assigned', `You've been assigned: "${name}"`)
    }

    // Optional sub-actions created at the same time as the task, so the
    // creation form can capture everything in one step.
    if (subActions && subActions.length > 0) {
      for (const sa of subActions) {
        if (!sa.name?.trim()) continue
        await supabase.from('sub_actions').insert({
          task_id: data.id, name: sa.name, description: sa.description || null,
          deadline: sa.deadline || null, assignee_id: sa.assigneeId || null, created_by: ownerId,
        })
      }
    }

    return data
  })
}

// ---------- ACCEPT / REJECT ----------

export async function acceptTask(taskId, userId) {
  return withNetworkErrorHandling(async () => {
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'in_progress' })
      .eq('id', taskId)
    if (error) throw error
    await logChange(taskId, userId, 'accepted', 'Assignee accepted the task')
  })
}

export async function rejectTask(taskId, userId, ownerId, taskName) {
  return withNetworkErrorHandling(async () => {
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'initiated', assignee_id: null })
      .eq('id', taskId)
    if (error) throw error
    await logChange(taskId, userId, 'rejected', 'Assignee rejected the task')
    await notify(ownerId, taskId, 'rejected', `Task rejected: "${taskName}" is back to To Do`)
  })
}

export async function cancelTask(taskId, userId, ownerId, taskName) {
  return withNetworkErrorHandling(async () => {
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'cancelled', percent_complete: 0 })
      .eq('id', taskId)
    if (error) throw error
    await logChange(taskId, userId, 'cancelled', 'Task cancelled')
    if (ownerId && ownerId !== userId) {
      await notify(ownerId, taskId, 'cancelled', `Task cancelled: "${taskName}"`)
    }
  })
}

// Assigns (or reassigns) a task. Mirrors createTask's status logic:
// self-assignment skips the accept/reject step entirely, assigning
// someone else puts it in pending_acceptance.
export async function assignTask({ taskId, ownerId, assigneeId, taskName }) {
  return withNetworkErrorHandling(async () => {
    const status = assigneeId === ownerId ? 'initiated' : 'pending_acceptance'
    const { error } = await supabase
      .from('tasks')
      .update({ assignee_id: assigneeId, status })
      .eq('id', taskId)
    if (error) throw error
    await logChange(taskId, ownerId, 'assigned', `Task assigned`)
    if (assigneeId !== ownerId) {
      await notify(assigneeId, taskId, 'assigned', `You've been assigned: "${taskName}"`)
    }
  })
}

// Owner-only hard delete. Cascades to sub_actions, notes, change_log,
// date_change_requests, and task_dependencies via their on-delete-cascade
// foreign keys — nothing orphaned.
export async function deleteTask(taskId) {
  return withNetworkErrorHandling(async () => {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    if (error) throw error
  })
}

// ---------- DEADLINE PUSH (approval-gated) ----------

export async function requestDateChange({ taskId, subActionId, requestedBy, oldDate, newDate, reason }) {
  const { data, error } = await supabase
    .from('date_change_requests')
    .insert({
      task_id: taskId || null,
      sub_action_id: subActionId || null,
      requested_by: requestedBy,
      old_date: oldDate,
      new_date: newDate,
      reason,
    })
    .select()
    .single()
  if (error) throw error

  const targetTaskId = taskId || (await getTaskIdForSubAction(subActionId))
  await logChange(targetTaskId, requestedBy, 'date_push_requested', `Requested push to ${newDate}: ${reason || 'no reason given'}`)
  return data
}

async function getTaskIdForSubAction(subActionId) {
  const { data } = await supabase.from('sub_actions').select('task_id').eq('id', subActionId).single()
  return data?.task_id
}

export async function resolveDateChange({ requestId, approve, resolverId }) {
  const { data: request, error: fetchErr } = await supabase
    .from('date_change_requests')
    .select('*')
    .eq('id', requestId)
    .single()
  if (fetchErr) throw fetchErr

  const { error } = await supabase
    .from('date_change_requests')
    .update({
      status: approve ? 'approved' : 'declined',
      resolved_by: resolverId,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', requestId)
  if (error) throw error

  const taskId = request.task_id || (await getTaskIdForSubAction(request.sub_action_id))

  if (approve) {
    if (request.task_id) {
      await supabase.from('tasks').update({ target_date: request.new_date }).eq('id', request.task_id)
    } else {
      await supabase.from('sub_actions').update({ deadline: request.new_date }).eq('id', request.sub_action_id)
    }
  }

  await logChange(
    taskId,
    resolverId,
    approve ? 'date_approved' : 'date_declined',
    `${approve ? 'Approved' : 'Declined'} push to ${request.new_date}`
  )
  await notify(
    request.requested_by,
    taskId,
    approve ? 'date_approved' : 'date_declined',
    `Your deadline push request was ${approve ? 'approved' : 'declined'}`
  )
}

// ---------- SUB-ACTIONS ----------

export async function createSubAction({ taskId, name, description, deadline, assigneeId, createdBy }) {
  const { data, error } = await supabase
    .from('sub_actions')
    .insert({ task_id: taskId, name, description: description || null, deadline, assignee_id: assigneeId || null, created_by: createdBy })
    .select()
    .single()
  if (error) throw error
  await logChange(taskId, createdBy, 'sub_action_added', `Added sub-action: ${name}`)
  return data
}

export async function updateSubActionStatus(subActionId, status) {
  const { error } = await supabase.from('sub_actions').update({ status }).eq('id', subActionId)
  if (error) throw error
}

// ---------- NOTES (free edit, no approval) ----------

export async function addNote({ taskId, authorId, body, people }) {
  const { data, error } = await supabase.from('notes').insert({ task_id: taskId, author_id: authorId, body }).select().single()
  if (error) throw error
  if (people) {
    await recordMentions({ text: body, people, entityType: 'note', entityId: data.id, mentioningUserId: authorId, contextTaskId: taskId })
  }
  return data
}

export async function editNote(noteId, body) {
  const { error } = await supabase
    .from('notes')
    .update({ body, edited_at: new Date().toISOString() })
    .eq('id', noteId)
  if (error) throw error
}

// ---------- PERCENT COMPLETE (free edit, no approval) ----------

export async function updatePercentComplete(taskId, percent) {
  const { error } = await supabase.from('tasks').update({ percent_complete: percent }).eq('id', taskId)
  if (error) throw error
}

// If the task has unfinished finish-to-start dependencies, the database
// trigger (enforce_dependency_before_completion) rejects this update and
// the resulting Postgres error message — which already explains why —
// surfaces to the UI via the normal error-handling path.
export async function markTaskDone(taskId) {
  return withNetworkErrorHandling(async () => {
    const { error } = await supabase.from('tasks').update({ status: 'completed', percent_complete: 100 }).eq('id', taskId)
    if (error) throw error
  })
}

export async function setTaskBlocked(taskId, blocked) {
  return withNetworkErrorHandling(async () => {
    const { error } = await supabase.from('tasks').update({ status: blocked ? 'blocked' : 'in_progress' }).eq('id', taskId)
    if (error) throw error
  })
}

// ---------- NOTIFICATIONS ----------

export async function fetchNotifications(userId) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*, task:tasks(name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return data
}

export async function markNotificationRead(id) {
  await supabase.from('notifications').update({ is_read: true }).eq('id', id)
}


export async function markAllNotificationsRead(userId) {
  await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false)
}

async function notify(userId, taskId, type, message) {
  await supabase.from('notifications').insert({ user_id: userId, task_id: taskId, type, message })
}

// ---------- CHANGE LOG ----------

async function logChange(taskId, actorId, action, detail) {
  await supabase.from('change_log').insert({ task_id: taskId, actor_id: actorId, action, detail })
}

// ---------- TEAMS & PEOPLE ----------

export async function fetchTeams() {
  const { data, error } = await supabase.from('teams').select('*').order('name')
  if (error) throw error
  return data
}

export async function fetchProfiles() {
  const { data, error } = await supabase.from('profiles').select('*, team:teams(name)').order('full_name')
  if (error) throw error
  return data
}
