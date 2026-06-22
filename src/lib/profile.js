import { supabase } from './supabase'

export async function updateMyProfile({ userId, fullName, jobTitle }) {
  const updates = { full_name: fullName }
  // job_title is added by supabase/profile_messages_updates.sql. If the migration
  // has not been run yet, Supabase will return a clear column error.
  updates.job_title = jobTitle || null
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('*, team:teams(id, name)')
    .single()
  if (error) throw error
  return data
}

export async function changeMyPassword(newPassword) {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
  return data
}
