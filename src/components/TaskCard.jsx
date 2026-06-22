import { StatusBadge, PriorityBadge } from './Badges'
import { teamColor, teamIcon } from '../lib/teamColors'

export default function TaskCard({ task, onClick }) {
  const subDone = task.sub_actions?.filter((s) => s.status === 'done').length || 0
  const subTotal = task.sub_actions?.length || 0
  const visibleSubs = (task.sub_actions || []).slice(0, 3)
  const c = teamColor(task.team?.name)
  const icon = teamIcon(task.team?.name)
  const isDelayed = task.status !== 'completed' && task.target_date && new Date(task.target_date) < new Date()

  return (
    <button onClick={onClick} className="task-card" style={{ ...styles.card, background: isDelayed ? 'var(--danger-light)' : c.card }}>
      <style>{`
        .task-card { transition: all 0.18s; animation: fadeIn 0.3s ease both; }
        .task-card:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(0,80,160,0.12); }
      `}</style>
      <div style={styles.row}>
        <div style={{ ...styles.tile, background: isDelayed ? '#fff' : c.tile }}>
          <i className={`ti ${icon}`} style={{ fontSize: 20, color: isDelayed ? 'var(--danger)' : c.icon }} aria-hidden="true" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.topRow}>
            <div style={{ minWidth: 0 }}>
              <p style={styles.name}>{task.name}</p>
              {task.project?.name && <p style={styles.projectName}>{task.project.name}</p>}
            </div>
            <div style={styles.badges}>
              <StatusBadge status={task.status} isDelayed={isDelayed} />
              <PriorityBadge priority={task.priority} />
            </div>
          </div>

          <div style={styles.metaRow}>
            <span style={styles.metaItem}><span style={{ ...styles.dot, background: c.dot }} /> {task.team?.name}</span>
            {task.assignee && <span style={styles.metaItem}>👤 {task.assignee.full_name}</span>}
            {task.target_date && <span style={styles.metaItem}>📅 {new Date(task.target_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
            {subTotal > 0 && <span style={styles.metaItem}>☑ {subDone}/{subTotal} sub-actions</span>}
          </div>

          {subTotal > 0 && (
            <div style={styles.subList}>
              {visibleSubs.map((s) => (
                <span key={s.id} style={styles.subItem}>
                  <span style={{ ...styles.subDot, background: s.status === 'done' ? 'var(--success)' : 'var(--border)' }} />
                  {s.name}
                </span>
              ))}
              {subTotal > 3 && <span style={styles.moreSubs}>+{subTotal - 3} more</span>}
            </div>
          )}

          {subTotal > 0 && (
            <div style={styles.progressTrack}>
              <div style={{ ...styles.progressFill, width: `${Math.round((subDone / subTotal) * 100)}%`, background: subDone === subTotal ? 'var(--success)' : c.icon }} />
            </div>
          )}
        </div>
      </div>
    </button>
  )
}

const styles = {
  card: { display: 'block', width: '100%', textAlign: 'left', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '15px 16px', marginBottom: 10, boxShadow: '0 2px 8px rgba(0,80,160,0.05)', cursor: 'pointer' },
  row: { display: 'flex', gap: 14, alignItems: 'flex-start' },
  tile: { width: 42, height: 42, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  topRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  name: { fontSize: 14.5, fontWeight: 800, margin: 0, color: 'var(--text)', lineHeight: 1.35 },
  projectName: { fontSize: 11.5, color: 'var(--text-3)', margin: '2px 0 0' },
  badges: { display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },
  metaRow: { display: 'flex', gap: 10, marginBottom: 8, flexWrap: 'wrap' },
  metaItem: { fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: '50%', display: 'inline-block' },
  subList: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  subItem: { fontSize: 11.5, color: 'var(--text-2)', background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(0,0,0,0.04)', padding: '4px 8px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: 210, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  subDot: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  moreSubs: { fontSize: 11.5, color: 'var(--text-3)', padding: '4px 6px' },
  progressTrack: { height: 5, background: 'rgba(255,255,255,0.7)', borderRadius: 999, marginTop: 10, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
}
