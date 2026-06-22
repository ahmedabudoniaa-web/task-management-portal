export default function NotificationsPanel({ notifications, onClose, onMarkRead }) {
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <p style={styles.title}>Notifications</p>
        {notifications.length === 0 && <p style={styles.empty}>Nothing yet.</p>}
        {notifications.map((n) => (
          <div
            key={n.id}
            onClick={() => onMarkRead(n.id)}
            style={{ ...styles.item, opacity: n.is_read ? 0.55 : 1 }}
          >
            <p style={styles.message}>{n.message}</p>
            <p style={styles.time}>{new Date(n.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles = {
  overlay: { position: 'fixed', inset: 0, zIndex: 90 },
  panel: {
    position: 'absolute', top: 60, right: 24, width: 320, maxHeight: 420, overflowY: 'auto',
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
    padding: '14px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
  },
  title: { fontSize: 13, fontWeight: 700, margin: '0 0 10px' },
  empty: { fontSize: 13, color: 'var(--text-3)' },
  item: { padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' },
  message: { fontSize: 13, margin: '0 0 3px' },
  time: { fontSize: 11, color: 'var(--text-3)', margin: 0 },
}
