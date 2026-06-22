import { teamColor } from '../lib/teamColors'
import { meetingSourceLabel } from '../lib/governance'

const STATUS_STYLES = {
  open: { bg: 'rgba(255,255,255,0.7)', text: '#6B7488', label: 'Open' },
  in_progress: { bg: 'var(--info-light)', text: 'var(--info)', label: 'In progress' },
  done: { bg: 'var(--success-light)', text: 'var(--success)', label: 'Done' },
  overdue: { bg: 'var(--danger-light)', text: 'var(--danger)', label: 'Overdue' },
  cancelled: { bg: 'rgba(255,255,255,0.7)', text: '#6B7488', label: 'Cancelled' },
}

export default function ActionCard({ action, onClick }) {
  const c = teamColor(action.team?.name)
  const s = STATUS_STYLES[action.status] || STATUS_STYLES.open
  const isOverdue = action.due_date && new Date(action.due_date) < new Date() && action.status !== 'done' && action.status !== 'cancelled'

  return (
    <button onClick={onClick} className="task-card" style={{ ...styles.card, background: c.card }}>
      <div style={styles.topRow}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={styles.title}>{action.title}</p>
          <p style={styles.sourceLine}>{meetingSourceLabel(action.meeting_source)}{action.meeting_source_detail ? ` · ${action.meeting_source_detail}` : ''}</p>
        </div>
        <span style={{ ...styles.statusBadge, background: isOverdue ? 'var(--danger-light)' : s.bg, color: isOverdue ? 'var(--danger)' : s.text }}>
          {isOverdue ? 'Overdue' : s.label}
        </span>
      </div>
      <div style={styles.metaRow}>
        <span style={styles.metaItem}>
          <span style={{ ...styles.dot, background: c.dot }} /> {action.team?.name}
        </span>
        <span style={styles.metaItem}>
          <i className="ti ti-user" style={{ fontSize: 13 }} aria-hidden="true" /> {action.owner?.full_name}
        </span>
        {action.due_date && (
          <span style={styles.metaItem}>
            <i className="ti ti-calendar" style={{ fontSize: 13 }} aria-hidden="true" />{' '}
            {new Date(action.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
    </button>
  )
}

const styles = {
  card: {
    display: 'block', width: '100%', textAlign: 'left', border: 'none',
    borderRadius: 'var(--radius-lg)', padding: '14px 16px', marginBottom: 10,
    boxShadow: '0 2px 8px rgba(0,80,160,0.05)',
  },
  topRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  title: { fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text)' },
  sourceLine: { fontSize: 11.5, color: 'var(--text-3)', margin: '2px 0 0' },
  statusBadge: { fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, flexShrink: 0, whiteSpace: 'nowrap' },
  metaRow: { display: 'flex', gap: 14, flexWrap: 'wrap' },
  metaItem: { fontSize: 11.5, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: '50%', display: 'inline-block' },
}
