import { supabase } from './supabase'
import { recordMentions } from './dependencies'

// ---------- STAGE ADVANCE REQUESTS ----------

export async function requestStageAdvance({ projectId, requestedBy, fromStatus, toStatus, note }) {
  const { data: pct, error: pctErr } = await supabase.rpc('recalc_milestone_completion_pct', { p_project_id: projectId })
  if (pctErr) throw pctErr

  const { data, error } = await supabase
    .from('stage_advance_requests')
    .insert({
      project_id: projectId,
      requested_by: requestedBy,
      from_status: fromStatus,
      to_status: toStatus,
      milestone_completion_snapshot: pct,
      note,
    })
    .select()
    .single()
  if (error) throw error

  await logAudit({ entityType: 'project', entityId: projectId, actorId: requestedBy, action: 'stage_advance_requested', detail: `Requested move from ${fromStatus} to ${toStatus}` })
  return data
}

export async function resolveStageAdvance({ requestId, approve, resolverId, projectId, toStatus }) {
  const { error } = await supabase
    .from('stage_advance_requests')
    .update({ status: approve ? 'approved' : 'declined', resolved_by: resolverId, resolved_at: new Date().toISOString() })
    .eq('id', requestId)
  if (error) throw error

  await logAudit({
    entityType: 'project', entityId: projectId, actorId: resolverId,
    action: approve ? 'stage_advance_approved' : 'stage_advance_declined',
    detail: approve ? `Approved move to ${toStatus}` : `Declined move to ${toStatus}`,
  })
}

// ---------- ACTION TRACKER ----------

const MEETING_SOURCE_LABELS = {
  leadership_meeting: 'Leadership meeting',
  committee_meeting: 'Committee meeting',
  steering_committee: 'Steering committee',
  executive_assignment: 'Executive assignment',
  vendor_followup: 'Vendor follow-up',
  other: 'Other',
}

export function meetingSourceLabel(key) {
  return MEETING_SOURCE_LABELS[key] || key
}

export async function fetchActions({ profile, teamFilter }) {
  let query = supabase
    .from('actions')
    .select(`
      *,
      team:teams(id, name),
      owner:profiles!actions_owner_id_fkey(id, full_name),
      creator:profiles!actions_created_by_fkey(id, full_name)
    `)
    .order('due_date', { ascending: true, nullsFirst: false })

  if (!profile.is_mbm) {
    query = query.or(`team_id.eq.${profile.team_id},owner_id.eq.${profile.id},created_by.eq.${profile.id}`)
  }
  if (teamFilter) {
    query = query.eq('team_id', teamFilter)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function fetchActionDetail(actionId) {
  const { data, error } = await supabase
    .from('actions')
    .select(`
      *,
      team:teams(id, name),
      owner:profiles!actions_owner_id_fkey(id, full_name),
      creator:profiles!actions_created_by_fkey(id, full_name),
      action_comments(*, author:profiles(id, full_name))
    `)
    .eq('id', actionId)
    .single()
  if (error) throw error
  return data
}

export async function createAction({
  title, ownerId, teamId, dueDate, priority, meetingSource, meetingSourceDetail, createdBy,
}) {
  const { data, error } = await supabase
    .from('actions')
    .insert({
      title, owner_id: ownerId, team_id: teamId, due_date: dueDate || null,
      priority: priority || 'medium', meeting_source: meetingSource,
      meeting_source_detail: meetingSourceDetail || null, created_by: createdBy,
    })
    .select()
    .single()
  if (error) throw error
  await logAudit({ entityType: 'action', entityId: data.id, actorId: createdBy, action: 'created', detail: `Action created: ${title}` })
  return data
}

export async function updateActionStatus({ actionId, status, actorId }) {
  const { error } = await supabase.from('actions').update({ status }).eq('id', actionId)
  if (error) throw error
  await logAudit({ entityType: 'action', entityId: actionId, actorId, action: 'status_changed', detail: `Status changed to ${status}` })
}

export async function addActionComment({ actionId, authorId, body, people }) {
  const { data, error } = await supabase.from('action_comments').insert({ action_id: actionId, author_id: authorId, body }).select().single()
  if (error) throw error
  if (people) {
    await recordMentions({ text: body, people, entityType: 'action_comment', entityId: data.id, mentioningUserId: authorId, contextActionId: actionId })
  }
  return data
}

// ---------- AUDIT TRAIL ----------

export async function logAudit({ entityType, entityId, actorId, action, detail }) {
  await supabase.from('audit_log').insert({ entity_type: entityType, entity_id: entityId, actor_id: actorId, action, detail })
}

export async function fetchAuditLog({ entityType, entityId }) {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*, actor:profiles(id, full_name)')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}
