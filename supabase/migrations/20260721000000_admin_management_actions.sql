-- Admin management: track suspension status alongside Supabase Auth's
-- own ban mechanism (auth.users.banned_until), which is what actually
-- blocks a suspended user from logging in. This column exists purely so
-- the admin UI can display/filter suspension status through the normal
-- RLS-scoped profiles query, without needing a privileged admin-only
-- fetch just to render a badge.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false;
