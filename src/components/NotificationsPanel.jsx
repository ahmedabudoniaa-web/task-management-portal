import { useMemo, useState } from 'react'
import { markAllNotificationsRead } from '../lib/tasks'

export default function NotificationsPanel({ notifications, onClose, onMarkRead, currentUserId, onChanged }) {
  const [filter, setFilter] = useState('all')

  const filtered = useMemo(() => {
    if (filter === 'unread') return notifications.filter((n) => !n.is_read)
    if (filter === 'mentions') return notifications.filter((n) => n.type === 'mention')
    if (filter === 'messages') return notifications.filter((n) => n.type === 'message')
    return notifications
  }, [notifications, filter])

  async function markAll() {
    if (!currentUserId) return
    await markAllNotificationsRead(currentUserId)
    onChanged?.()
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <p style={styles.eyebrow}>Notification center</p>
            <h2 style={styles.title}>Notifications</h2>
          </div>
          <button onClick={onClose} style={styles.closeBtn} aria-label="Close">×</button>
        </div>

        <div style={styles.tabs}>
          {[
            ['all', 'All'], ['unread', 'Unread'], ['mentions', 'Mentions'], ['messages', 'Messages'],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)} style={{ ...styles.tab, ...(filter === key ? styles.tabActive : {}) }}>{label}</button>
          ))}
        </div>

        <div style={styles.actions}>
          <span style={styles.count}>{notifications.filter((n) => !n.is_read).length} unread</span>
          <button onClick={markAll} style={styles.markAllBtn}>Mark all read</button>
        </div>

        {filtered.length === 0 && <p style={styles.empty}>Nothing here.</p>}
        {filtered.map((n) => (
          <button key={n.id} onClick={() => onMarkRead?.(n.id)} style={{ ...styles.item, ...(!n.is_read ? styles.unread : {}) }}>
            <div style={styles.itemTop}>
              <span style={styles.type}>{labelForType(n.type)}</span>
              <span style={styles.time}>{new Date(n.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p style={styles.message}>{n.message}</p>
            {n.task?.name && <p style={styles.context}>Task: {n.task.name}</p>}
          </button>
        ))}
      </div>
    </div>
  )
}

function labelForType(type) {
  const labels = {
    mention: '@ mention', message: 'Message', assigned: 'Assigned', rejected: 'Rejected',
    date_approved: 'Date approved', date_declined: 'Date declined', date_push_request: 'Date request',
  }
  return labels[type] || type || 'Notification'
}

const styles = {
  overlay: { position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(8,18,32,0.12)' },
  panel: { position: 'absolute', top: 72, right: 24, width: 430, maxHeight: '78vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 16, boxShadow: '0 16px 40px rgba(0,0,0,0.14)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  eyebrow: { margin: '0 0 3px', color: 'var(--text-3)', fontSize: 10.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' },
  title: { margin: 0, fontSize: 18, fontWeight: 900 },
  closeBtn: { border: '1px solid var(--border)', background: '#fff', borderRadius: 10, width: 32, height: 32, fontSize: 20, color: 'var(--text-2)', cursor: 'pointer' },
  tabs: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 },
  tab: { border: 'none', borderRadius: 999, background: 'var(--surface-2)', color: 'var(--text-2)', padding: '6px 10px', fontSize: 11.5, fontWeight: 800, cursor: 'pointer' },
  tabActive: { background: 'var(--info-light)', color: 'var(--info)' },
  actions: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  count: { fontSize: 12, color: 'var(--text-3)', fontWeight: 800 },
  markAllBtn: { border: 'none', background: 'none', color: 'var(--info)', fontSize: 12, fontWeight: 800, cursor: 'pointer' },
  empty: { fontSize: 13, color: 'var(--text-3)' },
  item: { display: 'block', width: '100%', textAlign: 'left', border: '1px solid var(--border)', background: '#fff', borderRadius: 14, padding: 12, marginBottom: 8, cursor: 'pointer' },
  unread: { borderColor: 'var(--bupa-blue)', background: 'var(--info-light)' },
  itemTop: { display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 4 },
  type: { fontSize: 11.5, fontWeight: 900, color: 'var(--info)' },
  time: { fontSize: 11, color: 'var(--text-3)' },
  message: { margin: 0, fontSize: 13, color: 'var(--text)', lineHeight: 1.45 },
  context: { margin: '5px 0 0', fontSize: 12, color: 'var(--text-3)' },
}
