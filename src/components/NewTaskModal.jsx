import { useState } from 'react'
import { createTask } from '../lib/tasks'
import { useAuth } from '../lib/AuthContext'

export default function NewTaskModal({ teams, people, onClose, onCreated }) {
  const { profile } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [teamId, setTeamId] = useState(profile.team_id)
  const [assigneeId, setAssigneeId] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [priority, setPriority] = useState('medium')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await createTask({
        name,
        description,
        teamId,
        ownerId: profile.id,
        assigneeId: assigneeId || null,
        targetDate,
        priority,
      })
      onCreated()
    } finally {
      setSaving(false)
    }
  }

  const peopleInTeam = people.filter((p) => p.team_id === teamId || profile.is_mbm)

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
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

          <p style={styles.hint}>
            {assigneeId && assigneeId !== profile.id
              ? 'They will need to accept this task before it moves to in progress.'
              : 'You can add sub-actions and assign collaborators after creating the task.'}
          </p>

          <div style={styles.actions}>
            <button type="button" onClick={onClose} style={styles.secondaryBtn}>Cancel</button>
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
    background: 'var(--surface)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 480,
    maxHeight: '90vh', overflowY: 'auto', padding: '24px 26px',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  title: { fontSize: 18, fontWeight: 600, margin: 0 },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text-2)' },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  row: { display: 'flex', gap: 12 },
  label: { fontSize: 13, fontWeight: 500, color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 },
  input: { fontSize: 14, padding: '9px 11px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' },
  textarea: { fontSize: 14, padding: '9px 11px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', minHeight: 70, resize: 'vertical' },
  hint: { fontSize: 12, color: 'var(--text-3)', margin: 0 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
  secondaryBtn: { padding: '9px 16px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'none', color: 'var(--text)', fontSize: 13 },
  primaryBtn: { padding: '9px 18px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600 },
}
