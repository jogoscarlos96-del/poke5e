import { browser } from "$app/environment"
import type { Data } from "$lib/DataClass"
import type { Move } from "$lib/moves/Move"
import type { Fetched } from "$lib/site/stores"
import { supabase } from "$lib/supabase"
import { writable } from "svelte/store"
import { CustomMove, type CustomMoveData } from "./CustomMove"
import { CustomMoveLocalStorage } from "./CustomMoveLocalStorage"

type CustomMoveRow = {
	id: string,
	move_data: CustomMoveData,
	created_at: string,
	updated_at: string,
}

type NewCustomMoveRow = {
	ret_id: string,
	ret_write_key: string,
}

const initial: Fetched<Move[]> = {
	result: undefined,
	fetching: true,
	error: undefined,
}

const store = writable<Fetched<Move[]>>(initial)
let loaded = false
let inFlight: Promise<Move[]> | undefined

async function load(): Promise<Move[]> {
	const { data, error } = await supabase.rpc("list_custom_moves").select()
	if (error) throw error
	return (data as CustomMoveRow[]).map(CustomMove.fromRow)
}

async function refresh(force = false): Promise<Move[]> {
	if (!browser) return []
	if (inFlight != null && !force) return inFlight

	store.update((prev) => ({ ...prev, fetching: true, error: undefined }))
	inFlight = load()
		.then((moves) => {
			loaded = true
			store.set({ result: moves, fetching: false, error: undefined })
			return moves
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

async function ensureLoaded(): Promise<Move[]> {
	if (!loaded) return refresh()
	let result: Move[] = []
	const unsubscribe = store.subscribe((value) => { result = value.result ?? [] })
	unsubscribe()
	return result
}

async function create(moveData: CustomMoveData): Promise<Move> {
	const { data, error } = await supabase.rpc("new_custom_move", { _move_data: moveData }).single<NewCustomMoveRow>()
	if (error) throw error

	CustomMoveLocalStorage.setWriteKey(data.ret_id, data.ret_write_key)
	const move = CustomMove.fromRow({ id: data.ret_id, move_data: moveData })
	await refresh(true)
	return move
}

async function update(move: Move): Promise<boolean> {
	const id = CustomMove.uuid(move.id)
	const writeKey = CustomMoveLocalStorage.getWriteKey(id)
	if (writeKey == null) throw new Error("An edit key is required to update this custom move.")

	const { data, error } = await supabase.rpc("update_custom_move", {
		_id: id,
		_write_key: writeKey,
		_move_data: CustomMove.toStoredData(move),
	}).single<number>()
	if (error) throw error
	await refresh(true)
	return data > 0
}

async function remove(moveId: string): Promise<boolean> {
	const id = CustomMove.uuid(moveId)
	const writeKey = CustomMoveLocalStorage.getWriteKey(id)
	if (writeKey == null) throw new Error("An edit key is required to remove this custom move.")

	const { data, error } = await supabase.rpc("remove_custom_move", {
		_id: id,
		_write_key: writeKey,
	}).single<number>()
	if (error) throw error
	if (data > 0) CustomMoveLocalStorage.removeWriteKey(id)
	await refresh(true)
	return data > 0
}

async function verifyAccess(moveId: string, writeKey: string): Promise<boolean> {
	const id = CustomMove.uuid(moveId)
	const { data, error } = await supabase.rpc("verify_custom_move_write_key", {
		_id: id,
		_write_key: writeKey,
	}).single<number>()
	if (error) throw error
	if (data > 0) CustomMoveLocalStorage.setWriteKey(id, writeKey)
	return data > 0
}

function canEdit(moveId: string): boolean {
	return CustomMoveLocalStorage.getWriteKey(CustomMove.uuid(moveId)) != null
}

if (browser) void refresh()

export const CustomMovesStore = {
	subscribe: store.subscribe,
	refresh,
	ensureLoaded,
	create,
	update,
	remove,
	verifyAccess,
	canEdit,
} as const
