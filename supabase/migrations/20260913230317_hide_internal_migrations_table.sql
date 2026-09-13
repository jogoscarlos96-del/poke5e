-- public.migrations is internal bookkeeping and is not used by the Poke5e
-- client. Keep it out of anonymous/authenticated REST and GraphQL access.
REVOKE ALL ON TABLE public.migrations FROM PUBLIC, anon, authenticated;
