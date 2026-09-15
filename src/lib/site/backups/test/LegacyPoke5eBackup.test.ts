import { FakemonLocalStorage } from "$lib/fakemon/data/FakemonLocalStorage"
import { CustomMoveLocalStorage } from "$lib/moves/custom/CustomMoveLocalStorage"
import { MegaDefinitionLocalStorage } from "$lib/pokemon/mega/MegaDefinitionLocalStorage"
import { TrainerLocalStorage } from "$lib/trainers/data/TrainerLocalStorage"
import { beforeEach, expect, test } from "vitest"
import { LiteBackup, type LegacyMigrationFunction } from "../LiteBackup"

beforeEach(() => {
	localStorage.clear()
})

test("migrates an official 2026-02 Poke5e backup without Kornia fields", async () => {
	// This is the exact field shape produced by the official Poke5e LiteBackup:
	// $schema, createdAt, fakemon, and trainers only. It intentionally contains
	// no customMoves or megaEvolutions fields.
	const legacyBackup = new Blob([JSON.stringify({
		$schema: "/backups/schemas/2026-02",
		createdAt: "2026-02-09T00:00:00.000Z",
		fakemon: [
			{
				id: "11111111-1111-1111-1111-111111111111",
				readKey: "legacy-fakemon-read",
				writeKey: "legacy-fakemon-write",
			},
			{
				id: "22222222-2222-2222-2222-222222222222",
				readKey: "legacy-fakemon-read-only",
			},
		],
		trainers: [
			{
				readKey: "legacy-trainer-read",
				writeKey: "legacy-trainer-write",
			},
			{
				readKey: "legacy-trainer-read-only",
			},
		],
	})], { type: "application/json" })

	// Existing Kornia-only edit access must survive an additive legacy restore.
	CustomMoveLocalStorage.setWriteKey("33333333-3333-3333-3333-333333333333", "existing-move-write")
	MegaDefinitionLocalStorage.setWriteKey("44444444-4444-4444-4444-444444444444", "existing-mega-write")

	const migrateLegacy: LegacyMigrationFunction = async ({ trainers, fakemon }) => {
		expect(trainers.map((it) => it.readKey)).toEqual([
			"legacy-trainer-read",
			"legacy-trainer-read-only",
		])
		expect(fakemon.map((it) => it.readKey)).toEqual([
			"legacy-fakemon-read",
			"legacy-fakemon-read-only",
		])

		// Simulate the cross-database migration generating new Kornia keys while
		// preserving whether the original backup had edit access.
		FakemonLocalStorage.add({
			id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
			readKey: "kornia-fakemon-read",
			writeKey: "kornia-fakemon-write",
		})
		FakemonLocalStorage.add({
			id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
			readKey: "kornia-fakemon-read-only",
		})
		TrainerLocalStorage.addReadKey("kornia-trainer-read")
		TrainerLocalStorage.addWriteKey("kornia-trainer-read", "kornia-trainer-write")
		TrainerLocalStorage.addReadKey("kornia-trainer-read-only")

		return {
			trainers: 2,
			fakemon: 2,
			failedTrainers: 0,
			failedFakemon: 0,
			warnings: 0,
		}
	}

	await expect(LiteBackup.restore(legacyBackup, migrateLegacy)).resolves.toEqual({
		trainers: 2,
		fakemon: 2,
	})

	// Legacy source keys must not remain as dead Kornia records.
	expect(FakemonLocalStorage.get("legacy-fakemon-read")).toBeUndefined()
	expect(FakemonLocalStorage.get("legacy-fakemon-read-only")).toBeUndefined()
	expect(TrainerLocalStorage.getReadKeys()).not.toContain("legacy-trainer-read")
	expect(TrainerLocalStorage.getReadKeys()).not.toContain("legacy-trainer-read-only")

	expect(FakemonLocalStorage.get("kornia-fakemon-read")).toEqual({
		id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
		readKey: "kornia-fakemon-read",
		writeKey: "kornia-fakemon-write",
	})
	expect(FakemonLocalStorage.get("kornia-fakemon-read-only")).toEqual({
		id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
		readKey: "kornia-fakemon-read-only",
	})

	expect(TrainerLocalStorage.getReadKeys()).toEqual([
		"kornia-trainer-read",
		"kornia-trainer-read-only",
	])
	expect(TrainerLocalStorage.getWriteKey("kornia-trainer-read")).toEqual("kornia-trainer-write")
	expect(TrainerLocalStorage.getWriteKey("kornia-trainer-read-only")).toBeNull()

	expect(CustomMoveLocalStorage.getWriteKey("33333333-3333-3333-3333-333333333333")).toEqual("existing-move-write")
	expect(MegaDefinitionLocalStorage.getWriteKey("44444444-4444-4444-4444-444444444444")).toEqual("existing-mega-write")
})
