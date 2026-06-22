-- ============================================================
-- TASK MANAGEMENT PORTAL — Supabase schema
-- ============================================================
-- Run this in the Supabase SQL editor (Project > SQL Editor > New query)
-- ============================================================

-- ---------- TEAMS ----------
create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

insert into teams (name) values
  ('Engineering'),
  ('Operations'),
  ('Health and Safety'),
  ('Property'),
  ('People Service Hub');

-- ---------- PROFILES (extends Supabase auth.users) ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  team_id uuid references teams(id) not null,
  is_mbm boolean default false,
  is_team_manager boolean default false,
  created_at timestamptz default now()
);

-- ---------- TASKS ----------
create table tasks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  team_id uuid references teams(id) not null,
  owner_id uuid references profiles(id) not null,
  assignee_id uuid references profiles(id),
  target_date date,
  status text not null default 'unassigned'
    check (status in ('unassigned','pending_acceptance','in_progress','blocked','done','rejected')),
  priority text not null default 'medium'
    check (priority in ('low','medium','high','urgent')),
  percent_complete int not null default 0 check (percent_complete between 0 and 100),
  tags text[] default '{}',
  is_recurring boolean default false,
  recurrence_pattern text check (recurrence_pattern in ('daily','weekly','monthly') or recurrence_pattern is null),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- SUB-ACTIONS ----------
create table sub_actions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade not null,
  name text not null,
  deadline date,
  assignee_id uuid references profiles(id),
  status text not null default 'pending'
    check (status in ('pending','in_progress','done')),
  created_by uuid references profiles(id) not null,
  created_at timestamptz default now()
);

-- ---------- DEADLINE PUSH REQUESTS (approval-gated) ----------
create table date_change_requests (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  sub_action_id uuid references sub_actions(id) on delete cascade,
  requested_by uuid references profiles(id) not null,
  old_date date,
  new_date date not null,
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  resolved_by uuid references profiles(id),
  resolved_at timestamptz,
  created_at timestamptz default now(),
  check (
    (task_id is not null and sub_action_id is null) or
    (task_id is null and sub_action_id is not null)
  )
);

-- ---------- NOTE LOG (freely editable, append-style) ----------
create table notes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade not null,
  author_id uuid references profiles(id) not null,
  body text not null,
  created_at timestamptz default now(),
  edited_at timestamptz
);

-- ---------- CHANGE LOG (auto audit trail, not user-editable) ----------
create table change_log (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade not null,
  actor_id uuid references profiles(id) not null,
  action text not null,
  detail text,
  created_at timestamptz default now()
);

-- ---------- ATTACHMENTS ----------
create table attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade not null,
  uploaded_by uuid references profiles(id) not null,
  file_name text not null,
  storage_path text not null,
  created_at timestamptz default now()
);

-- ---------- NOTIFICATIONS ----------
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) not null,
  task_id uuid references tasks(id) on delete cascade,
  type text not null,
  message text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table teams enable row level security;
alter table profiles enable row level security;
alter table tasks enable row level security;
alter table sub_actions enable row level security;
alter table date_change_requests enable row level security;
alter table notes enable row level security;
alter table change_log enable row level security;
alter table attachments enable row level security;
alter table notifications enable row level security;

create or replace function is_mbm()
returns boolean as $$
  select coalesce((select is_mbm from profiles where id = auth.uid()), false);
$$ language sql security definer stable;

create or replace function my_team()
returns uuid as $$
  select team_id from profiles where id = auth.uid();
$$ language sql security definer stable;

create policy "teams readable by all" on teams for select using (true);

create policy "profiles readable by all" on profiles for select using (true);
create policy "users update own profile" on profiles for update using (auth.uid() = id);

create policy "task visibility" on tasks for select using (
  is_mbm()
  or team_id = my_team()
  or owner_id = auth.uid()
  or assignee_id = auth.uid()
);

create policy "task creation" on tasks for insert with check (
  owner_id = auth.uid()
);

create policy "task update by owner, assignee or mbm" on tasks for update using (
  is_mbm() or owner_id = auth.uid() or assignee_id = auth.uid()
);

create policy "sub_action visibility" on sub_actions for select using (
  exists (select 1 from tasks t where t.id = task_id and (
    is_mbm() or t.team_id = my_team() or t.owner_id = auth.uid() or t.assignee_id = auth.uid()
  ))
);
create policy "sub_action insert by task participants" on sub_actions for insert with check (
  exists (select 1 from tasks t where t.id = task_id and (
    is_mbm() or t.owner_id = auth.uid() or t.assignee_id = auth.uid()
  ))
);
create policy "sub_action update by task participants" on sub_actions for update using (
  exists (select 1 from tasks t where t.id = task_id and (
    is_mbm() or t.owner_id = auth.uid() or t.assignee_id = auth.uid()
  ))
);

create policy "date_request visibility" on date_change_requests for select using (
  exists (select 1 from tasks t where t.id = task_id and (
    is_mbm() or t.owner_id = auth.uid() or t.assignee_id = auth.uid()
  ))
  or
  exists (select 1 from sub_actions sa join tasks t on t.id = sa.task_id where sa.id = sub_action_id and (
    is_mbm() or t.owner_id = auth.uid() or t.assignee_id = auth.uid()
  ))
);
create policy "date_request insert by assignee or owner" on date_change_requests for insert with check (
  requested_by = auth.uid()
);
create policy "date_request resolve by owner or mbm" on date_change_requests for update using (
  is_mbm() or
  exists (select 1 from tasks t where t.id = task_id and t.owner_id = auth.uid())
  or
  exists (select 1 from sub_actions sa join tasks t on t.id = sa.task_id where sa.id = sub_action_id and t.owner_id = auth.uid())
);

create policy "notes visibility" on notes for select using (
  exists (select 1 from tasks t where t.id = task_id and (
    is_mbm() or t.team_id = my_team() or t.owner_id = auth.uid() or t.assignee_id = auth.uid()
  ))
);
create policy "notes insert by task participants" on notes for insert with check (
  exists (select 1 from tasks t where t.id = task_id and (
    is_mbm() or t.owner_id = auth.uid() or t.assignee_id = auth.uid()
  ))
);
create policy "notes edit own" on notes for update using (author_id = auth.uid() or is_mbm());

create policy "change_log visibility" on change_log for select using (
  exists (select 1 from tasks t where t.id = task_id and (
    is_mbm() or t.team_id = my_team() or t.owner_id = auth.uid() or t.assignee_id = auth.uid()
  ))
);
create policy "change_log insert by anyone touching the task" on change_log for insert with check (
  actor_id = auth.uid()
);

create policy "attachments visibility" on attachments for select using (
  exists (select 1 from tasks t where t.id = task_id and (
    is_mbm() or t.team_id = my_team() or t.owner_id = auth.uid() or t.assignee_id = auth.uid()
  ))
);
create policy "attachments insert by task participants" on attachments for insert with check (
  exists (select 1 from tasks t where t.id = task_id and (
    is_mbm() or t.owner_id = auth.uid() or t.assignee_id = auth.uid()
  ))
);

create policy "notifications own" on notifications for select using (user_id = auth.uid());
create policy "notifications update own" on notifications for update using (user_id = auth.uid());
create policy "notifications insert system" on notifications for insert with check (true);

-- ============================================================
-- TRIGGER: auto-update tasks.updated_at
-- ============================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tasks_set_updated_at
before update on tasks
for each row execute function set_updated_at();
