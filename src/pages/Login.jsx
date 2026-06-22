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
      <style>{`
        .login-card { animation: fadeIn 0.5s ease both; }
        .login-input:focus { outline: none; border-color: var(--bupa-blue) !important; box-shadow: 0 0 0 3px rgba(0,80,160,0.12); }
        .login-btn:hover { box-shadow: 0 6px 18px rgba(0,80,160,0.25); transform: translateY(-1px); }
        .login-blob { position: absolute; border-radius: 50%; opacity: 0.12; background: white; }
      `}</style>

      <div className="login-card" style={styles.card}>
        <div style={styles.banner}>
          <div className="login-blob" style={{ width: 110, height: 110, top: -40, right: -10 }} />
          <div className="login-blob" style={{ width: 60, height: 60, bottom: -30, left: 30 }} />
          <img src="/logo.png" alt="FM Task Management" style={styles.logo} />
        </div>

        <div style={styles.body}>
          <p style={styles.eyebrow}>FM task management</p>
          <h1 style={styles.title}>Welcome back</h1>
          <p style={styles.subtitle}>Sign in with the credentials your admin set up for you.</p>

          <form onSubmit={handleSubmit} style={styles.form}>
            <label style={styles.label}>
              Email
              <input
                type="email" className="login-input" value={email}
                onChange={(e) => setEmail(e.target.value)} required
                style={styles.input} placeholder="you@company.com"
              />
            </label>
            <label style={styles.label}>
              Password
              <input
                type="password" className="login-input" value={password}
                onChange={(e) => setPassword(e.target.value)} required
                style={styles.input} placeholder="••••••••"
              />
            </label>
            {error && <p style={styles.error}>{error}</p>}
            <button type="submit" disabled={loading} className="login-btn" style={styles.button}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 24, background: 'var(--bg)',
  },
  card: {
    width: '100%', maxWidth: 400, background: 'var(--surface)',
    borderRadius: 'var(--radius-lg)', overflow: 'hidden',
    boxShadow: '0 4px 24px rgba(0,80,160,0.08)',
  },
  banner: {
    background: 'linear-gradient(135deg, #0050A0, #2D8FE0)', padding: '28px 0',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    position: 'relative', overflow: 'hidden',
  },
  logo: { width: 64, height: 64, borderRadius: 16, position: 'relative', zIndex: 1, objectFit: 'cover' },
  body: { padding: '32px 36px 36px' },
  eyebrow: {
    fontSize: 11.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--bupa-blue)',
    margin: '0 0 8px', fontWeight: 700,
  },
  title: { fontSize: 24, fontWeight: 800, margin: '0 0 8px', color: 'var(--text)' },
  subtitle: { fontSize: 13.5, color: 'var(--text-2)', margin: '0 0 26px', lineHeight: 1.6 },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  label: { fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: 6 },
  input: {
    fontSize: 14, padding: '11px 13px', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
    background: '#fff', color: 'var(--text)', transition: 'all 0.15s',
  },
  error: { fontSize: 12.5, color: 'var(--danger)', margin: 0 },
  button: {
    marginTop: 4, padding: '12px 0', borderRadius: 'var(--radius)', border: 'none',
    background: 'linear-gradient(135deg, #0050A0, #2D8FE0)',
    color: '#fff', fontSize: 14, fontWeight: 700, transition: 'all 0.2s',
  },
}
