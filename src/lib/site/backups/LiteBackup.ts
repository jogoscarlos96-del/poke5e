import type { Data } from "$lib/DataClass"
import type { Fakemon } from "$lib/fakemon"
import { FakemonLocalStorage } from "$lib/fakemon/data/FakemonLocalStorage"
import { CustomMoveLocalStorage } from "$lib/moves/custom/CustomMoveLocalStorage"
import { MegaDefinitionLocalStorage } from "$lib/pokemon/mega/MegaDefinitionLocalStorage"
import { TrainerLocalStorage } from "$lib/trainers/data/TrainerLocalStorage"
import type { Trainer, WithWriteKey } from "$lib/trainers/types"
import { Url } from "../url"
import { BackupError } from "./BackupError"
import { fakemonStore } from "$lib/fakemon/store"
import { trainers } from "$lib/trainers/trainers"
import {
	migrateLegacyPoke5eBackup,
	type LegacyPoke5eMigrationResult,
} from "./LegacyPoke5eMigration"

export type EditKeyBackup = {
	id: string,
	writeKey: string,
}

export type LiteBackup = {
	$schema: string,
	createdAt: string,
	fakemon: Pick<Data<Fakemon>, "id" | "readKey" | "writeKey">[],
	trainers: Pick<Trainer & Partial<WithWriteKey>, "readKey" | "writeKey">[],
	customMoves?: EditKeyBackup[],
	megaEvolutions?: EditKeyBackup[],
}

export type LegacyMigrationFunction = (data: {
	trainers: LiteBackup["trainers"],
	fakemon: LiteBackup["fakemon"],
}) => Promise<LegacyPoke5eMigrationResult>

async function createBackup(): Promise<Blob> {
	const trainers = TrainerLocalStorage.getReadKeys().map((readKey) => {
		const writeKey = TrainerLocalStorage.getWriteKey(readKey)
		return writeKey == null
			? { readKey }
			: { readKey, writeKey }
	})

	const fakemon = FakemonLocalStorage.list()
	const customMoves = CustomMoveLocalStorage.listWriteKeys()
	const megaEvolutions = MegaDefinitionLocalStorage.listWriteKeys()

	const backup: LiteBackup = {
		$schema: Url.backups.schemas["202609"](),
		createdAt: new Date().toISOString(),
		fakemon,
		trainers,
		customMoves,
		megaEvolutions,
	}

	return new Blob([JSON.stringify(backup)], { type: "application/json" })
}

function isEditKeyBackup(value: unknown): value is EditKeyBackup {
	return typeof value === "object"
		&& value != null
		&& "id" in value
		&& typeof value.id === "string"
		&& "writeKey" in value
		&& typeof value.writeKey === "string"
}

function validate(json: object): json is LiteBackup {
	const errors = []

	if ("fakemon" in json) {
		if (!Array.isArray(json.fakemon)) {
			errors.push("fakemon is not an array")
		} else if (json.fakemon.some((it) => !("id" in it) || !("readKey" in it))) {
			errors.push("fakemon require id and readKey")
		}
	} else {
		errors.push("fakemon is required")
	}

	if ("trainers" in json) {
		if (!Array.isArray(json.trainers)) {
			errors.push("trainers is not an array")
		} else if (json.trainers.some((it) => !("readKey" in it))) {
			errors.push("trainers require readKey")
		}
	} else {
		errors.push("trainers is required")
	}

	if ("customMoves" in json) {
		if (!Array.isArray(json.customMoves)) {
			errors.push("customMoves is not an array")
		} else if (json.customMoves.some((it) => !isEditKeyBackup(it))) {
			errors.push("customMoves require id and writeKey")
		}
	}

	if ("megaEvolutions" in json) {
		if (!Array.isArray(json.megaEvolutions)) {
			errors.push("megaEvolutions is not an array")
		} else if (json.megaEvolutions.some((it) => !isEditKeyBackup(it))) {
			errors.push("megaEvolutions require id and writeKey")
		}
	}

	if (errors.length > 0) {
		throw new BackupError(errors.join("; "))
	}

	return true
}

function isKorniaBackup(backup: LiteBackup): boolean {
	return typeof backup.$schema === "string" && backup.$schema.includes("/backups/schemas/2026-09")
}

async function restoreBackup(blob: Blob, migrateLegacy: LegacyMigrationFunction = migrateLegacyPoke5eBackup): Promise<{
	trainers: number,
	fakemon: number,
}> {
	let backup: object = {}
	try {
		const rawData = await blob.text()
		backup = JSON.parse(rawData)
	} catch (e) {
		console.error(e)
		throw new BackupError("Backup file has the wrong format.")
	}

	if (validate(backup)) {
		backup.fakemon.map((it) => {
			FakemonLocalStorage.add(it)
		})

		backup.trainers.map((it) => {
			TrainerLocalStorage.addReadKey(it.readKey)
			if (it.writeKey)
				TrainerLocalStorage.addWriteKey(it.readKey, it.writeKey)
		})

		backup.customMoves?.map((it) => {
			CustomMoveLocalStorage.setWriteKey(it.id, it.writeKey)
		})

		backup.megaEvolutions?.map((it) => {
			MegaDefinitionLocalStorage.setWriteKey(it.id, it.writeKey)
		})

		const fakemonResults = await Promise.all(backup.fakemon.map(async (entry) => ({
			entry,
			found: await fakemonStore.get(entry.readKey),
		})))
		const trainerResults = await Promise.all(backup.trainers.map(async (entry) => ({
			entry,
			found: await trainers.get(entry.readKey),
		})))

		const foundFakemon = fakemonResults.filter((it) => it.found != null)
		const foundTrainers = trainerResults.filter((it) => it.found != null)
		const missingFakemon = fakemonResults.filter((it) => it.found == null).map((it) => it.entry)
		const missingTrainers = trainerResults.filter((it) => it.found == null).map((it) => it.entry)

		if (!isKorniaBackup(backup) && (missingFakemon.length > 0 || missingTrainers.length > 0)) {
			// These keys belong to the original Poke5e database, not Kornia's.
			// Remove the unusable source keys before creating new Kornia copies.
			missingFakemon.forEach((entry) => FakemonLocalStorage.remove(entry.readKey))
			missingTrainers.forEach((entry) => {
				TrainerLocalStorage.removeWriteKey(entry.readKey)
				TrainerLocalStorage.removeReadKey(entry.readKey)
			})

			const migrated = await migrateLegacy({
				trainers: missingTrainers,
				fakemon: missingFakemon,
			})

			if (migrated.failedTrainers > 0 || migrated.failedFakemon > 0) {
				throw new BackupError(
					`Could not migrate ${migrated.failedTrainers} trainer(s) and ${migrated.failedFakemon} fakémon from the original Poke5e service.`,
				)
			}

			return {
				trainers: foundTrainers.length + migrated.trainers,
				fakemon: foundFakemon.length + migrated.fakemon,
			}
		}

		return {
			trainers: foundTrainers.length,
			fakemon: foundFakemon.length,
		}
	}
}

export const LiteBackup = {
	create: createBackup,
	restore: restoreBackup,
} as const
