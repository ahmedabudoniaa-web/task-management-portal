import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) setError(error.message)
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <p style={styles.eyebrow}>Task management portal</p>
        <h1 style={styles.title}>Sign in</h1>
        <p style={styles.subtitle}>Use the email and password your admin set up for you.</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={styles.input}
              placeholder="you@company.com"
            />
          </label>
          <label style={styles.label}>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={styles.input}
              placeholder="••••••••"
            />
          </label>
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    background: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    padding: '36px 32px',
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--text-3)',
    margin: '0 0 8px',
    fontWeight: 600,
  },
  title: { fontSize: 24, fontWeight: 600, margin: '0 0 6px' },
  subtitle: { fontSize: 14, color: 'var(--text-2)', margin: '0 0 28px', lineHeight: 1.5 },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  label: { fontSize: 13, fontWeight: 500, color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: 6 },
  input: {
    fontSize: 14,
    padding: '10px 12px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
  },
  error: { fontSize: 13, color: 'var(--danger)', margin: 0 },
  button: {
    marginTop: 8,
    padding: '11px 0',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
  },
}
