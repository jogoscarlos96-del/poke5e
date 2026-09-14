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

	activeForm: (pokemon: Pick<TrainerPokemon, "mega">): MegaForm | undefined =>
		pokemon.mega.forms.find((form) => form.id === pokemon.mega.activeFormId),

	isActive: (pokemon: Pick<TrainerPokemon, "mega">): boolean =>
		MegaEvolution.activeForm(pokemon) != null,

	hasMegaliteStone: (pokemon: Pick<TrainerPokemon, "items">): boolean =>
		pokemon.items.some((item) => item.type === "standard" && item.itemId === MEGALITE_STONE_ID),

	effectiveType: (pokemon: Pick<TrainerPokemon, "mega" | "type">): PokemonType =>
		MegaEvolution.activeForm(pokemon)?.type ?? pokemon.type,

	effectiveAbilities: (pokemon: Pick<TrainerPokemon, "mega" | "abilities">): Ability[] => {
		const megaAbility = MegaEvolution.activeForm(pokemon)?.ability
		return megaAbility ? [megaAbility] : pokemon.abilities
	},

	effectiveAc: (pokemon: Pick<TrainerPokemon, "mega" | "ac">): number =>
		pokemon.ac + (MegaEvolution.isActive(pokemon) ? 2 : 0),

	attributeModifierMultiplier: (pokemon: Pick<TrainerPokemon, "mega">): number =>
		MegaEvolution.isActive(pokemon) ? 2 : 1,

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
