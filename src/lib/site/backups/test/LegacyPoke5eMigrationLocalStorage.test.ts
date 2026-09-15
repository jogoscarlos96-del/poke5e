import { beforeEach, expect, test } from "vitest"
import { LegacyPoke5eMigrationLocalStorage } from "../LegacyPoke5eMigrationLocalStorage"

beforeEach(() => {
	localStorage.clear()
})

test("stores and removes trainer migration mappings", () => {
	LegacyPoke5eMigrationLocalStorage.setTrainer("old-trainer", {
		readKey: "new-trainer",
		writeKey: "new-trainer-write",
	})

	expect(LegacyPoke5eMigrationLocalStorage.getTrainer("old-trainer")).toEqual({
		readKey: "new-trainer",
		writeKey: "new-trainer-write",
	})

	LegacyPoke5eMigrationLocalStorage.removeTrainer("old-trainer")
	expect(LegacyPoke5eMigrationLocalStorage.getTrainer("old-trainer")).toBeUndefined()
})

test("stores read-only Fakemon mappings without an edit key", () => {
	LegacyPoke5eMigrationLocalStorage.setFakemon("old-fakemon", {
		id: "new-fakemon-id",
		readKey: "new-fakemon-read",
	})

	expect(LegacyPoke5eMigrationLocalStorage.getFakemon("old-fakemon")).toEqual({
		id: "new-fakemon-id",
		readKey: "new-fakemon-read",
	})
})

test("ignores malformed migration mappings", () => {
	localStorage.setItem("legacy-poke5e-migration::trainer::old-trainer", "not json")
	localStorage.setItem("legacy-poke5e-migration::fakemon::old-fakemon", JSON.stringify({ readKey: 123 }))

	expect(LegacyPoke5eMigrationLocalStorage.getTrainer("old-trainer")).toBeUndefined()
	expect(LegacyPoke5eMigrationLocalStorage.getFakemon("old-fakemon")).toBeUndefined()
})
