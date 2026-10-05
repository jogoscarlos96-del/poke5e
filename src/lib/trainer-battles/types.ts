import type { Attribute } from "$lib/dnd/attributes"
import type { Trainer, TrainerPokemon } from "$lib/trainers/types"

export type TrainerBattleFormat = "singles" | "doubles"
export type TrainerBattleTeamSize = 3 | 4 | 6
export type TrainerBattleScaling = "keep" | "scale"
export type TrainerBattleSide = "a" | "b"
export type TrainerBattleRole = "player" | "spectator"

export type HexPosition = {
	q: number,
	r: number,
}

export type TrainerBattleSettings = {
	format: TrainerBattleFormat,
	teamSize: TrainerBattleTeamSize,
	scaling: TrainerBattleScaling,
}

export type BattleMoveSnapshot = {
	id: string,
	moveId: string,
	pp: {
		current: number,
		max: number,
	},
	usageCount: number,
	revealed: boolean,
	notes: string,
}

export type BattlePokemonSnapshot = Omit<TrainerPokemon, "moves" | "hp" | "status"> & {
	sourcePokemonId: string,
	hp: {
		current: number,
		max: number,
	},
	moves: BattleMoveSnapshot[],
	status: TrainerPokemon["status"],
	volatileStatuses: string[],
	revealed: boolean,
	fainted: boolean,
	position: HexPosition | null,
	movementRemainingFeet: number,
	activeSlot: number | null,
}

export type BattleTrainerSnapshot = Omit<Trainer, "hp" | "readKey"> & {
	sourceTrainerId: string,
	hp: {
		current: number,
		max: number,
	},
}

export type TrainerBattleParticipant = {
	side: TrainerBattleSide,
	trainer: BattleTrainerSnapshot,
	pokemon: BattlePokemonSnapshot[],
	ready: boolean,
}

export type TrainerBattleSession = {
	id: string,
	joinCode: string,
	spectatorCode: string,
	settings: TrainerBattleSettings,
	participants: Partial<Record<TrainerBattleSide, TrainerBattleParticipant>>,
	status: "lobby" | "active" | "completed",
	turnPokemonId: string | null,
	createdAt: string,
	updatedAt: string,
}

export type TrainerBattleJoinPreview = {
	id: string,
	settings: TrainerBattleSettings,
	hostTrainerName: string,
	occupied: boolean,
	status: "lobby" | "active" | "completed",
	createdAt: string,
	updatedAt: string,
}

export type TrainerBattleOpponentLobby = {
	trainerName: string,
	ready: boolean,
	teamCount: number,
}

export type TrainerBattlePlayerView = {
	id: string,
	settings: TrainerBattleSettings,
	status: "lobby" | "active" | "completed",
	viewerSide: TrainerBattleSide,
	self: TrainerBattleParticipant,
	opponent: TrainerBattleOpponentLobby | null,
	joinCode: string | null,
	spectatorCode: string | null,
	createdAt: string,
	updatedAt: string,
}

export type TrainerBattleSpectatorView = {
	id: string,
	settings: TrainerBattleSettings,
	status: "lobby" | "active" | "completed",
	participants: Partial<Record<TrainerBattleSide, TrainerBattleParticipant>>,
	createdAt: string,
	updatedAt: string,
}

export type PublicOpponentMove = {
	moveId: string,
	usageCount: number,
}

export type PublicOpponentPokemon = {
	id: string,
	nickname: string,
	pokemonId: TrainerPokemon["pokemonId"],
	revealed: boolean,
	fainted: boolean,
	activeSlot: number | null,
	position: HexPosition | null,
	status: TrainerPokemon["status"],
	volatileStatuses: string[],
	moves: PublicOpponentMove[],
}

export type OpponentBattleProjection = {
	pokemon: PublicOpponentPokemon[],
	unrevealedCount: number,
}

export type TrainerBattleScaleContext = {
	actualLevel: number,
	damageTierLevel: number,
}

export type TrainerBattleModifierChoice = {
	id: string,
	label: string,
	attribute?: Attribute,
}
