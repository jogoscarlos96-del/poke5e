import { SpeciesIdentifier, SpeciesStore, type PokemonSpecies } from "$lib/poke5e/species"
import type { Readable } from "svelte/store"

const waitForValue = <T>(store: Readable<T | undefined>): Promise<T> =>
	new Promise((resolve) => {
		let unsubscribe: (() => void) | undefined
		unsubscribe = store.subscribe((value) => {
			if (value != null) {
				resolve(value)
				queueMicrotask(() => unsubscribe?.())
			}
		})
	})

export async function loadSafariSpecies(): Promise<PokemonSpecies[]> {
	const store = await SpeciesStore.completeList()
	return waitForValue(store)
}

export async function resolveSafariSpecies(
	ids: string[],
	knownSpecies: PokemonSpecies[],
): Promise<Map<string, PokemonSpecies>> {
	const result = new Map(knownSpecies.map((species) => [species.id.data, species]))
	const missingFakemon = [...new Set(ids)]
		.filter((id) => !result.has(id) && id.startsWith("F."))

	await Promise.all(missingFakemon.map(async (id) => {
		const store = await SpeciesStore.get(new SpeciesIdentifier(id))
		if (!store) return
		const stored = await waitForValue(store)
		if (stored?.value) result.set(id, stored.value)
	}))

	return result
}
