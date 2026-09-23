-- rename_category ran as SECURITY DEFINER, bypassing RLS, yet every write it
-- makes is already scoped to auth.uid() and allowed by the owner policies on
-- user_settings and items (authenticated holds UPDATE on both). Running as the
-- caller keeps RLS in force and clears advisor lint 0029.
alter function public.rename_category(text, text, text, text) security invoker;

-- Advisor lint 0011: a role-mutable search_path. NOTIFY needs no schema.
alter function public.pgrst_watch() set search_path = '';
