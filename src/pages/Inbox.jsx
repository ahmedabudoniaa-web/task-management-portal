import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { fetchProfiles, fetchTeams, fetchNotifications, markNotificationRead } from '../lib/tasks'
import { fetchMailbox, sendTeamMessage, markMessageRead } from '../lib/messages'
import Shell from '../components/Shell'
import NotificationsPanel from '../components/NotificationsPanel'

export default function Inbox() {
  const { profile } = useAuth()
  const [teams, setTeams] = useState([])
  const [people, setPeople] = useState([])
  const [messages, setMessages] = useState([])
  const [notifications, setNotifications] = useState([])
  const [teamFilter, setTeamFilter] = useState(null)
  const [showNotifs, setShowNotifs] = useState(false)
  const [recipientId, setRecipientId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function loadAll() {
    const [tm, ppl, mailbox, notif] = await Promise.all([
      fetchTeams(), fetchProfiles(), fetchMailbox(profile.id), fetchNotifications(profile.id),
    ])
    setTeams(tm)
    setPeople(ppl)
    setMessages(mailbox)
    setNotifications(notif)
  }

  useEffect(() => { loadAll() }, [])

  async function submitMessage(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (!recipientId) throw new Error('Choose a recipient.')
      if (!body.trim()) throw new Error('Write a message first.')
      await sendTeamMessage({ senderId: profile.id, recipientId, subject, body })
      setRecipientId('')
      setSubject('')
      setBody('')
      await loadAll()
    } catch (err) {
      setError(err.message || 'Could not send message.')
    } finally {
      setSaving(false)
    }
  }

  const inbox = useMemo(() => messages.filter((m) => m.recipient_id === profile.id), [messages, profile.id])
  const sent = useMemo(() => messages.filter((m) => m.sender_id === profile.id), [messages, profile.id])
  const unreadCount = notifications.filter((n) => !n.is_read).length
  const unreadMessages = inbox.filter((m) => !m.is_read).length

  async function openMessage(m) {
    if (m.recipient_id === profile.id && !m.is_read) {
      await markMessageRead(m.id)
      await loadAll()
    }
  }

  return (
    <Shell teams={teams} teamFilter={teamFilter} setTeamFilter={setTeamFilter} notifCount={unreadCount} onBellClick={() => setShowNotifs((s) => !s)}>
      <div style={styles.topBar}>
        <div>
          <h1 style={styles.pageTitle}>Team mailbox</h1>
          <p style={styles.sub}>Internal messages between team members. Because apparently email was not enough.</p>
        </div>
        <span style={styles.unreadBadge}>{unreadMessages} unread</span>
      </div>

      <div style={styles.layout}>
        <form onSubmit={submitMessage} style={styles.composeCard}>
          <h2 style={styles.cardTitle}>New message</h2>
          <select value={recipientId} onChange={(e) => setRecipientId(e.target.value)} style={styles.input}>
            <option value="">Choose recipient…</option>
            {people.filter((p) => p.id !== profile.id).map((p) => <option key={p.id} value={p.id}>{p.full_name} {p.team?.name ? `· ${p.team.name}` : ''}</option>)}
          </select>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} style={styles.input} placeholder="Subject" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} style={styles.textarea} placeholder="Write your message…" />
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" disabled={saving} style={styles.primaryBtn}>{saving ? 'Sending…' : 'Send message'}</button>
        </form>

        <div style={styles.mailGrid}>
          <MailboxList title="Inbox" items={inbox} currentUserId={profile.id} onOpen={openMessage} />
          <MailboxList title="Sent" items={sent} currentUserId={profile.id} onOpen={openMessage} />
        </div>
      </div>

      {showNotifs && <NotificationsPanel notifications={notifications} onClose={() => setShowNotifs(false)} onMarkRead={async (id) => { await markNotificationRead(id); await loadAll() }} />}
    </Shell>
  )
}

function MailboxList({ title, items, currentUserId, onOpen }) {
  return (
    <div style={styles.listCard}>
      <h2 style={styles.cardTitle}>{title}</h2>
      {items.length === 0 && <p style={styles.empty}>No messages.</p>}
      {items.map((m) => {
        const other = m.sender_id === currentUserId ? m.recipient : m.sender
        return (
          <button key={m.id} onClick={() => onOpen(m)} style={{ ...styles.messageRow, ...(!m.is_read && m.recipient_id === currentUserId ? styles.unreadRow : {}) }}>
            <div style={styles.messageTop}>
              <strong>{m.subject || 'No subject'}</strong>
              <span>{new Date(m.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p style={styles.messageMeta}>{m.sender_id === currentUserId ? 'To' : 'From'}: {other?.full_name || 'Unknown'}</p>
            <p style={styles.messageBody}>{m.body}</p>
          </button>
        )
      })}
    </div>
  )
}

const styles = {
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 18 },
  pageTitle: { margin: 0, fontSize: 24, fontWeight: 900 },
  sub: { margin: '5px 0 0', fontSize: 13, color: 'var(--text-2)' },
  unreadBadge: { background: 'var(--info-light)', color: 'var(--info)', fontSize: 12, fontWeight: 900, padding: '7px 11px', borderRadius: 999 },
  layout: { display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, alignItems: 'start' },
  composeCard: { background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 16, boxShadow: '0 2px 10px rgba(0,80,160,0.06)', display: 'flex', flexDirection: 'column', gap: 10 },
  cardTitle: { margin: '0 0 8px', fontSize: 15, fontWeight: 900 },
  input: { border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px', fontSize: 13.5, background: '#fff', color: 'var(--text)' },
  textarea: { border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px', minHeight: 120, resize: 'vertical', fontSize: 13.5, fontFamily: 'inherit', background: '#fff', color: 'var(--text)' },
  primaryBtn: { border: 'none', borderRadius: 12, padding: '10px 14px', background: 'linear-gradient(135deg, #0050A0, #2D8FE0)', color: '#fff', fontSize: 13, fontWeight: 900, cursor: 'pointer' },
  error: { color: 'var(--danger)', fontSize: 12.5, fontWeight: 800, margin: 0 },
  mailGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  listCard: { background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 16, boxShadow: '0 2px 10px rgba(0,80,160,0.06)' },
  empty: { fontSize: 13, color: 'var(--text-3)' },
  messageRow: { display: 'block', width: '100%', textAlign: 'left', background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 12, marginBottom: 8, cursor: 'pointer' },
  unreadRow: { borderColor: 'var(--bupa-blue)', background: 'var(--info-light)' },
  messageTop: { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5 },
  messageMeta: { margin: '4px 0', color: 'var(--text-3)', fontSize: 12 },
  messageBody: { margin: 0, color: 'var(--text-2)', fontSize: 12.5, lineHeight: 1.45, whiteSpace: 'pre-wrap' },
}
