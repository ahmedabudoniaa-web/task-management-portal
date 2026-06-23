-- ============================================================================
-- Trash / restore for soft-deleted projects — visibility policy
-- ============================================================================
--
-- The "project visibility" policy hides any row with deleted_at set, from
-- everyone. To build an in-app Trash view, the project's managers/owner need
-- to SEE deleted rows so they can restore them.
--
-- This adds a SECOND select policy scoped to DELETED rows only, restricted to
-- the same people who can edit the project (plus its creator). RLS ORs select
-- policies together, so:
--   * normal users: still cannot see deleted projects (neither policy matches),
--   * managers/owner/MBM: can see their deleted projects (this policy matches).
--
-- Restore itself is a normal UPDATE (clearing deleted_at) already covered by
-- the existing "project update" policy — no extra policy needed for that.
--
-- Safe to re-run.
-- ----------------------------------------------------------------------------

drop policy if exists "deleted project visibility" on projects;
create policy "deleted project visibility" on projects for select using (
  deleted_at is not null and (
    is_mbm() or manages_team(team_id)
    or sponsor_id = auth.uid() or project_manager_id = auth.uid() or project_coordinator_id = auth.uid()
    or created_by = auth.uid()
    or manages_profile(sponsor_id) or manages_profile(project_manager_id)
    or manages_profile(project_coordinator_id) or manages_profile(created_by)
  )
);
