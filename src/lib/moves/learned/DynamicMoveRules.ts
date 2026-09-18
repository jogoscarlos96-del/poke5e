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

export type ConditionalDiceDamageProfile = {
	kind: "conditional-dice",
	move: "assurance" | "payback" | "gyro-ball" | "venoshock" | "stomping-tantrum" | "snipe-shot",
	label: string,
	multiplier: number,
	note: string,
}

export type HealthTotalDamageProfile = {
	kind: "health-total",
	move: "reversal" | "flail",
	note: string,
}

export type ExtraDiceCountDamageProfile = {
	kind: "extra-dice-count",
	move: "stored-power" | "power-trip" | "last-respects",
	label: string,
	dicePerCount: number,
	maxTotalDice?: number,
	note: string,
}

export type DynamicMoveDamageProfile =
	| ProgressiveDamageProfile
	| RoundSequenceDamageProfile
	| MagnitudeDamageProfile
	| ConditionalDiceDamageProfile
	| HealthTotalDamageProfile
	| ExtraDiceCountDamageProfile

export type MoveDamage = NonNullable<MoveStats["damage"]>

export const MOVE_ROLLER_MOVE_NAME_CONTEXT = Symbol("move-roller-move-name")

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
	assurance: {
		kind: "conditional-dice",
		move: "assurance",
		label: "Target already took damage this round",
		multiplier: 2,
		note: "Assurance doubles its damage dice if the target has already taken damage during the same round.",
	},
	payback: {
		kind: "conditional-dice",
		move: "payback",
		label: "Target damaged the user on the immediately previous turn",
		multiplier: 2,
		note: "Payback doubles only the move's damage dice when this condition is met; MOVE and other flat modifiers are still applied once.",
	},
	"gyro ball": {
		kind: "conditional-dice",
		move: "gyro-ball",
		label: "User DEX is lower than the target's DEX",
		multiplier: 2,
		note: "Gyro Ball doubles the damage dice when the user's DEX score is lower than the target's.",
	},
	venoshock: {
		kind: "conditional-dice",
		move: "venoshock",
		label: "Target is already poisoned",
		multiplier: 2,
		note: "Venoshock doubles the damage dice against a target that is already poisoned.",
	},
	"stomping tantrum": {
		kind: "conditional-dice",
		move: "stomping-tantrum",
		label: "User's last attack missed",
		multiplier: 2,
		note: "Stomping Tantrum doubles its damage dice if the user's previous attack missed.",
	},
	"snipe shot": {
		kind: "conditional-dice",
		move: "snipe-shot",
		label: "This attack was made with advantage",
		multiplier: 2,
		note: "Snipe Shot doubles its damage dice when the attack was made with advantage.",
	},
	reversal: {
		kind: "health-total",
		move: "reversal",
		note: "Reversal doubles total damage below 50% maximum HP and triples total damage at 10% maximum HP or lower. This multiplier is applied before resistances or vulnerabilities.",
	},
	flail: {
		kind: "health-total",
		move: "flail",
		note: "Flail doubles total damage below 50% maximum HP and triples total damage at 10% maximum HP or lower. This multiplier is applied before resistances or vulnerabilities.",
	},
	"stored power": {
		kind: "extra-dice-count",
		move: "stored-power",
		label: "Active stat-changing effects on the user",
		dicePerCount: 1,
		note: "Add one additional damage die for each stat-changing effect currently applied to the user. A single move affecting multiple ability scores counts as one effect.",
	},
	"power trip": {
		kind: "extra-dice-count",
		move: "power-trip",
		label: "Unique stat changes affecting the user",
		dicePerCount: 1,
		note: "Add one additional damage die for each unique stat change currently affecting the user.",
	},
	"last respects": {
		kind: "extra-dice-count",
		move: "last-respects",
		label: "Currently downed allies this combat",
		dicePerCount: 2,
		maxTotalDice: 10,
		note: "Add 2d6 for each currently downed ally this combat, to a maximum of 10 total damage dice.",
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

export const addDamageDice = (expression: string, additionalDice: number, maxTotalDice?: number): string | undefined => {
	const parsed = parseDice(expression)
	if (parsed == null || !Number.isFinite(additionalDice)) return undefined

	const extra = Math.max(0, Math.floor(additionalDice))
	const uncapped = parsed.count + extra
	const count = maxTotalDice == null ? uncapped : Math.min(Math.max(parsed.count, Math.floor(maxTotalDice)), uncapped)
	return `${count}d${parsed.sides}`
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

export const healthTotalMultiplier = (currentHp: number | undefined, maxHp: number | undefined): number => {
	if (currentHp == null || maxHp == null || maxHp <= 0) return 1
	const ratio = Math.max(0, currentHp) / maxHp
	if (ratio <= 0.1) return 3
	if (ratio < 0.5) return 2
	return 1
}

export const resolveDynamicMoveDamage = (
	profile: DynamicMoveDamageProfile | undefined,
	damage: MoveDamage,
	options: {
		stage?: number,
		magnitudeRoll?: number,
		conditionActive?: boolean,
		count?: number,
	} = {},
): MoveDamage | undefined => {
	if (profile == null || profile.kind === "health-total") return damage

	if (profile.kind === "magnitude") {
		if (options.magnitudeRoll == null) return undefined
		const dice = resolveMagnitudeDice(damage.dice, options.magnitudeRoll)
		return dice == null ? undefined : { ...damage, dice }
	}

	if (profile.kind === "conditional-dice") {
		if (!options.conditionActive) return damage
		const dice = scaleDamageDice(damage.dice, profile.multiplier)
		return dice == null ? undefined : { ...damage, dice }
	}

	if (profile.kind === "extra-dice-count") {
		const count = Math.max(0, Math.floor(options.count ?? 0))
		const dice = addDamageDice(damage.dice, count * profile.dicePerCount, profile.maxTotalDice)
		return dice == null ? undefined : { ...damage, dice }
	}

	const stage = Math.max(1, Math.min(profile.multipliers.length, Math.floor(options.stage ?? 1)))
	const multiplier = profile.multipliers[stage - 1]
	const dice = scaleDamageDice(damage.dice, multiplier)
	return dice == null ? undefined : { ...damage, dice }
}
