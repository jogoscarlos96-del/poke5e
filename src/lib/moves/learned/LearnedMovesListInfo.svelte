<script lang="ts">
	import type { PokemonType } from "$lib/pokemon/types"
	import type { TrainerPokemon } from "$lib/trainers/types"
	import type { LearnedMove } from "./LearnedMove"
	import LearnedMoveInfo from "./LearnedMoveInfo.svelte"

	let {
		pokemon,
		editable = false,
		pokemonType = pokemon.type,
		attributeModifierMultiplier = 1,
		onupdate,
	}: {
		pokemon: TrainerPokemon
		editable?: boolean,
		pokemonType?: PokemonType,
		attributeModifierMultiplier?: number,
		onupdate?: (value: LearnedMove) => void
	} = $props()

	const onUpdatePp = (move: LearnedMove) => (pp: number) => {
		onupdate?.({
			...move,
			pp: {
				current: pp,
				max: move.pp.max,
			},
		})
	}
</script>

<ul>
	{#each pokemon.moves as move}
		<li>
			<LearnedMoveInfo value={move} {editable} level={pokemon.level} attributes={pokemon.attributes} {pokemonType} stab={pokemon.stab} {attributeModifierMultiplier} onupdatepp={onUpdatePp(move)} />
		</li>
	{/each}
</ul>

<style>
	ul {
		list-style: none;
		padding: 0;
		margin-block: 0;
	}
</style>
