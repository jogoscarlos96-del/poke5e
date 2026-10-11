import type { TrainerPokemon } from "$lib/trainers/types"
import type { Move } from "$lib/moves/Move"
import type { TrainerBattleScaleContext, TrainerBattleScaling } from "./types"

export const TRAINER_BATTLE_SCALE_LEVEL = 10

export function battleMaxHp(sourceMaxHp: number, level: number, scaling: TrainerBattleScaling): number {
	if (scaling !== "scale" || level <= TRAINER_BATTLE_SCALE_LEVEL) return sourceMaxHp
	return Math.max(1, Math.floor(sourceMaxHp / 2))
}

export function battleScaleContext(level: number, scaling: TrainerBattleScaling): TrainerBattleScaleContext {
	return {
		actualLevel: level,
		damageTierLevel: scaling === "scale" && level > TRAINER_BATTLE_SCALE_LEVEL
			? TRAINER_BATTLE_SCALE_LEVEL
			: level,
	}
}

export function battleDamageDice(move: Move, pokemon: TrainerPokemon, scaling: TrainerBattleScaling): string | undefined {
	const context = battleScaleContext(pokemon.level.data, scaling)
	if (move.dice != null) return move.dice.tiers[(context.damageTierLevel >= 5 ? 1 : 0) + (context.damageTierLevel >= 10 ? 1 : 0) + (context.damageTierLevel >= 17 ? 1 : 0)]
	return move.damage?.getDamageDice(context.damageTierLevel)
}
