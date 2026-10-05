import type { TrainerData } from "$lib/trainers/data"
import type { TrainerPokemon } from "$lib/trainers/types"
import { battleMovementSpeedFeet } from "./arena"
import { battleMaxHp } from "./scaling"
import type {
	BattleMoveSnapshot,
	BattlePokemonSnapshot,
	BattleTrainerSnapshot,
	TrainerBattleParticipant,
	TrainerBattleScaling,
	TrainerBattleSide,
} from "./types"

function copyPokemonForBattle(pokemon: TrainerPokemon, scaling: TrainerBattleScaling): BattlePokemonSnapshot {
	const maxHp = battleMaxHp(pokemon.hp.max, pokemon.level.data, scaling)
	const movementMaxFeet = battleMovementSpeedFeet(pokemon)
	const moves: BattleMoveSnapshot[] = pokemon.moves.map((move) => ({
		id: move.id,
		moveId: move.moveId,
		pp: {
			current: move.pp.max,
			max: move.pp.max,
		},
		usageCount: 0,
		revealed: false,
		notes: move.notes,
	}))

	return {
		...pokemon,
		sourcePokemonId: pokemon.id,
		hp: {
			current: maxHp,
			max: maxHp,
		},
		moves,
		status: null,
		volatileStatuses: [],
		revealed: false,
		fainted: false,
		position: null,
		movementMaxFeet,
		movementRemainingFeet: movementMaxFeet,
		activeSlot: null,
	}
}

function copyTrainerForBattle(trainer: TrainerData["info"]): BattleTrainerSnapshot {
	const { readKey: _readKey, hp: _sourceHp, ...trainerCopy } = trainer
	return {
		...trainerCopy,
		sourceTrainerId: trainer.id,
		hp: {
			current: trainer.hp.max,
			max: trainer.hp.max,
		},
	}
}

export function createBattleParticipant(args: {
	trainer: TrainerData,
	pokemonIds: string[],
	side: TrainerBattleSide,
	scaling: TrainerBattleScaling,
}): TrainerBattleParticipant {
	const chosen = args.pokemonIds.map((pokemonId) => {
		const pokemon = args.trainer.pokemon.find((candidate) => candidate.id === pokemonId)
		if (pokemon == null) throw new Error(`Trainer Pokémon not found: ${pokemonId}`)
		return copyPokemonForBattle(pokemon, args.scaling)
	})

	return {
		side: args.side,
		trainer: copyTrainerForBattle(args.trainer.info),
		pokemon: chosen,
		ready: false,
	}
}
