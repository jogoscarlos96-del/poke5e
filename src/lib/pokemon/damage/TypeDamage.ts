import { defensiveMultipliers } from "@auroratide/pokemon-types"
import type { PokeType, PokemonType } from "$lib/pokemon/types"

export type TypeEffectivenessTier =
	| "double-resistance"
	| "resistance"
	| "neutral"
	| "weakness"
	| "double-weakness"
	| "immunity"

export type DamageSpecialRule =
	| "automatic"
	| "neutral"
	| "effectiveness-up"
	| "resistance-up"

export type TypeDamageInput = {
	incomingDamage: number
	attackType: PokeType
	defenderType: PokemonType
	defenderProficiencyBonus: number
	specialRule?: DamageSpecialRule
}

export type TypeDamageResult = {
	baseEffectiveness: TypeEffectivenessTier
	effectiveness: TypeEffectivenessTier
	finalDamage: number
}

const EFFECTIVENESS_LADDER: Exclude<TypeEffectivenessTier, "immunity">[] = [
	"double-resistance",
	"resistance",
	"neutral",
	"weakness",
	"double-weakness",
]

export const baseTypeEffectiveness = (
	attackType: PokeType,
	defenderType: PokemonType,
): TypeEffectivenessTier => {
	const multiplier = defensiveMultipliers(defenderType.data)[attackType]

	if (multiplier === 0) return "immunity"
	if (multiplier >= 4) return "double-weakness"
	if (multiplier > 1) return "weakness"
	if (multiplier === 1) return "neutral"
	if (multiplier <= 0.25) return "double-resistance"
	return "resistance"
}

export const applyDamageSpecialRule = (
	effectiveness: TypeEffectivenessTier,
	rule: DamageSpecialRule,
): TypeEffectivenessTier => {
	if (rule === "neutral") return "neutral"
	if (rule === "automatic" || effectiveness === "immunity") return effectiveness

	const index = EFFECTIVENESS_LADDER.indexOf(effectiveness)
	const shift = rule === "effectiveness-up" ? 1 : -1
	const shiftedIndex = Math.min(
		EFFECTIVENESS_LADDER.length - 1,
		Math.max(0, index + shift),
	)

	return EFFECTIVENESS_LADDER[shiftedIndex]
}

export const damageForEffectiveness = (
	incomingDamage: number,
	effectiveness: TypeEffectivenessTier,
	defenderProficiencyBonus: number,
): number => {
	if (effectiveness === "immunity") return 0
	if (incomingDamage <= 0) return 0

	let calculatedDamage: number
	switch (effectiveness) {
		case "double-resistance":
			calculatedDamage = incomingDamage - 2 * defenderProficiencyBonus
			break
		case "resistance":
			calculatedDamage = incomingDamage - defenderProficiencyBonus
			break
		case "neutral":
			calculatedDamage = incomingDamage
			break
		case "weakness":
			calculatedDamage = incomingDamage * 1.5
			break
		case "double-weakness":
			calculatedDamage = incomingDamage * 2
			break
	}

	return Math.max(1, Math.floor(calculatedDamage))
}

export const calculateTypeDamage = ({
	incomingDamage,
	attackType,
	defenderType,
	defenderProficiencyBonus,
	specialRule = "automatic",
}: TypeDamageInput): TypeDamageResult => {
	const baseEffectiveness = baseTypeEffectiveness(attackType, defenderType)
	const effectiveness = applyDamageSpecialRule(baseEffectiveness, specialRule)

	return {
		baseEffectiveness,
		effectiveness,
		finalDamage: damageForEffectiveness(
			incomingDamage,
			effectiveness,
			defenderProficiencyBonus,
		),
	}
}
