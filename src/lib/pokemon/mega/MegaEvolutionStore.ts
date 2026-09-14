import { supabase } from "$lib/supabase"
import type { PokemonId, ReadWriteKey } from "$lib/trainers/types"
import { get, writable } from "svelte/store"
import { MegaEvolution, type MegaEvolutionState, type StoredMegaForm } from "./MegaEvolution"

type MegaRows = Record<PokemonId, MegaEvolutionState>

const store = writable<MegaRows>({})
const pending = new Map<PokemonId, Promise<MegaEvolutionState>>()

const setOne = (pokemonId: PokemonId, state: MegaEvolutionState) => {
	store.update((current) => ({ ...current, [pokemonId]: state }))
	return state
}

const refresh = (pokemonId: PokemonId, readKey: ReadWriteKey): Promise<MegaEvolutionState> => {
	const existing = pending.get(pokemonId)
	if (existing) return existing

	const request = supabase.rpc("get_pokemon_mega", {
		_pokemon_id: parseInt(pokemonId),
		_read_key: readKey,
	}).maybeSingle<{ forms: StoredMegaForm[] | null, active_form_id: string | null }>()
		.then(async ({ data, error }) => {
			if (error) throw error
			if (!data) return setOne(pokemonId, MegaEvolution.empty())

			const forms = await MegaEvolution.fromStoredForms(data.forms)
			return setOne(pokemonId, {
				forms,
				activeFormId: data.active_form_id,
			})
		})
		.finally(() => pending.delete(pokemonId))

	pending.set(pokemonId, request)
	return request
}

const save = async (pokemonId: PokemonId, writeKey: ReadWriteKey, state: MegaEvolutionState): Promise<MegaEvolutionState> => {
	const previous = get(store)[pokemonId] ?? MegaEvolution.empty()
	setOne(pokemonId, state)

	const { data, error } = await supabase.rpc("update_pokemon_mega", {
		_write_key: writeKey,
		_pokemon_id: parseInt(pokemonId),
		_mega_forms: MegaEvolution.toStoredForms(state.forms),
		_mega_active_form_id: state.activeFormId ?? null,
	}).single<number>()

	if (error || !data || data <= 0) {
		setOne(pokemonId, previous)
		throw error ?? new Error("Mega Evolution state could not be saved.")
	}

	return state
}

export const MegaEvolutionStore = {
	subscribe: store.subscribe,
	refresh,
	save,
	stateFor: (pokemonId: PokemonId): MegaEvolutionState => get(store)[pokemonId] ?? MegaEvolution.empty(),
}
