import { SupabaseFakemonDataProvider } from "$lib/fakemon/data/SupabaseFakemonDataProvider"
import { UserAssets } from "$lib/site/user-assets"
import { SupabaseTrainerProvider } from "$lib/trainers/data/supabase"
import { createClient } from "@supabase/supabase-js"

// The original Poke5e site is a public browser application. These values are
// its public client configuration, published by the official deployment in
// /_app/env.js. The anon key is intentionally public and only grants the same
// RPC access available to a normal visitor of poke5e.app.
const LEGACY_POKE5E_SUPABASE_URL = "https://api.poke5e.app"
const LEGACY_POKE5E_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvZ25jYmpqZm1udmJmcmpkeG1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE2Njk1ODY2MzEsImV4cCI6MTk4NTE2MjYzMX0.RXw9pfN-4qOR2AbqPoM6GMzjDGRwYnClF9LEiI2VE5k"
const LEGACY_POKE5E_USER_ASSETS_BASE_URL = "https://poke5e.auroratide.cloud"

export function createLegacyPoke5eProviders() {
	const supabase = createClient(LEGACY_POKE5E_SUPABASE_URL, LEGACY_POKE5E_SUPABASE_ANON_KEY)
	const userAssets = new UserAssets(LEGACY_POKE5E_USER_ASSETS_BASE_URL)

	return {
		trainers: new SupabaseTrainerProvider(supabase, userAssets),
		fakemon: new SupabaseFakemonDataProvider(supabase, userAssets),
	}
}
