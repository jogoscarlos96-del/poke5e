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

export function hexDistance(from: HexPosition, to: HexPosition): number {
	const ds = (-from.q - from.r) - (-to.q - to.r)
	return Math.max(Math.abs(from.q - to.q), Math.abs(from.r - to.r), Math.abs(ds))
}

export function movementDistanceFeet(from: HexPosition, to: HexPosition): number {
	return hexDistance(from, to) * TRAINER_BATTLE_HEX_FEET
}

export function isInsideArena(position: HexPosition): boolean {
	return position.q >= 0 && position.q < TRAINER_BATTLE_ARENA_COLUMNS && position.r >= 0 && position.r < TRAINER_BATTLE_ARENA_ROWS
}
