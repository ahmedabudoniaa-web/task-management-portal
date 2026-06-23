-- ============================================================================
-- Audit §8 / Finding 7.2 — add a Project Coordinator role to projects
-- ============================================================================
--
-- Adds one additive column and gives the coordinator the SAME access the
-- sponsor and project manager already have (the named coordinator, plus
-- anyone who manages them in the hierarchy, can see and edit the project).
-- This mirrors exactly how sponsor_id and project_manager_id are handled —
-- no new access model, just one more named role on the same pattern.
--
-- SAFETY
--  * The column add is `if not exists` — safe to re-run.
--  * The policy recreations are supersets: they only ADD the coordinator
--    branch, so no one loses access.
--  * Compatible whether or not the §10 duplicate-policy cleanup has run yet.
--  * The visibility policy is recreated WITH `deleted_at is null`, which also
--    confirms soft-deleted projects stay hidden (the adjacent §10 check).
-- ----------------------------------------------------------------------------

alter table projects
  add column if not exists project_coordinator_id uuid references profiles(id);

-- SELECT: who can see the project
drop policy if exists "project visibility" on projects;
create policy "project visibility" on projects for select using (
  deleted_at is null and (
    is_mbm() or manages_team(team_id)
    or sponsor_id = auth.uid() or project_manager_id = auth.uid() or project_coordinator_id = auth.uid()
    or manages_profile(sponsor_id) or manages_profile(project_manager_id)
    or manages_profile(project_coordinator_id) or manages_profile(created_by)
  )
);

-- UPDATE: who can edit the project
drop policy if exists "project update" on projects;
create policy "project update" on projects for update using (
  is_mbm() or manages_team(team_id)
  or sponsor_id = auth.uid() or project_manager_id = auth.uid() or project_coordinator_id = auth.uid()
  or manages_profile(sponsor_id) or manages_profile(project_manager_id) or manages_profile(project_coordinator_id)
);

-- VERIFY (optional, changes nothing):
--   select column_name from information_schema.columns
--   where table_name = 'projects' and column_name = 'project_coordinator_id';
--   -- should return one row.
