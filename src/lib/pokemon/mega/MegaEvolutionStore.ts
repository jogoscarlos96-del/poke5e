import { supabase } from "$lib/supabase"
import type { PokemonId, ReadWriteKey } from "$lib/trainers/types"
import { get, writable } from "svelte/store"
import { MegaEvolution, type MegaEvolutionState } from "./MegaEvolution"

type MegaRows = Record<PokemonId, MegaEvolutionState>

const store = writable<MegaRows>({})
const pending = new Map<PokemonId, Promise<MegaEvolutionState>>()

const setOne = (pokemonId: PokemonId, state: MegaEvolutionState) => {
	store.update((current) => ({ ...current, [pokemonId]: state }))
	return state
}

const normalizeState = (state: MegaEvolutionState): MegaEvolutionState => ({
	selectedMegaId: state.selectedMegaId || null,
})

const refresh = (pokemonId: PokemonId, readKey: ReadWriteKey): Promise<MegaEvolutionState> => {
	const existing = pending.get(pokemonId)
	if (existing) return existing

	const request = supabase.rpc("get_pokemon_mega", {
		_pokemon_id: parseInt(pokemonId),
		_read_key: readKey,
	}).maybeSingle<{ selected_mega_id: string | null }>()
		.then(({ data, error }) => {
			if (error) throw error
			if (!data) return setOne(pokemonId, MegaEvolution.empty())
			return setOne(pokemonId, normalizeState({ selectedMegaId: data.selected_mega_id }))
		})
		.finally(() => pending.delete(pokemonId))

	pending.set(pokemonId, request)
	return request
}

const save = async (pokemonId: PokemonId, writeKey: ReadWriteKey, state: MegaEvolutionState): Promise<MegaEvolutionState> => {
	const previous = get(store)[pokemonId] ?? MegaEvolution.empty()
	const normalized = normalizeState(state)
	setOne(pokemonId, normalized)

	const { data, error } = await supabase.rpc("update_pokemon_mega", {
		_write_key: writeKey,
		_pokemon_id: parseInt(pokemonId),
		_selected_mega_id: normalized.selectedMegaId,
	}).single<number>()

	if (error || !data || data <= 0) {
		setOne(pokemonId, previous)
		throw error ?? new Error("Mega Evolution state could not be saved.")
	}

	return normalized
}

export const MegaEvolutionStore = {
	subscribe: store.subscribe,
	refresh,
	save,
	stateFor: (pokemonId: PokemonId): MegaEvolutionState => get(store)[pokemonId] ?? MegaEvolution.empty(),
}
