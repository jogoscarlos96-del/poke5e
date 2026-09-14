<script lang="ts">
	import type { PokemonId } from "$lib/trainers/types"
	import { Card } from "$lib/ui/page"
	import { Button, Loader } from "$lib/ui/elements"
	import { ActionArea } from "$lib/ui/forms"
	import type { TrainerStore } from "../trainers"
	import { goto } from "$app/navigation"
	import Editor, { type UpdateDetail } from "./Editor.svelte"
	import { Url } from "$lib/site/url"
	import RequirePokemon from "./RequirePokemon.svelte"
	import WithSpecies from "$lib/poke5e/species/WithSpecies.svelte"
	import { onMount } from "svelte"
	import { MegaEvolution, MegaEvolutionStore, type MegaEvolutionState } from "$lib/pokemon/mega"

	export let trainer: TrainerStore
	export let id: PokemonId
	
	$: canEdit = $trainer.update != null
	$: pokemon = $trainer.pokemon.find((it) => it.id === id)
	$: pokemonTags = $trainer.tags.getForPokemon()

	let saving = false
	let megaLoading = true
	let megaLoadError: string | undefined
	let megaState: MegaEvolutionState = MegaEvolution.empty()

	onMount(() => {
		MegaEvolutionStore.refresh(id, $trainer.info.readKey)
			.then((state) => {
				megaState = state
			})
			.catch((e) => {
				megaLoadError = e instanceof Error ? e.message : String(e)
			})
			.finally(() => {
				megaLoading = false
			})
	})

	const update = (e: CustomEvent<UpdateDetail>) => {
		if (!$trainer.writeKey) return

		saving = true
		const activeFormId = e.detail.megaForms.some((form) => form.id === megaState.activeFormId)
			? megaState.activeFormId
			: null
		const nextMegaState: MegaEvolutionState = {
			forms: e.detail.megaForms,
			activeFormId,
		}

		$trainer.update?.pokemon(e.detail.pokemon, {
			updateAvatar: e.detail.updateAvatar,
		}).then(() => {
			return Promise.all([
				$trainer.update?.moveset(e.detail.pokemon) ?? Promise.resolve(),
				$trainer.update?.heldItems(e.detail.pokemon) ?? Promise.resolve(),
				$trainer.update?.pokemonFeats(e.detail.pokemon) ?? Promise.resolve(),
				MegaEvolutionStore.save(id, $trainer.writeKey, nextMegaState).then((saved) => {
					megaState = saved
				}),
			])
		}).then(() => {
			saving = false
			goto(Url.trainers($trainer.info.readKey, id))
		}).catch(() => {
			saving = false
		})
	}
	const cancel = () => {
		goto(Url.trainers($trainer.info.readKey, id))
	}
</script>

{#if pokemon}
	<RequirePokemon trainer={$trainer} {id} titlePrefix="Edit">
		<WithSpecies let:species ids={[pokemon.pokemonId]}>
			<Card title="Edit {pokemon.nickname}">
				{#if canEdit}
					{#if megaLoading}
						<Loader />
					{:else if megaLoadError}
						<section>
							<p>Could not load Mega Evolution settings: {megaLoadError}</p>
							<ActionArea>
								<Button on:click={cancel} variant="subtle">Go Back</Button>
							</ActionArea>
						</section>
					{:else}
						<Editor {pokemon} {species} megaForms={megaState.forms} {saving} {pokemonTags} on:cancel={cancel} on:update={update} />
					{/if}
				{:else}
					<section>
						<p>You do not have permission to edit this pokemon.</p>
						<ActionArea>
							<Button href="{Url.trainers($trainer.info.readKey, id)}">Go Back</Button>
						</ActionArea>
					</section>
				{/if}
			</Card>
		</WithSpecies>
	</RequirePokemon>
{/if}
