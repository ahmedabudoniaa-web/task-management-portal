-- Org hierarchy update based on uploaded employee file.
-- Safe migration: adds manager hierarchy and team director mappings; no data rows are deleted.

insert into teams (name) values
  ('Engineering'), ('Health and Safety'), ('People Service Hub'), ('Property'), ('Operation')
on conflict (name) do nothing;

alter table profiles add column if not exists role text default 'member';
alter table profiles add column if not exists job_title text;
alter table profiles add column if not exists manager_id uuid;
alter table profiles alter column team_id drop not null;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_manager_id_fkey'
  ) then
    alter table profiles
      add constraint profiles_manager_id_fkey
      foreign key (manager_id) references profiles(id) on delete set null;
  end if;
end $$;

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('mbm','director','manager','project_manager','member'));

update profiles set full_name = 'Abdu Ibrahim Kabbi', job_title = 'Security', role = 'member', is_mbm = false, is_team_manager = false, team_id = (select id from teams where name = 'Health and Safety' limit 1) where lower(email) = lower('abdu.kabbi@bupa.com.sa');
update profiles set full_name = 'Moideen Abdulsalam', job_title = 'Specialist - Facility Operations & Maintenance', role = 'manager', is_mbm = false, is_team_manager = true, team_id = (select id from teams where name = 'Operation' limit 1) where lower(email) = lower('Moideen.Abdulsalam@bupa.com.sa');
update profiles set full_name = 'Abdulrahman Abdulaziz Abdulaziz', job_title = 'Inquiry Employee', role = 'member', is_mbm = false, is_team_manager = false, team_id = (select id from teams where name = 'Health and Safety' limit 1) where lower(email) = lower('Abdulrahman.Abdulaziz@bupa.com.sa');
update profiles set full_name = 'Abdulrahman Hamad Hamad', job_title = 'Body Guard', role = 'member', is_mbm = false, is_team_manager = false, team_id = (select id from teams where name = 'Health and Safety' limit 1) where lower(email) = lower('Abdulrahman.Hamad@bupa.com.sa');
update profiles set full_name = 'Abdulrahman Abuhedeba', job_title = 'Technician', role = 'member', is_mbm = false, is_team_manager = false, team_id = (select id from teams where name = 'Health and Safety' limit 1) where lower(email) = lower('Abdulrahman.Abuhedeba@bupa.com.sa');
update profiles set full_name = 'Nadiah Abdu', job_title = 'Senior Manager - Property Management', role = 'manager', is_mbm = false, is_team_manager = true, team_id = (select id from teams where name = 'Property' limit 1) where lower(email) = lower('Nadiah.Abdu@bupa.com.sa');
update profiles set full_name = 'Ibrahim Abutaleb', job_title = 'Director - Facility Engineering & Operations', role = 'director', is_mbm = false, is_team_manager = true, team_id = (select id from teams where name = 'Operation' limit 1) where lower(email) = lower('Ibrahim.Abutaleb@bupa.com.sa');
update profiles set full_name = 'Mohammed Ahmed', job_title = 'Specialist - Facility Operations & Maintenance', role = 'member', is_mbm = false, is_team_manager = false, team_id = (select id from teams where name = 'Operation' limit 1) where lower(email) = lower('mohammed.h.ahmed@bupa.com.sa');
update profiles set full_name = 'Mohammed Alabdali', job_title = 'Specialist - Facility Management', role = 'member', is_mbm = false, is_team_manager = false, team_id = (select id from teams where name = 'People Service Hub' limit 1) where lower(email) = lower('Mohammed.Alabdali3@bupa.com.sa');
update profiles set full_name = 'Mohammed Ali', job_title = 'Senior Executive Manager - Engineering', role = 'manager', is_mbm = false, is_team_manager = true, team_id = (select id from teams where name = 'Engineering' limit 1) where lower(email) = lower('mohammed.t.ali@bupa.com.sa');
update profiles set full_name = 'Esmail Alqadhi', job_title = 'Senior Executive Manager - Health, Safety & Security', role = 'director', is_mbm = false, is_team_manager = true, team_id = (select id from teams where name = 'Health and Safety' limit 1) where lower(email) = lower('esmail.alqadhi@bupa.com.sa');
update profiles set full_name = 'Amer Mohammed Alrabay', job_title = 'Receptionist', role = 'member', is_mbm = false, is_team_manager = false, team_id = (select id from teams where name = 'Health and Safety' limit 1) where lower(email) = lower('amer.alrabay@bupa.com.sa');
update profiles set full_name = 'Abdulqader Bakhashwain', job_title = 'Senior Associate - Security Services', role = 'member', is_mbm = false, is_team_manager = false, team_id = (select id from teams where name = 'Health and Safety' limit 1) where lower(email) = lower('Abdulkader.Bakhashwen@bupa.com.sa');
update profiles set full_name = 'Jolan Bashowri', job_title = 'Senior Associate - Facility Operations & Maintenance', role = 'member', is_mbm = false, is_team_manager = false, team_id = (select id from teams where name = 'Operation' limit 1) where lower(email) = lower('jolan.bashowri@bupa.com.sa');
update profiles set full_name = 'Mohammed BinMahfoudh', job_title = 'Senior Director - Facility & Sustainability', role = 'mbm', is_mbm = true, is_team_manager = false, team_id = null where lower(email) = lower('Mohammed.BinMahfoudh@bupa.com.sa');
update profiles set full_name = 'Rayan Bukhari', job_title = 'Senior Manager - Architecture', role = 'member', is_mbm = false, is_team_manager = false, team_id = (select id from teams where name = 'Engineering' limit 1) where lower(email) = lower('rayan.bukhari@bupa.com.sa');
update profiles set full_name = 'Ahmed Abudonia', job_title = 'Senior Executive Manager - PMO', role = 'director', is_mbm = false, is_team_manager = true, team_id = (select id from teams where name = 'People Service Hub' limit 1) where lower(email) = lower('Ahmed.AboDonia@bupa.com.sa');
update profiles set full_name = 'Emad Abdulghani', job_title = 'Consultant', role = 'member', is_mbm = false, is_team_manager = false, team_id = (select id from teams where name = 'Engineering' limit 1) where lower(email) = lower('emad.abdulghani@bupa.com.sa');
update profiles set full_name = 'Hassan Shafiq', job_title = 'Travel Consultant', role = 'member', is_mbm = false, is_team_manager = false, team_id = (select id from teams where name = 'People Service Hub' limit 1) where lower(email) = lower('Hassan.Shafiq@bupa.com.sa');
update profiles set full_name = 'Rozan Jalal', job_title = 'Assistant Manager - Engineering', role = 'member', is_mbm = false, is_team_manager = false, team_id = (select id from teams where name = 'Engineering' limit 1) where lower(email) = lower('Rozan.Jalal2@bupa.com.sa');
update profiles set full_name = 'Sarah Jamal', job_title = 'Specialist - Property Management', role = 'member', is_mbm = false, is_team_manager = false, team_id = (select id from teams where name = 'Property' limit 1) where lower(email) = lower('Sarah.Jamal2@bupa.com.sa');
update profiles set full_name = 'Joana Flores', job_title = 'Nurse', role = 'member', is_mbm = false, is_team_manager = false, team_id = (select id from teams where name = 'Health and Safety' limit 1) where lower(email) = lower('Joana.Flores@bupa.com.sa');
update profiles set full_name = 'Manswor Ahmed Alghamdi', job_title = 'Receptionist', role = 'member', is_mbm = false, is_team_manager = false, team_id = (select id from teams where name = 'Health and Safety' limit 1) where lower(email) = lower('manswor.alghamdi@bupa.com.sa');
update profiles set full_name = 'Mohammed Manzoor', job_title = 'Senior Associate - Facility Operations & Maintenance', role = 'member', is_mbm = false, is_team_manager = false, team_id = (select id from teams where name = 'Operation' limit 1) where lower(email) = lower('mohammed.m.manzoor@bupa.com.sa');
update profiles set full_name = 'Mazhood Abdulla', job_title = 'Project Manager', role = 'member', is_mbm = false, is_team_manager = false, team_id = (select id from teams where name = 'Operation' limit 1) where lower(email) = lower('Mazhood.Abdulla@bupa.com.sa');
update profiles set full_name = 'Mohamed Khan', job_title = 'Project Manager', role = 'member', is_mbm = false, is_team_manager = false, team_id = (select id from teams where name = 'Operation' limit 1) where lower(email) = lower('Mohamed.Khan@bupa.com.sa');
update profiles set full_name = 'Mohammed Hakami', job_title = 'Consultant', role = 'member', is_mbm = false, is_team_manager = false, team_id = (select id from teams where name = 'Health and Safety' limit 1) where lower(email) = lower('mohammed.hakami@bupa.com.sa');
update profiles set full_name = 'Muhammad afzaal a', job_title = 'Project Manager', role = 'member', is_mbm = false, is_team_manager = false, team_id = (select id from teams where name = 'Operation' limit 1) where lower(email) = lower('muhammad.a@bupa.com.sa');
update profiles set full_name = 'Murugan Subramani', job_title = 'Project Manager', role = 'member', is_mbm = false, is_team_manager = false, team_id = (select id from teams where name = 'Operation' limit 1) where lower(email) = lower('murugan.subramani@bupa.com.sa');
update profiles set full_name = 'Naveen Narayana', job_title = 'Assistant Manager - Facility Operations & Maintenance', role = 'manager', is_mbm = false, is_team_manager = true, team_id = (select id from teams where name = 'Operation' limit 1) where lower(email) = lower('Naveen.Narayana@bupa.com.sa');
update profiles set full_name = 'Nishant PoyilMeethal', job_title = 'People Service HUB agent', role = 'member', is_mbm = false, is_team_manager = false, team_id = (select id from teams where name = 'People Service Hub' limit 1) where lower(email) = lower('NISHANT.POYILMEETHAL@bupa.com.sa');
update profiles set full_name = 'Nizarudeen Shahul Hameed', job_title = 'Mailing room supervisor', role = 'member', is_mbm = false, is_team_manager = false, team_id = (select id from teams where name = 'Operation' limit 1) where lower(email) = lower('Nizarudeen.ShahulHameed@bupa.com.sa');
update profiles set full_name = 'Saad Ali Alamri', job_title = 'Receptionist', role = 'member', is_mbm = false, is_team_manager = false, team_id = (select id from teams where name = 'Health and Safety' limit 1) where lower(email) = lower('saad.alamri@bupa.com.sa');
update profiles set full_name = 'Saleh Adel Batarfi', job_title = 'Data Analyst', role = 'member', is_mbm = false, is_team_manager = false, team_id = (select id from teams where name = 'People Service Hub' limit 1) where lower(email) = lower('saleh.batarfi@bupa.com.sa');
update profiles set full_name = 'Saud Aziz Saidi', job_title = 'Security Supervisor', role = 'member', is_mbm = false, is_team_manager = false, team_id = (select id from teams where name = 'Health and Safety' limit 1) where lower(email) = lower('saud.saidi@bupa.com.sa');
update profiles set full_name = 'Ali Sawas', job_title = 'Manager - Health, Safety & Security', role = 'manager', is_mbm = false, is_team_manager = true, team_id = (select id from teams where name = 'Health and Safety' limit 1) where lower(email) = lower('Ali.Sawas@bupa.com.sa');
update profiles set full_name = 'Siddiq Mukhtar', job_title = 'Senior Architect', role = 'member', is_mbm = false, is_team_manager = false, team_id = (select id from teams where name = 'Engineering' limit 1) where lower(email) = lower('siddiq.mukhtar@bupa.com.sa');
update profiles set full_name = 'Suhaib Daoud', job_title = 'Project Manager', role = 'member', is_mbm = false, is_team_manager = false, team_id = (select id from teams where name = 'Engineering' limit 1) where lower(email) = lower('suhaib.daoud@bupa.com.sa');
update profiles set full_name = 'Tamim Omar AlTamimi', job_title = 'People Service HUB agent', role = 'member', is_mbm = false, is_team_manager = false, team_id = (select id from teams where name = 'People Service Hub' limit 1) where lower(email) = lower('tamim.altamimi@bupa.com.sa');
update profiles set full_name = 'Maribel Tumamak', job_title = 'Senior Manager - Property & Facilities', role = 'manager', is_mbm = false, is_team_manager = true, team_id = (select id from teams where name = 'People Service Hub' limit 1) where lower(email) = lower('Maribel.Tumamak@bupa.com.sa');
update profiles set full_name = 'Waleed Aseeri Ahmed', job_title = 'Receptionist', role = 'member', is_mbm = false, is_team_manager = false, team_id = (select id from teams where name = 'Health and Safety' limit 1) where lower(email) = lower('waleed.ahmed@bupa.com.sa');
update profiles set full_name = 'Ahmed Yahyaoui', job_title = 'Senior Associate - Facility Operations & Maintenance', role = 'member', is_mbm = false, is_team_manager = false, team_id = (select id from teams where name = 'Operation' limit 1) where lower(email) = lower('Ahmed.Yahyaoui@bupa.com.sa');
update profiles set full_name = 'Yunus MOHAMMED MOHAMMED', job_title = 'Security', role = 'member', is_mbm = false, is_team_manager = false, team_id = (select id from teams where name = 'Health and Safety' limit 1) where lower(email) = lower('yunus.mohammed@bupa.com.sa');
update profiles set full_name = 'ZAID Omar Almafalha', job_title = 'Consultant', role = 'member', is_mbm = false, is_team_manager = false, team_id = (select id from teams where name = 'Property' limit 1) where lower(email) = lower('zaid.almafalha@bupa.com.sa');
update profiles set full_name = 'Muhammad Furqan Ali', job_title = 'Consultant', role = 'member', is_mbm = false, is_team_manager = false, team_id = (select id from teams where name = 'Property' limit 1) where lower(email) = lower('muhammad.ali1@bupa.com.sa');

-- Reporting line. MBM has no manager; the three principal managers report to MBM, then their managers/employees follow the uploaded file.
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Ali Sawas') limit 1) where lower(email) = lower('abdu.kabbi@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Naveen Narayana') limit 1) where lower(email) = lower('Moideen.Abdulsalam@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Ali Sawas') limit 1) where lower(email) = lower('Abdulrahman.Abdulaziz@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Ali Sawas') limit 1) where lower(email) = lower('Abdulrahman.Hamad@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Ali Sawas') limit 1) where lower(email) = lower('Abdulrahman.Abuhedeba@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Ibrahim Abutaleb') limit 1) where lower(email) = lower('Nadiah.Abdu@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Mohammed BinMahfoudh') limit 1) where lower(email) = lower('Ibrahim.Abutaleb@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Naveen Narayana') limit 1) where lower(email) = lower('mohammed.h.ahmed@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Ahmed Abudonia') limit 1) where lower(email) = lower('Mohammed.Alabdali3@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Ibrahim Abutaleb') limit 1) where lower(email) = lower('mohammed.t.ali@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Mohammed BinMahfoudh') limit 1) where lower(email) = lower('esmail.alqadhi@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Ali Sawas') limit 1) where lower(email) = lower('amer.alrabay@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Ali Sawas') limit 1) where lower(email) = lower('Abdulkader.Bakhashwen@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Naveen Narayana') limit 1) where lower(email) = lower('jolan.bashowri@bupa.com.sa');
update profiles set manager_id = null where lower(email) = lower('Mohammed.BinMahfoudh@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Mohammed Ali') limit 1) where lower(email) = lower('rayan.bukhari@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Mohammed BinMahfoudh') limit 1) where lower(email) = lower('Ahmed.AboDonia@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Mohammed Ali') limit 1) where lower(email) = lower('emad.abdulghani@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Maribel Tumamak') limit 1) where lower(email) = lower('Hassan.Shafiq@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Mohammed Ali') limit 1) where lower(email) = lower('Rozan.Jalal2@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Nadiah Abdu') limit 1) where lower(email) = lower('Sarah.Jamal2@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Ali Sawas') limit 1) where lower(email) = lower('Joana.Flores@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Ali Sawas') limit 1) where lower(email) = lower('manswor.alghamdi@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Naveen Narayana') limit 1) where lower(email) = lower('mohammed.m.manzoor@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Naveen Narayana') limit 1) where lower(email) = lower('Mazhood.Abdulla@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Naveen Narayana') limit 1) where lower(email) = lower('Mohamed.Khan@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Ali Sawas') limit 1) where lower(email) = lower('mohammed.hakami@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Naveen Narayana') limit 1) where lower(email) = lower('muhammad.a@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Naveen Narayana') limit 1) where lower(email) = lower('murugan.subramani@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Ibrahim Abutaleb') limit 1) where lower(email) = lower('Naveen.Narayana@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Maribel Tumamak') limit 1) where lower(email) = lower('NISHANT.POYILMEETHAL@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Moideen Abdulsalam') limit 1) where lower(email) = lower('Nizarudeen.ShahulHameed@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Ali Sawas') limit 1) where lower(email) = lower('saad.alamri@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Maribel Tumamak') limit 1) where lower(email) = lower('saleh.batarfi@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Ali Sawas') limit 1) where lower(email) = lower('saud.saidi@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Esmail Alqadhi') limit 1) where lower(email) = lower('Ali.Sawas@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Mohammed Ali') limit 1) where lower(email) = lower('siddiq.mukhtar@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Mohammed Ali') limit 1) where lower(email) = lower('suhaib.daoud@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Maribel Tumamak') limit 1) where lower(email) = lower('tamim.altamimi@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Ahmed Abudonia') limit 1) where lower(email) = lower('Maribel.Tumamak@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Ali Sawas') limit 1) where lower(email) = lower('waleed.ahmed@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Naveen Narayana') limit 1) where lower(email) = lower('Ahmed.Yahyaoui@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Ali Sawas') limit 1) where lower(email) = lower('yunus.mohammed@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Nadiah Abdu') limit 1) where lower(email) = lower('zaid.almafalha@bupa.com.sa');
update profiles set manager_id = (select id from profiles where lower(full_name) = lower('Nadiah Abdu') limit 1) where lower(email) = lower('muhammad.ali1@bupa.com.sa');

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

-- Principal team ownership: only the 3 managers under MBM own the 5 teams.
delete from team_directors;
insert into team_directors (team_id, director_id) select t.id, p.id from teams t cross join profiles p where t.name = 'Engineering' and lower(p.full_name) = lower('Ibrahim Abutaleb') on conflict do nothing;
insert into team_directors (team_id, director_id) select t.id, p.id from teams t cross join profiles p where t.name = 'Operation' and lower(p.full_name) = lower('Ibrahim Abutaleb') on conflict do nothing;
insert into team_directors (team_id, director_id) select t.id, p.id from teams t cross join profiles p where t.name = 'Property' and lower(p.full_name) = lower('Ibrahim Abutaleb') on conflict do nothing;
insert into team_directors (team_id, director_id) select t.id, p.id from teams t cross join profiles p where t.name = 'Health and Safety' and lower(p.full_name) = lower('Esmail Alqadhi') on conflict do nothing;
insert into team_directors (team_id, director_id) select t.id, p.id from teams t cross join profiles p where t.name = 'People Service Hub' and lower(p.full_name) = lower('Ahmed Abudonia') on conflict do nothing;

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

create or replace function managed_profile_ids()
returns uuid[] as $$
  with recursive reports as (
    select id from profiles where manager_id = auth.uid()
    union
    select p.id from profiles p join reports r on p.manager_id = r.id
  )
  select coalesce(array_agg(id), '{}') from reports;
$$ language sql security definer stable;

create or replace function manages_profile(target_profile uuid)
returns boolean as $$
  select coalesce(target_profile = any(managed_profile_ids()), false);
$$ language sql security definer stable;

create or replace function my_team()
returns uuid as $$
  select team_id from profiles where id = auth.uid();
$$ language sql security definer stable;
-- RLS updates: MBM sees all; principal managers see assigned teams; middle managers see their reporting line.
drop policy if exists "task visibility" on tasks;
create policy "task visibility" on tasks for select using (
  is_mbm()
  or manages_team(team_id)
  or owner_id = auth.uid()
  or assignee_id = auth.uid()
  or manages_profile(owner_id)
  or manages_profile(assignee_id)
  or exists (select 1 from sub_actions sa where sa.task_id = tasks.id and (sa.assignee_id = auth.uid() or manages_profile(sa.assignee_id)))
);

drop policy if exists "task creation" on tasks;
create policy "task creation" on tasks for insert with check (
  owner_id = auth.uid()
  and (is_mbm() or manages_team(team_id) or team_id = my_team())
);

drop policy if exists "task update by owner, assignee or mbm" on tasks;
drop policy if exists "task update by owner, assignee director or mbm" on tasks;
create policy "task update by owner, assignee manager or mbm" on tasks for update using (
  is_mbm() or manages_team(team_id) or owner_id = auth.uid() or assignee_id = auth.uid() or manages_profile(owner_id) or manages_profile(assignee_id)
);

drop policy if exists "task delete by owner or mbm" on tasks;
drop policy if exists "task delete by owner assignee or mbm" on tasks;
drop policy if exists "task delete by owner director or mbm" on tasks;
create policy "task delete by owner manager or mbm" on tasks for delete using (
  is_mbm() or manages_team(team_id) or owner_id = auth.uid() or manages_profile(owner_id)
);

drop policy if exists "sub_action visibility" on sub_actions;
create policy "sub_action visibility" on sub_actions for select using (
  assignee_id = auth.uid()
  or manages_profile(assignee_id)
  or exists (select 1 from tasks t where t.id = task_id and (
    is_mbm() or manages_team(t.team_id) or t.owner_id = auth.uid() or t.assignee_id = auth.uid() or manages_profile(t.owner_id) or manages_profile(t.assignee_id)
  ))
);

drop policy if exists "sub_action insert by task participants" on sub_actions;
create policy "sub_action insert by task participants" on sub_actions for insert with check (
  exists (select 1 from tasks t where t.id = task_id and (
    is_mbm() or manages_team(t.team_id) or t.owner_id = auth.uid() or t.assignee_id = auth.uid() or manages_profile(t.owner_id) or manages_profile(t.assignee_id)
  ))
);

drop policy if exists "sub_action update by task participants" on sub_actions;
create policy "sub_action update by task participants" on sub_actions for update using (
  assignee_id = auth.uid()
  or manages_profile(assignee_id)
  or exists (select 1 from tasks t where t.id = task_id and (
    is_mbm() or manages_team(t.team_id) or t.owner_id = auth.uid() or t.assignee_id = auth.uid() or manages_profile(t.owner_id) or manages_profile(t.assignee_id)
  ))
);

drop policy if exists "project visibility" on projects;
create policy "project visibility" on projects for select using (
  is_mbm() or manages_team(team_id) or sponsor_id = auth.uid() or project_manager_id = auth.uid()
  or manages_profile(sponsor_id) or manages_profile(project_manager_id) or manages_profile(created_by)
);

drop policy if exists "project insert" on projects;
create policy "project insert" on projects for insert with check (
  created_by = auth.uid() and (is_mbm() or manages_team(team_id) or team_id = my_team())
);

drop policy if exists "project update" on projects;
create policy "project update" on projects for update using (
  is_mbm() or manages_team(team_id) or sponsor_id = auth.uid() or project_manager_id = auth.uid()
  or manages_profile(sponsor_id) or manages_profile(project_manager_id)
);
