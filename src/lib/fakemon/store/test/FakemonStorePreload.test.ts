import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { provider } from "$lib/fakemon/data"
import { stubFakemon } from "$lib/fakemon/test/stubs"
import { stubPokemonSpecies } from "$lib/poke5e/species/test/stubs"
import { createStore } from "../FakemonStore"

beforeEach(() => {
	localStorage.clear()
})

afterEach(() => {
	vi.restoreAllMocks()
})

test("loading the list warms the individual fakemon cache", async () => {
	const draft = stubFakemon({
		species: stubPokemonSpecies({ name: "Cachemon" }).data,
	})
	const added = await provider.add(draft.data.species)
	const store = createStore()
	const getByReadKey = vi.spyOn(provider, "getByReadKey")

	await store.all()
	getByReadKey.mockClear()

	await store.get(added.data.readKey)

	expect(getByReadKey).not.toHaveBeenCalled()
})
