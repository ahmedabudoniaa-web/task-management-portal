import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { fetchProfiles, fetchTeams, fetchNotifications, markNotificationRead, fetchTasks } from '../lib/tasks'
import { fetchMailbox, sendTeamMessage, markMessageRead } from '../lib/messages'
import Shell from '../components/Shell'
import NotificationsPanel from '../components/NotificationsPanel'
import TaskDetail from '../components/TaskDetail'

function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function Inbox() {
  const { profile } = useAuth()
  const [teams, setTeams] = useState([])
  const [people, setPeople] = useState([])
  const [messages, setMessages] = useState([])
  const [notifications, setNotifications] = useState([])
  const [allTasks, setAllTasks] = useState([])
  const [teamFilter, setTeamFilter] = useState(null)
  const [showNotifs, setShowNotifs] = useState(false)
  const [recipientId, setRecipientId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [replyBody, setReplyBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [selectedRootId, setSelectedRootId] = useState(null)
  const [selectedTaskId, setSelectedTaskId] = useState(null)
  const [tab, setTab] = useState('inbox')

  async function loadAll() {
    const [tm, ppl, mailbox, notif, tasks] = await Promise.all([
      fetchTeams(),
      fetchProfiles(),
      fetchMailbox(profile.id),
      fetchNotifications(profile.id),
      fetchTasks({ profile, scope: 'team' }),
    ])
    setTeams(tm)
    setPeople(ppl)
    setMessages(mailbox)
    setNotifications(notif)
    setAllTasks(tasks)

    if (!selectedRootId) {
      const firstRoot = mailbox.find((m) => !m.parent_message_id && (m.sender_id === profile.id || m.recipient_id === profile.id))
      if (firstRoot) setSelectedRootId(firstRoot.id)
    }
  }

  useEffect(() => { loadAll() }, [])

  const roots = useMemo(() => messages.filter((m) => !m.parent_message_id), [messages])
  const inboxRoots = useMemo(() => roots.filter((m) => m.recipient_id === profile.id), [roots, profile.id])
  const sentRoots = useMemo(() => roots.filter((m) => m.sender_id === profile.id), [roots, profile.id])
  const activeRoots = tab === 'sent' ? sentRoots : inboxRoots

  const selectedRoot = useMemo(() => roots.find((m) => m.id === selectedRootId) || activeRoots[0] || null, [roots, selectedRootId, activeRoots])
  const thread = useMemo(() => {
    if (!selectedRoot) return []
    return [selectedRoot, ...messages.filter((m) => m.parent_message_id === selectedRoot.id)]
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  }, [messages, selectedRoot])

  const unreadCount = notifications.filter((n) => !n.is_read).length
  const unreadMessages = inboxRoots.filter((m) => !m.is_read).length

  async function submitMessage(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (!recipientId) throw new Error('Choose a recipient.')
      if (!body.trim()) throw new Error('Write a message first.')
      const sent = await sendTeamMessage({ senderId: profile.id, recipientId, subject, body })
      setRecipientId('')
      setSubject('')
      setBody('')
      setTab('sent')
      setSelectedRootId(sent.id)
      await loadAll()
    } catch (err) {
      setError(err.message || 'Could not send message.')
    } finally {
      setSaving(false)
    }
  }

  async function openThread(message) {
    setSelectedRootId(message.parent_message_id || message.id)
    if (message.recipient_id === profile.id && !message.is_read) {
      await markMessageRead(message.id)
      await loadAll()
    }
  }

  async function submitReply(e) {
    e.preventDefault()
    if (!selectedRoot || !replyBody.trim()) return
    setSaving(true)
    setError(null)
    try {
      const otherId = selectedRoot.sender_id === profile.id ? selectedRoot.recipient_id : selectedRoot.sender_id
      await sendTeamMessage({
        senderId: profile.id,
        recipientId: otherId,
        subject: selectedRoot.subject?.startsWith('Re:') ? selectedRoot.subject : `Re: ${selectedRoot.subject || 'No subject'}`,
        body: replyBody,
        parentMessageId: selectedRoot.id,
      })
      setReplyBody('')
      await loadAll()
    } catch (err) {
      setError(err.message || 'Could not send reply.')
    } finally {
      setSaving(false)
    }
  }

  async function openNotification(notification) {
    await markNotificationRead(notification.id)
    setNotifications((items) => items.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)))
    if (notification.task_id) setSelectedTaskId(notification.task_id)
  }

  return (
    <Shell teams={teams} teamFilter={teamFilter} setTeamFilter={setTeamFilter} notifCount={unreadCount} onBellClick={() => setShowNotifs((s) => !s)}>
      <div style={styles.topBar}>
        <div>
          <h1 style={styles.pageTitle}>Inbox</h1>
          <p style={styles.sub}>Messages, replies, mentions, and task alerts in one place. Humanity finally invented a second inbox.</p>
        </div>
        <div style={styles.topBadges}>
          <span style={styles.unreadBadge}>{unreadMessages} unread messages</span>
          <span style={styles.notifBadge}>{unreadCount} unread alerts</span>
        </div>
      </div>

      <div style={styles.layout}>
        <aside style={styles.composeCard}>
          <h2 style={styles.cardTitle}>New message</h2>
          <form onSubmit={submitMessage} style={styles.formStack}>
            <select value={recipientId} onChange={(e) => setRecipientId(e.target.value)} style={styles.input}>
              <option value="">Choose recipient…</option>
              {people.filter((p) => p.id !== profile.id).map((p) => <option key={p.id} value={p.id}>{p.full_name} {p.team?.name ? `· ${p.team.name}` : ''}</option>)}
            </select>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} style={styles.input} placeholder="Subject" />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} style={styles.textarea} placeholder="Write your message…" />
            {error && <p style={styles.error}>{error}</p>}
            <button type="submit" disabled={saving} style={styles.primaryBtn}>{saving ? 'Sending…' : 'Send message'}</button>
          </form>

          <div style={styles.tabs}>
            <button onClick={() => setTab('inbox')} style={{ ...styles.tab, ...(tab === 'inbox' ? styles.tabActive : {}) }}>Inbox</button>
            <button onClick={() => setTab('sent')} style={{ ...styles.tab, ...(tab === 'sent' ? styles.tabActive : {}) }}>Sent</button>
          </div>

          <div style={styles.threadList}>
            {activeRoots.length === 0 && <p style={styles.empty}>No messages.</p>}
            {activeRoots.map((m) => (
              <MessageListItem key={m.id} message={m} currentUserId={profile.id} selected={selectedRoot?.id === m.id} replies={messages.filter((r) => r.parent_message_id === m.id).length} onClick={() => openThread(m)} />
            ))}
          </div>
        </aside>

        <main style={styles.conversationCard}>
          {!selectedRoot ? (
            <div style={styles.emptyConversation}>
              <p style={styles.emptyTitle}>Select a message</p>
              <p style={styles.empty}>Choose a thread to read or reply.</p>
            </div>
          ) : (
            <>
              <div style={styles.conversationHeader}>
                <div>
                  <p style={styles.conversationLabel}>Conversation</p>
                  <h2 style={styles.conversationTitle}>{selectedRoot.subject || 'No subject'}</h2>
                </div>
                <span style={styles.replyCount}>{thread.length - 1} replies</span>
              </div>

              <div style={styles.messagesStack}>
                {thread.map((m) => (
                  <ThreadBubble key={m.id} message={m} mine={m.sender_id === profile.id} />
                ))}
              </div>

              <form onSubmit={submitReply} style={styles.replyBox}>
                <textarea value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder="Reply to this conversation…" style={styles.replyInput} />
                <button type="submit" disabled={saving || !replyBody.trim()} style={styles.replyBtn}>{saving ? 'Sending…' : 'Reply'}</button>
              </form>
            </>
          )}
        </main>

        <aside style={styles.notificationsCard}>
          <div style={styles.sideHeader}>
            <div>
              <p style={styles.conversationLabel}>Notification center</p>
              <h2 style={styles.cardTitle}>Alerts</h2>
            </div>
            <span style={styles.notifBadge}>{unreadCount}</span>
          </div>
          <div style={styles.notificationList}>
            {notifications.length === 0 && <p style={styles.empty}>No notifications.</p>}
            {notifications.map((n) => (
              <button key={n.id} onClick={() => openNotification(n)} style={{ ...styles.notificationRow, ...(!n.is_read ? styles.notificationUnread : {}) }}>
                <div style={styles.notificationTop}>
                  <span style={styles.notificationType}>{labelForType(n.type)}</span>
                  <span style={styles.notificationTime}>{formatDate(n.created_at)}</span>
                </div>
                <p style={styles.notificationText}>{n.message}</p>
                {n.task?.name && <p style={styles.notificationContext}>Open task: {n.task.name}</p>}
              </button>
            ))}
          </div>
        </aside>
      </div>

      {selectedTaskId && (
        <TaskDetail
          taskId={selectedTaskId}
          people={people}
          allTasks={allTasks}
          onClose={() => setSelectedTaskId(null)}
          onChanged={loadAll}
        />
      )}

      {showNotifs && (
        <NotificationsPanel
          notifications={notifications}
          currentUserId={profile.id}
          onClose={() => setShowNotifs(false)}
          onChanged={loadAll}
          onMarkRead={async (id) => {
            const notification = notifications.find((n) => n.id === id)
            if (notification) await openNotification(notification)
          }}
        />
      )}
    </Shell>
  )
}

function MessageListItem({ message, currentUserId, selected, replies, onClick }) {
  const other = message.sender_id === currentUserId ? message.recipient : message.sender
  const unread = message.recipient_id === currentUserId && !message.is_read
  return (
    <button onClick={onClick} style={{ ...styles.messageRow, ...(selected ? styles.messageRowSelected : {}), ...(unread ? styles.unreadRow : {}) }}>
      <div style={styles.avatarSmall}>{initials(other?.full_name)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={styles.messageTop}>
          <strong style={styles.messageSubject}>{message.subject || 'No subject'}</strong>
          <span style={styles.messageDate}>{formatDate(message.created_at)}</span>
        </div>
        <p style={styles.messageMeta}>{message.sender_id === currentUserId ? 'To' : 'From'}: {other?.full_name || 'Unknown'}</p>
        <p style={styles.messagePreview}>{message.body}</p>
        {replies > 0 && <span style={styles.threadBadge}>{replies} repl{replies === 1 ? 'y' : 'ies'}</span>}
      </div>
    </button>
  )
}

function ThreadBubble({ message, mine }) {
  const person = mine ? message.sender : message.sender
  return (
    <div style={{ ...styles.threadBubbleWrap, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
      {!mine && <div style={styles.avatarSmall}>{initials(person?.full_name)}</div>}
      <div style={{ ...styles.threadBubble, ...(mine ? styles.threadMine : styles.threadOther) }}>
        <div style={styles.bubbleHeader}>
          <strong>{mine ? 'You' : person?.full_name || 'Unknown'}</strong>
          <span>{formatDate(message.created_at)}</span>
        </div>
        <p style={styles.bubbleBody}>{message.body}</p>
      </div>
    </div>
  )
}

function labelForType(type) {
  const labels = {
    mention: '@ mention', message: 'Message', assigned: 'Assigned', rejected: 'Rejected',
    date_approved: 'Date approved', date_declined: 'Date declined', date_push_request: 'Date request',
  }
  return labels[type] || type || 'Notification'
}

const styles = {
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 18 },
  pageTitle: { margin: 0, fontSize: 24, fontWeight: 900 },
  sub: { margin: '5px 0 0', fontSize: 13, color: 'var(--text-2)' },
  topBadges: { display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' },
  unreadBadge: { background: 'var(--info-light)', color: 'var(--info)', fontSize: 12, fontWeight: 900, padding: '7px 11px', borderRadius: 999 },
  notifBadge: { background: 'var(--warning-light)', color: 'var(--warning)', fontSize: 12, fontWeight: 900, padding: '7px 11px', borderRadius: 999 },
  layout: { display: 'grid', gridTemplateColumns: '330px minmax(0, 1fr) 310px', gap: 16, alignItems: 'start' },
  composeCard: { background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 16, boxShadow: '0 2px 10px rgba(0,80,160,0.06)', border: '1px solid var(--border)' },
  formStack: { display: 'flex', flexDirection: 'column', gap: 10 },
  cardTitle: { margin: 0, fontSize: 15, fontWeight: 900 },
  input: { border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px', fontSize: 13.5, background: '#fff', color: 'var(--text)' },
  textarea: { border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px', minHeight: 105, resize: 'vertical', fontSize: 13.5, fontFamily: 'inherit', background: '#fff', color: 'var(--text)' },
  primaryBtn: { border: 'none', borderRadius: 12, padding: '10px 14px', background: 'linear-gradient(135deg, #0050A0, #2D8FE0)', color: '#fff', fontSize: 13, fontWeight: 900, cursor: 'pointer' },
  error: { color: 'var(--danger)', fontSize: 12.5, fontWeight: 800, margin: 0 },
  tabs: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, background: 'var(--surface-2)', padding: 4, borderRadius: 999, margin: '16px 0 12px' },
  tab: { border: 'none', borderRadius: 999, background: 'none', color: 'var(--text-2)', fontSize: 12.5, fontWeight: 900, padding: '7px 10px', cursor: 'pointer' },
  tabActive: { background: '#fff', color: 'var(--bupa-blue)', boxShadow: '0 1px 4px rgba(0,80,160,0.1)' },
  threadList: { display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 520, overflowY: 'auto' },
  messageRow: { display: 'flex', gap: 10, width: '100%', textAlign: 'left', background: '#fff', border: '1px solid var(--border)', borderRadius: 16, padding: 11, cursor: 'pointer' },
  messageRowSelected: { borderColor: 'var(--bupa-blue)', boxShadow: '0 0 0 2px var(--info-light)' },
  unreadRow: { background: 'var(--info-light)' },
  avatarSmall: { width: 32, height: 32, borderRadius: 999, background: 'linear-gradient(135deg, #E9F3FF, #F7E8F2)', color: 'var(--bupa-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 900, flexShrink: 0 },
  messageTop: { display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' },
  messageSubject: { fontSize: 12.7, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  messageDate: { fontSize: 10.5, color: 'var(--text-3)', flexShrink: 0 },
  messageMeta: { margin: '3px 0', color: 'var(--text-3)', fontSize: 11.5 },
  messagePreview: { margin: 0, color: 'var(--text-2)', fontSize: 12, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  threadBadge: { display: 'inline-flex', marginTop: 7, background: 'var(--surface-2)', color: 'var(--text-2)', borderRadius: 999, padding: '3px 7px', fontSize: 10.5, fontWeight: 800 },
  conversationCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 16, boxShadow: '0 2px 10px rgba(0,80,160,0.06)', minHeight: 620, display: 'flex', flexDirection: 'column' },
  conversationHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)' },
  conversationLabel: { margin: '0 0 3px', color: 'var(--text-3)', fontSize: 10.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' },
  conversationTitle: { margin: 0, fontSize: 18, fontWeight: 900 },
  replyCount: { background: 'var(--surface-2)', color: 'var(--text-2)', borderRadius: 999, padding: '5px 9px', fontSize: 11.5, fontWeight: 900 },
  messagesStack: { display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 0', overflowY: 'auto', flex: 1 },
  threadBubbleWrap: { display: 'flex', gap: 8, alignItems: 'flex-start' },
  threadBubble: { maxWidth: '76%', borderRadius: 16, padding: 12, border: '1px solid var(--border)' },
  threadMine: { background: 'var(--info-light)', borderColor: 'rgba(0,80,160,0.12)' },
  threadOther: { background: '#fff' },
  bubbleHeader: { display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 11.5, color: 'var(--text-3)', marginBottom: 5 },
  bubbleBody: { margin: 0, whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.5, color: 'var(--text)' },
  replyBox: { display: 'flex', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 12 },
  replyInput: { flex: 1, border: '1px solid var(--border)', borderRadius: 14, padding: '10px 12px', minHeight: 62, resize: 'vertical', fontSize: 13, fontFamily: 'inherit' },
  replyBtn: { alignSelf: 'flex-end', border: 'none', borderRadius: 12, padding: '11px 18px', background: 'var(--bupa-blue)', color: '#fff', fontSize: 13, fontWeight: 900, cursor: 'pointer' },
  emptyConversation: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--text-3)' },
  emptyTitle: { margin: '0 0 4px', color: 'var(--text-2)', fontWeight: 900 },
  empty: { fontSize: 13, color: 'var(--text-3)' },
  notificationsCard: { background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 16, boxShadow: '0 2px 10px rgba(0,80,160,0.06)', border: '1px solid var(--border)' },
  sideHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  notificationList: { display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 620, overflowY: 'auto' },
  notificationRow: { display: 'block', width: '100%', textAlign: 'left', border: '1px solid var(--border)', background: '#fff', borderRadius: 14, padding: 11, cursor: 'pointer' },
  notificationUnread: { background: 'var(--warning-light)', borderColor: 'rgba(255,149,0,0.25)' },
  notificationTop: { display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  notificationType: { fontSize: 11.5, fontWeight: 900, color: 'var(--warning)' },
  notificationTime: { fontSize: 10.5, color: 'var(--text-3)' },
  notificationText: { margin: 0, fontSize: 12.5, color: 'var(--text)', lineHeight: 1.4 },
  notificationContext: { margin: '6px 0 0', color: 'var(--info)', fontSize: 11.5, fontWeight: 800 },
}
