const STATUS_STYLES = {
  unassigned: { bg: 'var(--surface-2)', text: 'var(--text-2)', label: 'Unassigned' },
  pending_acceptance: { bg: 'var(--warning-light)', text: 'var(--warning)', label: 'Pending acceptance' },
  in_progress: { bg: 'var(--info-light)', text: 'var(--info)', label: 'In progress' },
  blocked: { bg: 'var(--danger-light)', text: 'var(--danger)', label: 'Blocked' },
  done: { bg: 'var(--accent-light)', text: 'var(--accent)', label: 'Done' },
  rejected: { bg: 'var(--danger-light)', text: 'var(--danger)', label: 'Rejected' },
}

const PRIORITY_STYLES = {
  low: { bg: 'var(--surface-2)', text: 'var(--text-2)', label: 'Low' },
  medium: { bg: 'var(--info-light)', text: 'var(--info)', label: 'Medium' },
  high: { bg: 'var(--warning-light)', text: 'var(--warning)', label: 'High' },
  urgent: { bg: 'var(--danger-light)', text: 'var(--danger)', label: 'Urgent' },
}

function Badge({ bg, text, label }) {
  return (
    <span
      style={{
        background: bg,
        color: text,
        fontSize: 12,
        fontWeight: 600,
        padding: '4px 10px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

export function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.unassigned
  return <Badge {...s} />
}

export function PriorityBadge({ priority }) {
  const p = PRIORITY_STYLES[priority] || PRIORITY_STYLES.medium
  return <Badge {...p} />
}
