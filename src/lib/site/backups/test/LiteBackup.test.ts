import { FakemonLocalStorage } from "$lib/fakemon/data/FakemonLocalStorage"
import { CustomMoveLocalStorage } from "$lib/moves/custom/CustomMoveLocalStorage"
import { TrainerLocalStorage } from "$lib/trainers/data/TrainerLocalStorage"
import { test, expect, beforeEach, describe } from "vitest"
import { LiteBackup } from "../LiteBackup"
import { BackupError } from "../BackupError"

beforeEach(() => {
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
	expect(json.megaEvolutions).toEqual([])

	localStorage.clear()
	expect(CustomMoveLocalStorage.getWriteKey("11111111-1111-1111-1111-111111111111")).toBeUndefined()

	await LiteBackup.restore(backup)

	expect(CustomMoveLocalStorage.getWriteKey("11111111-1111-1111-1111-111111111111")).toEqual("move-write-1")
	expect(CustomMoveLocalStorage.getWriteKey("22222222-2222-2222-2222-222222222222")).toEqual("move-write-2")
})

test("nothing is in storage", async () => {
	const backup = await LiteBackup.create()
	await LiteBackup.restore(backup)

	expect(FakemonLocalStorage.list()).toEqual([])
	expect(TrainerLocalStorage.getReadKeys()).toEqual([])
	expect(CustomMoveLocalStorage.listWriteKeys()).toEqual([])
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

	test("is not a json object", async () => {
		const backup = new Blob(["data"], { type: "image/png" })

		await expect(LiteBackup.restore(backup)).rejects.toThrow(BackupError)
	})
})
