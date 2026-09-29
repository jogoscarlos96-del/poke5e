import { supabase } from "$lib/supabase"
import { CampaignCreationAccess } from "$lib/site/CampaignCreationAccess"
import type { PokemonSpecies } from "$lib/poke5e/species"
import { SafariCaptureCode, type SafariCaptureCode as SafariCaptureCodeType } from "./SafariCaptureCode"
import { safariCapturePayload } from "./SafariCapturePayload"
import type { SafariPark, SafariParkData } from "./types"

type SafariParkRow = {
	id: string
	park_data: SafariParkData
	created_at: string
	updated_at: string
}

const fromRow = (row: SafariParkRow): SafariPark => ({
	id: row.id,
	...row.park_data,
	createdAt: row.created_at,
	updatedAt: row.updated_at,
})

async function listParks(): Promise<SafariPark[]> {
	const { data, error } = await supabase.rpc("list_safari_parks").select()
	if (error) throw error
	return ((data ?? []) as SafariParkRow[]).map(fromRow)
}

async function listAllParks(): Promise<SafariPark[]> {
	const managementKey = CampaignCreationAccess.managementKey()
	if (!managementKey) throw new Error("Safari Management is locked.")

	const { data, error } = await supabase.rpc("list_all_safari_parks", {
		_management_key: managementKey,
	}).select()
	if (error) throw error
	return ((data ?? []) as SafariParkRow[]).map(fromRow)
}

async function createPark(park: SafariParkData): Promise<string> {
	const managementKey = CampaignCreationAccess.managementKey()
	if (!managementKey) throw new Error("Safari Management is locked.")

	const { data, error } = await supabase.rpc("new_safari_park", {
		_management_key: managementKey,
		_park_data: park,
	}).single<string>()
	if (error || !data) throw error ?? new Error("Could not create Safari Park.")
	return data
}

async function updatePark(id: string, park: SafariParkData): Promise<boolean> {
	const managementKey = CampaignCreationAccess.managementKey()
	if (!managementKey) throw new Error("Safari Management is locked.")

	const { data, error } = await supabase.rpc("update_safari_park", {
		_management_key: managementKey,
		_id: id,
		_park_data: park,
	}).single<number>()
	if (error) throw error
	return (data ?? 0) > 0
}

async function removePark(id: string): Promise<boolean> {
	const managementKey = CampaignCreationAccess.managementKey()
	if (!managementKey) throw new Error("Safari Management is locked.")

	const { data, error } = await supabase.rpc("remove_safari_park", {
		_management_key: managementKey,
		_id: id,
	}).single<number>()
	if (error) throw error
	return (data ?? 0) > 0
}

async function createCaptureClaim({
	trainerReadKey,
	sessionId,
	species,
}: {
	trainerReadKey: string
	sessionId: string
	species: PokemonSpecies
}): Promise<SafariCaptureCodeType> {
	const { data, error } = await supabase.rpc("new_safari_capture_claim", {
		_trainer_read_key: trainerReadKey,
		_session_id: sessionId,
		_species_id: species.id.data,
		_species_sr: species.sr.data,
		_pokemon_data: safariCapturePayload(species),
	}).single<string>()

	if (error || !data) throw error ?? new Error("Could not create Safari capture claim.")
	return SafariCaptureCode.from(data)
}

async function redeemCapture(writeKey: string, code: SafariCaptureCodeType): Promise<string> {
	const { data, error } = await supabase.rpc("redeem_safari_capture", {
		_trainer_write_key: writeKey,
		_capture_code: SafariCaptureCode.raw(code),
	}).single<number>()

	if (error || data == null) throw error ?? new Error("Safari Capture Code is invalid or has already been redeemed.")
	return data.toString()
}

export const SafariData = {
	listParks,
	listAllParks,
	createPark,
	updatePark,
	removePark,
	createCaptureClaim,
	redeemCapture,
} as const
