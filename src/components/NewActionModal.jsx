import { useState } from 'react'
import { createAction } from '../lib/governance'
import { useAuth } from '../lib/AuthContext'

const SOURCES = [
  { value: 'leadership_meeting', label: 'Leadership meeting' },
  { value: 'committee_meeting', label: 'Committee meeting' },
  { value: 'steering_committee', label: 'Steering committee' },
  { value: 'executive_assignment', label: 'Executive assignment' },
  { value: 'vendor_followup', label: 'Vendor follow-up' },
  { value: 'other', label: 'Other' },
]

export default function NewActionModal({ teams, people, onClose, onCreated }) {
  const { profile } = useAuth()
  const [title, setTitle] = useState('')
  const [teamId, setTeamId] = useState(profile.team_id)
  const [ownerId, setOwnerId] = useState(profile.id)
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState('medium')
  const [meetingSource, setMeetingSource] = useState('leadership_meeting')
  const [meetingSourceDetail, setMeetingSourceDetail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await createAction({
        title, ownerId, teamId, dueDate, priority, meetingSource, meetingSourceDetail, createdBy: profile.id,
      })
      onCreated()
    } catch (err) {
      setError(err.message || 'Could not create this action. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const peopleInTeam = people.filter((p) => p.team_id === teamId || profile.is_mbm)

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>New action</h2>
          <button onClick={onClose} style={styles.closeBtn} aria-label="Close">
            <i className="ti ti-x" style={{ fontSize: 16 }} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Action title
            <input value={title} onChange={(e) => setTitle(e.target.value)} required style={styles.input} placeholder="Confirm budget sign-off with finance" />
          </label>

          <label style={styles.label}>
            Meeting source
            <select value={meetingSource} onChange={(e) => setMeetingSource(e.target.value)} style={styles.input}>
              {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>

          <label style={styles.label}>
            Source detail
            <input value={meetingSourceDetail} onChange={(e) => setMeetingSourceDetail(e.target.value)} style={styles.input} placeholder="e.g. Q3 Steering Committee, 15 Jun" />
          </label>

          <div style={styles.row}>
            <label style={styles.label}>
              Team
              <select value={teamId} onChange={(e) => setTeamId(e.target.value)} style={styles.input}>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
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
              Owner
              <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} style={styles.input}>
                <option value={profile.id}>Myself</option>
                {peopleInTeam.filter((p) => p.id !== profile.id).map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
            </label>
            <label style={styles.label}>
              Due date
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={styles.input} />
            </label>
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <div style={styles.actions}>
            <button type="button" onClick={onClose} disabled={saving} style={styles.secondaryBtn}>Cancel</button>
            <button type="submit" disabled={saving} style={styles.primaryBtn}>
              {saving ? 'Creating…' : 'Create action'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const styles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 100 },
  modal: { background: 'var(--surface)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', padding: '24px 26px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  title: { fontSize: 18, fontWeight: 700, margin: 0 },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text-2)' },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  row: { display: 'flex', gap: 12 },
  label: { fontSize: 13, fontWeight: 600, color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 },
  input: { fontSize: 14, padding: '9px 11px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: '#fff', color: 'var(--text)' },
  error: { fontSize: 12.5, color: 'var(--danger)', margin: 0, fontWeight: 600 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
  secondaryBtn: { padding: '9px 16px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'none', color: 'var(--text)', fontSize: 13, fontWeight: 600 },
  primaryBtn: { padding: '9px 18px', borderRadius: 'var(--radius)', border: 'none', background: 'linear-gradient(135deg, #0050A0, #2D8FE0)', color: '#fff', fontSize: 13, fontWeight: 700 },
}
