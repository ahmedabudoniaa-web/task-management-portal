export function isMBM(profile) {
  return Boolean(profile?.is_mbm || profile?.role === 'mbm')
}

export function isPeopleManager(profile) {
  return Boolean(
    profile?.role === 'director' ||
    profile?.role === 'manager' ||
    profile?.is_team_manager ||
    (profile?.managed_team_ids || []).length > 0 ||
    (profile?.managed_profile_ids || []).length > 0
  )
}

// Backward compatible name used around the app.
export function isDirector(profile) {
  return isPeopleManager(profile)
}

export function managedTeamIds(profile) {
  const ids = new Set()
  for (const id of profile?.managed_team_ids || []) if (id) ids.add(id)
  // Backward compatibility: old single-team managers still manage their home team.
  if (profile?.is_team_manager && profile?.team_id) ids.add(profile.team_id)
  return [...ids]
}

export function managedProfileIds(profile) {
  const ids = new Set()
  for (const id of profile?.managed_profile_ids || []) if (id) ids.add(id)
  return [...ids]
}

export function profileTeamIds(profile) {
  const ids = new Set()
  if (profile?.team_id) ids.add(profile.team_id)
  for (const id of managedTeamIds(profile)) ids.add(id)
  for (const p of profile?.managed_profiles || []) if (p?.team_id) ids.add(p.team_id)
  return [...ids]
}

export function canSeeAllTeams(profile) {
  return isMBM(profile)
}

export function availableTeamsForCreation(profile, teams = []) {
  // Anyone can create a task/project for any team (default is their own team,
  // chosen by the caller). No restriction — cross-team creation is intended.
  return teams
}

// People assignable when a specific team is chosen: everyone on that team.
// Picking a team in a create form shows that team's members so you can assign
// across teams. With no team, returns everyone.
export function peopleVisibleForTeam(profile, people = [], teamId) {
  if (!teamId) return people
  return people.filter((p) => (p.team_id || p.team?.id) === teamId)
}

// People you manage (yourself + your reporting chain); MBM sees everyone.
// Used by monitoring views like the dashboard "Team Tasks" filter, NOT by
// assignment pickers.
export function peopleIManage(profile, people = []) {
  if (isMBM(profile)) return people
  const managed = new Set(managedProfileIds(profile))
  return people.filter((p) => p.id === profile?.id || managed.has(p.id))
}

export function canManagePerson(profile, personId) {
  if (isMBM(profile)) return true
  return managedProfileIds(profile).includes(personId)
}
