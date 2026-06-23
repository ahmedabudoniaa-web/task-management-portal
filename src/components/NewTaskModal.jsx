import { useState } from 'react'
import { createTask } from '../lib/tasks'
import { useAuth } from '../lib/AuthContext'
import { availableTeamsForCreation, isMBM, isDirector, peopleVisibleForTeam } from '../lib/permissions'
import AutoGrowTextarea from './AutoGrowTextarea'

export default function NewTaskModal({ teams, people, projects, onClose, onCreated }) {
  const { profile } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const allowedTeams = availableTeamsForCreation(profile, teams)
  const [teamId, setTeamId] = useState(profile.team_id || allowedTeams[0]?.id || '')
  const [projectId, setProjectId] = useState('')
  const [assigneeId, setAssigneeId] = useState(profile.id)
  const [targetDate, setTargetDate] = useState('')
  const [priority, setPriority] = useState('medium')
  const [subActions, setSubActions] = useState([{ name: '', description: '', deadline: '', assigneeId: profile.id }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function addSubActionRow() {
    setSubActions((rows) => [...rows, { name: '', description: '', deadline: '', assigneeId: assigneeId || profile.id }])
  }

  function updateSubActionRow(index, field, value) {
    setSubActions((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  function removeSubActionRow(index) {
    setSubActions((rows) => rows.length === 1 ? [{ name: '', description: '', deadline: '', assigneeId: assigneeId || profile.id }] : rows.filter((_, i) => i !== index))
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
        subActions: subActions.filter((s) => s.name.trim()),
      })
      onCreated()
    } catch (err) {
      setError(err.message || 'Could not create this task. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const peopleInTeam = peopleVisibleForTeam(profile, people, teamId)
  const canAssignTeamQueue = isMBM(profile) || isDirector(profile)

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <p style={styles.eyebrow}>Task creation</p>
            <h2 style={styles.title}>New task</h2>
          </div>
          <button onClick={onClose} style={styles.closeBtn} aria-label="Close">×</button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.labelWide}>
            Task name <span style={styles.required}>*</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required style={styles.input} placeholder="Renew vendor contract" />
          </label>

          <label style={styles.labelWide}>
            Description / first action
            <AutoGrowTextarea value={description} onChange={(e) => setDescription(e.target.value)} style={styles.textarea} placeholder="What needs to happen" />
          </label>

          <div style={styles.grid2}>
            <label style={styles.label}>
              Team <span style={styles.required}>*</span>
              <select value={teamId} onChange={(e) => setTeamId(e.target.value)} style={styles.input}>
                {allowedTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label style={styles.label}>
              Priority <span style={styles.required}>*</span>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} style={styles.input}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
          </div>

          {projects && projects.length > 0 && (
            <label style={styles.labelWide}>
              Link to project (optional)
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={styles.input}>
                <option value="">No project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          )}

          <div style={styles.grid2}>
            <label style={styles.label}>
              Assign to
              <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} style={styles.input}>
                {canAssignTeamQueue && <option value="">Assign to team queue</option>}
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
              <div>
                <p style={styles.subSectionLabel}>Sub-actions</p>
                <p style={styles.subHint}>Break the task into smaller visible steps.</p>
              </div>
              <button type="button" onClick={addSubActionRow} style={styles.addBtn}>+ Add sub-action</button>
            </div>

            {subActions.map((row, i) => (
              <div key={i} style={styles.subActionRow}>
                <div style={styles.subActionHeader}>
                  <span style={styles.subIndex}>{i + 1}</span>
                  <input
                    value={row.name}
                    onChange={(e) => updateSubActionRow(i, 'name', e.target.value)}
                    placeholder="Sub-action name"
                    style={{ ...styles.input, flex: 1 }}
                  />
                  <button type="button" onClick={() => removeSubActionRow(i)} style={styles.removeRowBtn}>Remove</button>
                </div>
                <div style={styles.grid2Compact}>
                  <input
                    value={row.description}
                    onChange={(e) => updateSubActionRow(i, 'description', e.target.value)}
                    placeholder="Description (optional)"
                    style={styles.input}
                  />
                  <input
                    type="date"
                    value={row.deadline}
                    onChange={(e) => updateSubActionRow(i, 'deadline', e.target.value)}
                    style={styles.input}
                  />
                </div>
                <select
                  value={row.assigneeId}
                  onChange={(e) => updateSubActionRow(i, 'assigneeId', e.target.value)}
                  style={{ ...styles.input, marginTop: 8 }}
                >
                  <option value="">Sub-action unassigned</option>
                  {peopleVisibleForTeam(profile, people, teamId).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div style={styles.footer}>
            <div>
              {error && <p style={styles.error}>{error}</p>}
              <p style={styles.hint}>{!assigneeId ? 'This task will go to the selected team queue for the director to assign.' : assigneeId !== profile.id ? 'The assignee will need to accept this task.' : 'Only filled sub-actions will be created.'}</p>
            </div>
            <div style={styles.actions}>
              <button type="button" onClick={onClose} disabled={saving} style={styles.secondaryBtn}>Cancel</button>
              <button type="submit" disabled={saving} style={styles.primaryBtn}>{saving ? 'Creating…' : 'Create task'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

const styles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(8,18,32,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18, zIndex: 100 },
  modal: { background: 'var(--surface)', borderRadius: 18, width: '100%', maxWidth: 760, maxHeight: '92vh', overflowY: 'auto', overflowX: 'hidden', padding: '20px 22px', boxSizing: 'border-box', boxShadow: '0 22px 60px rgba(0,0,0,0.16)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12 },
  eyebrow: { fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px', fontWeight: 800 },
  title: { fontSize: 22, fontWeight: 800, margin: 0 },
  closeBtn: { width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border)', background: '#fff', color: 'var(--text-2)', fontSize: 22, lineHeight: 1, cursor: 'pointer' },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 },
  grid2Compact: { display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 8, marginTop: 8 },
  label: { fontSize: 12.5, fontWeight: 750, color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  labelWide: { fontSize: 12.5, fontWeight: 750, color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: 6 },
  required: { color: 'var(--danger)' },
  input: { fontSize: 14, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border)', background: '#fff', color: 'var(--text)', width: '100%', boxSizing: 'border-box', minHeight: 42 },
  textarea: { fontSize: 14, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border)', background: '#fff', color: 'var(--text)', minHeight: 76, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' },
  subSection: { background: 'var(--surface-2)', borderRadius: 16, padding: 12, border: '1px solid var(--border)' },
  subSectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 },
  subSectionLabel: { fontSize: 13, fontWeight: 800, color: 'var(--text)', margin: 0 },
  subHint: { fontSize: 11.5, color: 'var(--text-3)', margin: '2px 0 0' },
  addBtn: { border: 'none', background: 'var(--bupa-blue)', color: '#fff', padding: '8px 12px', borderRadius: 10, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' },
  subActionRow: { background: '#fff', borderRadius: 14, padding: 10, marginBottom: 8, border: '1px solid var(--border)' },
  subActionHeader: { display: 'flex', alignItems: 'center', gap: 8 },
  subIndex: { width: 24, height: 24, borderRadius: 999, background: 'var(--info-light)', color: 'var(--info)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 },
  removeRowBtn: { border: '1px solid var(--border)', background: '#fff', color: 'var(--text-2)', borderRadius: 10, padding: '8px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, paddingTop: 2 },
  hint: { fontSize: 12, color: 'var(--text-3)', margin: 0 },
  error: { fontSize: 12.5, color: 'var(--danger)', margin: '0 0 4px', fontWeight: 700 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 },
  secondaryBtn: { padding: '10px 16px', borderRadius: 12, border: '1px solid var(--border)', background: '#fff', color: 'var(--text)', fontSize: 13, fontWeight: 750, cursor: 'pointer' },
  primaryBtn: { padding: '10px 18px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #0050A0, #2D8FE0)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' },
}
