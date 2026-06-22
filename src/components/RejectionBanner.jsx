export default function RejectionBanner({ tasks, onDismiss }) {
  if (!tasks || tasks.length === 0) return null

  return (
    <div style={styles.wrap}>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .marquee-track { animation: none !important; }
        }
      `}</style>
      <div style={styles.iconWrap}>
        <i className="ti ti-alert-triangle" style={{ fontSize: 16 }} aria-hidden="true" />
      </div>
      <div style={styles.trackOuter}>
        <div className="marquee-track" style={styles.track}>
          {[...tasks, ...tasks].map((t, i) => (
            <span key={i} style={styles.item}>
              <strong>{t.name}</strong> was rejected by {t.assigneeName || 'the assignee'} — back to initiated
            </span>
          ))}
        </div>
      </div>
      <button onClick={onDismiss} style={styles.dismiss} aria-label="Dismiss">
        <i className="ti ti-x" style={{ fontSize: 14 }} aria-hidden="true" />
      </button>
    </div>
  )
}

const styles = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: 'var(--danger-light)',
    border: '1px solid var(--danger)',
    borderRadius: 'var(--radius)',
    padding: '10px 14px',
    marginBottom: 20,
    overflow: 'hidden',
  },
  iconWrap: { color: 'var(--danger)', flexShrink: 0, display: 'flex' },
  trackOuter: { flex: 1, overflow: 'hidden' },
  track: {
    display: 'flex',
    gap: 48,
    whiteSpace: 'nowrap',
    animation: 'marquee 14s linear infinite',
    width: 'max-content',
  },
  item: { fontSize: 13, color: 'var(--danger)' },
  dismiss: { background: 'none', border: 'none', color: 'var(--danger)', flexShrink: 0, padding: 4 },
}
