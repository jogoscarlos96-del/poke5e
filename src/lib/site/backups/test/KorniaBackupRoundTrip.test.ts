import { FakemonLocalStorage } from "$lib/fakemon/data/FakemonLocalStorage"
import { CustomMoveLocalStorage } from "$lib/moves/custom/CustomMoveLocalStorage"
import { MegaDefinitionLocalStorage } from "$lib/pokemon/mega/MegaDefinitionLocalStorage"
import { TrainerLocalStorage } from "$lib/trainers/data/TrainerLocalStorage"
import { beforeEach, expect, test } from "vitest"
import { LiteBackup } from "../LiteBackup"

beforeEach(() => {
	localStorage.clear()
})

test("round trips all Kornia backup data together", async () => {
	FakemonLocalStorage.add({
		id: "11111111-1111-1111-1111-111111111111",
		readKey: "fakemon-read-owned",
		writeKey: "fakemon-write-owned",
	})
	FakemonLocalStorage.add({
		id: "22222222-2222-2222-2222-222222222222",
		readKey: "fakemon-read-shared",
	})

	TrainerLocalStorage.addReadKey("trainer-read-owned")
	TrainerLocalStorage.addWriteKey("trainer-read-owned", "trainer-write-owned")
	TrainerLocalStorage.addReadKey("trainer-read-shared")

	CustomMoveLocalStorage.setWriteKey("33333333-3333-3333-3333-333333333333", "custom-move-write-1")
	CustomMoveLocalStorage.setWriteKey("44444444-4444-4444-4444-444444444444", "custom-move-write-2")

	MegaDefinitionLocalStorage.setWriteKey("55555555-5555-5555-5555-555555555555", "mega-write-1")
	MegaDefinitionLocalStorage.setWriteKey("66666666-6666-6666-6666-666666666666", "mega-write-2")

	const backup = await LiteBackup.create()
	const json = JSON.parse(await backup.text())

	expect(json.$schema).toContain("/backups/schemas/2026-09")
	expect([...json.fakemon].sort((a, b) => a.id.localeCompare(b.id))).toEqual([
		{
			id: "11111111-1111-1111-1111-111111111111",
			readKey: "fakemon-read-owned",
			writeKey: "fakemon-write-owned",
		},
		{
			id: "22222222-2222-2222-2222-222222222222",
			readKey: "fakemon-read-shared",
		},
	])
	expect(json.trainers).toEqual([
		{ readKey: "trainer-read-owned", writeKey: "trainer-write-owned" },
		{ readKey: "trainer-read-shared" },
	])
	expect(json.customMoves).toEqual([
		{ id: "33333333-3333-3333-3333-333333333333", writeKey: "custom-move-write-1" },
		{ id: "44444444-4444-4444-4444-444444444444", writeKey: "custom-move-write-2" },
	])
	expect(json.megaEvolutions).toEqual([
		{ id: "55555555-5555-5555-5555-555555555555", writeKey: "mega-write-1" },
		{ id: "66666666-6666-6666-6666-666666666666", writeKey: "mega-write-2" },
	])

	localStorage.clear()

	expect(FakemonLocalStorage.list()).toEqual([])
	expect(TrainerLocalStorage.getReadKeys()).toEqual([])
	expect(CustomMoveLocalStorage.listWriteKeys()).toEqual([])
	expect(MegaDefinitionLocalStorage.listWriteKeys()).toEqual([])

	await LiteBackup.restore(backup)

	expect(FakemonLocalStorage.get("fakemon-read-owned")).toEqual({
		id: "11111111-1111-1111-1111-111111111111",
		readKey: "fakemon-read-owned",
		writeKey: "fakemon-write-owned",
	})
	expect(FakemonLocalStorage.get("fakemon-read-shared")).toEqual({
		id: "22222222-2222-2222-2222-222222222222",
		readKey: "fakemon-read-shared",
	})

	expect(TrainerLocalStorage.getReadKeys()).toEqual([
		"trainer-read-owned",
		"trainer-read-shared",
	])
	expect(TrainerLocalStorage.getWriteKey("trainer-read-owned")).toEqual("trainer-write-owned")
	expect(TrainerLocalStorage.getWriteKey("trainer-read-shared")).toBeNull()

	expect(CustomMoveLocalStorage.listWriteKeys()).toEqual([
		{ id: "33333333-3333-3333-3333-333333333333", writeKey: "custom-move-write-1" },
		{ id: "44444444-4444-4444-4444-444444444444", writeKey: "custom-move-write-2" },
	])
	expect(MegaDefinitionLocalStorage.listWriteKeys()).toEqual([
		{ id: "55555555-5555-5555-5555-555555555555", writeKey: "mega-write-1" },
		{ id: "66666666-6666-6666-6666-666666666666", writeKey: "mega-write-2" },
	])
})
