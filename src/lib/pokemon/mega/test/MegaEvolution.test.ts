import { expect, test } from "vitest"
import { Level } from "$lib/dnd/level"
import { PokemonType } from "$lib/pokemon/types"
import { MegaEvolution, MEGALITE_STONE_ID, type MegaEvolutionState } from "../MegaEvolution"

const eligiblePokemon = () => ({
	level: new Level(10),
	items: [{ id: "mega-stone", type: "standard" as const, itemId: MEGALITE_STONE_ID }],
})

test("Mega eligibility requires level, final stage, and Megalite Stone", () => {
	expect(MegaEvolution.eligibility(eligiblePokemon(), true)).toEqual({ eligible: true })

	expect(MegaEvolution.eligibility({ ...eligiblePokemon(), level: new Level(9) }, true).eligible).toBe(false)
	expect(MegaEvolution.eligibility(eligiblePokemon(), false).eligible).toBe(false)
	expect(MegaEvolution.eligibility({ level: new Level(10), items: [] }, true).eligible).toBe(false)
})

test("Mega overlays apply only while the form is active and allowed", () => {
	const state: MegaEvolutionState = {
		forms: [{
			id: "mega-x",
			name: "Mega X",
			type: new PokemonType(["fire", "dragon"]),
		}],
		activeFormId: "mega-x",
	}
	const pokemon = {
		ac: 15,
		type: new PokemonType(["fire"]),
		abilities: [],
	}

	expect(MegaEvolution.effectiveAc(pokemon, state, true)).toBe(17)
	expect(MegaEvolution.effectiveAc(pokemon, state, false)).toBe(15)
	expect(MegaEvolution.attributeModifierMultiplier(state, true)).toBe(2)
	expect(MegaEvolution.attributeModifierMultiplier(state, false)).toBe(1)
	expect(MegaEvolution.effectiveType(pokemon, state, true).data).toEqual(["fire", "dragon"])
	expect(MegaEvolution.effectiveType(pokemon, state, false).data).toEqual(["fire"])
})
