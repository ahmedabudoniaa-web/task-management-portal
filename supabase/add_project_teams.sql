-- ============================================================================
-- Audit §8 / Finding 7.1 — multi-team support via a project_teams join table
-- ============================================================================
--
-- DESIGN (additive, non-disruptive — as the audit recommends):
--  * projects.team_id is UNCHANGED — it remains the canonical "owner" team.
--    Every existing dashboard, filter, and permission keeps working exactly
--    as before.
--  * project_teams holds ADDITIONAL teams attached to a project, each with a
--    role (contributing / supporting / approver). 'owner' is allowed in the
--    constraint for flexibility but is normally represented by team_id.
--  * Access:
--      - SELECT: anyone who can already see the parent project (the EXISTS
--        subquery is itself filtered by projects' own RLS, so visibility
--        follows the project automatically).
--      - INSERT/DELETE: the project's owner-team manager, sponsor, PM,
--        coordinator, or MBM — the same set that can edit the project.
--  * No recursion risk: the helper functions used here (is_mbm, manages_team,
--    manages_profile) are SECURITY DEFINER and never read project_teams.
--
-- Safe to re-run (if not exists / if exists guards).
-- ----------------------------------------------------------------------------

create table if not exists project_teams (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  team_id uuid not null references teams(id),
  role text not null default 'contributing'
    check (role in ('owner', 'contributing', 'supporting', 'approver')),
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique (project_id, team_id, role)
);

alter table project_teams enable row level security;

-- SELECT: visible to anyone who can see the parent project.
drop policy if exists "project_teams visibility" on project_teams;
create policy "project_teams visibility" on project_teams for select using (
  exists (select 1 from projects p where p.id = project_teams.project_id)
);

-- INSERT: only those who can edit the project.
drop policy if exists "project_teams insert" on project_teams;
create policy "project_teams insert" on project_teams for insert with check (
  exists (
    select 1 from projects p
    where p.id = project_teams.project_id
      and (is_mbm() or manages_team(p.team_id)
        or p.sponsor_id = auth.uid() or p.project_manager_id = auth.uid()
        or p.project_coordinator_id = auth.uid())
  )
);

-- DELETE: same edit set.
drop policy if exists "project_teams delete" on project_teams;
create policy "project_teams delete" on project_teams for delete using (
  exists (
    select 1 from projects p
    where p.id = project_teams.project_id
      and (is_mbm() or manages_team(p.team_id)
        or p.sponsor_id = auth.uid() or p.project_manager_id = auth.uid()
        or p.project_coordinator_id = auth.uid())
  )
);

-- VERIFY (optional):
--   select table_name from information_schema.tables where table_name = 'project_teams';
