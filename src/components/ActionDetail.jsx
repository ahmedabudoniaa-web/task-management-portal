import { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { fetchActionDetail, updateActionStatus, addActionComment, meetingSourceLabel } from '../lib/governance'
import MentionText from './MentionText'

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
]

export default function ActionDetail({ actionId, people, onClose, onChanged }) {
  const { profile } = useAuth()
  const [action, setAction] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [commentBody, setCommentBody] = useState('')

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await fetchActionDetail(actionId)
      setAction(data)
    } catch (err) {
      setLoadError(err.message || 'Could not load this action.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [actionId])

  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function runAction(fn) {
    setActionError(null)
    setBusy(true)
    try {
      await fn()
    } catch (err) {
      setActionError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function refresh() {
    await load()
    onChanged?.()
  }

  function handleStatusChange(status) {
    runAction(async () => {
      await updateActionStatus({ actionId: action.id, status, actorId: profile.id })
      await refresh()
    })
  }

  function submitComment(e) {
    e.preventDefault()
    if (!commentBody.trim()) return
    runAction(async () => {
      await addActionComment({ actionId: action.id, authorId: profile.id, body: commentBody, people })
      setCommentBody('')
      await refresh()
    })
  }

  if (loadError) {
    return (
      <div style={styles.overlay} onClick={onClose}>
        <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={styles.closeBtn} aria-label="Close"><i className="ti ti-x" style={{ fontSize: 18 }} aria-hidden="true" /></button>
          </div>
          <p style={{ color: 'var(--danger)', fontSize: 14, fontWeight: 700 }}>Couldn't load this action</p>
          <p style={{ color: 'var(--text-2)', fontSize: 13 }}>{loadError}</p>
          <button onClick={load} style={styles.smallBtn}>Try again</button>
        </div>
      </div>
    )
  }

  if (loading || !action) {
    return (
      <div style={styles.overlay} onClick={onClose}>
        <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={styles.closeBtn} aria-label="Close"><i className="ti ti-x" style={{ fontSize: 18 }} aria-hidden="true" /></button>
          </div>
          <p style={{ color: 'var(--text-2)' }}>Loading…</p>
        </div>
      </div>
    )
  }

  const canEdit = profile.is_mbm || action.owner_id === profile.id || action.created_by === profile.id

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <p style={styles.team}>{action.team?.name} · {meetingSourceLabel(action.meeting_source)}</p>
            <h2 style={styles.title}>{action.title}</h2>
            {action.meeting_source_detail && <p style={styles.sourceDetail}>{action.meeting_source_detail}</p>}
          </div>
          <button onClick={onClose} style={styles.closeBtn} aria-label="Close"><i className="ti ti-x" style={{ fontSize: 18 }} aria-hidden="true" /></button>
        </div>

        {actionError && (
          <div style={styles.actionErrorBox}>
            <p style={styles.actionErrorText}>{actionError}</p>
            <button onClick={() => setActionError(null)} style={styles.actionErrorDismiss} aria-label="Dismiss"><i className="ti ti-x" style={{ fontSize: 13 }} aria-hidden="true" /></button>
          </div>
        )}

        <div style={styles.peopleRow}>
          <div><p style={styles.fieldLabel}>Owner</p><p style={styles.fieldValue}>{action.owner?.full_name}</p></div>
          <div><p style={styles.fieldLabel}>Due date</p><p style={styles.fieldValue}>
            {action.due_date ? new Date(action.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
          </p></div>
        </div>

        {canEdit && (
          <div style={styles.statusRow}>
            <p style={styles.sectionLabel}>Status</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value} onClick={() => handleStatusChange(opt.value)} disabled={busy}
                  style={{ ...styles.statusOption, ...(action.status === opt.value ? styles.statusOptionActive : {}) }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <p style={styles.sectionLabel}>Comments</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
          {action.action_comments?.length === 0 && <p style={styles.emptyText}>No comments yet.</p>}
          {action.action_comments
            ?.slice()
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
            .map((c) => (
              <div key={c.id} style={styles.commentRow}>
                <p style={styles.commentMeta}>
                  {c.author?.full_name} · {new Date(c.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
                <p style={styles.commentBody}><MentionText text={c.body} people={people} /></p>
              </div>
            ))}
        </div>
        <form onSubmit={submitComment} style={{ display: 'flex', gap: 8 }}>
          <input value={commentBody} onChange={(e) => setCommentBody(e.target.value)} placeholder="Add a comment… (type @Full Name to mention)" style={{ ...styles.input, flex: 1 }} />
          <button type="submit" disabled={busy} style={styles.smallBtn}>{busy ? 'Posting…' : 'Post'}</button>
        </form>
      </div>
    </div>
  )
}

const styles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'flex-end', zIndex: 100 },
  panel: { background: 'var(--surface)', width: '100%', maxWidth: 520, height: '100%', overflowY: 'auto', padding: '28px 30px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  team: { fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 4px' },
  title: { fontSize: 19, fontWeight: 800, margin: 0, color: 'var(--text)' },
  sourceDetail: { fontSize: 12.5, color: 'var(--text-2)', margin: '4px 0 0' },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text-2)', flexShrink: 0 },
  actionErrorBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, background: 'var(--danger-light)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 16 },
  actionErrorText: { fontSize: 13, color: 'var(--danger)', margin: 0 },
  actionErrorDismiss: { background: 'none', border: 'none', color: 'var(--danger)', flexShrink: 0 },
  peopleRow: { display: 'flex', gap: 28, paddingBottom: 18, marginBottom: 18, borderBottom: '1px solid var(--border)' },
  fieldLabel: { fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.03em', margin: '0 0 3px' },
  fieldValue: { fontSize: 13.5, fontWeight: 700, margin: 0, color: 'var(--text)' },
  statusRow: { marginBottom: 20 },
  sectionLabel: { fontSize: 12, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.03em', margin: '0 0 10px' },
  statusOption: { fontSize: 12.5, fontWeight: 600, padding: '7px 13px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)' },
  statusOptionActive: { background: 'var(--bupa-blue)', color: '#fff', borderColor: 'var(--bupa-blue)' },
  emptyText: { fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic', margin: 0 },
  commentRow: { padding: '0 0 10px', borderBottom: '1px solid var(--border)' },
  commentMeta: { fontSize: 11, color: 'var(--text-3)', margin: '0 0 3px' },
  commentBody: { fontSize: 13, margin: 0, lineHeight: 1.5 },
  input: { fontSize: 13, padding: '8px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: '#fff', color: 'var(--text)' },
  smallBtn: { fontSize: 13, padding: '8px 14px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--bupa-blue)', color: '#fff', fontWeight: 700 },
}
