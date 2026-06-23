import { useState } from 'react'
import { createProject } from '../lib/projects'
import { useAuth } from '../lib/AuthContext'
import { availableTeamsForCreation, peopleVisibleForTeam } from '../lib/permissions'
import AutoGrowTextarea from './AutoGrowTextarea'

export default function NewProjectModal({ teams, people, onClose, onCreated }) {
  const { profile } = useAuth()
  const [name, setName] = useState('')
  const allowedTeams = availableTeamsForCreation(profile, teams)
  const [teamId, setTeamId] = useState(profile.team_id || allowedTeams[0]?.id || '')
  const [sponsorId, setSponsorId] = useState('')
  const [pmId, setPmId] = useState(profile.id)
  const [strategicObjective, setStrategicObjective] = useState('')
  const [businessJustification, setBusinessJustification] = useState('')
  const [expectedOutcome, setExpectedOutcome] = useState('')
  const [successCriteria, setSuccessCriteria] = useState('')
  const [startDate, setStartDate] = useState('')
  const [targetCompletionDate, setTargetCompletionDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await createProject({
        name, teamId, sponsorId: sponsorId || null, projectManagerId: pmId || null,
        strategicObjective, businessJustification, expectedOutcome, successCriteria,
        startDate, targetCompletionDate, createdBy: profile.id,
      })
      onCreated()
    } catch (err) {
      setError(err.message || 'Could not create this project. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const peopleInTeam = peopleVisibleForTeam(profile, people, teamId)

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>New project</h2>
          <button onClick={onClose} style={styles.closeBtn} aria-label="Close">
            <i className="ti ti-x" style={{ fontSize: 16 }} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Project name
            <input value={name} onChange={(e) => setName(e.target.value)} required style={styles.input} placeholder="Office renovation project" />
          </label>

          <div style={styles.row}>
            <label style={styles.label}>
              Team
              <select value={teamId} onChange={(e) => setTeamId(e.target.value)} style={styles.input}>
                {allowedTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label style={styles.label}>
              Project manager
              <select value={pmId} onChange={(e) => setPmId(e.target.value)} style={styles.input}>
                <option value="">Unassigned</option>
                <option value={profile.id}>Myself</option>
                {peopleInTeam.filter((p) => p.id !== profile.id).map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
            </label>
          </div>

          <label style={styles.label}>
            Sponsor
            <select value={sponsorId} onChange={(e) => setSponsorId(e.target.value)} style={styles.input}>
              <option value="">Unassigned</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.full_name} ({p.team?.name})</option>)}
            </select>
          </label>

          <label style={styles.label}>
            Strategic objective
            <AutoGrowTextarea value={strategicObjective} onChange={(e) => setStrategicObjective(e.target.value)} style={styles.textarea} placeholder="What strategic goal does this support" />
          </label>

          <label style={styles.label}>
            Business justification
            <AutoGrowTextarea value={businessJustification} onChange={(e) => setBusinessJustification(e.target.value)} style={styles.textarea} placeholder="Why this project, why now" />
          </label>

          <div style={styles.row}>
            <label style={styles.label}>
              Expected outcome
              <AutoGrowTextarea value={expectedOutcome} onChange={(e) => setExpectedOutcome(e.target.value)} style={{ ...styles.textarea, minHeight: 56 }} />
            </label>
            <label style={styles.label}>
              Success criteria
              <AutoGrowTextarea value={successCriteria} onChange={(e) => setSuccessCriteria(e.target.value)} style={{ ...styles.textarea, minHeight: 56 }} />
            </label>
          </div>

          <div style={styles.row}>
            <label style={styles.label}>
              Start date
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={styles.input} />
            </label>
            <label style={styles.label}>
              Target completion
              <input type="date" value={targetCompletionDate} onChange={(e) => setTargetCompletionDate(e.target.value)} style={styles.input} />
            </label>
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <div style={styles.actions}>
            <button type="button" onClick={onClose} disabled={saving} style={styles.secondaryBtn}>Cancel</button>
            <button type="submit" disabled={saving} style={styles.primaryBtn}>
              {saving ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const styles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 100 },
  modal: { background: 'var(--surface)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', padding: '24px 26px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  title: { fontSize: 18, fontWeight: 700, margin: 0 },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text-2)' },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  row: { display: 'flex', gap: 12 },
  label: { fontSize: 13, fontWeight: 600, color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 },
  input: { fontSize: 14, padding: '9px 11px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: '#fff', color: 'var(--text)' },
  textarea: { fontSize: 14, padding: '9px 11px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: '#fff', color: 'var(--text)', minHeight: 64, resize: 'vertical', fontFamily: 'inherit' },
  error: { fontSize: 12.5, color: 'var(--danger)', margin: 0, fontWeight: 600 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
  secondaryBtn: { padding: '9px 16px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'none', color: 'var(--text)', fontSize: 13, fontWeight: 600 },
  primaryBtn: { padding: '9px 18px', borderRadius: 'var(--radius)', border: 'none', background: 'linear-gradient(135deg, #0050A0, #2D8FE0)', color: '#fff', fontSize: 13, fontWeight: 700 },
}
