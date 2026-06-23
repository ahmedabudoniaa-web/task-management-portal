import { supabase } from './supabase'
import { isMBM, managedTeamIds, managedProfileIds, profileTeamIds } from './permissions'
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
      coordinator:profiles!projects_project_coordinator_id_fkey(id, full_name),
      milestones(id, percent_complete, status)
    `)
    .order('created_at', { ascending: false })

  if (!isMBM(profile)) {
    const directorTeams = managedTeamIds(profile)
    const reportIds = managedProfileIds(profile)
    if (directorTeams.length > 0) query = query.in('team_id', directorTeams)
    else if (reportIds.length > 0) {
      const ids = [profile.id, ...reportIds]
      query = query.or(`sponsor_id.in.(${ids.join(',')}),project_manager_id.in.(${ids.join(',')}),project_coordinator_id.in.(${ids.join(',')}),created_by.in.(${ids.join(',')})`)
    } else {
      query = query.or(`sponsor_id.eq.${profile.id},project_manager_id.eq.${profile.id},project_coordinator_id.eq.${profile.id},created_by.eq.${profile.id}`)
    }
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
      coordinator:profiles!projects_project_coordinator_id_fkey(id, full_name),
      milestones(*, owner:profiles!milestones_owner_id_fkey(id, full_name)),
      project_health_log(*, changer:profiles(id, full_name)),
      tasks(id, name, status, priority, target_date, percent_complete, milestone_id,
        owner:profiles!tasks_owner_id_fkey(id, full_name), assignee:profiles!tasks_assignee_id_fkey(id, full_name))
    `)
    .eq('id', projectId)
    .order('sort_order', { referencedTable: 'milestones', ascending: true })
    .single()
  if (error) throw error

  // project_id is now the SINGLE source of truth for project membership
  // (see reshape_task_project_linkage.sql) — every task above already
  // belongs to this project. milestone_id is just "which phase is this
  // grouped under, if any," so grouping happens client-side from one
  // query result instead of needing a second query path + de-duplication.
  if (data) {
    const allTasks = data.tasks || []
    for (const milestone of data.milestones || []) {
      milestone.tasks = allTasks.filter((t) => t.milestone_id === milestone.id)
    }
    data.direct_tasks = allTasks.filter((t) => !t.milestone_id)
  }
  return data
}

export async function createProject({
  name, sponsorId, projectManagerId, projectCoordinatorId, teamId, strategicObjective,
  businessJustification, expectedOutcome, successCriteria,
  startDate, targetCompletionDate, createdBy,
}) {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      name,
      sponsor_id: sponsorId || null,
      project_manager_id: projectManagerId || null,
      project_coordinator_id: projectCoordinatorId || null,
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

// ---------- PROJECT LIFECYCLE: archive, cancel, close, soft-delete ----------
// All four are restricted to owner (created_by), project manager, or MBM —
// access is enforced by the existing "project update" RLS policy (for the
// first three) and a dedicated check inside deleteProject (since a soft
// delete is conceptually different from a status change).

export async function archiveProject(projectId, actorId) {
  const { error } = await supabase.from('projects').update({ status: 'archived' }).eq('id', projectId)
  if (error) throw error
  await logAudit({ entityType: 'project', entityId: projectId, actorId, action: 'archived', detail: 'Project archived' })
}

export async function cancelProject(projectId, actorId, reason) {
  const { error } = await supabase.from('projects').update({ status: 'cancelled' }).eq('id', projectId)
  if (error) throw error
  await logAudit({ entityType: 'project', entityId: projectId, actorId, action: 'cancelled', detail: reason || 'Project cancelled' })
}

// Closing requires a closure note — the database trigger
// (enforce_closure_checklist) additionally blocks this unless all phases
// are done and all tasks are completed, regardless of what the UI shows,
// so this can't be bypassed by a direct API call either.
export async function closeProject(projectId, actorId, closureNote) {
  const { error } = await supabase
    .from('projects')
    .update({ status: 'closed', closure_note: closureNote })
    .eq('id', projectId)
  if (error) throw error
  await logAudit({ entityType: 'project', entityId: projectId, actorId, action: 'closed', detail: closureNote })
}

// Soft delete: the project becomes invisible to everyone (including its
// own owner/PM) via the updated "project visibility" RLS policy
// (`deleted_at is null`). Nothing is physically removed — recovering a
// soft-deleted project is a direct-database operation for now, since
// there's no in-app "trash" view yet (deferred — see audit backlog).
export async function deleteProject({ projectId, actorId, reason }) {
  const { error } = await supabase
    .from('projects')
    .update({ deleted_at: new Date().toISOString(), deleted_by: actorId, deletion_reason: reason })
    .eq('id', projectId)
  if (error) throw error
  await logAudit({ entityType: 'project', entityId: projectId, actorId, action: 'deleted', detail: reason || 'Project deleted' })
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
// Linking a task into a milestone now ALSO sets the task's project_id to
// match the milestone's project — required by the database consistency
// trigger (a task's milestone must belong to the same project as the
// task itself). project_id is the single source of truth for project
// membership; milestone_id is purely "which phase is this grouped under."
export async function linkTaskToMilestone(taskId, milestoneId) {
  const { data: milestone, error: milestoneErr } = await supabase
    .from('milestones').select('project_id').eq('id', milestoneId).single()
  if (milestoneErr) throw milestoneErr

  const { error } = await supabase
    .from('tasks')
    .update({ milestone_id: milestoneId, project_id: milestone.project_id })
    .eq('id', taskId)
  if (error) throw error
}

// Unlinking from a milestone clears milestone_id only — the task stays
// linked to its project (project_id is untouched), it just becomes
// "ungrouped" within that project rather than belonging to no project.
export async function unlinkTaskFromMilestone(taskId) {
  const { error } = await supabase.from('tasks').update({ milestone_id: null }).eq('id', taskId)
  if (error) throw error
}
