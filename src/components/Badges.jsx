const STATUS_STYLES = {
  initiated: { bg: 'rgba(255,255,255,0.7)', text: '#6B7488', label: 'Initiated' },
  pending_acceptance: { bg: 'var(--warning-light)', text: 'var(--warning)', label: 'Pending acceptance' },
  in_progress: { bg: 'var(--info-light)', text: 'var(--info)', label: 'In progress' },
  blocked: { bg: 'var(--danger-light)', text: 'var(--danger)', label: 'Blocked' },
  completed: { bg: 'var(--success-light)', text: 'var(--success)', label: 'Completed' },
  delayed: { bg: 'var(--danger-light)', text: 'var(--danger)', label: 'Delayed' },
}

const PRIORITY_STYLES = {
  low: { bg: 'rgba(255,255,255,0.7)', text: '#6B7488', label: 'Low' },
  medium: { bg: 'var(--info-light)', text: 'var(--info)', label: 'Medium' },
  high: { bg: 'var(--warning-light)', text: 'var(--warning)', label: 'High' },
  urgent: { bg: 'var(--danger-light)', text: 'var(--danger)', label: 'Urgent' },
}

function Badge({ bg, text, label }) {
  return (
    <span
      style={{
        background: bg, color: text, fontSize: 11.5, fontWeight: 700,
        padding: '4px 11px', borderRadius: 999, whiteSpace: 'nowrap', letterSpacing: '0.01em',
      }}
    >
      {label}
    </span>
  )
}

export function StatusBadge({ status, isDelayed }) {
  const s = isDelayed && status !== 'completed' ? STATUS_STYLES.delayed : (STATUS_STYLES[status] || STATUS_STYLES.initiated)
  return <Badge {...s} />
}

export function PriorityBadge({ priority }) {
  const p = PRIORITY_STYLES[priority] || PRIORITY_STYLES.medium
  return <Badge {...p} />
}
