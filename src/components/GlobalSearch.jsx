import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchAll } from '../lib/dashboard'

export default function GlobalSearch({ projects, tasks, actions, risks, decisions, onSelectTask }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const results = query.trim() ? searchAll({ query, projects, tasks, actions, risks, decisions }) : null
  const totalResults = results
    ? results.projects.length + results.milestones.length + results.tasks.length + results.actions.length + results.risks.length + results.decisions.length
    : 0

  function go(path) {
    setOpen(false)
    setQuery('')
    navigate(path)
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.inputWrap}>
        <i className="ti ti-search" style={{ fontSize: 15, color: 'var(--text-3)' }} aria-hidden="true" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search projects, tasks, actions, risks, decisions…"
          style={styles.input}
        />
        {query && (
          <button onClick={() => { setQuery(''); setOpen(false) }} style={styles.clearBtn} aria-label="Clear search">
            <i className="ti ti-x" style={{ fontSize: 13 }} aria-hidden="true" />
          </button>
        )}
      </div>

      {open && query.trim() && (
        <div style={styles.dropdown} onMouseLeave={() => setOpen(false)}>
          {totalResults === 0 ? (
            <p style={styles.noResults}>No matches for "{query}"</p>
          ) : (
            <>
              {results.projects.length > 0 && (
                <ResultGroup label="Projects">
                  {results.projects.map((p) => (
                    <ResultRow key={p.id} icon="ti-briefcase" label={p.name} onClick={() => go(`/projects/${p.id}`)} />
                  ))}
                </ResultGroup>
              )}
              {results.milestones.length > 0 && (
                <ResultGroup label="Milestones">
                  {results.milestones.map((m) => (
                    <ResultRow key={m.id} icon="ti-flag" label={m.name} sub={m.projectName} onClick={() => go(`/projects/${m.projectId}`)} />
                  ))}
                </ResultGroup>
              )}
              {results.tasks.length > 0 && (
                <ResultGroup label="Tasks">
                  {results.tasks.map((t) => (
                    <ResultRow key={t.id} icon="ti-checklist" label={t.name} onClick={() => { setOpen(false); setQuery(''); onSelectTask?.(t.id) }} />
                  ))}
                </ResultGroup>
              )}
              {results.actions.length > 0 && (
                <ResultGroup label="Actions">
                  {results.actions.map((a) => (
                    <ResultRow key={a.id} icon="ti-target-arrow" label={a.title} onClick={() => go('/actions')} />
                  ))}
                </ResultGroup>
              )}
              {results.risks.length > 0 && (
                <ResultGroup label="Risks">
                  {results.risks.map((r) => (
                    <ResultRow key={r.id} icon="ti-alert-triangle" label={r.description} onClick={() => go('/governance')} />
                  ))}
                </ResultGroup>
              )}
              {results.decisions.length > 0 && (
                <ResultGroup label="Decisions">
                  {results.decisions.map((d) => (
                    <ResultRow key={d.id} icon="ti-gavel" label={d.decision} onClick={() => go('/governance')} />
                  ))}
                </ResultGroup>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ResultGroup({ label, children }) {
  return (
    <div style={styles.group}>
      <p style={styles.groupLabel}>{label}</p>
      {children}
    </div>
  )
}

function ResultRow({ icon, label, sub, onClick }) {
  return (
    <button onClick={onClick} style={styles.resultRow}>
      <i className={`ti ${icon}`} style={{ fontSize: 15, color: 'var(--text-3)', flexShrink: 0 }} aria-hidden="true" />
      <span style={styles.resultLabel}>{label}{sub ? <span style={styles.resultSub}> · {sub}</span> : null}</span>
    </button>
  )
}

const styles = {
  wrap: { position: 'relative', flex: 1, maxWidth: 360 },
  inputWrap: { display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.18)', borderRadius: 999, padding: '7px 14px' },
  input: { flex: 1, background: 'none', border: 'none', color: '#fff', fontSize: 13, outline: 'none' },
  clearBtn: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', flexShrink: 0, padding: 0 },
  dropdown: {
    position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, maxHeight: 400, overflowY: 'auto',
    background: 'var(--surface)', borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
    padding: '10px 0', zIndex: 50,
  },
  noResults: { fontSize: 13, color: 'var(--text-3)', padding: '12px 16px', margin: 0 },
  group: { padding: '4px 0' },
  groupLabel: { fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '4px 16px' },
  resultRow: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '8px 16px' },
  resultLabel: { fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  resultSub: { color: 'var(--text-3)' },
}
