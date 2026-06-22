-- ============================================================
-- Profile, Notification Center, and Team Mailbox updates
-- Run this in Supabase SQL Editor before deploying the updated app.
-- Safe note: this does not delete existing project/task data.
-- ============================================================

-- 1) Add editable job title to user profiles.
alter table profiles add column if not exists job_title text;

-- 2) Team mailbox table.
create table if not exists team_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references profiles(id) on delete cascade not null,
  recipient_id uuid references profiles(id) on delete cascade not null,
  subject text,
  body text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);

alter table team_messages enable row level security;

drop policy if exists "team messages visible to participants" on team_messages;
create policy "team messages visible to participants"
on team_messages for select
using (sender_id = auth.uid() or recipient_id = auth.uid() or is_mbm());

drop policy if exists "team messages insert by sender" on team_messages;
create policy "team messages insert by sender"
on team_messages for insert
with check (sender_id = auth.uid());

drop policy if exists "team messages recipient update read" on team_messages;
create policy "team messages recipient update read"
on team_messages for update
using (recipient_id = auth.uid() or is_mbm())
with check (recipient_id = auth.uid() or is_mbm());

-- 3) Optional mentions audit table if it has not already been created.
create table if not exists mentions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  mentioned_user_id uuid references profiles(id) on delete cascade not null,
  mentioning_user_id uuid references profiles(id) on delete cascade not null,
  context_task_id uuid references tasks(id) on delete cascade,
  context_action_id uuid,
  is_read boolean default false,
  created_at timestamptz default now()
);

alter table mentions enable row level security;

drop policy if exists "mentions visible to mentioned or author" on mentions;
create policy "mentions visible to mentioned or author"
on mentions for select
using (mentioned_user_id = auth.uid() or mentioning_user_id = auth.uid() or is_mbm());

drop policy if exists "mentions insert by logged in users" on mentions;
create policy "mentions insert by logged in users"
on mentions for insert
with check (mentioning_user_id = auth.uid());

-- 4) Conversation replies for team mailbox.
alter table team_messages add column if not exists parent_message_id uuid references team_messages(id) on delete cascade;
create index if not exists team_messages_parent_message_id_idx on team_messages(parent_message_id);
