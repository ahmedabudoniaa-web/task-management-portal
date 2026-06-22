import { supabase } from './supabase'

// ---------- TASK DEPENDENCIES ----------

export async function fetchTaskDependencies(taskId) {
  const { data, error } = await supabase
    .from('task_dependencies')
    .select(`
      *,
      blocking_task:tasks!task_dependencies_blocking_task_id_fkey(id, name, status),
      blocked_task:tasks!task_dependencies_blocked_task_id_fkey(id, name, status)
    `)
    .or(`blocked_task_id.eq.${taskId},blocking_task_id.eq.${taskId}`)
  if (error) throw error
  return data
}

export async function addDependency({ blockedTaskId, blockingTaskId, dependencyType, createdBy }) {
  const { error } = await supabase
    .from('task_dependencies')
    .insert({ blocked_task_id: blockedTaskId, blocking_task_id: blockingTaskId, dependency_type: dependencyType || 'finish_to_start', created_by: createdBy })
  if (error) throw error
}

export async function removeDependency(dependencyId) {
  const { error } = await supabase.from('task_dependencies').delete().eq('id', dependencyId)
  if (error) throw error
}

// ---------- MENTIONS ----------

// Extracts @Full Name mentions from free text against a known list of
// people. Matching is done by checking if any person's full name appears
// immediately after an @ symbol — simple substring approach rather than a
// dropdown-driven mention picker, since the app doesn't have rich text
// editing. People should type @ followed by the person's exact full name.
export function extractMentions(text, people) {
  const mentioned = []
  for (const person of people) {
    const pattern = `@${person.full_name}`
    if (text.includes(pattern)) {
      mentioned.push(person)
    }
  }
  return mentioned
}

export async function recordMentions({ text, people, entityType, entityId, mentioningUserId, contextTaskId, contextActionId }) {
  const mentioned = extractMentions(text, people)
  for (const person of mentioned) {
    if (person.id === mentioningUserId) continue // don't notify yourself
    await supabase.from('mentions').insert({
      entity_type: entityType,
      entity_id: entityId,
      mentioned_user_id: person.id,
      mentioning_user_id: mentioningUserId,
      context_task_id: contextTaskId || null,
      context_action_id: contextActionId || null,
    })
  }
  return mentioned
}

// Renders @Full Name occurrences as visually distinct spans. Returns an
// array of {text, isMention} segments for the caller to render with React.
export function renderMentionSegments(text, people) {
  const names = people.map((p) => p.full_name).sort((a, b) => b.length - a.length)
  if (names.length === 0) return [{ text, isMention: false }]

  const pattern = new RegExp(`@(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g')
  const segments = []
  let lastIndex = 0
  let match
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) segments.push({ text: text.slice(lastIndex, match.index), isMention: false })
    segments.push({ text: match[0], isMention: true })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex), isMention: false })
  return segments
}
