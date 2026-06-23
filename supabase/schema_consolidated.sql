-- ============================================================
-- FM TASK MANAGEMENT PORTAL — CONSOLIDATED SCHEMA
-- ============================================================
-- This file replaces the five overlapping migration files previously in
-- this repo (schema.sql, org_hierarchy_updates.sql,
-- roles_permissions_updates.sql, profile_messages_updates.sql,
-- user_requested_updates.sql). It was built by querying the LIVE database
-- directly (information_schema, pg_policies, pg_proc, pg_get_functiondef)
-- rather than reading those files, because the files did not match
-- reality — see project-module-audit.md, Findings 1.1 and 1.2.
--
-- This file is NOT meant to be run against your existing database — it
-- documents what's already there. It exists so that:
--   1. A fresh environment (staging, disaster recovery) can be rebuilt
--      from one file instead of guessing the right order for five.
--   2. Future migrations have one accurate baseline to diff against.
--   3. The RLS recursion bug (see fix_rls_recursion.sql) and the
--      duplicate-policy issues below are documented in one place.
--
-- Two known cleanups folded in here that were NOT yet applied live as of
-- this writing — see "KNOWN CLEANUP NEEDED" markers below. Everything
-- else reflects exactly what's live, verified by direct query.
-- ============================================================


-- ============================================================
-- SECTION 1: FOUNDATIONAL TABLES (teams, profiles)
-- ============================================================

create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  team_id uuid references teams(id),
  is_mbm boolean default false,
  is_team_manager boolean default false,
  created_at timestamptz default now(),
  job_title text,
  role text default 'member' check (role in ('mbm', 'director', 'manager', 'project_manager', 'member')),
  manager_id uuid references profiles(id)
);

-- ============================================================
-- SECTION 2: TASKS, SUB-ACTIONS, AND RELATED
-- ============================================================

create table tasks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  team_id uuid not null references teams(id),
  owner_id uuid not null references profiles(id),
  assignee_id uuid references profiles(id),
  target_date date,
  -- KNOWN CLEANUP NEEDED: the live constraint currently also accepts
  -- 8 retired legacy values (unassigned, todo, done, cancelled, canceled,
  -- rejected) alongside the 5 below, because it was widened instead of
  -- replaced during the Phase 6 status-model rework. Verified via
  -- `select status, count(*) from tasks group by status` that only 1
  -- live row exists, using 'in_progress' — safe to tighten with zero
  -- data migration. See fix_tasks_status_constraint.sql for the fix.
  -- The version below is the CORRECT, intended constraint.
  status text not null default 'initiated'
    check (status in ('initiated', 'pending_acceptance', 'in_progress', 'blocked', 'completed')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  percent_complete integer not null default 0 check (percent_complete >= 0 and percent_complete <= 100),
  tags text[] default '{}',
  is_recurring boolean default false,
  recurrence_pattern text check (recurrence_pattern is null or recurrence_pattern in ('daily', 'weekly', 'monthly')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  milestone_id uuid, -- FK added below, after milestones exists (Section 3)
  project_id uuid    -- FK added below, after projects exists (Section 3)
);

create table sub_actions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id),
  name text not null,
  deadline date,
  assignee_id uuid references profiles(id),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'done')),
  created_by uuid not null references profiles(id),
  created_at timestamptz default now(),
  description text
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id),
  author_id uuid not null references profiles(id),
  body text not null,
  created_at timestamptz default now(),
  edited_at timestamptz
);

create table change_log (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id),
  actor_id uuid not null references profiles(id),
  action text not null,
  detail text,
  created_at timestamptz default now()
);

create table date_change_requests (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id),
  sub_action_id uuid references sub_actions(id),
  requested_by uuid not null references profiles(id),
  old_date date,
  new_date date not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  resolved_by uuid references profiles(id),
  resolved_at timestamptz,
  created_at timestamptz default now()
);

create table task_dependencies (
  id uuid primary key default gen_random_uuid(),
  blocked_task_id uuid not null references tasks(id),
  blocking_task_id uuid not null references tasks(id),
  dependency_type text not null default 'finish_to_start' check (dependency_type in ('finish_to_start', 'start_to_start')),
  created_by uuid not null references profiles(id),
  created_at timestamptz default now(),
  check (blocked_task_id <> blocking_task_id)
);

create table attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id),
  uploaded_by uuid not null references profiles(id),
  file_name text not null,
  storage_path text not null,
  created_at timestamptz default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  task_id uuid references tasks(id),
  type text not null,
  message text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- SECTION 3: PROJECTS, MILESTONES (UI label: "Phases"), HEALTH LOG
-- ============================================================

create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sponsor_id uuid references profiles(id),
  project_manager_id uuid references profiles(id),
  project_coordinator_id uuid references profiles(id),
  team_id uuid not null references teams(id),
  strategic_objective text,
  business_justification text,
  expected_outcome text,
  success_criteria text,
  start_date date,
  target_completion_date date,
  status text not null default 'initiation'
    check (status in ('initiation', 'planning', 'execution', 'final_review', 'closure', 'closed', 'cancelled', 'archived')),
  closure_note text,
  health text not null default 'green' check (health in ('green', 'amber', 'red')),
  health_reason text,
  percent_complete integer not null default 0 check (percent_complete >= 0 and percent_complete <= 100),
  -- Soft delete (audit §7 / Finding 6.1): a deleted project is hidden from
  -- everyone via the "project visibility" policy (deleted_at is null); rows
  -- are never physically removed.
  deleted_at timestamptz,
  deleted_by uuid references profiles(id),
  deletion_reason text,
  created_by uuid not null references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Additional teams attached to a project beyond the owner team (projects.team_id).
-- Audit §8 / Finding 7.1. The owner team stays on projects.team_id; this table
-- holds contributing / supporting / approver teams.
create table project_teams (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  team_id uuid not null references teams(id),
  role text not null default 'contributing'
    check (role in ('owner', 'contributing', 'supporting', 'approver')),
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique (project_id, team_id, role)
);

create table milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id),
  name text not null,
  owner_id uuid references profiles(id),
  planned_date date,
  actual_completion_date date,
  percent_complete integer not null default 0 check (percent_complete >= 0 and percent_complete <= 100),
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'done', 'blocked')),
  sort_order integer not null default 0,
  created_by uuid not null references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table project_health_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id),
  changed_by uuid not null references profiles(id),
  old_health text,
  new_health text not null,
  reason text not null,
  created_at timestamptz default now()
);

-- Now that both milestones and projects exist, add the deferred foreign
-- keys from tasks (created earlier in Section 2, before either existed).
alter table tasks add constraint tasks_milestone_id_fkey foreign key (milestone_id) references milestones(id);
alter table tasks add constraint tasks_project_id_fkey foreign key (project_id) references projects(id);

create table stage_advance_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id),
  requested_by uuid not null references profiles(id),
  from_status text not null,
  to_status text not null,
  milestone_completion_snapshot integer not null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  resolved_by uuid references profiles(id),
  resolved_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================================
-- SECTION 4: ACTION TRACKER (independent of tasks/projects)
-- ============================================================

create table actions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  owner_id uuid not null references profiles(id),
  created_by uuid not null references profiles(id),
  team_id uuid not null references teams(id),
  due_date date,
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'overdue', 'cancelled')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  meeting_source text not null
    check (meeting_source in ('leadership_meeting', 'committee_meeting', 'steering_committee', 'executive_assignment', 'vendor_followup', 'other')),
  meeting_source_detail text,
  progress_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table action_comments (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references actions(id),
  author_id uuid not null references profiles(id),
  body text not null,
  created_at timestamptz default now()
);

-- ============================================================
-- SECTION 5: GOVERNANCE — RISKS, ISSUES, DECISIONS, AUDIT LOG
-- ============================================================

create table risk_matrix (
  impact text not null check (impact in ('low', 'medium', 'high')),
  likelihood text not null check (likelihood in ('low', 'medium', 'high')),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  primary key (impact, likelihood)
);

create table risks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id),
  team_id uuid not null references teams(id),
  description text not null,
  impact text not null check (impact in ('low', 'medium', 'high')),
  likelihood text not null check (likelihood in ('low', 'medium', 'high')),
  severity text not null default 'low' check (severity in ('low', 'medium', 'high', 'critical')),
  severity_overridden boolean not null default false,
  severity_override_reason text,
  mitigation_plan text,
  owner_id uuid references profiles(id),
  status text not null default 'open' check (status in ('open', 'mitigated', 'closed', 'accepted')),
  created_by uuid not null references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table issues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id),
  team_id uuid not null references teams(id),
  description text not null,
  owner_id uuid references profiles(id),
  date_raised date not null default current_date,
  resolution_plan text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_by uuid not null references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table decisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id),
  team_id uuid not null references teams(id),
  decision text not null,
  decision_date date not null default current_date,
  decision_owner_id uuid references profiles(id),
  reason text,
  impact text,
  created_by uuid not null references profiles(id),
  created_at timestamptz default now()
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null
    check (entity_type in ('project', 'milestone', 'action', 'stage_request', 'risk', 'issue', 'decision')),
  entity_id uuid not null,
  actor_id uuid not null references profiles(id),
  action text not null,
  detail text,
  created_at timestamptz default now()
);

-- ============================================================
-- SECTION 6: COLLABORATION — MENTIONS, ORG HIERARCHY, MESSAGES
-- ============================================================

create table mentions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('note', 'action_comment')),
  entity_id uuid not null,
  mentioned_user_id uuid not null references profiles(id),
  mentioning_user_id uuid not null references profiles(id),
  context_task_id uuid references tasks(id),
  context_action_id uuid references actions(id),
  created_at timestamptz default now()
);

-- A director can oversee a team beyond their own home team (e.g. Ibrahim
-- Abutaleb directing Operation, Engineering, and Property simultaneously).
create table team_directors (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id),
  director_id uuid not null references profiles(id),
  created_at timestamptz default now()
);

create table team_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references profiles(id),
  recipient_id uuid not null references profiles(id),
  subject text,
  body text not null,
  is_read boolean default false,
  created_at timestamptz default now(),
  parent_message_id uuid references team_messages(id)
);


-- ============================================================
-- SECTION 7: FUNCTIONS
-- ============================================================
-- Verbatim from pg_get_functiondef() against the live database.

CREATE OR REPLACE FUNCTION public.is_mbm()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select is_mbm or role = 'mbm' from profiles where id = auth.uid()), false);
$function$;

CREATE OR REPLACE FUNCTION public.my_team()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select team_id from profiles where id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.managed_profile_ids()
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with recursive reports as (
    select id from profiles where manager_id = auth.uid()
    union
    select p.id from profiles p join reports r on p.manager_id = r.id
  )
  select coalesce(array_agg(id), '{}') from reports;
$function$;

CREATE OR REPLACE FUNCTION public.managed_team_ids()
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(array_agg(team_id), '{}') from team_directors where director_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.manages_profile(target_profile uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select coalesce(target_profile = any(managed_profile_ids()), false);
$function$;

CREATE OR REPLACE FUNCTION public.manages_team(target_team uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select coalesce(target_team = any(managed_team_ids()), false);
$function$;

-- can_access_task: the RLS-recursion fix (see fix_rls_recursion.sql for
-- the full incident writeup). security definer is load-bearing here —
-- it lets this function read `tasks` WITHOUT re-triggering tasks' own
-- RLS policy, which is what breaks the recursive loop with sub_actions.
CREATE OR REPLACE FUNCTION public.can_access_task(p_task_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from tasks t
    where t.id = p_task_id
      and (
        is_mbm()
        or manages_team(t.team_id)
        or t.owner_id = auth.uid()
        or t.assignee_id = auth.uid()
        or manages_profile(t.owner_id)
        or manages_profile(t.assignee_id)
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_dependency_before_completion()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  v_open_blockers int;
begin
  if new.status = 'completed' and (old.status is distinct from 'completed') then
    select count(*) into v_open_blockers
    from task_dependencies td
    join tasks t on t.id = td.blocking_task_id
    where td.blocked_task_id = new.id
      and td.dependency_type = 'finish_to_start'
      and t.status <> 'completed';
    if v_open_blockers > 0 then
      raise exception 'This task has % unfinished prerequisite task(s) and cannot be marked done yet.', v_open_blockers;
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_mention()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_mentioner_name text;
begin
  select full_name into v_mentioner_name from profiles where id = new.mentioning_user_id;
  insert into notifications (user_id, task_id, type, message)
  values (
    new.mentioned_user_id,
    new.context_task_id,
    'mention',
    coalesce(v_mentioner_name, 'Someone') || ' mentioned you in a comment'
  );
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.recalc_milestone_progress(p_milestone_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_total int;
  v_avg numeric;
begin
  select count(*), coalesce(avg(percent_complete), 0)
  into v_total, v_avg
  from tasks
  where milestone_id = p_milestone_id;

  -- A milestone with no linked tasks keeps whatever percent_complete and
  -- status were set manually (e.g. milestones tracked without task linkage).
  if v_total > 0 then
    update milestones
    set percent_complete = round(v_avg),
        status = case
          when round(v_avg) >= 100 then 'done'
          when round(v_avg) > 0 then 'in_progress'
          else status
        end,
        updated_at = now()
    where id = p_milestone_id;
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.recalc_project_progress(p_project_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_total int;
  v_avg numeric;
begin
  select count(*), coalesce(avg(percent_complete), 0)
  into v_total, v_avg
  from milestones
  where project_id = p_project_id;

  if v_total > 0 then
    update projects
    set percent_complete = round(v_avg),
        updated_at = now()
    where id = p_project_id;
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_recalc_on_task_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  if new.milestone_id is not null then
    perform recalc_milestone_progress(new.milestone_id);
    perform recalc_project_progress(
      (select project_id from milestones where id = new.milestone_id)
    );
  end if;
  if old.milestone_id is not null and old.milestone_id is distinct from new.milestone_id then
    perform recalc_milestone_progress(old.milestone_id);
    perform recalc_project_progress(
      (select project_id from milestones where id = old.milestone_id)
    );
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_recalc_project_on_milestone_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  perform recalc_project_progress(new.project_id);
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_health_change_reason()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  if new.health is distinct from old.health then
    if not exists (
      select 1 from project_health_log
      where project_id = new.id
        and new_health = new.health
        and created_at > now() - interval '10 seconds'
    ) then
      raise exception 'A reason is required whenever project health changes.';
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.apply_stage_advance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  if new.status = 'approved' and old.status = 'pending' then
    update projects set status = new.to_status, updated_at = now() where id = new.project_id;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.recalc_milestone_completion_pct(p_project_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE
AS $function$
  select case when count(*) = 0 then 0
    else round(100.0 * count(*) filter (where status = 'done') / count(*))
  end
  from milestones where project_id = p_project_id;
$function$;

CREATE OR REPLACE FUNCTION public.compute_risk_severity(p_impact text, p_likelihood text)
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  select severity from risk_matrix where impact = p_impact and likelihood = p_likelihood;
$function$;

CREATE OR REPLACE FUNCTION public.apply_risk_severity()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if not new.severity_overridden then
    new.severity := compute_risk_severity(new.impact, new.likelihood);
  elsif new.severity_override_reason is null or trim(new.severity_override_reason) = '' then
    raise exception 'A reason is required when manually overriding risk severity.';
  end if;
  return new;
end;
$function$;


-- ============================================================
-- SECTION 8: TRIGGERS
-- ============================================================

create trigger tasks_set_updated_at before update on tasks for each row execute function set_updated_at();
create trigger tasks_enforce_dependency before update on tasks for each row execute function enforce_dependency_before_completion();
create trigger tasks_recalc_progress after update on tasks for each row execute function trigger_recalc_on_task_change();
create trigger tasks_recalc_progress_on_insert after insert on tasks for each row execute function trigger_recalc_on_task_change();

create trigger milestones_set_updated_at before update on milestones for each row execute function set_updated_at();
create trigger milestones_recalc_project after update on milestones for each row execute function trigger_recalc_project_on_milestone_change();
create trigger milestones_recalc_project_on_insert after insert on milestones for each row execute function trigger_recalc_project_on_milestone_change();

create trigger projects_set_updated_at before update on projects for each row execute function set_updated_at();
create trigger projects_enforce_health_reason before update on projects for each row execute function enforce_health_change_reason();

create trigger stage_requests_apply_on_approve after update on stage_advance_requests for each row execute function apply_stage_advance();

create trigger actions_set_updated_at before update on actions for each row execute function set_updated_at();
create trigger issues_set_updated_at before update on issues for each row execute function set_updated_at();

create trigger risks_set_updated_at before update on risks for each row execute function set_updated_at();
create trigger risks_apply_severity before insert or update on risks for each row execute function apply_risk_severity();

create trigger mentions_notify after insert on mentions for each row execute function notify_on_mention();


-- ============================================================
-- SECTION 9: ROW LEVEL SECURITY
-- ============================================================
-- All 24 tables have RLS enabled and at least one policy, verified live.
-- Duplicate/overlapping policies found during this audit are marked
-- "KNOWN CLEANUP NEEDED" and consolidated to ONE canonical policy per
-- table/action below — this file represents the CLEANED-UP target state
-- for those specific cases, not a byte-for-byte mirror of every duplicate
-- currently live. Everywhere else, policies below match live exactly.

alter table teams enable row level security;
alter table profiles enable row level security;
alter table tasks enable row level security;
alter table sub_actions enable row level security;
alter table notes enable row level security;
alter table change_log enable row level security;
alter table date_change_requests enable row level security;
alter table task_dependencies enable row level security;
alter table attachments enable row level security;
alter table notifications enable row level security;
alter table projects enable row level security;
alter table milestones enable row level security;
alter table project_health_log enable row level security;
alter table stage_advance_requests enable row level security;
alter table actions enable row level security;
alter table action_comments enable row level security;
alter table risk_matrix enable row level security;
alter table risks enable row level security;
alter table issues enable row level security;
alter table decisions enable row level security;
alter table audit_log enable row level security;
alter table mentions enable row level security;
alter table team_directors enable row level security;
alter table team_messages enable row level security;

-- ---------- teams ----------
create policy "teams readable by all" on teams for select using (true);

-- ---------- profiles ----------
create policy "profiles readable by all" on profiles for select using (true);
create policy "users update own profile" on profiles for update using (auth.uid() = id);

-- ---------- tasks ----------
-- KNOWN CLEANUP NEEDED: "task creation" (owner_id = auth.uid() only) is
-- the live, correct policy reflecting the cross-team assignment decision
-- — anyone can create a task for anyone, any team. Kept as-is.
create policy "task creation" on tasks for insert with check (
  owner_id = auth.uid()
);
create policy "task visibility" on tasks for select using (
  is_mbm() or manages_team(team_id) or owner_id = auth.uid() or assignee_id = auth.uid()
  or manages_profile(owner_id) or manages_profile(assignee_id)
);
create policy "task update by owner, assignee manager or mbm" on tasks for update using (
  is_mbm() or manages_team(team_id) or owner_id = auth.uid() or assignee_id = auth.uid()
  or manages_profile(owner_id) or manages_profile(assignee_id)
);
create policy "task delete by owner manager or mbm" on tasks for delete using (
  is_mbm() or manages_team(team_id) or owner_id = auth.uid() or manages_profile(owner_id)
);

-- ---------- sub_actions ----------
-- Uses can_access_task() — see Section 7 comment for why (RLS recursion fix).
create policy "sub_actions visibility" on sub_actions for select using (can_access_task(task_id));
create policy "sub_actions insert" on sub_actions for insert with check (can_access_task(task_id));
create policy "sub_actions update" on sub_actions for update using (can_access_task(task_id)) with check (can_access_task(task_id));
create policy "sub_actions delete" on sub_actions for delete using (can_access_task(task_id));

-- ---------- notes ----------
create policy "notes visibility" on notes for select using (
  exists (select 1 from tasks t where t.id = notes.task_id
    and (is_mbm() or t.team_id = my_team() or t.owner_id = auth.uid() or t.assignee_id = auth.uid()))
);
create policy "notes insert by task participants" on notes for insert with check (
  exists (select 1 from tasks t where t.id = notes.task_id
    and (is_mbm() or t.owner_id = auth.uid() or t.assignee_id = auth.uid()))
);
create policy "notes edit own" on notes for update using (author_id = auth.uid() or is_mbm());

-- ---------- change_log ----------
create policy "change_log visibility" on change_log for select using (
  exists (select 1 from tasks t where t.id = change_log.task_id
    and (is_mbm() or t.team_id = my_team() or t.owner_id = auth.uid() or t.assignee_id = auth.uid()))
);
create policy "change_log insert by anyone touching the task" on change_log for insert with check (actor_id = auth.uid());

-- ---------- date_change_requests ----------
create policy "date_request visibility" on date_change_requests for select using (
  exists (select 1 from tasks t where t.id = date_change_requests.task_id
    and (is_mbm() or t.owner_id = auth.uid() or t.assignee_id = auth.uid()))
  or exists (select 1 from sub_actions sa join tasks t on t.id = sa.task_id where sa.id = date_change_requests.sub_action_id
    and (is_mbm() or t.owner_id = auth.uid() or t.assignee_id = auth.uid()))
);
create policy "date_request insert by assignee or owner" on date_change_requests for insert with check (requested_by = auth.uid());
create policy "date_request resolve by owner or mbm" on date_change_requests for update using (
  is_mbm()
  or exists (select 1 from tasks t where t.id = date_change_requests.task_id and t.owner_id = auth.uid())
  or exists (select 1 from sub_actions sa join tasks t on t.id = sa.task_id where sa.id = date_change_requests.sub_action_id and t.owner_id = auth.uid())
);

-- ---------- task_dependencies ----------
create policy "dependency visibility" on task_dependencies for select using (
  exists (select 1 from tasks t where t.id = task_dependencies.blocked_task_id
    and (is_mbm() or t.team_id = my_team() or t.owner_id = auth.uid() or t.assignee_id = auth.uid()))
  or exists (select 1 from tasks t where t.id = task_dependencies.blocking_task_id
    and (is_mbm() or t.team_id = my_team() or t.owner_id = auth.uid() or t.assignee_id = auth.uid()))
);
create policy "dependency insert by task participants" on task_dependencies for insert with check (
  created_by = auth.uid()
  and exists (select 1 from tasks t where t.id = task_dependencies.blocked_task_id
    and (is_mbm() or t.owner_id = auth.uid() or t.assignee_id = auth.uid()))
);
create policy "dependency delete by task participants" on task_dependencies for delete using (
  exists (select 1 from tasks t where t.id = task_dependencies.blocked_task_id
    and (is_mbm() or t.owner_id = auth.uid() or t.assignee_id = auth.uid()))
);

-- ---------- attachments ----------
create policy "attachments visibility" on attachments for select using (
  exists (select 1 from tasks t where t.id = attachments.task_id
    and (is_mbm() or t.team_id = my_team() or t.owner_id = auth.uid() or t.assignee_id = auth.uid()))
);
create policy "attachments insert by task participants" on attachments for insert with check (
  exists (select 1 from tasks t where t.id = attachments.task_id
    and (is_mbm() or t.owner_id = auth.uid() or t.assignee_id = auth.uid()))
);

-- ---------- notifications ----------
create policy "notifications own" on notifications for select using (user_id = auth.uid());
create policy "notifications update own" on notifications for update using (user_id = auth.uid());
create policy "notifications insert system" on notifications for insert with check (true);

-- ---------- projects ----------
-- Cleaned up: the live database previously carried duplicate "project insert"
-- and "project update by pm sponsor or mbm" policies — both dropped via
-- cleanup_duplicate_project_policies.sql (audit §10). These are the single
-- canonical policies. The coordinator role (audit §8) is included on the same
-- access pattern as sponsor / project_manager.
create policy "project creation" on projects for insert with check (created_by = auth.uid());
create policy "project update" on projects for update using (
  is_mbm() or manages_team(team_id)
  or sponsor_id = auth.uid() or project_manager_id = auth.uid() or project_coordinator_id = auth.uid()
  or manages_profile(sponsor_id) or manages_profile(project_manager_id) or manages_profile(project_coordinator_id)
);
create policy "project visibility" on projects for select using (
  deleted_at is null and (
    is_mbm() or manages_team(team_id)
    or sponsor_id = auth.uid() or project_manager_id = auth.uid() or project_coordinator_id = auth.uid()
    or manages_profile(sponsor_id) or manages_profile(project_manager_id)
    or manages_profile(project_coordinator_id) or manages_profile(created_by)
  )
);

-- project_teams: additional-team membership (audit §8 / Finding 7.1).
alter table project_teams enable row level security;
create policy "project_teams visibility" on project_teams for select using (
  exists (select 1 from projects p where p.id = project_teams.project_id)
);
create policy "project_teams insert" on project_teams for insert with check (
  exists (select 1 from projects p where p.id = project_teams.project_id
    and (is_mbm() or manages_team(p.team_id) or p.sponsor_id = auth.uid()
      or p.project_manager_id = auth.uid() or p.project_coordinator_id = auth.uid()))
);
create policy "project_teams delete" on project_teams for delete using (
  exists (select 1 from projects p where p.id = project_teams.project_id
    and (is_mbm() or manages_team(p.team_id) or p.sponsor_id = auth.uid()
      or p.project_manager_id = auth.uid() or p.project_coordinator_id = auth.uid()))
);

-- ---------- milestones ----------
create policy "milestone visibility" on milestones for select using (
  exists (select 1 from projects p where p.id = milestones.project_id
    and (is_mbm() or p.team_id = my_team() or p.sponsor_id = auth.uid() or p.project_manager_id = auth.uid()))
);
create policy "milestone insert by project pm sponsor or mbm" on milestones for insert with check (
  exists (select 1 from projects p where p.id = milestones.project_id
    and (is_mbm() or p.project_manager_id = auth.uid() or p.sponsor_id = auth.uid()))
);
create policy "milestone update by project pm sponsor or mbm" on milestones for update using (
  exists (select 1 from projects p where p.id = milestones.project_id
    and (is_mbm() or p.project_manager_id = auth.uid() or p.sponsor_id = auth.uid()))
);

-- ---------- project_health_log ----------
create policy "health log visibility" on project_health_log for select using (
  exists (select 1 from projects p where p.id = project_health_log.project_id
    and (is_mbm() or p.team_id = my_team() or p.sponsor_id = auth.uid() or p.project_manager_id = auth.uid()))
);
create policy "health log insert by project pm sponsor or mbm" on project_health_log for insert with check (
  changed_by = auth.uid()
  and exists (select 1 from projects p where p.id = project_health_log.project_id
    and (is_mbm() or p.project_manager_id = auth.uid() or p.sponsor_id = auth.uid()))
);

-- ---------- stage_advance_requests ----------
create policy "stage_request visibility" on stage_advance_requests for select using (
  exists (select 1 from projects p where p.id = stage_advance_requests.project_id
    and (is_mbm() or p.team_id = my_team() or p.sponsor_id = auth.uid() or p.project_manager_id = auth.uid()))
);
create policy "stage_request insert by pm" on stage_advance_requests for insert with check (
  requested_by = auth.uid()
  and exists (select 1 from projects p where p.id = stage_advance_requests.project_id
    and (is_mbm() or p.project_manager_id = auth.uid()))
);
create policy "stage_request resolve by sponsor or mbm" on stage_advance_requests for update using (
  is_mbm() or exists (select 1 from projects p where p.id = stage_advance_requests.project_id and p.sponsor_id = auth.uid())
);

-- ---------- actions ----------
create policy "action visibility" on actions for select using (
  is_mbm() or team_id = my_team() or owner_id = auth.uid() or created_by = auth.uid()
);
create policy "action creation" on actions for insert with check (created_by = auth.uid());
create policy "action update by owner creator or mbm" on actions for update using (
  is_mbm() or owner_id = auth.uid() or created_by = auth.uid()
);

-- ---------- action_comments ----------
create policy "action_comment visibility" on action_comments for select using (
  exists (select 1 from actions a where a.id = action_comments.action_id
    and (is_mbm() or a.team_id = my_team() or a.owner_id = auth.uid() or a.created_by = auth.uid()))
);
create policy "action_comment insert by action participants" on action_comments for insert with check (
  author_id = auth.uid()
  and exists (select 1 from actions a where a.id = action_comments.action_id
    and (is_mbm() or a.team_id = my_team() or a.owner_id = auth.uid() or a.created_by = auth.uid()))
);

-- ---------- risk_matrix ----------
create policy "risk_matrix readable by all" on risk_matrix for select using (true);

-- ---------- risks ----------
create policy "risk visibility" on risks for select using (
  is_mbm() or team_id = my_team() or owner_id = auth.uid() or created_by = auth.uid()
);
create policy "risk creation" on risks for insert with check (created_by = auth.uid());
create policy "risk update by owner creator or mbm" on risks for update using (
  is_mbm() or owner_id = auth.uid() or created_by = auth.uid()
);

-- ---------- issues ----------
create policy "issue visibility" on issues for select using (
  is_mbm() or team_id = my_team() or owner_id = auth.uid() or created_by = auth.uid()
);
create policy "issue creation" on issues for insert with check (created_by = auth.uid());
create policy "issue update by owner creator or mbm" on issues for update using (
  is_mbm() or owner_id = auth.uid() or created_by = auth.uid()
);

-- ---------- decisions ----------
create policy "decision visibility" on decisions for select using (
  is_mbm() or team_id = my_team() or decision_owner_id = auth.uid() or created_by = auth.uid()
);
create policy "decision creation" on decisions for insert with check (created_by = auth.uid());
-- No update policy: decisions are intentionally append-only (full history
-- requirement). MBM can still correct via direct DB access if truly
-- needed, but the app never exposes an edit control.

-- ---------- audit_log ----------
create policy "audit_log visibility" on audit_log for select using (is_mbm() or actor_id = auth.uid());
create policy "audit_log insert by actor" on audit_log for insert with check (actor_id = auth.uid());

-- ---------- mentions ----------
-- KNOWN CLEANUP NEEDED: live database has TWO near-duplicate policy pairs
-- here ("mention ..." and "mentions ..." — naming drift from being
-- created twice). This file keeps one canonical pair.
create policy "mention visibility" on mentions for select using (
  is_mbm() or mentioned_user_id = auth.uid() or mentioning_user_id = auth.uid()
);
create policy "mention insert by mentioning user" on mentions for insert with check (mentioning_user_id = auth.uid());

-- ---------- team_directors ----------
create policy "team_directors readable" on team_directors for select using (true);
create policy "team_directors mbm manage" on team_directors for all using (is_mbm()) with check (is_mbm());

-- ---------- team_messages ----------
create policy "team messages visible to participants" on team_messages for select using (
  sender_id = auth.uid() or recipient_id = auth.uid() or is_mbm()
);
create policy "team messages insert by sender" on team_messages for insert with check (sender_id = auth.uid());
create policy "team messages recipient update read" on team_messages for update using (
  recipient_id = auth.uid() or is_mbm()
) with check (
  recipient_id = auth.uid() or is_mbm()
);

-- ============================================================
-- SEED DATA: risk matrix lookup table
-- ============================================================
insert into risk_matrix (impact, likelihood, severity) values
  ('low', 'low', 'low'),
  ('low', 'medium', 'low'),
  ('low', 'high', 'medium'),
  ('medium', 'low', 'low'),
  ('medium', 'medium', 'medium'),
  ('medium', 'high', 'high'),
  ('high', 'low', 'medium'),
  ('high', 'medium', 'high'),
  ('high', 'high', 'critical')
on conflict do nothing;
