import { supabase } from './supabase'

export async function fetchMailbox(userId) {
  const { data, error } = await supabase
    .from('team_messages')
    .select(`
      *,
      sender:profiles!team_messages_sender_id_fkey(id, full_name, email, job_title),
      recipient:profiles!team_messages_recipient_id_fkey(id, full_name, email, job_title)
    `)
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) throw error
  return data || []
}

export async function sendTeamMessage({ senderId, recipientId, subject, body, parentMessageId }) {
  const { data, error } = await supabase
    .from('team_messages')
    .insert({
      sender_id: senderId,
      recipient_id: recipientId,
      subject: subject || 'No subject',
      body,
      parent_message_id: parentMessageId || null,
    })
    .select()
    .single()
  if (error) throw error

  await supabase.from('notifications').insert({
    user_id: recipientId,
    type: 'message',
    message: parentMessageId ? `New reply: ${subject || 'No subject'}` : `New message: ${subject || 'No subject'}`,
  })

  return data
}

export async function markMessageRead(messageId) {
  const { error } = await supabase
    .from('team_messages')
    .update({ is_read: true })
    .eq('id', messageId)
  if (error) throw error
}
