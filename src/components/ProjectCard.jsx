import { teamColor } from '../lib/teamColors'
import { healthColor } from '../lib/teamColors'

const STATUS_LABELS = {
  initiation: 'Initiation',
  planning: 'Planning',
  execution: 'Execution',
  final_review: 'Final review',
  closure: 'Closure',
  closed: 'Closed',
}

export default function ProjectCard({ project, onClick }) {
  const c = teamColor(project.team?.name)
  const h = healthColor(project.health)
  const milestoneCount = project.milestones?.length || 0
  const doneMilestones = project.milestones?.filter((m) => m.status === 'done').length || 0

  return (
    <button onClick={onClick} className="task-card" style={{ ...styles.card, background: c.card }}>
      <div style={styles.topRow}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={styles.name}>{project.name}</p>
          <p style={styles.statusLine}>{STATUS_LABELS[project.status] || project.status}</p>
        </div>
        <span style={{ ...styles.healthBadge, background: h.bg, color: h.text }}>
          <span style={{ ...styles.healthDot, background: h.text }} />
          {h.label}
        </span>
      </div>

      <div style={styles.metaRow}>
        <span style={styles.metaItem}>
          <span style={{ ...styles.dot, background: c.dot }} /> {project.team?.name}
        </span>
        {project.target_completion_date && (
          <span style={styles.metaItem}>
            <i className="ti ti-calendar" style={{ fontSize: 13 }} aria-hidden="true" />{' '}
            {new Date(project.target_completion_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
        )}
        {milestoneCount > 0 && (
          <span style={styles.metaItem}>
            <i className="ti ti-flag" style={{ fontSize: 13 }} aria-hidden="true" /> {doneMilestones}/{milestoneCount} milestones
          </span>
        )}
      </div>

      <div style={styles.bottomRow}>
        <span style={styles.personTag}>PM: {project.project_manager?.full_name || '—'}</span>
        {project.sponsor && <span style={styles.personTag}>Sponsor: {project.sponsor.full_name}</span>}
      </div>

      <div style={styles.progressTrack}>
        <div style={{ ...styles.progressFill, width: `${project.percent_complete}%`, background: c.icon }} />
      </div>
    </button>
  )
}

const styles = {
  card: {
    display: 'block', width: '100%', textAlign: 'left', border: 'none',
    borderRadius: 'var(--radius-lg)', padding: '16px 18px', marginBottom: 12,
    boxShadow: '0 2px 8px rgba(0,80,160,0.05)',
  },
  topRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  name: { fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text)' },
  statusLine: { fontSize: 12, color: 'var(--text-3)', margin: '2px 0 0' },
  healthBadge: {
    fontSize: 11.5, fontWeight: 700, padding: '4px 11px 4px 8px', borderRadius: 999,
    display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, whiteSpace: 'nowrap',
  },
  healthDot: { width: 6, height: 6, borderRadius: '50%', display: 'inline-block' },
  metaRow: { display: 'flex', gap: 14, marginBottom: 10, flexWrap: 'wrap' },
  metaItem: { fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: '50%', display: 'inline-block' },
  bottomRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 },
  personTag: { fontSize: 11.5, color: 'var(--text-2)', background: 'rgba(255,255,255,0.6)', padding: '3px 9px', borderRadius: 999 },
  progressTrack: { height: 5, background: 'rgba(255,255,255,0.6)', borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%' },
}
