import { supabase } from "$lib/supabase"
import type {
	TrainerBattleJoinPreview,
	TrainerBattleParticipant,
	TrainerBattlePlayerView,
	TrainerBattleSettings,
	TrainerBattleSpectatorView,
} from "./types"

export type CreatedTrainerBattle = {
	id: string,
	joinCode: string,
	spectatorCode: string,
	accessKey: string,
}

export type JoinedTrainerBattle = {
	id: string,
	accessKey: string,
}

type CreatedRow = {
	id: string,
	join_code: string,
	spectator_code: string,
	access_key: string,
}

type JoinedRow = {
	id: string,
	access_key: string,
}

const normalizeCode = (code: string): string => code.trim().toUpperCase()
const serialize = <T>(value: T): unknown => JSON.parse(JSON.stringify(value))

async function create(settings: TrainerBattleSettings, participant: TrainerBattleParticipant): Promise<CreatedTrainerBattle> {
	const { data, error } = await supabase.rpc("new_trainer_battle", {
		_settings: settings,
		_host_participant: serialize(participant),
	}).single<CreatedRow>()

	if (error || data == null) throw new Error(error?.message ?? "Could not create Trainer Battle.")

	return {
		id: data.id,
		joinCode: data.join_code,
		spectatorCode: data.spectator_code,
		accessKey: data.access_key,
	}
}

async function getJoinPreview(code: string): Promise<TrainerBattleJoinPreview | null> {
	const { data, error } = await supabase.rpc("get_trainer_battle_join", {
		_join_code: normalizeCode(code),
	})
	if (error) throw new Error(error.message)
	return data as TrainerBattleJoinPreview | null
}

async function join(code: string, participant: TrainerBattleParticipant): Promise<JoinedTrainerBattle> {
	const { data, error } = await supabase.rpc("join_trainer_battle", {
		_join_code: normalizeCode(code),
		_participant: serialize(participant),
	}).single<JoinedRow>()

	if (error || data == null) throw new Error(error?.message ?? "Could not join Trainer Battle.")
	return { id: data.id, accessKey: data.access_key }
}

async function getPlayer(accessKey: string): Promise<TrainerBattlePlayerView | null> {
	const { data, error } = await supabase.rpc("get_trainer_battle_player", {
		_access_key: accessKey,
	})
	if (error) throw new Error(error.message)
	return data as TrainerBattlePlayerView | null
}

async function getSpectator(code: string): Promise<TrainerBattleSpectatorView | null> {
	const { data, error } = await supabase.rpc("get_trainer_battle_spectator", {
		_spectator_code: normalizeCode(code),
	})
	if (error) throw new Error(error.message)
	return data as TrainerBattleSpectatorView | null
}

async function leave(accessKey: string): Promise<void> {
	const { error } = await supabase.rpc("leave_trainer_battle", {
		_access_key: accessKey,
	})
	if (error) throw new Error(error.message)
}

const accessStorageKey = (battleId: string) => `trainer-battle:${battleId}:access`

const storeAccessKey = (battleId: string, accessKey: string): void => {
	localStorage.setItem(accessStorageKey(battleId), accessKey)
}

const getStoredAccessKey = (battleId: string): string | null => {
	return localStorage.getItem(accessStorageKey(battleId))
}

const clearAccessKey = (battleId: string): void => {
	localStorage.removeItem(accessStorageKey(battleId))
}

async function leaveStoredBattle(battleId: string): Promise<void> {
	const accessKey = getStoredAccessKey(battleId)
	if (accessKey == null) return

	try {
		await leave(accessKey)
	} finally {
		clearAccessKey(battleId)
	}
}

export const TrainerBattleProvider = {
	create,
	getJoinPreview,
	join,
	getPlayer,
	getSpectator,
	leave,
	leaveStoredBattle,
	storeAccessKey,
	getStoredAccessKey,
	clearAccessKey,
	normalizeCode,
} as const
