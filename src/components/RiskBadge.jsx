const SEVERITY_STYLES = {
  low: { bg: 'var(--success-light)', text: 'var(--success)', label: 'Low' },
  medium: { bg: 'var(--warning-light)', text: 'var(--warning)', label: 'Medium' },
  high: { bg: 'rgba(255,92,114,0.12)', text: '#C23B3B', label: 'High' },
  critical: { bg: 'var(--danger-light)', text: 'var(--danger)', label: 'Critical' },
}

export default function RiskBadge({ severity, overridden }) {
  const s = SEVERITY_STYLES[severity] || SEVERITY_STYLES.medium
  return (
    <span style={{
      background: s.bg, color: s.text, fontSize: 11.5, fontWeight: 700,
      padding: '4px 10px', borderRadius: 999, whiteSpace: 'nowrap',
      display: 'inline-flex', alignItems: 'center', gap: 5,
    }}>
      {s.label}
      {overridden && <i className="ti ti-edit" style={{ fontSize: 11 }} title="Manually overridden" aria-hidden="true" />}
    </span>
  )
}
