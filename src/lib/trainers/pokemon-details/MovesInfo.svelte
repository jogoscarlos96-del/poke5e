<script lang="ts">
	import { LearnedMovesListInfo } from "$lib/moves/learned"
	import { MovesStore } from "$lib/moves/store"
	import type { PokemonType } from "$lib/pokemon/types"
	import { Loader } from "$lib/ui/elements"
	import { createEventDispatcher } from "svelte"
	import type { LearnedMove, TrainerPokemon } from "../types"

	const dispatch = createEventDispatcher()

	export let pokemon: TrainerPokemon
	export let editable: boolean = false
	export let pokemonType: PokemonType = pokemon.type
	export let attributeModifierMultiplier = 1
	export let abilityNames: string[] = []

	const onUpdate = (move: LearnedMove) => {
		dispatch("update", { ...move } as LearnedMove)
	}

	const onApplyHealing = (value: number) => {
		dispatch("apply-healing", { healing: value })
	}
</script>

{#if pokemon.moves.length > 0}
	{#if $MovesStore.result}
		<h2>Moves</h2>
		<LearnedMovesListInfo
			{pokemon}
			{editable}
			{pokemonType}
			{attributeModifierMultiplier}
			{abilityNames}
			onupdate={onUpdate}
			onapplyhealing={onApplyHealing}
		/>
	{:else}
		<Loader />
	{/if}
{/if}