-- Kornia: harden the upstream read-key / write-key sharing architecture without
-- changing its public RPC contract.

-- Remove an upstream extension-test helper that is not used by the application
-- and should not be exposed in a public deployment.
DROP FUNCTION IF EXISTS public.install_available_extensions_and_test();

-- Prevent untrusted roles from creating shadow objects in API-visible schemas.
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Keep the private schema truly private. The application reaches these tables
-- only through the existing SECURITY DEFINER RPC functions owned by postgres.
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated;

-- Future objects in private inherit the same isolation.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA private
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA private
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA private
  REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- Add defense in depth. postgres owns both the private tables and the
-- SECURITY DEFINER RPCs, so the RPCs retain the intended key-sharing behavior
-- while direct client table access remains blocked.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'private' AND c.relkind = 'r'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.schema_name, r.table_name);
  END LOOP;
END $$;

-- Pin search_path on application functions to trusted schemas only. This
-- removes mutable-search-path risk while preserving existing unqualified
-- helper lookups used by the upstream RPC layer.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    LEFT JOIN pg_depend d ON d.classid = 'pg_proc'::regclass
      AND d.objid = p.oid AND d.deptype = 'e'
    WHERE n.nspname = 'public' AND d.objid IS NULL
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %s SET search_path = pg_catalog, public, private, extensions',
      r.oid::regprocedure
    );
  END LOOP;
END $$;
