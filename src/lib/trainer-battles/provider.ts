import { supabase } from "$lib/supabase"
import type { Attribute } from "$lib/dnd/attributes"
import type {
	HexPosition,
	TrainerBattleJoinPreview,
	TrainerBattleMoveResult,
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

export type UseTrainerBattleMoveInput = {
	pokemonId: string,
	moveSnapshotId: string,
	moveName: string,
	targetPokemonId: string | null,
	timeUnit: TrainerBattleMoveResult["timeUnit"],
	attackBonus: number | null,
	saveDc: number | null,
	saveAttributes: Attribute[],
	damageDice: string | null,
	damageModifier: number,
	isHealing: boolean,
	rangeFeet: number | null,
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

async function resume(code: string): Promise<JoinedTrainerBattle> {
	const { data, error } = await supabase.rpc("resume_trainer_battle", {
		_join_code: normalizeCode(code),
	}).single<JoinedRow>()

	if (error || data == null) throw new Error(error?.message ?? "Could not resume Trainer Battle.")
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

async function setReady(accessKey: string, pokemonIds: string[]): Promise<void> {
	const { error } = await supabase.rpc("set_trainer_battle_ready", {
		_access_key: accessKey,
		_pokemon_ids: pokemonIds,
	})
	if (error) throw new Error(error.message)
}

async function clearReady(accessKey: string): Promise<void> {
	const { error } = await supabase.rpc("clear_trainer_battle_ready", {
		_access_key: accessKey,
	})
	if (error) throw new Error(error.message)
}

async function start(accessKey: string): Promise<void> {
	const { error } = await supabase.rpc("start_trainer_battle", {
		_access_key: accessKey,
	})
	if (error) throw new Error(error.message)
}

async function rollInitiative(accessKey: string, pokemonId: string, useAlert: boolean, otherModifier: number): Promise<void> {
	const { error } = await supabase.rpc("roll_trainer_battle_initiative", {
		_access_key: accessKey,
		_pokemon_id: pokemonId,
		_use_alert: useAlert,
		_other_modifier: otherModifier,
	})
	if (error) throw new Error(error.message)
}

async function movePokemon(accessKey: string, pokemonId: string, position: HexPosition): Promise<void> {
	const { error } = await supabase.rpc("move_trainer_battle_pokemon", {
		_access_key: accessKey,
		_pokemon_id: pokemonId,
		_q: position.q,
		_r: position.r,
	})
	if (error) throw new Error(error.message)
}

async function useMove(accessKey: string, input: UseTrainerBattleMoveInput): Promise<TrainerBattleMoveResult> {
	const { data, error } = await supabase.rpc("use_trainer_battle_move", {
		_access_key: accessKey,
		_pokemon_id: input.pokemonId,
		_move_snapshot_id: input.moveSnapshotId,
		_move_name: input.moveName,
		_target_pokemon_id: input.targetPokemonId,
		_time_unit: input.timeUnit,
		_attack_bonus: input.attackBonus,
		_save_dc: input.saveDc,
		_save_attributes: input.saveAttributes,
		_damage_dice: input.damageDice,
		_damage_modifier: input.damageModifier,
		_is_healing: input.isHealing,
		_range_feet: input.rangeFeet,
	})
	if (error || data == null) throw new Error(error?.message ?? "Could not use that move.")
	return data as TrainerBattleMoveResult
}

async function applyLastDamage(accessKey: string, amount: number): Promise<void> {
	const { error } = await supabase.rpc("apply_trainer_battle_last_damage", {
		_access_key: accessKey,
		_amount: amount,
	})
	if (error) throw new Error(error.message)
}

async function endTurn(accessKey: string): Promise<void> {
	const { error } = await supabase.rpc("end_trainer_battle_turn", {
		_access_key: accessKey,
	})
	if (error) throw new Error(error.message)
}

async function leave(accessKey: string): Promise<void> {
	const { error } = await supabase.rpc("leave_trainer_battle", {
		_access_key: accessKey,
	})
	if (error) throw new Error(error.message)
}

const accessStorageKey = (battleId: string) => `trainer-battle:${battleId}:access`
const currentBattleStorageKey = "trainer-battle:current"

const storeAccessKey = (battleId: string, accessKey: string): void => {
	localStorage.setItem(accessStorageKey(battleId), accessKey)
	localStorage.setItem(currentBattleStorageKey, battleId)
}

const getStoredAccessKey = (battleId: string): string | null => {
	return localStorage.getItem(accessStorageKey(battleId))
}

const getCurrentStoredBattle = (): { battleId: string, accessKey: string } | null => {
	const battleId = localStorage.getItem(currentBattleStorageKey)
	if (!battleId) return null
	const accessKey = getStoredAccessKey(battleId)
	if (!accessKey) {
		localStorage.removeItem(currentBattleStorageKey)
		return null
	}
	return { battleId, accessKey }
}

const clearAccessKey = (battleId: string): void => {
	localStorage.removeItem(accessStorageKey(battleId))
	if (localStorage.getItem(currentBattleStorageKey) === battleId) localStorage.removeItem(currentBattleStorageKey)
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
	resume,
	getPlayer,
	getSpectator,
	setReady,
	clearReady,
	start,
	rollInitiative,
	movePokemon,
	useMove,
	applyLastDamage,
	endTurn,
	leave,
	leaveStoredBattle,
	storeAccessKey,
	getStoredAccessKey,
	getCurrentStoredBattle,
	clearAccessKey,
	normalizeCode,
} as const
