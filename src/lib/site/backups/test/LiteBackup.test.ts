import { FakemonLocalStorage } from "$lib/fakemon/data/FakemonLocalStorage"
import { fakemonStore } from "$lib/fakemon/store"
import { CustomMoveLocalStorage } from "$lib/moves/custom/CustomMoveLocalStorage"
import { MegaDefinitionLocalStorage } from "$lib/pokemon/mega/MegaDefinitionLocalStorage"
import { TrainerLocalStorage } from "$lib/trainers/data/TrainerLocalStorage"
import { trainers } from "$lib/trainers/trainers"
import { test, expect, beforeEach, describe, vi } from "vitest"
import { LiteBackup } from "../LiteBackup"
import { BackupError } from "../BackupError"

beforeEach(() => {
	vi.restoreAllMocks()
	localStorage.clear()
})

test("records fakemon and trainers", async () => {
	// given: data in storage
	FakemonLocalStorage.add({
		id: "11111111-1111-1111-1111-111111111111",
		readKey: "fr1",
		writeKey: "fw1",
	})

	FakemonLocalStorage.add({
		id: "22222222-1111-1111-1111-111111111111",
		readKey: "fr2",
	})

	TrainerLocalStorage.addReadKey("tr1")
	TrainerLocalStorage.addWriteKey("tr1", "tw1")
	TrainerLocalStorage.addReadKey("tr2")

	// when: backup created and restored
	const backup = await LiteBackup.create()

	localStorage.clear()

	expect(FakemonLocalStorage.get("fr1")).toBeUndefined()
	expect(FakemonLocalStorage.get("fr2")).toBeUndefined()
	expect(TrainerLocalStorage.getReadKeys()).toEqual([])

	await LiteBackup.restore(backup)

	// then: data comes back
	expect(FakemonLocalStorage.get("fr1")).toEqual({
		id: "11111111-1111-1111-1111-111111111111",
		readKey: "fr1",
		writeKey: "fw1",
	})
	expect(FakemonLocalStorage.get("fr2")).toEqual({
		id: "22222222-1111-1111-1111-111111111111",
		readKey: "fr2",
	})
	expect(TrainerLocalStorage.getReadKeys()).toEqual(["tr1", "tr2"])
	expect(TrainerLocalStorage.getWriteKey("tr1")).toEqual("tw1")
	expect(TrainerLocalStorage.getWriteKey("tr2")).toBeNull()
})

test("refreshes live stores after a legacy migration", async () => {
	const fakemonGet = vi.spyOn(fakemonStore, "get")
	const trainerGet = vi.spyOn(trainers, "get")
	const backup = new Blob([JSON.stringify({
		$schema: "https://poke5e.app/backups/schemas/2026-02",
		createdAt: "2026-02-01T00:00:00.000Z",
		fakemon: [{
			id: "11111111-1111-1111-1111-111111111111",
			readKey: "legacy-fakemon",
		}],
		trainers: [{
			readKey: "legacy-trainer",
		}],
	})], { type: "application/json" })

	const migrateLegacy = vi.fn(async () => {
		FakemonLocalStorage.add({
			id: "22222222-2222-2222-2222-222222222222",
			readKey: "restored-fakemon",
		})
		TrainerLocalStorage.addReadKey("restored-trainer")
		return {
			trainers: 1,
			fakemon: 1,
			failedTrainers: 0,
			failedFakemon: 0,
			warnings: 0,
		}
	})

	await LiteBackup.restore(backup, migrateLegacy)

	expect(fakemonGet).toHaveBeenCalledWith("restored-fakemon")
	expect(trainerGet).toHaveBeenCalledWith("restored-trainer")
})

test("records and restores custom move edit keys", async () => {
	CustomMoveLocalStorage.setWriteKey("22222222-2222-2222-2222-222222222222", "move-write-2")
	CustomMoveLocalStorage.setWriteKey("11111111-1111-1111-1111-111111111111", "move-write-1")

	const backup = await LiteBackup.create()
	const json = JSON.parse(await backup.text())

	expect(json.$schema).toContain("/backups/schemas/2026-09")
	expect(json.customMoves).toEqual([
		{ id: "11111111-1111-1111-1111-111111111111", writeKey: "move-write-1" },
		{ id: "22222222-2222-2222-2222-222222222222", writeKey: "move-write-2" },
	])

	localStorage.clear()
	expect(CustomMoveLocalStorage.getWriteKey("11111111-1111-1111-1111-111111111111")).toBeUndefined()

	await LiteBackup.restore(backup)

	expect(CustomMoveLocalStorage.getWriteKey("11111111-1111-1111-1111-111111111111")).toEqual("move-write-1")
	expect(CustomMoveLocalStorage.getWriteKey("22222222-2222-2222-2222-222222222222")).toEqual("move-write-2")
})

test("records and restores Mega Evolution edit keys", async () => {
	MegaDefinitionLocalStorage.setWriteKey("44444444-4444-4444-4444-444444444444", "mega-write-2")
	MegaDefinitionLocalStorage.setWriteKey("33333333-3333-3333-3333-333333333333", "mega-write-1")

	const backup = await LiteBackup.create()
	const json = JSON.parse(await backup.text())

	expect(json.$schema).toContain("/backups/schemas/2026-09")
	expect(json.megaEvolutions).toEqual([
		{ id: "33333333-3333-3333-3333-333333333333", writeKey: "mega-write-1" },
		{ id: "44444444-4444-4444-4444-444444444444", writeKey: "mega-write-2" },
	])

	localStorage.clear()
	expect(MegaDefinitionLocalStorage.getWriteKey("33333333-3333-3333-3333-333333333333")).toBeUndefined()

	await LiteBackup.restore(backup)

	expect(MegaDefinitionLocalStorage.getWriteKey("33333333-3333-3333-3333-333333333333")).toEqual("mega-write-1")
	expect(MegaDefinitionLocalStorage.getWriteKey("44444444-4444-4444-4444-444444444444")).toEqual("mega-write-2")
})

test("nothing is in storage", async () => {
	const backup = await LiteBackup.create()
	await LiteBackup.restore(backup)

	expect(FakemonLocalStorage.list()).toEqual([])
	expect(TrainerLocalStorage.getReadKeys()).toEqual([])
	expect(CustomMoveLocalStorage.listWriteKeys()).toEqual([])
	expect(MegaDefinitionLocalStorage.listWriteKeys()).toEqual([])
})

test("existing records are not overwritten", async () => {
	// given: a backup
	FakemonLocalStorage.add({
		id: "11111111-1111-1111-1111-111111111111",
		readKey: "fr1",
		writeKey: "fw1",
	})

	TrainerLocalStorage.addReadKey("tr1")
	TrainerLocalStorage.addWriteKey("tr1", "tw1")

	const backup = await LiteBackup.create()

	localStorage.clear()

	// and: fakemon/trainers in storage
	FakemonLocalStorage.add({
		id: "22222222-1111-1111-1111-111111111111",
		readKey: "fr2",
	})
	TrainerLocalStorage.addReadKey("tr2")

	// when
	await LiteBackup.restore(backup)

	// then: everything is there
	expect(FakemonLocalStorage.get("fr1")).toEqual({
		id: "11111111-1111-1111-1111-111111111111",
		readKey: "fr1",
		writeKey: "fw1",
	})
	expect(FakemonLocalStorage.get("fr2")).toEqual({
		id: "22222222-1111-1111-1111-111111111111",
		readKey: "fr2",
	})
	expect(TrainerLocalStorage.getReadKeys()).toEqual(["tr2", "tr1"])
	expect(TrainerLocalStorage.getWriteKey("tr1")).toEqual("tw1")
	expect(TrainerLocalStorage.getWriteKey("tr2")).toBeNull()
})

describe("bad formats", () => {
	const createBackup = (json: object) => new Blob([JSON.stringify(json)], { type: "application/json" })

	test("fakemon is not a list", async () => {
		const backup = createBackup({
			fakemon: {
				id: "0",
				readKey: "r",
				writeKey: "w",
			},
			trainers: [],
		})

		await expect(LiteBackup.restore(backup)).rejects.toThrow(BackupError)
	})

	test("trainers is not a list", async () => {
		const backup = createBackup({
			trainers: {
				readKey: "r",
				writeKey: "w",
			},
			fakemon: [],
		})

		await expect(LiteBackup.restore(backup)).rejects.toThrow(BackupError)
	})

	test("fakemon missing read keys", async () => {
		const backup = createBackup({
			fakemon: [ {
				id: "id",
			} ],
			trainers: [],
		})

		await expect(LiteBackup.restore(backup)).rejects.toThrow(BackupError)
	})

	test("trainers missing read keys", async () => {
		const backup = createBackup({
			trainers: [ {} ],
			fakemon: [],
		})

		await expect(LiteBackup.restore(backup)).rejects.toThrow(BackupError)
	})

	test("custom moves missing edit keys", async () => {
		const backup = createBackup({
			trainers: [],
			fakemon: [],
			customMoves: [ { id: "move-id" } ],
		})

		await expect(LiteBackup.restore(backup)).rejects.toThrow(BackupError)
	})

	test("Mega Evolutions missing edit keys", async () => {
		const backup = createBackup({
			trainers: [],
			fakemon: [],
			megaEvolutions: [ { id: "mega-id" } ],
		})

		await expect(LiteBackup.restore(backup)).rejects.toThrow(BackupError)
	})

	test("is not a json object", async () => {
		const backup = new Blob(["data"], { type: "image/png" })

		await expect(LiteBackup.restore(backup)).rejects.toThrow(BackupError)
	})
})