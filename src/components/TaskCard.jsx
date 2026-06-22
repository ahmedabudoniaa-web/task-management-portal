import { StatusBadge, PriorityBadge } from './Badges'
import { teamColor, teamIcon } from '../lib/teamColors'

export default function TaskCard({ task, onClick }) {
  const subDone = task.sub_actions?.filter((s) => s.status === 'done').length || 0
  const subTotal = task.sub_actions?.length || 0
  const c = teamColor(task.team?.name)
  const icon = teamIcon(task.team?.name)

  return (
    <button onClick={onClick} className="task-card" style={{ ...styles.card, background: c.card }}>
      <style>{`
        .task-card { transition: all 0.18s; animation: fadeIn 0.3s ease both; }
        .task-card:hover { transform: translateY(-3px) rotate(-0.3deg); box-shadow: 0 8px 20px rgba(0,80,160,0.1); }
      `}</style>
      <div style={styles.row}>
        <div style={{ ...styles.tile, background: c.tile }}>
          <i className={`ti ${icon}`} style={{ fontSize: 20, color: c.icon }} aria-hidden="true" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.topRow}>
            <p style={styles.name}>{task.name}</p>
            <StatusBadge status={task.status} isDelayed={task.status !== 'completed' && task.target_date && new Date(task.target_date) < new Date()} />
          </div>
          <div style={styles.metaRow}>
            <span style={styles.metaItem}>
              <span style={{ ...styles.dot, background: c.dot }} /> {task.team?.name}
            </span>
            {task.target_date && (
              <span style={styles.metaItem}>
                <i className="ti ti-calendar" style={{ fontSize: 13 }} aria-hidden="true" />{' '}
                {new Date(task.target_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            )}
            {subTotal > 0 && (
              <span style={styles.metaItem}>
                <i className="ti ti-list-check" style={{ fontSize: 13 }} aria-hidden="true" /> {subDone}/{subTotal}
              </span>
            )}
          </div>
          <div style={styles.bottomRow}>
            <div style={styles.people}>
              <span style={styles.personTag}>Owner: {task.owner?.full_name}</span>
              {task.assignee && <span style={styles.personTag}>Assignee: {task.assignee.full_name}</span>}
            </div>
            <PriorityBadge priority={task.priority} />
          </div>
          {task.percent_complete > 0 && (
            <div style={styles.progressTrack}>
              <div style={{ ...styles.progressFill, width: `${task.percent_complete}%`, background: c.icon }} />
            </div>
          )}
        </div>
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
  row: { display: 'flex', gap: 14, alignItems: 'flex-start' },
  tile: { width: 44, height: 44, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  topRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 6 },
  name: { fontSize: 14.5, fontWeight: 700, margin: 0, color: 'var(--text)' },
  metaRow: { display: 'flex', gap: 14, marginBottom: 10, flexWrap: 'wrap' },
  metaItem: { fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: '50%', display: 'inline-block' },
  bottomRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  people: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  personTag: { fontSize: 11.5, color: 'var(--text-2)', background: 'rgba(255,255,255,0.6)', padding: '3px 9px', borderRadius: 999 },
  progressTrack: { height: 5, background: 'rgba(255,255,255,0.6)', borderRadius: 999, marginTop: 12, overflow: 'hidden' },
  progressFill: { height: '100%' },
}
