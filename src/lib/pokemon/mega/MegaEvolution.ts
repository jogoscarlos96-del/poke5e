import { Ability } from "$lib/pokemon/ability"
import { PokemonType, type PokeType } from "$lib/pokemon/types"
import type { TrainerPokemon } from "$lib/trainers/types"

export type MegaForm = {
	id: string,
	name: string,
	type?: PokemonType,
	ability?: Ability,
	imageUrl?: string,
}

export type MegaEvolutionState = {
	forms: MegaForm[],
	activeFormId?: string | null,
}

export type StoredMegaForm = {
	id: string,
	name: string,
	type?: PokeType[],
	ability?: {
		referenceId: string,
	},
	imageUrl?: string,
}

export const MEGALITE_STONE_ID = "megalite-stone"

const makeId = () => globalThis.crypto?.randomUUID?.() ?? `mega-${Date.now()}-${Math.random().toString(36).slice(2)}`

export const MegaEvolution = {
	empty: (): MegaEvolutionState => ({ forms: [], activeFormId: null }),

	newForm: (name = "Mega Form"): MegaForm => ({
		id: makeId(),
		name,
	}),

	activeForm: (state: MegaEvolutionState): MegaForm | undefined =>
		state.forms.find((form) => form.id === state.activeFormId),

	isActive: (state: MegaEvolutionState): boolean => MegaEvolution.activeForm(state) != null,

	hasMegaliteStone: (pokemon: Pick<TrainerPokemon, "items">): boolean =>
		pokemon.items.some((item) => item.type === "standard" && item.itemId === MEGALITE_STONE_ID),

	effectiveType: (pokemon: Pick<TrainerPokemon, "type">, state: MegaEvolutionState): PokemonType =>
		MegaEvolution.activeForm(state)?.type ?? pokemon.type,

	effectiveAbilities: (pokemon: Pick<TrainerPokemon, "abilities">, state: MegaEvolutionState): Ability[] => {
		const megaAbility = MegaEvolution.activeForm(state)?.ability
		return megaAbility ? [megaAbility] : pokemon.abilities
	},

	effectiveAc: (pokemon: Pick<TrainerPokemon, "ac">, state: MegaEvolutionState): number =>
		pokemon.ac + (MegaEvolution.isActive(state) ? 2 : 0),

	attributeModifierMultiplier: (state: MegaEvolutionState): number =>
		MegaEvolution.isActive(state) ? 2 : 1,

	toStoredForms: (forms: MegaForm[]): StoredMegaForm[] => forms.map((form) => ({
		id: form.id,
		name: form.name,
		type: form.type?.data,
		ability: form.ability?.referenceId ? { referenceId: form.ability.referenceId } : undefined,
		imageUrl: form.imageUrl?.trim() || undefined,
	})),

	fromStoredForms: async (forms: StoredMegaForm[] | null | undefined): Promise<MegaForm[]> =>
		Promise.all((forms ?? []).map(async (form) => ({
			id: form.id,
			name: form.name,
			type: form.type && form.type.length > 0 ? new PokemonType(form.type.filter(PokemonType.isPokeType)) : undefined,
			ability: form.ability?.referenceId ? await Ability.resolve(form.ability.referenceId) : undefined,
			imageUrl: form.imageUrl,
		}))),
}
