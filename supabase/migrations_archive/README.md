# Archived migrations

History only. The Supabase CLI reads `supabase/migrations/` and never runs
anything here.

These are the 44 migrations from before 2026-10-09, when they were replaced
by one baseline, `supabase/migrations/20261009000000_baseline.sql`. Keep them
for the reasoning in their comments (why a column, policy or function is the
way it is), not as a way to build a database:

- **`001`–`009` are not what production ran.** They're a later rewrite; production's
  own `001`–`009` (`schema`, `rls`, `search`, …) were different files. Those
  are in `production_001-009/`, fetched from production's history table
  (`supabase migration fetch`) before it was repaired; it was their only copy.
- **Production was also changed outside migrations**, e.g. `items.linked_people_ids`
  came from no migration. A fresh replay of these files failed partway
  whichever `001`–`009` were used.
- **`20260820000000` was run by hand**, so production's history row for it was empty.
  Its effects are in production and in the baseline.

When the baseline was made, production's migration history was repaired to
list only the baseline (`supabase migration repair`), and a fresh
`supabase db reset` from it was diffed against production with no
differences: the `public` schema, function grants, RLS, the auth trigger, the
Realtime tables and the cron jobs.
