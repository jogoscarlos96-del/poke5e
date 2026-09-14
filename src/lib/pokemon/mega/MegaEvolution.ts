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

type StoredMegaAbility = {
	referenceId: string,
} | {
	name: string,
	description: string,
}

export type StoredMegaForm = {
	id: string,
	name: string,
	type?: PokeType[],
	ability?: StoredMegaAbility,
	imageUrl?: string,
}

export type MegaEligibility = {
	eligible: boolean,
	reason?: string,
}

export const MEGALITE_STONE_ID = "megalite-stone"

const makeId = () => globalThis.crypto?.randomUUID?.() ?? `mega-${Date.now()}-${Math.random().toString(36).slice(2)}`

const isReferenceAbility = (ability: StoredMegaAbility): ability is { referenceId: string } =>
	"referenceId" in ability && ability.referenceId.length > 0

export const MegaEvolution = {
	empty: (): MegaEvolutionState => ({ forms: [], activeFormId: null }),

	newForm: (name = "Mega Form"): MegaForm => ({
		id: makeId(),
		name,
	}),

	activeForm: (state: MegaEvolutionState, allowed = true): MegaForm | undefined =>
		allowed ? state.forms.find((form) => form.id === state.activeFormId) : undefined,

	isActive: (state: MegaEvolutionState, allowed = true): boolean =>
		MegaEvolution.activeForm(state, allowed) != null,

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

	effectiveType: (pokemon: Pick<TrainerPokemon, "type">, state: MegaEvolutionState, allowed = true): PokemonType =>
		MegaEvolution.activeForm(state, allowed)?.type ?? pokemon.type,

	effectiveAbilities: (pokemon: Pick<TrainerPokemon, "abilities">, state: MegaEvolutionState, allowed = true): Ability[] => {
		const megaAbility = MegaEvolution.activeForm(state, allowed)?.ability
		return megaAbility ? [megaAbility] : pokemon.abilities
	},

	effectiveAc: (pokemon: Pick<TrainerPokemon, "ac">, state: MegaEvolutionState, allowed = true): number =>
		pokemon.ac + (MegaEvolution.isActive(state, allowed) ? 2 : 0),

	attributeModifierMultiplier: (state: MegaEvolutionState, allowed = true): number =>
		MegaEvolution.isActive(state, allowed) ? 2 : 1,

	toStoredForms: (forms: MegaForm[]): StoredMegaForm[] => forms.map((form) => ({
		id: form.id,
		name: form.name,
		type: form.type?.data,
		ability: form.ability
			? form.ability.referenceId
				? { referenceId: form.ability.referenceId }
				: { name: form.ability.name, description: form.ability.description }
			: undefined,
		imageUrl: form.imageUrl?.trim() || undefined,
	})),

	fromStoredForms: async (forms: StoredMegaForm[] | null | undefined): Promise<MegaForm[]> =>
		Promise.all((forms ?? []).map(async (form) => ({
			id: form.id,
			name: form.name,
			type: form.type && form.type.length > 0 ? new PokemonType(form.type.filter(PokemonType.isPokeType)) : undefined,
			ability: form.ability
				? isReferenceAbility(form.ability)
					? await Ability.resolve(form.ability.referenceId)
					: new Ability({ name: form.ability.name, description: form.ability.description })
				: undefined,
			imageUrl: form.imageUrl,
		}))),
}
