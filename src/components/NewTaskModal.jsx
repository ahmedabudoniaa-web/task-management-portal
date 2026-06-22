import { useState } from 'react'
import { createTask } from '../lib/tasks'
import { useAuth } from '../lib/AuthContext'

export default function NewTaskModal({ teams, people, projects, onClose, onCreated }) {
  const { profile } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [teamId, setTeamId] = useState(profile.team_id)
  const [projectId, setProjectId] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [priority, setPriority] = useState('medium')
  const [subActions, setSubActions] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function addSubActionRow() {
    setSubActions((rows) => [...rows, { name: '', description: '', deadline: '', assigneeId: '' }])
  }

  function updateSubActionRow(index, field, value) {
    setSubActions((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  function removeSubActionRow(index) {
    setSubActions((rows) => rows.filter((_, i) => i !== index))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await createTask({
        name,
        description,
        teamId,
        projectId: projectId || null,
        ownerId: profile.id,
        assigneeId: assigneeId || null,
        targetDate,
        priority,
        subActions,
      })
      onCreated()
    } catch (err) {
      setError(err.message || 'Could not create this task. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const peopleInTeam = people.filter((p) => p.team_id === teamId || profile.is_mbm)

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>New task</h2>
          <button onClick={onClose} style={styles.closeBtn} aria-label="Close">
            <i className="ti ti-x" style={{ fontSize: 16 }} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Task name
            <input value={name} onChange={(e) => setName(e.target.value)} required style={styles.input} placeholder="Renew vendor contract" />
          </label>

          <label style={styles.label}>
            Description / first action
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={styles.textarea} placeholder="What needs to happen" />
          </label>

          <div style={styles.row}>
            <label style={styles.label}>
              Team
              <select value={teamId} onChange={(e) => setTeamId(e.target.value)} style={styles.input}>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
            <label style={styles.label}>
              Priority
              <select value={priority} onChange={(e) => setPriority(e.target.value)} style={styles.input}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
          </div>

          {projects && projects.length > 0 && (
            <label style={styles.label}>
              Link to project (optional)
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={styles.input}>
                <option value="">No project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          )}

          <div style={styles.row}>
            <label style={styles.label}>
              Assign to
              <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} style={styles.input}>
                <option value="">Leave unassigned</option>
                <option value={profile.id}>Myself</option>
                {peopleInTeam.filter((p) => p.id !== profile.id).map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name} ({p.team?.name})</option>
                ))}
              </select>
            </label>
            <label style={styles.label}>
              Target date
              <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} style={styles.input} />
            </label>
          </div>

          <div style={styles.subSection}>
            <div style={styles.subSectionHeader}>
              <p style={styles.subSectionLabel}>Sub-actions (optional)</p>
              <button type="button" onClick={addSubActionRow} style={styles.addLink}>
                <i className="ti ti-plus" style={{ fontSize: 13 }} aria-hidden="true" /> Add
              </button>
            </div>
            {subActions.map((row, i) => (
              <div key={i} style={styles.subActionRow}>
                <div style={styles.subActionRowTop}>
                  <input
                    value={row.name} onChange={(e) => updateSubActionRow(i, 'name', e.target.value)}
                    placeholder="Sub-action name" style={{ ...styles.input, flex: 1 }}
                  />
                  <button type="button" onClick={() => removeSubActionRow(i)} style={styles.removeRowBtn} aria-label="Remove">
                    <i className="ti ti-x" style={{ fontSize: 14 }} aria-hidden="true" />
                  </button>
                </div>
                <input
                  value={row.description} onChange={(e) => updateSubActionRow(i, 'description', e.target.value)}
                  placeholder="Description (optional)" style={{ ...styles.input, marginTop: 6 }}
                />
                <div style={{ ...styles.row, marginTop: 6 }}>
                  <input
                    type="date" value={row.deadline} onChange={(e) => updateSubActionRow(i, 'deadline', e.target.value)}
                    style={styles.input}
                  />
                  <select
                    value={row.assigneeId} onChange={(e) => updateSubActionRow(i, 'assigneeId', e.target.value)}
                    style={styles.input}
                  >
                    <option value="">Unassigned</option>
                    {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <p style={styles.hint}>
            {assigneeId && assigneeId !== profile.id
              ? 'They will need to accept this task before it moves to in progress.'
              : 'You can add more sub-actions and collaborators after creating the task too.'}
          </p>

          {error && <p style={styles.error}>{error}</p>}

          <div style={styles.actions}>
            <button type="button" onClick={onClose} disabled={saving} style={styles.secondaryBtn}>Cancel</button>
            <button type="submit" disabled={saving} style={styles.primaryBtn}>
              {saving ? 'Creating…' : 'Create task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 100,
  },
  modal: {
    background: 'var(--surface)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 560,
    maxHeight: '88vh', overflowY: 'auto', overflowX: 'hidden', padding: '22px 24px', boxSizing: 'border-box',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  title: { fontSize: 18, fontWeight: 700, margin: 0 },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text-2)', flexShrink: 0 },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  row: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  label: { fontSize: 13, fontWeight: 600, color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 200px', minWidth: 0 },
  input: { fontSize: 14, padding: '9px 11px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: '#fff', color: 'var(--text)', width: '100%', boxSizing: 'border-box' },
  textarea: { fontSize: 14, padding: '9px 11px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: '#fff', color: 'var(--text)', minHeight: 64, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' },
  subSection: { background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: 12 },
  subSectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  subSectionLabel: { fontSize: 12, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.03em', margin: 0 },
  addLink: { display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--bupa-blue)', fontSize: 12, fontWeight: 700 },
  subActionRow: { background: '#fff', borderRadius: 'var(--radius)', padding: 10, marginBottom: 8 },
  subActionRowTop: { display: 'flex', gap: 8, alignItems: 'center' },
  removeRowBtn: { background: 'none', border: 'none', color: 'var(--text-3)', flexShrink: 0 },
  hint: { fontSize: 12, color: 'var(--text-3)', margin: 0 },
  error: { fontSize: 12.5, color: 'var(--danger)', margin: 0, fontWeight: 600 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
  secondaryBtn: { padding: '9px 16px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'none', color: 'var(--text)', fontSize: 13, fontWeight: 600 },
  primaryBtn: { padding: '9px 18px', borderRadius: 'var(--radius)', border: 'none', background: 'linear-gradient(135deg, #0050A0, #2D8FE0)', color: '#fff', fontSize: 13, fontWeight: 700 },
}
