export const DIE_SIZES = [4, 6, 8, 10, 12, 20, 100] as const

export type DieSize = typeof DIE_SIZES[number]
export type DiceRollMode = "normal" | "advantage" | "disadvantage"

export type DiceRollInput = {
	count: number
	sides: DieSize
	modifier?: number
	mode?: DiceRollMode
}

export type DiceRollResult = {
	rolls: number[]
	keptRolls: number[]
	subtotal: number
	modifier: number
	total: number
	mode: DiceRollMode
}

export type RandomSource = () => number

const rollSingleDie = (sides: DieSize, random: RandomSource): number =>
	Math.floor(random() * sides) + 1

export function rollDice(input: DiceRollInput, random: RandomSource = Math.random): DiceRollResult {
	const count = Math.floor(input.count)
	const modifier = Math.trunc(input.modifier ?? 0)
	const mode = input.mode ?? "normal"

	if (!Number.isFinite(count) || count < 1 || count > 20) {
		throw new Error("Dice count must be between 1 and 20.")
	}

	if (!DIE_SIZES.includes(input.sides)) {
		throw new Error("Unsupported die size.")
	}

	if (!Number.isFinite(modifier)) {
		throw new Error("Modifier must be a finite number.")
	}

	if (mode !== "normal" && (input.sides !== 20 || count !== 1)) {
		throw new Error("Advantage and disadvantage are only available for a single d20.")
	}

	const rolls = mode === "normal"
		? Array.from({ length: count }, () => rollSingleDie(input.sides, random))
		: [rollSingleDie(20, random), rollSingleDie(20, random)]

	const keptRolls = mode === "advantage"
		? [Math.max(...rolls)]
		: mode === "disadvantage"
			? [Math.min(...rolls)]
			: [...rolls]

	const subtotal = keptRolls.reduce((sum, value) => sum + value, 0)

	return {
		rolls,
		keptRolls,
		subtotal,
		modifier,
		total: subtotal + modifier,
		mode,
	}
}
