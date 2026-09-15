import { browser } from "$app/environment"
import type { Fetched } from "$lib/site/stores"
import { userAssets } from "$lib/site/user-assets"
import { supabase } from "$lib/supabase"
import type { ImageInputValue } from "$lib/ui/forms"
import { writable } from "svelte/store"
import { MegaDefinitionLocalStorage } from "./MegaDefinitionLocalStorage"
import { MegaDefinitions, type DraftMegaDefinition, type MegaDefinition, type MegaDefinitionRow } from "./MegaDefinition"

type NewMegaDefinitionRow = {
	ret_id: string,
	ret_write_key: string,
}

type MegaMediaInput = {
	portrait?: ImageInputValue,
	sprite?: ImageInputValue,
}

type MegaMediaUploadResponse = {
	portrait?: { filename: string, uploadUrl: string },
	sprite?: { filename: string, uploadUrl: string },
}

type UserAssetsResponse<T> = {
	values: T,
}

async function readableFunctionError(error: unknown): Promise<Error> {
	const context = error != null && typeof error === "object" && "context" in error
		? (error as { context?: unknown }).context
		: undefined
	if (context instanceof Response) {
		try {
			const body = await context.clone().json() as { message?: unknown }
			if (typeof body.message === "string" && body.message.length > 0) return new Error(body.message)
		} catch {
			// Fall through to the original Supabase Functions error.
		}
	}
	return error instanceof Error ? error : new Error(String(error))
}

const initial: Fetched<MegaDefinition[]> = {
	result: undefined,
	fetching: true,
	error: undefined,
}

const store = writable<Fetched<MegaDefinition[]>>(initial)
let loaded = false
let inFlight: Promise<MegaDefinition[]> | undefined

async function load(): Promise<MegaDefinition[]> {
	const { data, error } = await supabase.rpc("list_mega_evolutions").select()
	if (error) throw error
	return Promise.all((data as MegaDefinitionRow[]).map(MegaDefinitions.fromRow))
}

function currentDefinitions(): MegaDefinition[] {
	let result: MegaDefinition[] = []
	const unsubscribe = store.subscribe((value) => { result = value.result ?? [] })
	unsubscribe()
	return result
}

async function refresh(force = false): Promise<MegaDefinition[]> {
	if (!browser) return []
	if (inFlight != null && !force) return inFlight
	if (loaded && !force) return currentDefinitions()

	store.update((prev) => ({ ...prev, fetching: true, error: undefined }))
	inFlight = load()
		.then((definitions) => {
			loaded = true
			store.set({ result: definitions, fetching: false, error: undefined })
			return definitions
		})
		.catch((error) => {
			store.set({ result: undefined, fetching: false, error })
			throw error
		})
		.finally(() => {
			inFlight = undefined
		})

	return inFlight
}

async function ensureLoaded(): Promise<MegaDefinition[]> {
	if (!loaded) return refresh()
	return currentDefinitions()
}

async function create(draft: DraftMegaDefinition): Promise<MegaDefinition> {
	const { data, error } = await supabase.rpc("new_mega_evolution", {
		_species_id: draft.speciesId,
		_mega_data: MegaDefinitions.toStoredData(draft),
	}).single<NewMegaDefinitionRow>()
	if (error) throw error

	MegaDefinitionLocalStorage.setWriteKey(data.ret_id, data.ret_write_key)
	await refresh(true)
	const definitions = await ensureLoaded()
	const created = definitions.find((it) => it.id === data.ret_id)
	if (!created) throw new Error("The Mega Evolution was created but could not be reloaded.")
	return created
}

async function update(definition: MegaDefinition): Promise<boolean> {
	const writeKey = MegaDefinitionLocalStorage.getWriteKey(definition.id)
	if (!writeKey) throw new Error("An edit key is required to update this Mega Evolution.")

	const { data, error } = await supabase.rpc("update_mega_evolution", {
		_id: definition.id,
		_write_key: writeKey,
		_species_id: definition.speciesId,
		_mega_data: MegaDefinitions.toStoredData(definition),
	}).single<number>()
	if (error) throw error
	await refresh(true)
	return data > 0
}

async function remove(id: string): Promise<boolean> {
	const writeKey = MegaDefinitionLocalStorage.getWriteKey(id)
	if (!writeKey) throw new Error("An edit key is required to remove this Mega Evolution.")

	const { data, error } = await supabase.rpc("remove_mega_evolution", {
		_id: id,
		_write_key: writeKey,
	}).single<number>()
	if (error) throw error
	if (data > 0) MegaDefinitionLocalStorage.removeWriteKey(id)
	await refresh(true)
	return data > 0
}

async function verifyAccess(id: string, writeKey: string): Promise<boolean> {
	const { data, error } = await supabase.rpc("verify_mega_evolution_write_key", {
		_id: id,
		_write_key: writeKey,
	}).single<number>()
	if (error) throw error
	if (data > 0) MegaDefinitionLocalStorage.setWriteKey(id, writeKey)
	return data > 0
}

function canEdit(id: string): boolean {
	return MegaDefinitionLocalStorage.getWriteKey(id) != null
}

function getWriteKey(id: string): string | undefined {
	return MegaDefinitionLocalStorage.getWriteKey(id)
}

async function updateMedia(id: string, media: MegaMediaInput): Promise<boolean> {
	const writeKey = MegaDefinitionLocalStorage.getWriteKey(id)
	if (!writeKey) throw new Error("An edit key is required to update Mega Evolution images.")

	const uploadParams = (value?: ImageInputValue) => value?.type === "new" ? {
		mimetype: value.value.type,
		sizeInBytes: value.value.size,
	} : undefined

	const hasNewPortrait = media.portrait?.type === "new"
	const hasNewSprite = media.sprite?.type === "new"
	if (hasNewPortrait || hasNewSprite) {
		const { data, error } = await supabase.functions.invoke<UserAssetsResponse<MegaMediaUploadResponse>>("user-assets", {
			method: "POST",
			body: {
				type: "mega-media",
				params: {
					id,
					key: writeKey,
					portrait: uploadParams(media.portrait),
					sprite: uploadParams(media.sprite),
				},
			},
		})
		if (error) throw await readableFunctionError(error)

		const uploads = data?.values
		await Promise.all([
			uploads?.portrait && media.portrait?.type === "new" ? userAssets.upload(uploads.portrait.uploadUrl, media.portrait.value) : undefined,
			uploads?.sprite && media.sprite?.type === "new" ? userAssets.upload(uploads.sprite.uploadUrl, media.sprite.value) : undefined,
		].filter((it): it is Promise<void> => it != null))
	}

	const removePortrait = media.portrait?.type === "remove"
	const removeSprite = media.sprite?.type === "remove"
	if (removePortrait || removeSprite) {
		const { error: removeError } = await supabase.functions.invoke("user-assets", {
			method: "DELETE",
			body: {
				type: "mega-media",
				params: { id, key: writeKey, portrait: removePortrait, sprite: removeSprite },
			},
		})
		if (removeError) throw await readableFunctionError(removeError)
	}

	await refresh(true)
	return true
}

function forSpecies(definitions: MegaDefinition[] | undefined, speciesId: string): MegaDefinition[] {
	return (definitions ?? []).filter((it) => it.speciesId === speciesId)
}

if (browser) void refresh()

export const MegaDefinitionsStore = {
	subscribe: store.subscribe,
	refresh,
	ensureLoaded,
	create,
	update,
	remove,
	verifyAccess,
	canEdit,
	getWriteKey,
	updateMedia,
	forSpecies,
} as const
