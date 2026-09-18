import type { MoveStats } from "../MoveStats"

export type ProgressiveDamageProfile = {
	kind: "progressive",
	move: "rollout" | "fury-cutter",
	label: string,
	multipliers: readonly number[],
	note: string,
}

export type RoundSequenceDamageProfile = {
	kind: "round-sequence",
	move: "outrage",
	label: string,
	multipliers: readonly number[],
	note: string,
}

export type MagnitudeDamageProfile = {
	kind: "magnitude",
	move: "magnitude",
	note: string,
}

export type DynamicMoveDamageProfile =
	| ProgressiveDamageProfile
	| RoundSequenceDamageProfile
	| MagnitudeDamageProfile

export type MoveDamage = NonNullable<MoveStats["damage"]>

const normalizeMoveName = (name: string) => name.trim().toLowerCase().replace(/[-\s]+/g, " ")

const PROFILES: Record<string, DynamicMoveDamageProfile> = {
	rollout: {
		kind: "progressive",
		move: "rollout",
		label: "Consecutive successful hit",
		multipliers: [1, 2, 4, 8, 16],
		note: "Choose the current consecutive successful hit. Reset to hit 1 if an attack fails to damage a creature, your speed is reduced to 0, or you are incapacitated.",
	},
	"fury cutter": {
		kind: "progressive",
		move: "fury-cutter",
		label: "Consecutive successful hit",
		multipliers: [1, 2, 4, 8],
		note: "Choose the current consecutive successful hit. Reset to hit 1 if an attack misses or you are incapacitated.",
	},
	outrage: {
		kind: "round-sequence",
		move: "outrage",
		label: "Outrage round",
		multipliers: [1, 2, 4],
		note: "Outrage automatically hits for three rounds while concentration continues. PP is spent on activation only; rounds 2 and 3 continue here without spending PP again. If the move ends early, close the roller. When Outrage ends, remember to resolve Confused.",
	},
	magnitude: {
		kind: "magnitude",
		move: "magnitude",
		note: "Roll d100 to determine the base damage dice. The move's level multiplier is then applied automatically. Raised creatures are immune; burrowed creatures and creatures in Dig's invulnerable stage take double damage. A successful save takes half damage.",
	},
}

export const getDynamicMoveDamageProfile = (moveName: string): DynamicMoveDamageProfile | undefined =>
	PROFILES[normalizeMoveName(moveName)]

const parseDice = (expression: string): { count: number, sides: number } | undefined => {
	const normal = expression.trim().match(/^(\d+)d(\d+)$/i)
	if (normal != null) {
		const count = Number.parseInt(normal[1], 10)
		const sides = Number.parseInt(normal[2], 10)
		if (count > 0 && sides > 0) return { count, sides }
	}

	const repeated = expression.trim().match(/^Rd(\d+)$/i)
	if (repeated != null) {
		const sides = Number.parseInt(repeated[1], 10)
		if (sides > 0) return { count: 1, sides }
	}

	return undefined
}

export const scaleDamageDice = (expression: string, multiplier: number): string | undefined => {
	const parsed = parseDice(expression)
	if (parsed == null || !Number.isFinite(multiplier) || multiplier <= 0) return undefined
	return `${parsed.count * Math.floor(multiplier)}d${parsed.sides}`
}

export const magnitudeBaseDice = (roll: number): string | undefined => {
	const value = Math.floor(roll)
	if (value < 1 || value > 100) return undefined
	if (value <= 5) return "1d4"
	if (value <= 15) return "1d8"
	if (value <= 35) return "1d10"
	if (value <= 65) return "1d12"
	if (value <= 85) return "2d6"
	if (value <= 95) return "2d8"
	return "2d12"
}

export const magnitudeLevelMultiplier = (expression: string): number | undefined => {
	const normalized = expression.trim().toLowerCase()
	if (normalized === "dice") return 1

	const match = normalized.match(/^(\d+)\s*[×x]\s*dice$/i)
	if (match == null) return undefined

	const multiplier = Number.parseInt(match[1], 10)
	return multiplier > 0 ? multiplier : undefined
}

export const resolveMagnitudeDice = (expression: string, roll: number): string | undefined => {
	const baseDice = magnitudeBaseDice(roll)
	const multiplier = magnitudeLevelMultiplier(expression)
	if (baseDice == null || multiplier == null) return undefined
	return scaleDamageDice(baseDice, multiplier)
}

export const resolveDynamicMoveDamage = (
	profile: DynamicMoveDamageProfile | undefined,
	damage: MoveDamage,
	options: {
		stage?: number,
		magnitudeRoll?: number,
	} = {},
): MoveDamage | undefined => {
	if (profile == null) return damage

	if (profile.kind === "magnitude") {
		if (options.magnitudeRoll == null) return undefined
		const dice = resolveMagnitudeDice(damage.dice, options.magnitudeRoll)
		return dice == null ? undefined : { ...damage, dice }
	}

	const stage = Math.max(1, Math.min(profile.multipliers.length, Math.floor(options.stage ?? 1)))
	const multiplier = profile.multipliers[stage - 1]
	const dice = scaleDamageDice(damage.dice, multiplier)
	return dice == null ? undefined : { ...damage, dice }
}
