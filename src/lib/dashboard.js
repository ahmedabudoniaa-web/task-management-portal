// Dashboard helpers used by GlobalSearch and executive widgets.

// ---------- SHARED PROJECT-STATUS SETS ----------
// Single source of truth for what each project status means to reporting.
// (The live DB allows all eight; `schema_consolidated.sql` is stale and
// still lists only the first six — re-sync it when convenient.)
// A project is "active" only if it is NOT in one of the three terminal
// states. Previously the dashboards treated anything that wasn't 'closed'
// as active, which silently counted cancelled and archived projects as
// live work — fixed here and consumed everywhere via these exports.
export const PROJECT_STATUS_ORDER = [
  'initiation', 'planning', 'execution', 'final_review', 'closure',
  'closed', 'cancelled', 'archived',
]
export const TERMINAL_PROJECT_STATUSES = ['closed', 'cancelled', 'archived']
export const isActiveProject = (p) => !TERMINAL_PROJECT_STATUSES.includes(p.status)

export function computeExecutiveMetrics({ projects, actions }) {
  const now = new Date()

  const active = projects.filter(isActiveProject).length
  const completed = projects.filter((p) => p.status === 'closed').length
  const cancelled = projects.filter((p) => p.status === 'cancelled').length
  const archived = projects.filter((p) => p.status === 'archived').length
  // Delayed and at-risk only make sense for live work — a cancelled or
  // archived project can't be "delayed".
  const delayed = projects.filter((p) => {
    if (!p.target_completion_date || !isActiveProject(p)) return false
    return new Date(p.target_completion_date) < now && p.percent_complete < 100
  }).length
  const atRisk = projects.filter((p) => isActiveProject(p) && (p.health === 'red' || p.health === 'amber')).length

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
    cancelled,
    archived,
    delayed,
    atRisk,
    openActions,
    overdueActions,
    upcomingMilestones: upcomingMilestones.slice(0, 5),
  }
}

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

  const matchedTasks = tasks.filter((t) =>
    t.name?.toLowerCase().includes(q) ||
    (t.sub_actions || []).some((s) => s.name?.toLowerCase().includes(q))
  )
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
