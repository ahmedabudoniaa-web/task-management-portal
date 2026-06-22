import { StatusBadge, PriorityBadge } from './Badges'

export default function TaskCard({ task, onClick }) {
  const subDone = task.sub_actions?.filter((s) => s.status === 'done').length || 0
  const subTotal = task.sub_actions?.length || 0

  return (
    <button onClick={onClick} style={styles.card}>
      <div style={styles.topRow}>
        <p style={styles.name}>{task.name}</p>
        <StatusBadge status={task.status} />
      </div>
      <div style={styles.metaRow}>
        <span style={styles.metaItem}>
          <i className="ti ti-building" style={{ fontSize: 13 }} aria-hidden="true" /> {task.team?.name}
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
          <div style={{ ...styles.progressFill, width: `${task.percent_complete}%` }} />
        </div>
      )}
    </button>
  )
}

const styles = {
  card: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '16px 18px',
    marginBottom: 10,
  },
  topRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  name: { fontSize: 15, fontWeight: 600, margin: 0 },
  metaRow: { display: 'flex', gap: 14, marginBottom: 10, flexWrap: 'wrap' },
  metaItem: { fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 },
  bottomRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  people: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  personTag: { fontSize: 12, color: 'var(--text-2)', background: 'var(--surface-2)', padding: '3px 9px', borderRadius: 999 },
  progressTrack: { height: 4, background: 'var(--surface-2)', borderRadius: 999, marginTop: 12, overflow: 'hidden' },
  progressFill: { height: '100%', background: 'var(--accent)' },
}
