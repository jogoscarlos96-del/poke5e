import { expect, test } from "vitest"
import { Level } from "$lib/dnd/level"
import { PokemonType } from "$lib/pokemon/types"
import type { MegaDefinition } from "../MegaDefinition"
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

test("per-Pokemon Mega state stores only the selected reusable definition ID", () => {
	expect(MegaEvolution.empty()).toEqual({ selectedMegaId: null })

	const state: MegaEvolutionState = { selectedMegaId: "mega-x" }
	expect(state).toEqual({ selectedMegaId: "mega-x" })
	expect("forms" in state).toBe(false)
	expect("activeFormId" in state).toBe(false)
})

test("Mega overlays resolve from a reusable definition and apply only while allowed", () => {
	const state: MegaEvolutionState = { selectedMegaId: "mega-x" }
	const definitions: MegaDefinition[] = [{
		id: "mega-x",
		speciesId: "charizard",
		name: "Mega X",
		type: new PokemonType(["fire", "dragon"]),
	}]
	const definition = MegaEvolution.selectedDefinition(state, definitions)
	const pokemon = {
		ac: 15,
		type: new PokemonType(["fire"]),
		abilities: [],
	}

	expect(definition?.id).toBe("mega-x")
	expect(MegaEvolution.effectiveAc(pokemon, definition, true)).toBe(17)
	expect(MegaEvolution.effectiveAc(pokemon, definition, false)).toBe(15)
	expect(MegaEvolution.attributeModifierMultiplier(definition, true)).toBe(2)
	expect(MegaEvolution.attributeModifierMultiplier(definition, false)).toBe(1)
	expect(MegaEvolution.effectiveType(pokemon, definition, true).data).toEqual(["fire", "dragon"])
	expect(MegaEvolution.effectiveType(pokemon, definition, false).data).toEqual(["fire"])
})
