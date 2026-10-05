import type {
	BattlePokemonSnapshot,
	OpponentBattleProjection,
	PublicOpponentPokemon,
} from "./types"

function publicPokemon(pokemon: BattlePokemonSnapshot): PublicOpponentPokemon | undefined {
	if (!pokemon.revealed && !pokemon.fainted) return undefined

	return {
		id: pokemon.id,
		nickname: pokemon.nickname,
		pokemonId: pokemon.pokemonId,
		revealed: pokemon.revealed,
		fainted: pokemon.fainted,
		activeSlot: pokemon.activeSlot,
		position: pokemon.position,
		status: pokemon.status,
		volatileStatuses: pokemon.volatileStatuses,
		moves: pokemon.moves
			.filter((move) => move.revealed)
			.map((move) => ({
				moveId: move.moveId,
				usageCount: move.usageCount,
			})),
	}
}

export function createOpponentProjection(pokemon: BattlePokemonSnapshot[]): OpponentBattleProjection {
	return {
		pokemon: pokemon.map(publicPokemon).filter((entry): entry is PublicOpponentPokemon => entry != null),
		unrevealedCount: pokemon.filter((entry) => !entry.revealed && !entry.fainted).length,
	}
}
