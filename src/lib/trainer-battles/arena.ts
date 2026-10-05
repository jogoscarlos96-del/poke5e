import type { TrainerPokemon } from "$lib/trainers/types"
import type { HexPosition, TrainerBattleFormat, TrainerBattleSide } from "./types"

export const TRAINER_BATTLE_HEX_FEET = 5
export const TRAINER_BATTLE_ARENA_WIDTH_FEET = 80
export const TRAINER_BATTLE_ARENA_HEIGHT_FEET = 50
export const TRAINER_BATTLE_ARENA_COLUMNS = TRAINER_BATTLE_ARENA_WIDTH_FEET / TRAINER_BATTLE_HEX_FEET
export const TRAINER_BATTLE_ARENA_ROWS = TRAINER_BATTLE_ARENA_HEIGHT_FEET / TRAINER_BATTLE_HEX_FEET

const spawnColumn = {
	a: 2,
	b: TRAINER_BATTLE_ARENA_COLUMNS - 3,
} satisfies Record<TrainerBattleSide, number>

const singlesSpawn: Record<TrainerBattleSide, HexPosition[]> = {
	a: [{ q: spawnColumn.a, r: 4 }],
	b: [{ q: spawnColumn.b, r: 4 }],
}

const doublesSpawn: Record<TrainerBattleSide, HexPosition[]> = {
	a: [{ q: spawnColumn.a, r: 3 }, { q: spawnColumn.a, r: 6 }],
	b: [{ q: spawnColumn.b, r: 3 }, { q: spawnColumn.b, r: 6 }],
}

export function spawnPositions(format: TrainerBattleFormat, side: TrainerBattleSide): HexPosition[] {
	return format === "singles" ? singlesSpawn[side] : doublesSpawn[side]
}

function oddQToCube(position: HexPosition): { x: number, y: number, z: number } {
	const x = position.q
	const z = position.r - Math.floor((position.q - (position.q & 1)) / 2)
	const y = -x - z
	return { x, y, z }
}

export function hexDistance(from: HexPosition, to: HexPosition): number {
	const a = oddQToCube(from)
	const b = oddQToCube(to)
	return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z))
}

export function movementDistanceFeet(from: HexPosition, to: HexPosition): number {
	return hexDistance(from, to) * TRAINER_BATTLE_HEX_FEET
}

export function isInsideArena(position: HexPosition): boolean {
	return position.q >= 0 && position.q < TRAINER_BATTLE_ARENA_COLUMNS && position.r >= 0 && position.r < TRAINER_BATTLE_ARENA_ROWS
}

export function allArenaPositions(): HexPosition[] {
	return Array.from({ length: TRAINER_BATTLE_ARENA_COLUMNS * TRAINER_BATTLE_ARENA_ROWS }, (_, index) => ({
		q: index % TRAINER_BATTLE_ARENA_COLUMNS,
		r: Math.floor(index / TRAINER_BATTLE_ARENA_COLUMNS),
	}))
}

export function battleMovementSpeedFeet(pokemon: Pick<TrainerPokemon, "speeds">): number {
	const values = Object.values(pokemon.speeds.data).filter((value): value is number => typeof value === "number" && value > 0)
	return values.length === 0 ? 0 : Math.max(...values)
}
