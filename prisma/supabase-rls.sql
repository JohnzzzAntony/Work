-- Supabase exposes the public schema through its Data API (PostgREST) to anyone
-- holding the publishable key. This app only talks to Postgres through Prisma
-- (as the postgres role, which bypasses RLS), so enable RLS with no policies on
-- every public table: the Data API sees nothing, Prisma is unaffected.
-- Idempotent; re-run after every schema push so new tables are covered.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
