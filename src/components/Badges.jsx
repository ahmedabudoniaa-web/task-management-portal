const STATUS_STYLES = {
  unassigned: { bg: 'rgba(143,163,196,0.12)', text: '#8FA3C4', dot: '#8FA3C4', label: 'Unassigned' },
  pending_acceptance: { bg: 'var(--warning-light)', text: 'var(--warning)', dot: 'var(--warning)', label: 'Pending acceptance' },
  in_progress: { bg: 'var(--info-light)', text: 'var(--info)', dot: 'var(--info)', label: 'In progress' },
  blocked: { bg: 'var(--danger-light)', text: 'var(--danger)', dot: 'var(--danger)', label: 'Blocked' },
  done: { bg: 'var(--accent-light)', text: 'var(--accent)', dot: 'var(--accent)', label: 'Done' },
  rejected: { bg: 'var(--danger-light)', text: 'var(--danger)', dot: 'var(--danger)', label: 'Rejected' },
}

const PRIORITY_STYLES = {
  low: { bg: 'rgba(143,163,196,0.12)', text: '#8FA3C4', label: 'Low' },
  medium: { bg: 'var(--info-light)', text: 'var(--info)', label: 'Medium' },
  high: { bg: 'var(--warning-light)', text: 'var(--warning)', label: 'High' },
  urgent: { bg: 'var(--danger-light)', text: 'var(--danger)', label: 'Urgent' },
}

function Badge({ bg, text, label, dot, pulse }) {
  return (
    <span
      style={{
        background: bg, color: text, fontSize: 11.5, fontWeight: 600,
        padding: '4px 10px 4px 8px', borderRadius: 999, whiteSpace: 'nowrap',
        display: 'inline-flex', alignItems: 'center', gap: 6, letterSpacing: '0.01em',
      }}
    >
      {dot && (
        <span style={{
          width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0,
          animation: pulse ? 'glowPulse 1.6s ease-in-out infinite' : 'none',
          boxShadow: `0 0 6px ${dot}`,
        }} />
      )}
      {label}
    </span>
  )
}

export function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.unassigned
  return <Badge {...s} pulse={status === 'in_progress' || status === 'pending_acceptance'} />
}

export function PriorityBadge({ priority }) {
  const p = PRIORITY_STYLES[priority] || PRIORITY_STYLES.medium
  return <Badge {...p} />
}
