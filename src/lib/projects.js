import { supabase } from './supabase'
import { logAudit } from './governance'

// ---------- PROJECTS ----------

export async function fetchProjects({ profile, teamFilter }) {
  let query = supabase
    .from('projects')
    .select(`
      *,
      team:teams(id, name),
      sponsor:profiles!projects_sponsor_id_fkey(id, full_name),
      project_manager:profiles!projects_project_manager_id_fkey(id, full_name),
      milestones(id, percent_complete, status)
    `)
    .order('created_at', { ascending: false })

  if (!profile.is_mbm) {
    query = query.or(
      `team_id.eq.${profile.team_id},sponsor_id.eq.${profile.id},project_manager_id.eq.${profile.id}`
    )
  }
  if (teamFilter) {
    query = query.eq('team_id', teamFilter)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function fetchProjectDetail(projectId) {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      team:teams(id, name),
      sponsor:profiles!projects_sponsor_id_fkey(id, full_name),
      project_manager:profiles!projects_project_manager_id_fkey(id, full_name),
      milestones(*, owner:profiles!milestones_owner_id_fkey(id, full_name), tasks(id, name, status, percent_complete, assignee:profiles!tasks_assignee_id_fkey(id, full_name))),
      project_health_log(*, changer:profiles(id, full_name))
    `)
    .eq('id', projectId)
    .order('sort_order', { referencedTable: 'milestones', ascending: true })
    .single()
  if (error) throw error
  return data
}

export async function createProject({
  name, sponsorId, projectManagerId, teamId, strategicObjective,
  businessJustification, expectedOutcome, successCriteria,
  startDate, targetCompletionDate, createdBy,
}) {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      name,
      sponsor_id: sponsorId || null,
      project_manager_id: projectManagerId || null,
      team_id: teamId,
      strategic_objective: strategicObjective || null,
      business_justification: businessJustification || null,
      expected_outcome: expectedOutcome || null,
      success_criteria: successCriteria || null,
      start_date: startDate || null,
      target_completion_date: targetCompletionDate || null,
      created_by: createdBy,
    })
    .select()
    .single()
  if (error) throw error
  await logAudit({ entityType: 'project', entityId: data.id, actorId: createdBy, action: 'created', detail: `Project created: ${name}` })
  return data
}

export async function updateProjectStatus(projectId, status) {
  const { error } = await supabase.from('projects').update({ status }).eq('id', projectId)
  if (error) throw error
}

// Health changes always require a reason. This writes the log entry first,
// then the health column update — the database trigger checks the log entry
// exists before allowing the health column to change (see migration file).
export async function updateProjectHealth({ projectId, newHealth, oldHealth, reason, changedBy }) {
  const { error: logErr } = await supabase.from('project_health_log').insert({
    project_id: projectId,
    changed_by: changedBy,
    old_health: oldHealth,
    new_health: newHealth,
    reason,
  })
  if (logErr) throw logErr

  const { error } = await supabase.from('projects').update({ health: newHealth }).eq('id', projectId)
  if (error) throw error

  await logAudit({
    entityType: 'project', entityId: projectId, actorId: changedBy,
    action: 'health_changed', detail: `Health changed to ${newHealth}: ${reason}`,
  })
}

// ---------- MILESTONES ----------

export async function createMilestone({ projectId, name, ownerId, plannedDate, sortOrder, createdBy }) {
  const { data, error } = await supabase
    .from('milestones')
    .insert({
      project_id: projectId,
      name,
      owner_id: ownerId || null,
      planned_date: plannedDate || null,
      sort_order: sortOrder || 0,
      created_by: createdBy,
    })
    .select()
    .single()
  if (error) throw error
  await logAudit({ entityType: 'project', entityId: projectId, actorId: createdBy, action: 'milestone_added', detail: `Added milestone: ${name}` })
  return data
}

export async function updateMilestone(milestoneId, fields) {
  const { error } = await supabase.from('milestones').update(fields).eq('id', milestoneId)
  if (error) throw error
}

// Links an existing standalone task into a milestone (and therefore a project).
// Existing tasks default to milestone_id = null, so this is opt-in.
export async function linkTaskToMilestone(taskId, milestoneId) {
  const { error } = await supabase.from('tasks').update({ milestone_id: milestoneId }).eq('id', taskId)
  if (error) throw error
}

export async function unlinkTaskFromMilestone(taskId) {
  const { error } = await supabase.from('tasks').update({ milestone_id: null }).eq('id', taskId)
  if (error) throw error
}
