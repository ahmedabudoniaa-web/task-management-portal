-- ============================================================================
-- Fix #8 — collapse the duplicate "Operation" / "Operations" teams into one
-- ============================================================================
--
-- From the diagnostic:
--   9c7a8ffd-7672-464f-85b0-49ecb0f9cb94  "Operation"   12 people, 2 projects
--   d47c3f33-b0e4-4734-b89f-d5bac47deb34  "Operations"   0 people, 0 projects
--
-- The data lives on "Operation"; "Operations" is empty. So we DROP the empty
-- duplicate and RENAME the real row to the canonical "Operations". Because the
-- row that holds the data keeps its id, NOTHING needs repointing — no people,
-- projects, or tasks move.
--
-- Wrapped in a transaction: if the delete hits an unexpected foreign-key
-- reference, the whole thing rolls back cleanly (nothing half-done). If that
-- happens, paste me the error and I'll add the missing cleanup line.
-- ----------------------------------------------------------------------------

begin;

-- Clear any stray references to the empty duplicate (expected: 0 rows each).
delete from team_directors where team_id = 'd47c3f33-b0e4-4734-b89f-d5bac47deb34';
delete from project_teams  where team_id = 'd47c3f33-b0e4-4734-b89f-d5bac47deb34';

-- Remove the empty duplicate.
delete from teams where id = 'd47c3f33-b0e4-4734-b89f-d5bac47deb34';

-- Give the real team the canonical plural name.
update teams set name = 'Operations' where id = '9c7a8ffd-7672-464f-85b0-49ecb0f9cb94';

commit;

-- VERIFY (optional): should return exactly one row, "Operations" with 12 people.
--   select t.id, t.name, (select count(*) from profiles p where p.team_id = t.id) as people
--   from teams t where t.name ilike 'operation%';
