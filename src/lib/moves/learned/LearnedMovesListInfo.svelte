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
		abilityNames = [],
		onupdate,
		onapplyhealing,
	}: {
		pokemon: TrainerPokemon
		editable?: boolean,
		pokemonType?: PokemonType,
		attributeModifierMultiplier?: number,
		abilityNames?: string[],
		onupdate?: (value: LearnedMove) => void,
		onapplyhealing?: (value: number) => void,
	} = $props()

	const featNames = $derived(pokemon.feats.map((feat) => feat.name))

	const onUpdatePp = (move: LearnedMove, rank: number) => (pp: number) => {
		onupdate?.({
			...move,
			rank,
			pp: {
				current: pp,
				max: move.pp.max,
			},
		})
	}
</script>

<ul>
	{#each pokemon.moves as move, rank}
		<li>
			<LearnedMoveInfo
				value={move}
				{editable}
				level={pokemon.level}
				attributes={pokemon.attributes}
				{pokemonType}
				stab={pokemon.stab}
				{attributeModifierMultiplier}
				{abilityNames}
				{featNames}
				currentHp={pokemon.hp.current}
				maxHp={pokemon.hp.max}
				onupdatepp={onUpdatePp(move, rank)}
				{onapplyhealing}
			/>
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
