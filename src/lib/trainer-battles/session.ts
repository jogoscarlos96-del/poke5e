import type { TrainerBattleFormat, TrainerBattleSettings, TrainerBattleTeamSize, TrainerBattleScaling } from "./types"

const formats: TrainerBattleFormat[] = ["singles", "doubles"]
const teamSizes: TrainerBattleTeamSize[] = [3, 4, 6]
const scalingModes: TrainerBattleScaling[] = ["keep", "scale"]

export function validateTrainerBattleSettings(settings: TrainerBattleSettings): TrainerBattleSettings {
	if (!formats.includes(settings.format)) throw new Error("Unsupported Trainer Battle format.")
	if (!teamSizes.includes(settings.teamSize)) throw new Error("Unsupported Trainer Battle team size.")
	if (!scalingModes.includes(settings.scaling)) throw new Error("Unsupported Trainer Battle scaling mode.")
	return settings
}

export function activePokemonLimit(format: TrainerBattleFormat): number {
	return format === "doubles" ? 2 : 1
}
