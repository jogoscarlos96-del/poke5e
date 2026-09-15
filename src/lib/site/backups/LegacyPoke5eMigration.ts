import { Fakemon, type DraftFakemon } from "$lib/fakemon/Fakemon"
import type { FakemonDataProvider } from "$lib/fakemon/data/FakemonDataProvider"
import { FakemonLocalStorage } from "$lib/fakemon/data/FakemonLocalStorage"
import { provider as destinationFakemonProvider } from "$lib/fakemon/data"
import { SpeciesStore, type PokemonSpecies, type SpeciesIdentifier } from "$lib/poke5e/species"
import type { StorageResource, TrainerDataProvider } from "$lib/trainers/data"
import { provider as destinationTrainerProvider } from "$lib/trainers/data"
import { TrainerLocalStorage } from "$lib/trainers/data/TrainerLocalStorage"
import type { TrainerPokemon } from "$lib/trainers/types"
import { createLegacyPoke5eProviders } from "./LegacyPoke5eSource"

export type LegacyTrainerBackupEntry = {
	readKey: string,
	writeKey?: string | null,
}

export type LegacyFakemonBackupEntry = {
	id?: string,
	readKey: string,
	writeKey?: string | null,
}

export type LegacyPoke5eMigrationResult = {
	trainers: number,
	fakemon: number,
	failedTrainers: number,
	failedFakemon: number,
	warnings: number,
}

type LegacyTrainerProvider = Pick<TrainerDataProvider, "getTrainer" | "verifyWriteKey">
type LegacyFakemonProvider = Pick<FakemonDataProvider, "getByReadKey" | "verifyWriteKey">

export type LegacyPoke5eMigrationDependencies = {
	legacyTrainers: LegacyTrainerProvider,
	legacyFakemon: LegacyFakemonProvider,
	destinationTrainers: TrainerDataProvider,
	destinationFakemon: FakemonDataProvider,
	resolveSpecies: (id: SpeciesIdentifier) => Promise<PokemonSpecies | undefined>,
	copyMedia: boolean,
}

const waitForSpecies = async (id: SpeciesIdentifier): Promise<PokemonSpecies | undefined> => {
	const store = await SpeciesStore.get(id)
	if (store == null) return undefined

	return new Promise((resolve) => {
		let finished = false
		let unsubscribe = () => {}
		const finish = (value: PokemonSpecies | undefined) => {
			if (finished) return
			finished = true
			resolve(value)
			queueMicrotask(() => unsubscribe())
		}

		unsubscribe = store.subscribe((value) => {
			if (value?.value != null) finish(value.value)
		})

		window.setTimeout(() => finish(undefined), 10000)
	})
}

const createDependencies = (): LegacyPoke5eMigrationDependencies => {
	const legacy = createLegacyPoke5eProviders()
	return {
		legacyTrainers: legacy.trainers,
		legacyFakemon: legacy.fakemon,
		destinationTrainers: destinationTrainerProvider,
		destinationFakemon: destinationFakemonProvider,
		resolveSpecies: waitForSpecies,
		copyMedia: true,
	}
}

async function withLegacyTrainerAccess<T>(entry: LegacyTrainerBackupEntry, action: () => Promise<T>): Promise<T> {
	const previousReadKeys = TrainerLocalStorage.getReadKeys()
	const hadReadKey = previousReadKeys.includes(entry.readKey)
	const previousWriteKey = TrainerLocalStorage.getWriteKey(entry.readKey)

	TrainerLocalStorage.addReadKey(entry.readKey)
	if (entry.writeKey != null) TrainerLocalStorage.addWriteKey(entry.readKey, entry.writeKey)

	try {
		return await action()
	} finally {
		if (!hadReadKey) TrainerLocalStorage.removeReadKey(entry.readKey)
		if (previousWriteKey != null) {
			TrainerLocalStorage.addWriteKey(entry.readKey, previousWriteKey)
		} else {
			TrainerLocalStorage.removeWriteKey(entry.readKey)
		}
	}
}

async function withLegacyFakemonAccess<T>(entry: LegacyFakemonBackupEntry, action: () => Promise<T>): Promise<T> {
	const previous = FakemonLocalStorage.get(entry.readKey)

	FakemonLocalStorage.remove(entry.readKey)
	FakemonLocalStorage.add({
		id: entry.id ?? "legacy",
		readKey: entry.readKey,
		writeKey: entry.writeKey ?? undefined,
	})

	try {
		return await action()
	} finally {
		FakemonLocalStorage.remove(entry.readKey)
		if (previous != null) FakemonLocalStorage.add(previous)
	}
}

async function resourceToFile(resource: StorageResource): Promise<File> {
	const response = await fetch(resource.href)
	if (!response.ok) throw new Error("Could not download legacy media.")

	const blob = await response.blob()
	return new File([blob], resource.name || "legacy-image", {
		type: blob.type || "image/png",
	})
}

async function migrateOneFakemon(
	entry: LegacyFakemonBackupEntry,
	dependencies: LegacyPoke5eMigrationDependencies,
): Promise<{ fakemon: Fakemon, owned: boolean } | undefined> {
	return withLegacyFakemonAccess(entry, async () => {
		const legacy = await dependencies.legacyFakemon.getByReadKey(entry.readKey)
		if (legacy == null) return undefined

		const owned = entry.writeKey != null
			? await dependencies.legacyFakemon.verifyWriteKey(legacy, entry.writeKey)
			: false

		const { id: _legacySpeciesId, ...draft } = legacy.data.species
		const created = await dependencies.destinationFakemon.add(draft as DraftFakemon)
		const migrated = new Fakemon({
			...created.data,
			species: {
				...legacy.data.species,
				id: created.data.species.id,
			},
			tags: legacy.tags,
		})

		await dependencies.destinationFakemon.update(migrated)

		if (!owned) {
			FakemonLocalStorage.remove(created.data.readKey)
			FakemonLocalStorage.add({
				id: created.data.id,
				readKey: created.data.readKey,
			})
		}

		return { fakemon: migrated, owned }
	})
}

async function copyTrainerMedia(
	legacy: StorageResource | undefined,
	writeKey: string,
	readKey: string,
	dependencies: LegacyPoke5eMigrationDependencies,
): Promise<boolean> {
	if (!dependencies.copyMedia || legacy == null) return true

	try {
		const file = await resourceToFile(legacy)
		await dependencies.destinationTrainers.updateTrainerAvatar(writeKey, readKey, file)
		return true
	} catch (e) {
		console.warn("Could not migrate a legacy trainer avatar.", e)
		return false
	}
}

async function copyPokemonMedia(
	legacy: TrainerPokemon,
	migrated: TrainerPokemon,
	writeKey: string,
	readKey: string,
	dependencies: LegacyPoke5eMigrationDependencies,
): Promise<boolean> {
	if (!dependencies.copyMedia || legacy.avatar == null) return true

	try {
		const file = await resourceToFile(legacy.avatar)
		await dependencies.destinationTrainers.updatePokemonAvatar(writeKey, readKey, migrated, file)
		return true
	} catch (e) {
		console.warn("Could not migrate a legacy pokemon avatar.", e)
		return false
	}
}

export async function migrateLegacyPoke5eBackup({
	trainers,
	fakemon,
}: {
	trainers: LegacyTrainerBackupEntry[],
	fakemon: LegacyFakemonBackupEntry[],
}, dependencies: LegacyPoke5eMigrationDependencies = createDependencies()): Promise<LegacyPoke5eMigrationResult> {
	let migratedTrainerCount = 0
	let migratedFakemonCount = 0
	let failedTrainers = 0
	let failedFakemon = 0
	let warnings = 0

	const fakemonEntries = new Map(fakemon.map((entry) => [entry.readKey, entry]))
	const migratedFakemon = new Map<string, Fakemon>()

	const migrateFakemon = async (entry: LegacyFakemonBackupEntry, countInBackup: boolean): Promise<Fakemon | undefined> => {
		const existing = migratedFakemon.get(entry.readKey)
		if (existing != null) return existing

		try {
			const result = await migrateOneFakemon(entry, dependencies)
			if (result == null) return undefined

			migratedFakemon.set(entry.readKey, result.fakemon)
			if (countInBackup) migratedFakemonCount += 1
			if (entry.writeKey != null && !result.owned) warnings += 1
			return result.fakemon
		} catch (e) {
			console.error("Could not migrate a legacy fakemon.", e)
			if (countInBackup) failedFakemon += 1
			return undefined
		}
	}

	for (const entry of fakemon) {
		await migrateFakemon(entry, true)
	}

	const resolvePokemonSpecies = async (pokemon: TrainerPokemon): Promise<PokemonSpecies | undefined> => {
		if (!pokemon.pokemonId.isFakemon()) {
			return dependencies.resolveSpecies(pokemon.pokemonId)
		}

		const readKey = pokemon.pokemonId.toFakemonReadKey()
		const entry = fakemonEntries.get(readKey) ?? { readKey }
		return (await migrateFakemon(entry, false))?.species
	}

	for (const entry of trainers) {
		let createdTrainer: Awaited<ReturnType<TrainerDataProvider["newTrainer"]>> | undefined
		try {
			const legacy = await withLegacyTrainerAccess(entry, async () => {
				const data = await dependencies.legacyTrainers.getTrainer(entry.readKey)
				if (data == null) return undefined

				const owned = entry.writeKey != null
					? await dependencies.legacyTrainers.verifyWriteKey(data.info, entry.writeKey)
					: false
				return { data, owned }
			})

			if (legacy == null) {
				failedTrainers += 1
				continue
			}

			createdTrainer = await dependencies.destinationTrainers.newTrainer({
				name: legacy.data.info.name,
				description: legacy.data.info.description,
			})

			const writeKey = createdTrainer.writeKey
			const readKey = createdTrainer.info.readKey

			await dependencies.destinationTrainers.updateTrainerInfo(writeKey, readKey, legacy.data.info)
			await dependencies.destinationTrainers.updateTrainerInventory(writeKey, readKey, legacy.data.info.inventory)
			await dependencies.destinationTrainers.updateTrainerFeats(writeKey, readKey, legacy.data.info.feats)

			if (!await copyTrainerMedia(legacy.data.info.avatar, writeKey, readKey, dependencies)) warnings += 1

			const migratedPokemon: TrainerPokemon[] = []
			for (const legacyPokemon of legacy.data.pokemon) {
				const species = await resolvePokemonSpecies(legacyPokemon)
				if (species == null) throw new Error("Could not resolve a pokemon species while migrating a legacy trainer.")

				const added = await dependencies.destinationTrainers.addPokemonToTeam(
					writeKey,
					readKey,
					createdTrainer.info.id,
					species,
				)
				const migrated: TrainerPokemon = {
					...legacyPokemon,
					id: added.id,
					trainerId: createdTrainer.info.id,
					pokemonId: species.id,
					avatar: undefined,
				}

				await dependencies.destinationTrainers.updatePokemon(writeKey, readKey, migrated)
				await dependencies.destinationTrainers.updateMoveset(writeKey, readKey, migrated.id, legacyPokemon.moves)
				await dependencies.destinationTrainers.updateAllHeldItems(writeKey, migrated.id, legacyPokemon.items)
				await dependencies.destinationTrainers.updatePokemonFeats(writeKey, migrated.id, legacyPokemon.feats)
				if (!await copyPokemonMedia(legacyPokemon, migrated, writeKey, readKey, dependencies)) warnings += 1

				migratedPokemon.push(migrated)
			}

			await dependencies.destinationTrainers.reorderPokemonTeam(writeKey, readKey, migratedPokemon)

			if (!legacy.owned) {
				TrainerLocalStorage.removeWriteKey(readKey)
			}
			if (entry.writeKey != null && !legacy.owned) warnings += 1

			migratedTrainerCount += 1
		} catch (e) {
			console.error("Could not migrate a legacy trainer.", e)
			failedTrainers += 1

			if (createdTrainer != null) {
				await dependencies.destinationTrainers.deleteTrainer(
					createdTrainer.writeKey,
					createdTrainer.info.id,
					createdTrainer.info.readKey,
				).catch(() => {})
			}
		}
	}

	return {
		trainers: migratedTrainerCount,
		fakemon: migratedFakemonCount,
		failedTrainers,
		failedFakemon,
		warnings,
	}
}
