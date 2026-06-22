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
        @keyframes dash { to { stroke-dashoffset: -400; } }
        @keyframes glowPulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes floatGrid { from { background-position: 0 0; } to { background-position: 60px 60px; } }
        .login-card { animation: fadeIn 0.5s ease both; }
        .pulse-line { animation: dash 3.5s linear infinite; }
        .login-input:focus { outline: none; border-color: var(--border-strong) !important; box-shadow: 0 0 0 3px var(--pulse-dim); }
        .login-btn:hover { box-shadow: 0 0 28px var(--pulse-dim), 0 0 0 1px var(--border-strong); transform: translateY(-1px); }
        .bg-grid {
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background-image: linear-gradient(rgba(0,229,199,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,199,0.05) 1px, transparent 1px);
          background-size: 60px 60px;
          animation: floatGrid 6s linear infinite;
          mask-image: radial-gradient(circle at 50% 30%, black, transparent 70%);
        }
      `}</style>
      <div className="bg-grid" aria-hidden="true" />

      <div className="login-card" style={styles.card}>
        <svg width="100%" height="36" viewBox="0 0 360 36" style={{ marginBottom: 18 }} aria-hidden="true">
          <polyline
            className="pulse-line"
            points="0,18 60,18 75,4 90,32 105,18 150,18 165,10 180,26 195,18 360,18"
            fill="none" stroke="var(--pulse)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray="6 4"
          />
        </svg>

        <p style={styles.eyebrow}>Bupa Arabia &middot; internal portal</p>
        <h1 style={styles.title}>Task control center</h1>
        <p style={styles.subtitle}>Sign in with the credentials your admin set up for you.</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Email
            <input
              type="email" className="login-input" value={email}
              onChange={(e) => setEmail(e.target.value)} required
              style={styles.input} placeholder="you@bupa.com.sa"
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
            {loading ? 'Authenticating…' : 'Enter portal'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 24, position: 'relative', overflow: 'hidden',
  },
  card: {
    width: '100%', maxWidth: 400, background: 'var(--surface)', backdropFilter: 'blur(20px)',
    borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '40px 36px',
    position: 'relative', zIndex: 1, boxShadow: '0 0 60px rgba(0, 229, 199, 0.06), 0 20px 60px rgba(0,0,0,0.4)',
  },
  eyebrow: {
    fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--pulse)',
    margin: '0 0 10px', fontWeight: 600, fontFamily: 'var(--font-display)',
  },
  title: {
    fontSize: 26, fontWeight: 600, margin: '0 0 8px', fontFamily: 'var(--font-display)',
    background: 'linear-gradient(135deg, #EAF2FF 0%, #00E5C7 120%)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
  },
  subtitle: { fontSize: 13.5, color: 'var(--text-2)', margin: '0 0 30px', lineHeight: 1.6 },
  form: { display: 'flex', flexDirection: 'column', gap: 18 },
  label: { fontSize: 12.5, fontWeight: 500, color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: 7, letterSpacing: '0.01em' },
  input: {
    fontSize: 14, padding: '12px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
    background: 'rgba(6, 9, 18, 0.5)', color: 'var(--text)', transition: 'all 0.2s',
  },
  error: { fontSize: 12.5, color: 'var(--danger)', margin: 0 },
  button: {
    marginTop: 6, padding: '13px 0', borderRadius: 'var(--radius)', border: '1px solid var(--border-strong)',
    background: 'linear-gradient(135deg, rgba(0,229,199,0.18), rgba(61,169,252,0.12))',
    color: 'var(--text)', fontSize: 14, fontWeight: 600, letterSpacing: '0.02em',
    transition: 'all 0.25s', fontFamily: 'var(--font-display)',
  },
}
