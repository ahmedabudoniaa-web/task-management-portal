-- ============================================================================
-- Project membership visibility  (requests #1 + #3)
-- ============================================================================
-- Goal: anyone on the project's OWNING team or any LINKED team (added via
-- project_teams as contributing / supporting / approver / etc.) can:
--   * see the project
--   * see its phases and all tasks under it
-- Task creation already allows any user to add a task (owner = themselves),
-- so "members can add tasks" needs no insert-policy change.
--
-- Why a SECURITY DEFINER helper: the projects visibility policy needs to look
-- at project_teams, and the project_teams policy looks at projects. Referencing
-- them inside each other's RLS would recurse. is_project_member() runs as the
-- definer and bypasses RLS for that internal check, so there's no recursion.
-- (Same pattern as the existing can_access_task() recursion fix.)
--
-- Idempotent: safe to run more than once.
-- ----------------------------------------------------------------------------

create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from projects p
    where p.id = p_project_id
      and (
        p.team_id = my_team()
        or exists (
          select 1 from project_teams pt
          where pt.project_id = p.id
            and pt.team_id = my_team()
        )
      )
  );
$$;

-- ---- projects: members of owning/linked teams can see the project ----
drop policy if exists "project visibility" on projects;
create policy "project visibility" on projects for select using (
  deleted_at is null and (
    is_mbm() or manages_team(team_id)
    or is_project_member(id)
    or sponsor_id = auth.uid() or project_manager_id = auth.uid() or project_coordinator_id = auth.uid()
    or manages_profile(sponsor_id) or manages_profile(project_manager_id)
    or manages_profile(project_coordinator_id) or manages_profile(created_by)
  )
);

-- ---- tasks: members can see every task under a project they belong to ----
drop policy if exists "task visibility" on tasks;
create policy "task visibility" on tasks for select using (
  is_mbm() or manages_team(team_id) or owner_id = auth.uid() or assignee_id = auth.uid()
  or manages_profile(owner_id) or manages_profile(assignee_id)
  or (project_id is not null and is_project_member(project_id))
);

-- ---- milestones (phases): members can see the project's phases ----
drop policy if exists "milestone visibility" on milestones;
create policy "milestone visibility" on milestones for select using (
  is_project_member(project_id)
  or exists (
    select 1 from projects p
    where p.id = milestones.project_id
      and (is_mbm() or p.team_id = my_team() or p.sponsor_id = auth.uid() or p.project_manager_id = auth.uid())
  )
);

-- VERIFY (optional): confirm the helper resolves and policies exist.
--   select policyname from pg_policies
--   where tablename in ('projects','tasks','milestones')
--     and policyname in ('project visibility','task visibility','milestone visibility');
