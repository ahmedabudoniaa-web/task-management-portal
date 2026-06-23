import { useNavigate } from 'react-router-dom'

export default function ExecutiveDashboard({ metrics, pendingDecisionCount }) {
  const navigate = useNavigate()

  return (
    <div style={styles.wrap}>
      <div style={styles.grid}>
        <Metric label="Active projects" value={metrics.active} />
        <Metric label="Delayed" value={metrics.delayed} accent="var(--danger)" />
        <Metric label="At risk (amber/red)" value={metrics.atRisk} accent="var(--warning)" />
        <Metric label="Completed" value={metrics.completed} accent="var(--success)" />
        <Metric label="Cancelled" value={metrics.cancelled} accent="var(--text-3)" />
        <Metric label="Archived" value={metrics.archived} accent="var(--text-3)" />
        <Metric label="Needs decision" value={pendingDecisionCount} accent="var(--bupa-blue)" />
        <Metric label="Open actions" value={metrics.openActions} />
        <Metric label="Overdue actions" value={metrics.overdueActions} accent="var(--danger)" />
      </div>

      {metrics.upcomingMilestones.length > 0 && (
        <div style={styles.upcomingCard}>
          <p style={styles.upcomingTitle}>Upcoming milestones</p>
          {metrics.upcomingMilestones.map((m) => (
            <button key={m.id} onClick={() => navigate(`/projects/${m.projectId}`)} style={styles.upcomingRow}>
              <span style={styles.upcomingName}>{m.name}</span>
              <span style={styles.upcomingMeta}>
                {m.projectName} · {new Date(m.planned_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, accent }) {
  return (
    <div style={styles.metricCard}>
      <p style={styles.metricLabel}>{label}</p>
      <p style={{ ...styles.metricValue, color: accent || 'var(--text)' }}>{value}</p>
    </div>
  )
}

const styles = {
  wrap: { marginBottom: 24 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 },
  metricCard: { background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '14px 16px', boxShadow: '0 2px 8px rgba(0,80,160,0.05)' },
  metricLabel: { fontSize: 11.5, color: 'var(--text-3)', margin: '0 0 4px', lineHeight: 1.3 },
  metricValue: { fontSize: 22, fontWeight: 800, margin: 0 },
  upcomingCard: { background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '16px 18px', boxShadow: '0 2px 8px rgba(0,80,160,0.05)' },
  upcomingTitle: { fontSize: 12, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.03em', margin: '0 0 10px' },
  upcomingRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', background: 'none', border: 'none', padding: '8px 0', borderBottom: '1px solid var(--border)', textAlign: 'left' },
  upcomingName: { fontSize: 13, fontWeight: 600, color: 'var(--text)' },
  upcomingMeta: { fontSize: 12, color: 'var(--text-3)' },
}
