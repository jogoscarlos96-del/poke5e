const PREFIX = "legacy-poke5e-migration::"

export type LegacyTrainerMigrationMapping = {
	readKey: string,
	writeKey?: string,
}

export type LegacyFakemonMigrationMapping = LegacyTrainerMigrationMapping & {
	id: string,
}

const key = (type: "trainer" | "fakemon", legacyReadKey: string) =>
	`${PREFIX}${type}::${legacyReadKey}`

function parseTrainer(value: string | null): LegacyTrainerMigrationMapping | undefined {
	if (value == null) return undefined
	try {
		const parsed = JSON.parse(value)
		if (typeof parsed !== "object" || parsed == null) return undefined
		if (!("readKey" in parsed) || typeof parsed.readKey !== "string") return undefined
		if ("writeKey" in parsed && parsed.writeKey != null && typeof parsed.writeKey !== "string") return undefined
		return {
			readKey: parsed.readKey,
			...(typeof parsed.writeKey === "string" ? { writeKey: parsed.writeKey } : {}),
		}
	} catch {
		return undefined
	}
}

function getTrainer(legacyReadKey: string): LegacyTrainerMigrationMapping | undefined {
	return parseTrainer(localStorage.getItem(key("trainer", legacyReadKey)))
}

function setTrainer(legacyReadKey: string, mapping: LegacyTrainerMigrationMapping): void {
	localStorage.setItem(key("trainer", legacyReadKey), JSON.stringify(mapping))
}

function removeTrainer(legacyReadKey: string): void {
	localStorage.removeItem(key("trainer", legacyReadKey))
}

function getFakemon(legacyReadKey: string): LegacyFakemonMigrationMapping | undefined {
	const storageKey = key("fakemon", legacyReadKey)
	const value = localStorage.getItem(storageKey)
	if (value == null) return undefined

	try {
		const parsed = JSON.parse(value)
		if (typeof parsed !== "object" || parsed == null) return undefined
		if (!("id" in parsed) || typeof parsed.id !== "string") return undefined
		const trainerFields = parseTrainer(JSON.stringify(parsed))
		if (trainerFields == null) return undefined
		return {
			id: parsed.id,
			...trainerFields,
		}
	} catch {
		return undefined
	}
}

function setFakemon(legacyReadKey: string, mapping: LegacyFakemonMigrationMapping): void {
	localStorage.setItem(key("fakemon", legacyReadKey), JSON.stringify(mapping))
}

function removeFakemon(legacyReadKey: string): void {
	localStorage.removeItem(key("fakemon", legacyReadKey))
}

export const LegacyPoke5eMigrationLocalStorage = {
	getTrainer,
	setTrainer,
	removeTrainer,
	getFakemon,
	setFakemon,
	removeFakemon,
} as const
