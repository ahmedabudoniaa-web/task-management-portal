-- Roles, directors, and team-task assignment update.
-- Safe migration: no data is deleted. It adds role fields and a team_directors mapping table.

alter table profiles add column if not exists role text default 'member';
alter table profiles add column if not exists job_title text;
alter table profiles alter column team_id drop not null;

-- Keep old booleans compatible with the new role model.
update profiles set role = 'mbm' where is_mbm = true;
update profiles set role = 'director' where coalesce(is_team_manager, false) = true and coalesce(is_mbm, false) = false;
update profiles set role = 'member' where role is null;

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('mbm','director','project_manager','member'));

create table if not exists team_directors (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade not null,
  director_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (team_id, director_id)
);

alter table team_directors enable row level security;
drop policy if exists "team_directors readable" on team_directors;
create policy "team_directors readable" on team_directors for select using (true);
drop policy if exists "team_directors mbm manage" on team_directors;
create policy "team_directors mbm manage" on team_directors for all using (is_mbm()) with check (is_mbm());

-- Backfill old single-team managers into the new mapping table.
insert into team_directors (team_id, director_id)
select team_id, id
from profiles
where is_team_manager = true and team_id is not null
on conflict do nothing;

create or replace function is_mbm()
returns boolean as $$
  select coalesce((select is_mbm or role = 'mbm' from profiles where id = auth.uid()), false);
$$ language sql security definer stable;

create or replace function managed_team_ids()
returns uuid[] as $$
  select coalesce(array_agg(team_id), '{}') from team_directors where director_id = auth.uid();
$$ language sql security definer stable;

create or replace function manages_team(target_team uuid)
returns boolean as $$
  select coalesce(target_team = any(managed_team_ids()), false);
$$ language sql security definer stable;

create or replace function my_team()
returns uuid as $$
  select team_id from profiles where id = auth.uid();
$$ language sql security definer stable;

-- Let MBM have no home team. Directors can manage one or more teams through team_directors.
-- RLS updates for tasks so MBM sees all, directors see managed teams, members see own rows.
drop policy if exists "task visibility" on tasks;
create policy "task visibility" on tasks for select using (
  is_mbm()
  or manages_team(team_id)
  or team_id = my_team()
  or owner_id = auth.uid()
  or assignee_id = auth.uid()
  or exists (select 1 from sub_actions sa where sa.task_id = tasks.id and sa.assignee_id = auth.uid())
);

drop policy if exists "task creation" on tasks;
create policy "task creation" on tasks for insert with check (
  owner_id = auth.uid()
  and (is_mbm() or manages_team(team_id) or team_id = my_team())
);

drop policy if exists "task update by owner, assignee or mbm" on tasks;
create policy "task update by owner, assignee director or mbm" on tasks for update using (
  is_mbm() or manages_team(team_id) or owner_id = auth.uid() or assignee_id = auth.uid()
);

drop policy if exists "task delete by owner or mbm" on tasks;
drop policy if exists "task delete by owner assignee or mbm" on tasks;
create policy "task delete by owner director or mbm" on tasks for delete using (
  is_mbm() or manages_team(team_id) or owner_id = auth.uid()
);

-- Sub-actions visible to parent task viewers or direct sub-action assignees.
drop policy if exists "sub_action visibility" on sub_actions;
create policy "sub_action visibility" on sub_actions for select using (
  assignee_id = auth.uid()
  or exists (select 1 from tasks t where t.id = task_id and (
    is_mbm() or manages_team(t.team_id) or t.team_id = my_team() or t.owner_id = auth.uid() or t.assignee_id = auth.uid()
  ))
);

drop policy if exists "sub_action insert by task participants" on sub_actions;
create policy "sub_action insert by task participants" on sub_actions for insert with check (
  exists (select 1 from tasks t where t.id = task_id and (
    is_mbm() or manages_team(t.team_id) or t.owner_id = auth.uid() or t.assignee_id = auth.uid()
  ))
);

drop policy if exists "sub_action update by task participants" on sub_actions;
create policy "sub_action update by task participants" on sub_actions for update using (
  assignee_id = auth.uid()
  or exists (select 1 from tasks t where t.id = task_id and (
    is_mbm() or manages_team(t.team_id) or t.owner_id = auth.uid() or t.assignee_id = auth.uid()
  ))
);

-- Projects/actions/governance records: directors see managed teams.
-- These policies may not exist in every database version, so each one is dropped conditionally.
drop policy if exists "project visibility" on projects;
create policy "project visibility" on projects for select using (
  is_mbm() or manages_team(team_id) or team_id = my_team() or sponsor_id = auth.uid() or project_manager_id = auth.uid()
);

drop policy if exists "project insert" on projects;
create policy "project insert" on projects for insert with check (
  created_by = auth.uid() and (is_mbm() or manages_team(team_id) or team_id = my_team())
);

drop policy if exists "project update" on projects;
create policy "project update" on projects for update using (
  is_mbm() or manages_team(team_id) or sponsor_id = auth.uid() or project_manager_id = auth.uid()
);

-- Optional: put Mohammed BinMahfoudh as MBM with no home team after you confirm his exact email.
-- update profiles set role='mbm', is_mbm=true, team_id=null where lower(full_name) like '%mohammed%binmahfoudh%';
