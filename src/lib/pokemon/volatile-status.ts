import { supabase } from "$lib/supabase"
import { isAnyVolatileStatus, type AnyVolatileStatus } from "./status"

export const PokemonVolatileStatus = {
	get: async (readKey: string, pokemonId: string): Promise<AnyVolatileStatus | null> => {
		const { data, error } = await supabase.rpc("get_pokemon_volatile_status", {
			_read_key: readKey,
			_pokemon_id: parseInt(pokemonId),
		}).single<string | null>()

		if (error) throw error
		return isAnyVolatileStatus(data) ? data : null
	},

	set: async (writeKey: string, pokemonId: string, value: AnyVolatileStatus | null): Promise<void> => {
		const { data, error } = await supabase.rpc("set_pokemon_volatile_status", {
			_write_key: writeKey,
			_pokemon_id: parseInt(pokemonId),
			_volatile_status: value,
		}).single<number>()

		if (error) throw error
		if ((data ?? 0) <= 0) throw new Error("Could not update volatile condition.")
	},
} as const
