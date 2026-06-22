// All Phase 4 metrics are computed client-side from data already fetched by
// fetchProjects/fetchActions/fetchRisks — no new tables needed. This keeps
// the dashboard fast (no extra round trips) and avoids duplicating logic
// that already exists in the underlying registers.

export function computeExecutiveMetrics({ projects, actions }) {
  const now = new Date()

  const active = projects.filter((p) => p.status !== 'closed').length
  const completed = projects.filter((p) => p.status === 'closed').length
  const delayed = projects.filter((p) => {
    if (!p.target_completion_date || p.status === 'closed') return false
    return new Date(p.target_completion_date) < now && p.percent_complete < 100
  }).length
  const atRisk = projects.filter((p) => p.health === 'red' || p.health === 'amber').length

  const openActions = actions.filter((a) => a.status === 'open' || a.status === 'in_progress').length
  const overdueActions = actions.filter((a) => {
    if (!a.due_date || a.status === 'done' || a.status === 'cancelled') return false
    return new Date(a.due_date) < now
  }).length

  const upcomingMilestones = []
  for (const p of projects) {
    for (const m of p.milestones || []) {
      if (m.status !== 'done' && m.planned_date) {
        upcomingMilestones.push({ ...m, projectName: p.name, projectId: p.id })
      }
    }
  }
  upcomingMilestones.sort((a, b) => new Date(a.planned_date) - new Date(b.planned_date))

  return {
    active,
    completed,
    delayed,
    atRisk,
    openActions,
    overdueActions,
    upcomingMilestones: upcomingMilestones.slice(0, 5),
  }
}

// ---------- GLOBAL SEARCH ----------
// Searches across already-loaded data rather than issuing a new query per keystroke.

export function searchAll({ query, projects, tasks, actions, risks, decisions }) {
  const q = query.trim().toLowerCase()
  if (!q) return { projects: [], milestones: [], tasks: [], actions: [], risks: [], decisions: [] }

  const matchedProjects = projects.filter((p) => p.name?.toLowerCase().includes(q))

  const milestones = []
  for (const p of projects) {
    for (const m of p.milestones || []) {
      if (m.name?.toLowerCase().includes(q)) milestones.push({ ...m, projectName: p.name, projectId: p.id })
    }
  }

  const matchedTasks = tasks.filter((t) => t.name?.toLowerCase().includes(q))
  const matchedActions = actions.filter((a) => a.title?.toLowerCase().includes(q))
  const matchedRisks = risks.filter((r) => r.description?.toLowerCase().includes(q))
  const matchedDecisions = decisions.filter((d) => d.decision?.toLowerCase().includes(q))

  return {
    projects: matchedProjects,
    milestones,
    tasks: matchedTasks,
    actions: matchedActions,
    risks: matchedRisks,
    decisions: matchedDecisions,
  }
}
