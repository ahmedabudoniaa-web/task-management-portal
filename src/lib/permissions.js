export function isMBM(profile) {
  return Boolean(profile?.is_mbm || profile?.role === 'mbm')
}

export function isDirector(profile) {
  return Boolean(profile?.role === 'director' || profile?.is_team_manager || (profile?.managed_team_ids || []).length > 0)
}

export function managedTeamIds(profile) {
  const ids = new Set()
  for (const id of profile?.managed_team_ids || []) if (id) ids.add(id)
  // Backward compatibility: old single-team managers still manage their home team.
  if (profile?.is_team_manager && profile?.team_id) ids.add(profile.team_id)
  return [...ids]
}

export function profileTeamIds(profile) {
  const ids = new Set()
  if (profile?.team_id) ids.add(profile.team_id)
  for (const id of managedTeamIds(profile)) ids.add(id)
  return [...ids]
}

export function canSeeAllTeams(profile) {
  return isMBM(profile)
}

export function availableTeamsForCreation(profile, teams = []) {
  if (canSeeAllTeams(profile)) return teams
  const allowed = new Set(profileTeamIds(profile))
  return teams.filter((t) => allowed.has(t.id))
}

export function peopleVisibleForTeam(profile, people = [], teamId) {
  if (canSeeAllTeams(profile)) return people
  const allowed = new Set(profileTeamIds(profile))
  return people.filter((p) => {
    if (teamId) return p.team_id === teamId || p.id === profile?.id
    return allowed.has(p.team_id) || p.id === profile?.id
  })
}
