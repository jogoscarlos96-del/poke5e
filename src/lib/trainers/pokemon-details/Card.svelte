<script lang="ts">
	import { WithSpecies } from "$lib/poke5e/species"
	import { Card } from "$lib/ui/page"
	import { TypeTag } from "$lib/pokemon/types"
	import type { LearnedMove, PokemonId, TrainerPokemon } from "$lib/trainers/types"
	import type { TrainerStore } from "../trainers"
	import Info from "./Info.svelte"
	import RequirePokemon from "./RequirePokemon.svelte"
	import TrainerPokemonActions from "./TrainerPokemonActions.svelte"
	import { Url } from "$lib/site/url"
	import { PageAction } from "../page-action"
	import { EvolutionStore } from "$lib/pokemon/evolution"
	import { MegaDefinitionsStore, MegaEvolution, MegaEvolutionControl, MegaEvolutionStore } from "$lib/pokemon/mega"
	import { onMount } from "svelte"

	export let trainer: TrainerStore
	export let id: PokemonId

	const evolutions = EvolutionStore.all()

	$: canEdit = $trainer.update != null
	$: pokemon = $trainer.pokemon.find((it) => it.id === id)
	$: pokemonTags = $trainer.tags.getForPokemon()
	$: megaState = pokemon ? ($MegaEvolutionStore[pokemon.id] ?? MegaEvolution.empty()) : MegaEvolution.empty()
	$: availableMegaDefinitions = pokemon
		? MegaDefinitionsStore.forSpecies($MegaDefinitionsStore.result, pokemon.pokemonId.data)
		: []
	$: selectedMegaDefinition = MegaEvolution.selectedDefinition(megaState, availableMegaDefinitions)
	$: evolutionDataReady = $evolutions != null
	$: isFinalEvolution = pokemon != null && evolutionDataReady && ($evolutions?.evolvesTo(pokemon.pokemonId).length ?? 0) === 0
	$: megaEligible = pokemon != null && MegaEvolution.eligibility(pokemon, isFinalEvolution, evolutionDataReady).eligible
	$: effectiveType = pokemon ? MegaEvolution.effectiveType(pokemon, selectedMegaDefinition, megaEligible) : undefined
	$: showMegaControl = pokemon != null && MegaEvolution.hasMegaliteStone(pokemon) && availableMegaDefinitions.length > 0

	onMount(() => {
		void MegaDefinitionsStore.refresh().catch(() => {})
		if (pokemon) {
			MegaEvolutionStore.refresh(pokemon.id, $trainer.info.readKey).catch(() => {})
		}
	})

	const onUpdateHealth = (e: CustomEvent<TrainerPokemon>) => {
		$trainer.update?.pokemon(e.detail, {
			optimistic: true,
		})
	}

	const onUpdatePp = (e: CustomEvent<LearnedMove>) => {
		$trainer.update?.move(e.detail, {
			optimistic: true,
		})
	}

	const onUpdateBond = (e: CustomEvent<TrainerPokemon>) => {
		$trainer.update?.pokemon(e.detail, {
			optimistic: true,
		})
	}

	const onUpdateTags = (e: CustomEvent<TrainerPokemon>) => {
		$trainer.tags.pokemon(e.detail)
	}
</script>

{#if pokemon}
	<RequirePokemon trainer={$trainer} {id}>
		<WithSpecies let:species ids={[pokemon?.pokemonId]}>
			<Card title={pokemon.nickname} dismissToHref="{Url.trainers($trainer.info.readKey, undefined, PageAction.fullList)}">
				{#if effectiveType}<TypeTag slot="header-extra" type={effectiveType.data} />{/if}
				{#if showMegaControl}
					<MegaEvolutionControl {pokemon} {species} {trainer} definitions={availableMegaDefinitions} />
				{/if}
				<Info trainer={$trainer.info} {pokemon} {species} editable={canEdit} {pokemonTags} megaDefinition={selectedMegaDefinition} {megaEligible} on:update-health={onUpdateHealth} on:update-pp={onUpdatePp} on:update-bond={onUpdateBond} on:update-tags={onUpdateTags} />
				{#if canEdit}
					<TrainerPokemonActions {trainer} {species} {pokemon} />
				{/if}
			</Card>
		</WithSpecies>
	</RequirePokemon>
{/if}