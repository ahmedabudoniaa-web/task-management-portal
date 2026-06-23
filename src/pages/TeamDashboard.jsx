import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { fetchProjects } from '../lib/projects'
import { fetchTeams } from '../lib/tasks'
import { fetchRisks } from '../lib/risks'
import { isActiveProject } from '../lib/dashboard'
import { teamColor } from '../lib/teamColors'
import Shell from '../components/Shell'

const OPEN_RISK_STATUSES = ['open', 'monitoring', 'active']

function isPast(date) {
  if (!date) return false
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(date); d.setHours(0, 0, 0, 0)
  return d < today
}
function pct(value) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}
function projectProgress(project) {
  if (typeof project.percent_complete === 'number') return project.percent_complete
  const phases = project.milestones || []
  if (phases.length === 0) return 0
  return phases.reduce((s, ph) => s + (ph.percent_complete || 0), 0) / phases.length
}

export default function TeamDashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [teams, setTeams] = useState([])
  const [projects, setProjects] = useState([])
  const [risks, setRisks] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  async function loadAll() {
    setLoading(true); setLoadError(null)
    try {
      const [tm, proj, riskData] = await Promise.all([
        fetchTeams(),
        fetchProjects({ profile }),
        fetchRisks({ profile }),
      ])
      setTeams(tm); setProjects(proj); setRisks(riskData)
    } catch (err) {
      setLoadError(err.message || 'Could not load team dashboard.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { loadAll() }, [])

  // Group strictly by the projects the viewer can actually see — RLS has
  // already scoped `projects` to the teams this person is allowed to view,
  // so grouping on team_id naturally shows only their teams.
  const teamRows = useMemo(() => {
    const byTeam = new Map()
    for (const p of projects) {
      const id = p.team_id || p.team?.id
      if (!id) continue
      if (!byTeam.has(id)) byTeam.set(id, { id, name: p.team?.name || 'Unknown team', projects: [] })
      byTeam.get(id).projects.push(p)
    }
    const openRiskByTeam = new Map()
    for (const r of risks) {
      if (!OPEN_RISK_STATUSES.includes(r.status || 'open')) continue
      const id = r.team_id || r.team?.id
      if (!id) continue
      openRiskByTeam.set(id, (openRiskByTeam.get(id) || 0) + 1)
    }
    const rows = [...byTeam.values()].map((team) => {
      const active = team.projects.filter(isActiveProject)
      const delayed = active.filter((p) => isPast(p.target_completion_date) && projectProgress(p) < 100)
      const atRisk = active.filter((p) => ['red', 'amber'].includes(p.health))
      const avgProgress = active.length
        ? active.reduce((s, p) => s + projectProgress(p), 0) / active.length
        : 0
      return {
        ...team,
        total: team.projects.length,
        active: active.length,
        closed: team.projects.filter((p) => p.status === 'closed').length,
        delayed: delayed.length,
        atRisk: atRisk.length,
        avgProgress: pct(avgProgress),
        openRisks: openRiskByTeam.get(team.id) || 0,
      }
    })
    return rows.sort((a, b) => b.active - a.active || b.total - a.total)
  }, [projects, risks])

  const totals = useMemo(() => ({
    teams: teamRows.length,
    activeProjects: teamRows.reduce((s, t) => s + t.active, 0),
    delayed: teamRows.reduce((s, t) => s + t.delayed, 0),
    avgProgress: teamRows.length ? pct(teamRows.reduce((s, t) => s + t.avgProgress, 0) / teamRows.length) : 0,
  }), [teamRows])

  return (
    <Shell teams={teams} teamFilter={null} setTeamFilter={() => {}} notifCount={0} onBellClick={() => {}}>
      <div style={styles.heroRow}>
        <div>
          <p style={styles.eyebrow}>Cross-team comparison</p>
          <h1 style={styles.pageTitle}>Team Dashboard</h1>
          <p style={styles.pageSub}>Delivery at a glance across every team you oversee. Open the Portfolio view and filter by team for the full detail.</p>
        </div>
        <div style={styles.heroActions}>
          <button onClick={() => navigate('/portfolio')} style={styles.secondaryBtn}>Portfolio view</button>
        </div>
      </div>

      {loadError ? (
        <div style={styles.emptyState}>
          <p style={styles.errorTitle}>Couldn&apos;t load team dashboard</p>
          <p style={styles.emptySub}>{loadError}</p>
          <button onClick={loadAll} style={styles.primaryBtn}>Try again</button>
        </div>
      ) : loading ? (
        <p style={styles.loadingText}>Loading team dashboard…</p>
      ) : teamRows.length === 0 ? (
        <div style={styles.emptyState}><p style={styles.emptySub}>No team projects visible to you yet.</p></div>
      ) : (
        <>
          <div style={styles.kpiGrid}>
            <KpiCard label="Teams" value={totals.teams} sub="in your view" icon="◫" />
            <KpiCard label="Active projects" value={totals.activeProjects} sub="across teams" icon="▣" tone="info" />
            <KpiCard label="Avg progress" value={`${totals.avgProgress}%`} sub="mean of team averages" icon="◉" tone="success" />
            <KpiCard label="Delayed" value={totals.delayed} sub="past target date" icon="!" tone={totals.delayed ? 'danger' : undefined} />
          </div>

          <section style={styles.panel}>
            <div style={styles.panelHeader}><h2 style={styles.panelTitle}>By team</h2><span style={styles.panelAction}>active delivery</span></div>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Team</th>
                    <th style={styles.thNum}>Active</th>
                    <th style={styles.thNum}>Closed</th>
                    <th style={styles.thWide}>Avg progress</th>
                    <th style={styles.thNum}>Delayed</th>
                    <th style={styles.thNum}>At risk</th>
                    <th style={styles.thNum}>Open risks</th>
                  </tr>
                </thead>
                <tbody>
                  {teamRows.map((team) => (
                    <tr key={team.id} style={styles.tableRow}>
                      <td style={styles.td}>
                        <span style={{ ...styles.teamSwatch, background: teamColor(team.name).dot }} />
                        <strong>{team.name}</strong>
                        <span style={styles.tableSub}>{team.total} total</span>
                      </td>
                      <td style={styles.tdNum}>{team.active}</td>
                      <td style={styles.tdNum}>{team.closed}</td>
                      <td style={styles.td}>
                        <div style={styles.inlineProgressWrap}>
                          <div style={styles.inlineProgressTrack}><div style={{ ...styles.inlineProgressFill, width: `${team.avgProgress}%` }} /></div>
                          <span style={styles.inlineProgressText}>{team.avgProgress}%</span>
                        </div>
                      </td>
                      <td style={styles.tdNum}><Pill value={team.delayed} tone={team.delayed ? 'danger' : 'neutral'} /></td>
                      <td style={styles.tdNum}><Pill value={team.atRisk} tone={team.atRisk ? 'warning' : 'neutral'} /></td>
                      <td style={styles.tdNum}><Pill value={team.openRisks} tone={team.openRisks ? 'purple' : 'neutral'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </Shell>
  )
}

function KpiCard({ label, value, sub, icon, tone }) {
  return (
    <div style={{ ...styles.kpiCard, ...(tone ? styles[`kpi_${tone}`] : {}) }}>
      <div>
        <p style={styles.kpiLabel}>{label}</p>
        <p style={styles.kpiValue}>{value}</p>
        <p style={styles.kpiSub}>{sub}</p>
      </div>
      <span style={styles.kpiIcon}>{icon}</span>
    </div>
  )
}
function Pill({ value, tone }) {
  const map = {
    danger: { background: 'var(--danger-light)', color: 'var(--danger)' },
    warning: { background: 'var(--warning-light)', color: 'var(--warning)' },
    purple: { background: 'rgba(123,92,255,0.14)', color: '#5b40d6' },
    neutral: { background: 'var(--surface-2)', color: 'var(--text-3)' },
  }
  return <span style={{ ...styles.pill, ...(map[tone] || map.neutral) }}>{value}</span>
}

const styles = {
  heroRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, marginBottom: 20, flexWrap: 'wrap' },
  eyebrow: { fontSize: 11.5, fontWeight: 900, color: 'var(--bupa-blue)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 5px' },
  pageTitle: { fontSize: 28, fontWeight: 900, color: 'var(--text)', margin: 0 },
  pageSub: { fontSize: 13.5, color: 'var(--text-2)', margin: '6px 0 0', maxWidth: 560 },
  heroActions: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  secondaryBtn: { border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 750, fontSize: 13, padding: '10px 16px', cursor: 'pointer' },
  primaryBtn: { border: 'none', borderRadius: 'var(--radius)', background: 'linear-gradient(135deg, #0050A0, #2D8FE0)', color: '#fff', fontWeight: 800, fontSize: 13, padding: '10px 16px', cursor: 'pointer' },
  loadingText: { color: 'var(--text-2)', fontSize: 14 },
  emptyState: { textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 40 },
  errorTitle: { fontSize: 16, color: 'var(--danger)', fontWeight: 900, margin: '0 0 6px' },
  emptySub: { fontSize: 13, color: 'var(--text-2)', margin: '0 0 16px' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 14 },
  kpiCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 17px', boxShadow: '0 2px 10px rgba(0,80,160,0.06)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' },
  kpi_success: { background: 'linear-gradient(135deg, var(--surface), var(--success-light))' },
  kpi_danger: { background: 'linear-gradient(135deg, var(--surface), var(--danger-light))' },
  kpi_info: { background: 'linear-gradient(135deg, var(--surface), var(--info-light))' },
  kpiLabel: { fontSize: 11.5, color: 'var(--text-3)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.03em', margin: '0 0 6px' },
  kpiValue: { fontSize: 27, fontWeight: 950, color: 'var(--text)', lineHeight: 1, margin: 0 },
  kpiSub: { fontSize: 12, color: 'var(--text-2)', margin: '6px 0 0' },
  kpiIcon: { width: 42, height: 42, borderRadius: 14, background: 'rgba(255,255,255,0.72)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bupa-blue)', fontWeight: 900, fontSize: 18, flexShrink: 0 },
  panel: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 18px', boxShadow: '0 2px 10px rgba(0,80,160,0.05)' },
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14 },
  panelTitle: { fontSize: 15, color: 'var(--text)', fontWeight: 900, margin: 0 },
  panelAction: { fontSize: 11.5, color: 'var(--text-3)', fontWeight: 750, background: 'var(--surface-2)', padding: '4px 9px', borderRadius: 999, whiteSpace: 'nowrap' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12.5 },
  th: { textAlign: 'left', fontSize: 11, color: 'var(--text-3)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.03em', padding: '0 8px 8px 0' },
  thNum: { textAlign: 'center', fontSize: 11, color: 'var(--text-3)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.03em', padding: '0 8px 8px' },
  thWide: { textAlign: 'left', fontSize: 11, color: 'var(--text-3)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.03em', padding: '0 8px 8px', minWidth: 140 },
  tableRow: { borderTop: '1px solid var(--border)' },
  td: { padding: '11px 8px 11px 0', color: 'var(--text)', verticalAlign: 'middle' },
  tdNum: { padding: '11px 8px', textAlign: 'center', color: 'var(--text)', verticalAlign: 'middle' },
  tableSub: { display: 'block', fontSize: 11.2, color: 'var(--text-3)', marginTop: 2 },
  teamSwatch: { display: 'inline-block', width: 10, height: 10, borderRadius: 3, marginRight: 8, verticalAlign: 'middle' },
  inlineProgressWrap: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 },
  inlineProgressTrack: { flex: 1, height: 7, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' },
  inlineProgressFill: { height: '100%', borderRadius: 999, background: 'linear-gradient(135deg, #0050A0, #2DA86A)' },
  inlineProgressText: { fontSize: 11.5, color: 'var(--text-2)', fontWeight: 800 },
  pill: { display: 'inline-block', minWidth: 26, fontSize: 12, fontWeight: 800, borderRadius: 999, padding: '3px 9px' },
}
