import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { updateMyProfile, changeMyPassword } from '../lib/profile'
import Shell from '../components/Shell'

export default function Profile() {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [jobTitle, setJobTitle] = useState(profile?.job_title || '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [profileMsg, setProfileMsg] = useState(null)
  const [passwordMsg, setPasswordMsg] = useState(null)

  async function saveProfile(e) {
    e.preventDefault()
    setSavingProfile(true)
    setProfileMsg(null)
    try {
      await updateMyProfile({ userId: profile.id, fullName, jobTitle })
      await refreshProfile?.()
      setProfileMsg({ type: 'success', text: 'Profile updated successfully.' })
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message || 'Could not update profile.' })
    } finally {
      setSavingProfile(false)
    }
  }

  async function savePassword(e) {
    e.preventDefault()
    setSavingPassword(true)
    setPasswordMsg(null)
    try {
      if (newPassword.length < 8) throw new Error('Password must be at least 8 characters.')
      if (newPassword !== confirmPassword) throw new Error('Passwords do not match.')
      await changeMyPassword(newPassword)
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMsg({ type: 'success', text: 'Password updated successfully.' })
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err.message || 'Could not update password.' })
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <Shell teams={[]} teamFilter={null} setTeamFilter={() => {}} notifCount={0} onBellClick={() => {}}>
      <button onClick={() => navigate(-1)} style={styles.backBtn}>← Back</button>
      <div style={styles.headerCard}>
        <div style={styles.avatar}>{profile?.full_name?.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}</div>
        <div>
          <p style={styles.eyebrow}>User profile</p>
          <h1 style={styles.title}>{profile?.full_name}</h1>
          <p style={styles.sub}>{profile?.email} · {profile?.team?.name || 'No team'}</p>
        </div>
      </div>

      <div style={styles.grid}>
        <form onSubmit={saveProfile} style={styles.card}>
          <h2 style={styles.cardTitle}>Profile details</h2>
          <label style={styles.label}>Full name
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required style={styles.input} />
          </label>
          <label style={styles.label}>Job title
            <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} style={styles.input} placeholder="e.g. Employee Experience Manager" />
          </label>
          {profileMsg && <p style={{ ...styles.message, ...(profileMsg.type === 'error' ? styles.error : styles.success) }}>{profileMsg.text}</p>}
          <button type="submit" disabled={savingProfile} style={styles.primaryBtn}>{savingProfile ? 'Saving…' : 'Save profile'}</button>
        </form>

        <form onSubmit={savePassword} style={styles.card}>
          <h2 style={styles.cardTitle}>Change password</h2>
          <label style={styles.label}>New password
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={styles.input} placeholder="At least 8 characters" />
          </label>
          <label style={styles.label}>Confirm password
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={styles.input} />
          </label>
          {passwordMsg && <p style={{ ...styles.message, ...(passwordMsg.type === 'error' ? styles.error : styles.success) }}>{passwordMsg.text}</p>}
          <button type="submit" disabled={savingPassword} style={styles.primaryBtn}>{savingPassword ? 'Updating…' : 'Update password'}</button>
        </form>
      </div>
    </Shell>
  )
}

const styles = {
  backBtn: { border: 'none', background: 'none', color: 'var(--info)', fontSize: 13, fontWeight: 700, marginBottom: 14, cursor: 'pointer' },
  headerCard: { display: 'flex', alignItems: 'center', gap: 16, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 20, boxShadow: '0 2px 10px rgba(0,80,160,0.06)', marginBottom: 18 },
  avatar: { width: 60, height: 60, borderRadius: 20, background: 'linear-gradient(135deg, #0050A0, #2D8FE0)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900 },
  eyebrow: { margin: '0 0 4px', fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 },
  title: { margin: 0, fontSize: 24, fontWeight: 900 },
  sub: { margin: '4px 0 0', fontSize: 13, color: 'var(--text-2)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 },
  card: { background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 18, boxShadow: '0 2px 10px rgba(0,80,160,0.06)', display: 'flex', flexDirection: 'column', gap: 12 },
  cardTitle: { margin: 0, fontSize: 16, fontWeight: 900 },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, color: 'var(--text-2)', fontWeight: 800 },
  input: { border: '1px solid var(--border)', borderRadius: 12, padding: '11px 12px', fontSize: 14, background: '#fff', color: 'var(--text)' },
  primaryBtn: { alignSelf: 'flex-start', border: 'none', borderRadius: 12, padding: '10px 16px', background: 'linear-gradient(135deg, #0050A0, #2D8FE0)', color: '#fff', fontSize: 13, fontWeight: 900, cursor: 'pointer' },
  message: { margin: 0, fontSize: 12.5, fontWeight: 800 },
  error: { color: 'var(--danger)' },
  success: { color: 'var(--success)' },
}
