import { expect, test } from "vitest"
import { PokemonType } from "$lib/pokemon/types"
import {
	applyDamageSpecialRule,
	baseTypeEffectiveness,
	calculateTypeDamage,
	damageForEffectiveness,
} from "../TypeDamage"

test("standard Pokemon type matchups map to Kornia effectiveness tiers", () => {
	expect(baseTypeEffectiveness("grass", new PokemonType(["water", "ground"]))).toBe("double-weakness")
	expect(baseTypeEffectiveness("grass", new PokemonType(["water"]))).toBe("weakness")
	expect(baseTypeEffectiveness("fire", new PokemonType(["normal"]))).toBe("neutral")
	expect(baseTypeEffectiveness("fire", new PokemonType(["water"]))).toBe("resistance")
	expect(baseTypeEffectiveness("fire", new PokemonType(["water", "dragon"]))).toBe("double-resistance")
	expect(baseTypeEffectiveness("electric", new PokemonType(["ground"]))).toBe("immunity")
})

test("special rules move exactly one tier and respect hard caps", () => {
	expect(applyDamageSpecialRule("double-resistance", "effectiveness-up")).toBe("resistance")
	expect(applyDamageSpecialRule("resistance", "effectiveness-up")).toBe("neutral")
	expect(applyDamageSpecialRule("neutral", "effectiveness-up")).toBe("weakness")
	expect(applyDamageSpecialRule("weakness", "effectiveness-up")).toBe("double-weakness")
	expect(applyDamageSpecialRule("double-weakness", "effectiveness-up")).toBe("double-weakness")

	expect(applyDamageSpecialRule("double-weakness", "resistance-up")).toBe("weakness")
	expect(applyDamageSpecialRule("weakness", "resistance-up")).toBe("neutral")
	expect(applyDamageSpecialRule("neutral", "resistance-up")).toBe("resistance")
	expect(applyDamageSpecialRule("resistance", "resistance-up")).toBe("double-resistance")
	expect(applyDamageSpecialRule("double-resistance", "resistance-up")).toBe("double-resistance")
})

test("immunity stays outside the tier ladder unless Neutral is explicitly selected", () => {
	expect(applyDamageSpecialRule("immunity", "automatic")).toBe("immunity")
	expect(applyDamageSpecialRule("immunity", "effectiveness-up")).toBe("immunity")
	expect(applyDamageSpecialRule("immunity", "resistance-up")).toBe("immunity")
	expect(applyDamageSpecialRule("immunity", "neutral")).toBe("neutral")
})

test("Kornia damage formulas use defender PB, round down, and enforce minimum damage", () => {
	expect(damageForEffectiveness(40, "double-resistance", 6)).toBe(28)
	expect(damageForEffectiveness(40, "resistance", 6)).toBe(34)
	expect(damageForEffectiveness(40, "neutral", 6)).toBe(40)
	expect(damageForEffectiveness(41, "weakness", 6)).toBe(61)
	expect(damageForEffectiveness(40, "double-weakness", 6)).toBe(80)
	expect(damageForEffectiveness(40, "immunity", 6)).toBe(0)
	expect(damageForEffectiveness(5, "resistance", 6)).toBe(1)
	expect(damageForEffectiveness(5, "double-resistance", 6)).toBe(1)
})

test("full calculation detects double weakness and applies overrides", () => {
	const swampertType = new PokemonType(["water", "ground"])

	expect(calculateTypeDamage({
		incomingDamage: 40,
		attackType: "grass",
		defenderType: swampertType,
		defenderProficiencyBonus: 4,
	})).toEqual({
		baseEffectiveness: "double-weakness",
		effectiveness: "double-weakness",
		finalDamage: 80,
	})

	expect(calculateTypeDamage({
		incomingDamage: 40,
		attackType: "grass",
		defenderType: swampertType,
		defenderProficiencyBonus: 4,
		specialRule: "resistance-up",
	}).finalDamage).toBe(60)
})

test("Neutral can deliberately bypass a normal type immunity", () => {
	const groundType = new PokemonType(["ground"])

	expect(calculateTypeDamage({
		incomingDamage: 40,
		attackType: "electric",
		defenderType: groundType,
		defenderProficiencyBonus: 4,
		specialRule: "neutral",
	})).toEqual({
		baseEffectiveness: "immunity",
		effectiveness: "neutral",
		finalDamage: 40,
	})
})
