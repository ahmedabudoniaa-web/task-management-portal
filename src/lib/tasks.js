import { supabase } from './supabase'

// ---------- TASKS ----------

export async function fetchTasks({ profile, teamFilter }) {
  let query = supabase
    .from('tasks')
    .select(`
      *,
      team:teams(id, name),
      owner:profiles!tasks_owner_id_fkey(id, full_name),
      assignee:profiles!tasks_assignee_id_fkey(id, full_name),
      sub_actions(*)
    `)
    .order('created_at', { ascending: false })

  // Non-MBM users see their team's tasks plus anything they own/are assigned (cross-team)
  if (!profile.is_mbm) {
    query = query.or(
      `team_id.eq.${profile.team_id},owner_id.eq.${profile.id},assignee_id.eq.${profile.id}`
    )
  }
  if (teamFilter) {
    query = query.eq('team_id', teamFilter)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function fetchTaskDetail(taskId) {
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      team:teams(id, name),
      owner:profiles!tasks_owner_id_fkey(id, full_name),
      assignee:profiles!tasks_assignee_id_fkey(id, full_name),
      sub_actions(*, assignee:profiles(id, full_name)),
      notes(*, author:profiles(id, full_name)),
      change_log(*, actor:profiles(id, full_name)),
      date_change_requests(*, requester:profiles!date_change_requests_requested_by_fkey(id, full_name))
    `)
    .eq('id', taskId)
    .single()
  if (error) throw error
  return data
}

export async function createTask({ name, description, teamId, ownerId, assigneeId, targetDate, priority }) {
  const status = assigneeId
    ? (assigneeId === ownerId ? 'in_progress' : 'pending_acceptance')
    : 'unassigned'

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      name,
      description,
      team_id: teamId,
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
  return data
}

// ---------- ACCEPT / REJECT ----------

export async function acceptTask(taskId, userId) {
  const { error } = await supabase
    .from('tasks')
    .update({ status: 'in_progress' })
    .eq('id', taskId)
  if (error) throw error
  await logChange(taskId, userId, 'accepted', 'Assignee accepted the task')
}

export async function rejectTask(taskId, userId, ownerId, taskName) {
  const { error } = await supabase
    .from('tasks')
    .update({ status: 'unassigned', assignee_id: null })
    .eq('id', taskId)
  if (error) throw error
  await logChange(taskId, userId, 'rejected', 'Assignee rejected the task')
  await notify(ownerId, taskId, 'rejected', `Task rejected: "${taskName}" is now unassigned`)
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

export async function createSubAction({ taskId, name, deadline, assigneeId, createdBy }) {
  const { data, error } = await supabase
    .from('sub_actions')
    .insert({ task_id: taskId, name, deadline, assignee_id: assigneeId || null, created_by: createdBy })
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

export async function addNote({ taskId, authorId, body }) {
  const { error } = await supabase.from('notes').insert({ task_id: taskId, author_id: authorId, body })
  if (error) throw error
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

// ---------- NOTIFICATIONS ----------

export async function fetchNotifications(userId) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*, task:tasks(name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return data
}

export async function markNotificationRead(id) {
  await supabase.from('notifications').update({ is_read: true }).eq('id', id)
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
