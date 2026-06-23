-- ============================================================================
-- Fix #7 (data) — set each profile's manager_id from Team_Data.xlsx
-- ============================================================================
--
-- Sets manager_id for all 45 FM staff, keyed on email (case-insensitive), so
-- the managed-people hierarchy (used by 'people I manage' everywhere) is
-- correct. Mohammed BinMahfoudh is the root (manager_id = NULL).
--
-- Safe: only rows whose email matches an existing profile are touched. If a
-- profile email in the DB differs from the file, that row is skipped (and the
-- verification query at the bottom will show it as still-unset).
-- ----------------------------------------------------------------------------

-- 1) Everyone with a manager: resolve manager_id by the manager's email.
update profiles p
set manager_id = m.id
from (values
  (lower('abdu.kabbi@bupa.com.sa'), lower('Ali.Sawas@bupa.com.sa')),
  (lower('Moideen.Abdulsalam@bupa.com.sa'), lower('Naveen.Narayana@bupa.com.sa')),
  (lower('Abdulrahman.Abdulaziz@bupa.com.sa'), lower('Ali.Sawas@bupa.com.sa')),
  (lower('Abdulrahman.Hamad@bupa.com.sa'), lower('Ali.Sawas@bupa.com.sa')),
  (lower('Abdulrahman.Abuhedeba@bupa.com.sa'), lower('Ali.Sawas@bupa.com.sa')),
  (lower('Nadiah.Abdu@bupa.com.sa'), lower('Ibrahim.Abutaleb@bupa.com.sa')),
  (lower('Ibrahim.Abutaleb@bupa.com.sa'), lower('Mohammed.BinMahfoudh@bupa.com.sa')),
  (lower('mohammed.h.ahmed@bupa.com.sa'), lower('Naveen.Narayana@bupa.com.sa')),
  (lower('Mohammed.Alabdali3@bupa.com.sa'), lower('Ahmed.AboDonia@bupa.com.sa')),
  (lower('mohammed.t.ali@bupa.com.sa'), lower('Ibrahim.Abutaleb@bupa.com.sa')),
  (lower('esmail.alqadhi@bupa.com.sa'), lower('Mohammed.BinMahfoudh@bupa.com.sa')),
  (lower('amer.alrabay@bupa.com.sa'), lower('Ali.Sawas@bupa.com.sa')),
  (lower('Abdulkader.Bakhashwen@bupa.com.sa'), lower('Ali.Sawas@bupa.com.sa')),
  (lower('jolan.bashowri@bupa.com.sa'), lower('Naveen.Narayana@bupa.com.sa')),
  (lower('rayan.bukhari@bupa.com.sa'), lower('mohammed.t.ali@bupa.com.sa')),
  (lower('Ahmed.AboDonia@bupa.com.sa'), lower('Mohammed.BinMahfoudh@bupa.com.sa')),
  (lower('emad.abdulghani@bupa.com.sa'), lower('mohammed.t.ali@bupa.com.sa')),
  (lower('Hassan.Shafiq@bupa.com.sa'), lower('Maribel.Tumamak@bupa.com.sa')),
  (lower('Rozan.Jalal2@bupa.com.sa'), lower('mohammed.t.ali@bupa.com.sa')),
  (lower('Sarah.Jamal2@bupa.com.sa'), lower('Nadiah.Abdu@bupa.com.sa')),
  (lower('Joana.Flores@bupa.com.sa'), lower('Ali.Sawas@bupa.com.sa')),
  (lower('manswor.alghamdi@bupa.com.sa'), lower('Ali.Sawas@bupa.com.sa')),
  (lower('mohammed.m.manzoor@bupa.com.sa'), lower('Naveen.Narayana@bupa.com.sa')),
  (lower('Mazhood.Abdulla@bupa.com.sa'), lower('Naveen.Narayana@bupa.com.sa')),
  (lower('Mohamed.Khan@bupa.com.sa'), lower('Naveen.Narayana@bupa.com.sa')),
  (lower('mohammed.hakami@bupa.com.sa'), lower('Ali.Sawas@bupa.com.sa')),
  (lower('muhammad.a@bupa.com.sa'), lower('Naveen.Narayana@bupa.com.sa')),
  (lower('murugan.subramani@bupa.com.sa'), lower('Naveen.Narayana@bupa.com.sa')),
  (lower('Naveen.Narayana@bupa.com.sa'), lower('Ibrahim.Abutaleb@bupa.com.sa')),
  (lower('NISHANT.POYILMEETHAL@bupa.com.sa'), lower('Maribel.Tumamak@bupa.com.sa')),
  (lower('Nizarudeen.ShahulHameed@bupa.com.sa'), lower('Moideen.Abdulsalam@bupa.com.sa')),
  (lower('saad.alamri@bupa.com.sa'), lower('Ali.Sawas@bupa.com.sa')),
  (lower('saleh.batarfi@bupa.com.sa'), lower('Maribel.Tumamak@bupa.com.sa')),
  (lower('saud.saidi@bupa.com.sa'), lower('Ali.Sawas@bupa.com.sa')),
  (lower('Ali.Sawas@bupa.com.sa'), lower('esmail.alqadhi@bupa.com.sa')),
  (lower('siddiq.mukhtar@bupa.com.sa'), lower('mohammed.t.ali@bupa.com.sa')),
  (lower('suhaib.daoud@bupa.com.sa'), lower('mohammed.t.ali@bupa.com.sa')),
  (lower('tamim.altamimi@bupa.com.sa'), lower('Maribel.Tumamak@bupa.com.sa')),
  (lower('Maribel.Tumamak@bupa.com.sa'), lower('Ahmed.AboDonia@bupa.com.sa')),
  (lower('waleed.ahmed@bupa.com.sa'), lower('Ali.Sawas@bupa.com.sa')),
  (lower('Ahmed.Yahyaoui@bupa.com.sa'), lower('Naveen.Narayana@bupa.com.sa')),
  (lower('yunus.mohammed@bupa.com.sa'), lower('Ali.Sawas@bupa.com.sa')),
  (lower('zaid.almafalha@bupa.com.sa'), lower('Nadiah.Abdu@bupa.com.sa')),
  (lower('muhammad.ali1@bupa.com.sa'), lower('Nadiah.Abdu@bupa.com.sa'))
) as map(emp_email, mgr_email)
join profiles m on lower(m.email) = map.mgr_email
where lower(p.email) = map.emp_email;

-- 2) Root of the tree: Mohammed BinMahfoudh reports to no one.
update profiles set manager_id = null where lower(email) = lower('Mohammed.BinMahfoudh@bupa.com.sa');

-- VERIFY (optional): list anyone in FM whose manager_id is still unset
-- (expected: only Mohammed BinMahfoudh).
--   select full_name, email from profiles where manager_id is null order by full_name;
