import { supabase } from './supabase'
import { isMBM, managedTeamIds, profileTeamIds } from './permissions'
import { logAudit } from './governance'

// ---------- RISKS ----------

export async function fetchRisks({ profile, teamFilter, projectId }) {
  let query = supabase
    .from('risks')
    .select(`
      *,
      team:teams(id, name),
      project:projects(id, name),
      owner:profiles!risks_owner_id_fkey(id, full_name)
    `)
    .order('created_at', { ascending: false })

  if (!isMBM(profile)) {
    const directorTeams = managedTeamIds(profile)
    if (directorTeams.length > 0) query = query.in('team_id', directorTeams)
    else {
      const teams = profileTeamIds(profile)
      if (teams.length > 1) query = query.in('team_id', teams)
      else query = query.or(`team_id.eq.${profile.team_id},owner_id.eq.${profile.id},created_by.eq.${profile.id}`)
    }
  }
  if (teamFilter) query = query.eq('team_id', teamFilter)
  if (projectId) query = query.eq('project_id', projectId)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createRisk({
  description, impact, likelihood, mitigationPlan, ownerId, teamId, projectId, createdBy,
}) {
  const { data, error } = await supabase
    .from('risks')
    .insert({
      description, impact, likelihood, mitigation_plan: mitigationPlan || null,
      owner_id: ownerId || null, team_id: teamId, project_id: projectId || null, created_by: createdBy,
    })
    .select()
    .single()
  if (error) throw error
  await logAudit({ entityType: 'risk', entityId: data.id, actorId: createdBy, action: 'created', detail: `Risk logged: ${description.slice(0, 60)}` })
  return data
}

export async function overrideRiskSeverity({ riskId, severity, reason, actorId }) {
  const { error } = await supabase
    .from('risks')
    .update({ severity, severity_overridden: true, severity_override_reason: reason })
    .eq('id', riskId)
  if (error) throw error
  await logAudit({ entityType: 'risk', entityId: riskId, actorId, action: 'severity_overridden', detail: `Severity manually set to ${severity}: ${reason}` })
}

export async function updateRiskStatus({ riskId, status, actorId }) {
  const { error } = await supabase.from('risks').update({ status }).eq('id', riskId)
  if (error) throw error
  await logAudit({ entityType: 'risk', entityId: riskId, actorId, action: 'status_changed', detail: `Status changed to ${status}` })
}

// ---------- ISSUES ----------

export async function fetchIssues({ profile, teamFilter, projectId }) {
  let query = supabase
    .from('issues')
    .select(`
      *,
      team:teams(id, name),
      project:projects(id, name),
      owner:profiles!issues_owner_id_fkey(id, full_name)
    `)
    .order('date_raised', { ascending: false })

  if (!isMBM(profile)) {
    const directorTeams = managedTeamIds(profile)
    if (directorTeams.length > 0) query = query.in('team_id', directorTeams)
    else {
      const teams = profileTeamIds(profile)
      if (teams.length > 1) query = query.in('team_id', teams)
      else query = query.or(`team_id.eq.${profile.team_id},owner_id.eq.${profile.id},created_by.eq.${profile.id}`)
    }
  }
  if (teamFilter) query = query.eq('team_id', teamFilter)
  if (projectId) query = query.eq('project_id', projectId)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createIssue({
  description, ownerId, teamId, projectId, dateRaised, resolutionPlan, createdBy,
}) {
  const { data, error } = await supabase
    .from('issues')
    .insert({
      description, owner_id: ownerId || null, team_id: teamId, project_id: projectId || null,
      date_raised: dateRaised || new Date().toISOString().slice(0, 10),
      resolution_plan: resolutionPlan || null, created_by: createdBy,
    })
    .select()
    .single()
  if (error) throw error
  await logAudit({ entityType: 'issue', entityId: data.id, actorId: createdBy, action: 'created', detail: `Issue raised: ${description.slice(0, 60)}` })
  return data
}

export async function updateIssueStatus({ issueId, status, actorId }) {
  const { error } = await supabase.from('issues').update({ status }).eq('id', issueId)
  if (error) throw error
  await logAudit({ entityType: 'issue', entityId: issueId, actorId, action: 'status_changed', detail: `Status changed to ${status}` })
}

export async function updateIssueResolutionPlan({ issueId, resolutionPlan, actorId }) {
  const { error } = await supabase.from('issues').update({ resolution_plan: resolutionPlan }).eq('id', issueId)
  if (error) throw error
  await logAudit({ entityType: 'issue', entityId: issueId, actorId, action: 'resolution_plan_updated', detail: 'Resolution plan updated' })
}

// ---------- DECISIONS ----------

export async function fetchDecisions({ profile, teamFilter, projectId }) {
  let query = supabase
    .from('decisions')
    .select(`
      *,
      team:teams(id, name),
      project:projects(id, name),
      decision_owner:profiles!decisions_decision_owner_id_fkey(id, full_name)
    `)
    .order('decision_date', { ascending: false })

  if (!isMBM(profile)) {
    const directorTeams = managedTeamIds(profile)
    if (directorTeams.length > 0) query = query.in('team_id', directorTeams)
    else {
      const teams = profileTeamIds(profile)
      if (teams.length > 1) query = query.in('team_id', teams)
      else query = query.or(`team_id.eq.${profile.team_id},decision_owner_id.eq.${profile.id},created_by.eq.${profile.id}`)
    }
  }
  if (teamFilter) query = query.eq('team_id', teamFilter)
  if (projectId) query = query.eq('project_id', projectId)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createDecision({
  decision, decisionDate, decisionOwnerId, reason, impact, teamId, projectId, createdBy,
}) {
  const { data, error } = await supabase
    .from('decisions')
    .insert({
      decision, decision_date: decisionDate || new Date().toISOString().slice(0, 10),
      decision_owner_id: decisionOwnerId || null, reason: reason || null, impact: impact || null,
      team_id: teamId, project_id: projectId || null, created_by: createdBy,
    })
    .select()
    .single()
  if (error) throw error
  await logAudit({ entityType: 'decision', entityId: data.id, actorId: createdBy, action: 'created', detail: `Decision logged: ${decision.slice(0, 60)}` })
  return data
}
