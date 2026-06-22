-- Run this once in Supabase SQL Editor before deploying the updated UI.
-- It keeps the UI labels friendly while allowing the statuses/features used by the app.

-- 1) Allow cancellation status for tasks.
alter table tasks drop constraint if exists tasks_status_check;
alter table tasks add constraint tasks_status_check
check (status in (
  'unassigned', 'initiated', 'todo', 'pending_acceptance',
  'in_progress', 'blocked', 'completed', 'done', 'cancelled', 'canceled', 'rejected'
));

-- 2) Make sure project/phase task linking exists. Safe if it already exists.
alter table tasks add column if not exists project_id uuid references projects(id) on delete set null;
alter table tasks add column if not exists milestone_id uuid references milestones(id) on delete set null;

-- 3) Let a user see sub-actions assigned directly to them, even if the parent task
-- is not owned/assigned to them. This is what makes delegated sub-tasks appear in My Tasks.
drop policy if exists "sub_action visibility" on sub_actions;
create policy "sub_action visibility" on sub_actions for select using (
  assignee_id = auth.uid()
  or created_by = auth.uid()
  or exists (select 1 from tasks t where t.id = task_id and (
    is_mbm() or t.team_id = my_team() or t.owner_id = auth.uid() or t.assignee_id = auth.uid()
  ))
);

-- 4) Optional mentions table. Notifications work even without this, but this keeps
-- an auditable mention record.
create table if not exists mentions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  mentioned_user_id uuid references profiles(id) not null,
  mentioning_user_id uuid references profiles(id) not null,
  context_task_id uuid references tasks(id) on delete cascade,
  context_action_id uuid,
  created_at timestamptz default now()
);

alter table mentions enable row level security;
drop policy if exists "mentions visible to mentioned or author" on mentions;
create policy "mentions visible to mentioned or author" on mentions for select using (
  mentioned_user_id = auth.uid() or mentioning_user_id = auth.uid() or is_mbm()
);
drop policy if exists "mentions insert by logged in users" on mentions;
create policy "mentions insert by logged in users" on mentions for insert with check (
  mentioning_user_id = auth.uid()
);
