import { Attributes } from "$lib/dnd/attributes"
import { Level } from "$lib/dnd/level"
import { Move } from "$lib/moves/Move"
import type { MoveStats } from "$lib/moves/MoveStats"
import { CustomMove, CustomMovesStore } from "$lib/moves/custom"
import { Stab } from "$lib/pokemon/stab"
import { MovesSrdClient } from "$lib/srd/moves/client"
import type { TrainerPokemon } from "$lib/trainers/types"
import { battleDamageDice } from "./scaling"
import type { BattlePokemonSnapshot, TrainerBattleScaling } from "./types"

const standardMoves = new MovesSrdClient("2024")
const cache = new Map<string, Promise<Move | undefined>>()

async function loadMove(moveId: string): Promise<Move | undefined> {
	if (CustomMove.isCustom(moveId)) {
		const customMoves = await CustomMovesStore.ensureLoaded()
		return customMoves.find((move) => move.id === moveId)
	}

	const json = await standardMoves.one(moveId)
	return json == null ? undefined : Move.fromJson(json)
}

export function resolveBattleMove(moveId: string): Promise<Move | undefined> {
	let pending = cache.get(moveId)
	if (pending == null) {
		pending = loadMove(moveId)
		cache.set(moveId, pending)
	}
	return pending
}

export function calculateBattleMoveStats(
	move: Move,
	pokemon: BattlePokemonSnapshot,
	scaling: TrainerBattleScaling,
): MoveStats {
	const attributes = new Attributes(pokemon.attributes.data)
	const level = new Level(pokemon.level.data)
	const stab = new Stab(pokemon.stab.data)
	const stats = move.calculateMoveStats("2024", {
		attributes,
		level,
		type: pokemon.type.data,
		stab,
	})

	if (stats.damage != null) {
		const scaledDice = battleDamageDice(move, pokemon as unknown as TrainerPokemon, scaling)
		if (scaledDice != null) stats.damage = { ...stats.damage, dice: scaledDice }
	}

	return stats
}

export function battleMoveRangeFeet(move: Move): number | null {
	switch (move.range.type) {
	case "melee": return move.range.reach?.value ?? 5
	case "distance": return move.range.value
	case "self": return 0
	case "varies": return null
	}
}
