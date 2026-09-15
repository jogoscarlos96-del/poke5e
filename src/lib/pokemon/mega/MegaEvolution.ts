import { Ability } from "$lib/pokemon/ability"
import { PokemonType } from "$lib/pokemon/types"
import type { TrainerPokemon } from "$lib/trainers/types"
import type { MegaDefinition } from "./MegaDefinition"

export type MegaEvolutionState = {
	selectedMegaId?: string | null,
}

export type MegaEligibility = {
	eligible: boolean,
	reason?: string,
}

export const MEGALITE_STONE_ID = "megalite-stone"

export const MegaEvolution = {
	empty: (): MegaEvolutionState => ({ selectedMegaId: null }),

	selectedDefinition: (state: MegaEvolutionState, definitions: MegaDefinition[]): MegaDefinition | undefined =>
		definitions.find((definition) => definition.id === state.selectedMegaId),

	activeDefinition: (state: MegaEvolutionState, definitions: MegaDefinition[], allowed = true): MegaDefinition | undefined =>
		allowed ? MegaEvolution.selectedDefinition(state, definitions) : undefined,

	isActive: (definition: MegaDefinition | undefined, allowed = true): boolean =>
		definition != null && allowed,

	hasMegaliteStone: (pokemon: Pick<TrainerPokemon, "items">): boolean =>
		pokemon.items.some((item) => item.type === "standard" && item.itemId === MEGALITE_STONE_ID),

	eligibility: (
		pokemon: Pick<TrainerPokemon, "items" | "level">,
		isFinalEvolution: boolean,
		evolutionDataReady = true,
	): MegaEligibility => {
		if (pokemon.level.data < 10) {
			return { eligible: false, reason: "Mega Evolution requires level 10 or higher." }
		}
		if (!evolutionDataReady) {
			return { eligible: false, reason: "Checking evolution eligibility…" }
		}
		if (!isFinalEvolution) {
			return { eligible: false, reason: "Mega Evolution requires a final-stage Pokémon." }
		}
		if (!MegaEvolution.hasMegaliteStone(pokemon)) {
			return { eligible: false, reason: "This Pokémon must hold a Megalite Stone." }
		}
		return { eligible: true }
	},

	effectiveType: (pokemon: Pick<TrainerPokemon, "type">, definition: MegaDefinition | undefined, allowed = true): PokemonType =>
		allowed ? definition?.type ?? pokemon.type : pokemon.type,

	effectiveAbilities: (pokemon: Pick<TrainerPokemon, "abilities">, definition: MegaDefinition | undefined, allowed = true): Ability[] => {
		const megaAbility = allowed ? definition?.ability : undefined
		return megaAbility ? [megaAbility] : pokemon.abilities
	},

	effectiveAc: (pokemon: Pick<TrainerPokemon, "ac">, definition: MegaDefinition | undefined, allowed = true): number =>
		pokemon.ac + (MegaEvolution.isActive(definition, allowed) ? 2 : 0),

	attributeModifierMultiplier: (definition: MegaDefinition | undefined, allowed = true): number =>
		MegaEvolution.isActive(definition, allowed) ? 2 : 1,
}
