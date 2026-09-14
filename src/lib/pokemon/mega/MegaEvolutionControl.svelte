<script lang="ts">
	import { onMount } from "svelte"
	import { SelectField } from "$lib/ui/forms"
	import { EvolutionStore } from "$lib/pokemon/evolution"
	import type { PokemonSpecies } from "$lib/poke5e/species"
	import type { TrainerStore } from "$lib/trainers/trainers"
	import type { TrainerPokemon } from "$lib/trainers/types"
	import { MegaEvolution, MegaEvolutionStore, type MegaDefinition } from "."

	const evolutions = EvolutionStore.all()
	const megaToggleOptions = [
		{ name: "No", value: "no" },
		{ name: "Yes", value: "yes" },
	]

	export let pokemon: TrainerPokemon
	export let species: PokemonSpecies
	export let trainer: TrainerStore
	export let definitions: MegaDefinition[] = []

	let saving = false
	let error: string | undefined
	let megaChoice = "no"
	let selectedDefinitionId = ""
	let lastSyncedId: string | null | undefined = undefined

	$: state = $MegaEvolutionStore[pokemon.id] ?? MegaEvolution.empty()
	$: selectedDefinition = MegaEvolution.selectedDefinition(state, definitions)
	$: formOptions = definitions.map((definition) => ({ name: definition.name, value: definition.id }))

	$: if ((state.selectedMegaId ?? null) !== lastSyncedId) {
		lastSyncedId = state.selectedMegaId ?? null
		megaChoice = state.selectedMegaId ? "yes" : "no"
		selectedDefinitionId = state.selectedMegaId ?? definitions[0]?.id ?? ""
	}

	$: if (!selectedDefinitionId && definitions.length > 0) selectedDefinitionId = definitions[0].id

	$: evolutionDataReady = $evolutions != null
	$: isFinalEvolution = evolutionDataReady && ($evolutions?.evolvesTo(species.id).length ?? 0) === 0
	$: eligibility = MegaEvolution.eligibility(pokemon, isFinalEvolution, evolutionDataReady)
	$: isActive = selectedDefinition != null && eligibility.eligible
	$: canEdit = $trainer.update != null && $trainer.writeKey != null
	$: canSelectMega = canEdit && definitions.length > 0 && eligibility.eligible

	onMount(() => {
		MegaEvolutionStore.refresh(pokemon.id, $trainer.info.readKey).catch((e) => {
			error = e instanceof Error ? e.message : String(e)
		})
	})

	const saveSelection = async (selectedMegaId: string | null) => {
		if (!$trainer.writeKey) return
		saving = true
		error = undefined
		try {
			await MegaEvolutionStore.save(pokemon.id, $trainer.writeKey, { selectedMegaId })
		} catch (e) {
			error = e instanceof Error ? e.message : String(e)
		} finally {
			saving = false
		}
	}

	const restoreChoiceFromState = () => {
		megaChoice = state.selectedMegaId ? "yes" : "no"
		selectedDefinitionId = state.selectedMegaId ?? definitions[0]?.id ?? ""
	}

	const onChoiceChange = async () => {
		if (megaChoice === "no") {
			await saveSelection(null)
			return
		}

		if (!canSelectMega) {
			restoreChoiceFromState()
			return
		}

		const definitionId = definitions.length === 1
			? definitions[0].id
			: selectedDefinitionId || definitions[0]?.id
		if (!definitionId) {
			restoreChoiceFromState()
			return
		}

		selectedDefinitionId = definitionId
		await saveSelection(definitionId)
	}

	const onDefinitionChange = async () => {
		if (megaChoice !== "yes" || !canSelectMega || !selectedDefinitionId) return
		await saveSelection(selectedDefinitionId)
	}
</script>

<div class:active={isActive} class:invalid-active={selectedDefinition != null && !isActive} class="mega-control">
	<div class="heading">
		<strong>Mega Evolution</strong>
		{#if isActive}<span class="badge">MEGA</span>{/if}
	</div>

	<div class="choose-form">
		<SelectField label="Mega Evolution" options={megaToggleOptions} bind:value={megaChoice} on:change={onChoiceChange} disabled={saving || !canEdit} />

		{#if megaChoice === "yes"}
			{#if definitions.length > 1}
				<SelectField label="Mega Form" options={formOptions} bind:value={selectedDefinitionId} on:change={onDefinitionChange} disabled={saving || !canSelectMega} />
			{:else if definitions.length === 1}
				<div class="single-form">
					<span>Mega Form</span>
					<strong>{definitions[0].name}</strong>
				</div>
			{/if}
		{/if}
	</div>

	{#if isActive}
		<p class="rules"><strong>{selectedDefinition?.name}</strong> · +2 AC · doubled ability modifiers for attacks, damage, saving throws, and save DCs{#if selectedDefinition?.type} · {selectedDefinition.type.toString()} type{/if}</p>
	{:else if selectedDefinition != null && !eligibility.eligible}
		<p class="warning">The selected Mega Evolution is stored but not currently applied: {eligibility.reason}</p>
	{:else if megaChoice === "yes" && !eligibility.eligible}
		<p class="hint">{eligibility.reason}</p>
	{/if}

	{#if !canEdit}<p class="hint">Read-only sheet.</p>{/if}
	{#if error}<p class="error">{error}</p>{/if}
</div>

<style>
	.mega-control { margin-block: 0.5rem 1rem; padding: 0.75rem 1rem; border: 0.0625rem solid var(--skin-input-bg); border-radius: 0.5rem; }
	.mega-control.active { border-width: 0.125rem; }
	.mega-control.invalid-active { border-style: dashed; }
	.heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
	.badge { padding: 0.15em 0.4em; border-radius: 0.25em; background: var(--skin-bg); color: var(--skin-bg-text); font-size: var(--font-sz-mars); font-weight: bold; }
	.rules, .hint, .warning, .error { margin: 0.5em 0 0; font-size: var(--font-sz-venus); }
	.hint { opacity: 0.8; }
	.warning, .error { color: var(--red-text); font-weight: bold; }
	.choose-form { display: grid; grid-template-columns: minmax(10rem, 1fr) minmax(10rem, 1fr); align-items: end; gap: 0.5rem; margin-block-start: 0.75rem; }
	.single-form { display: flex; flex-direction: column; gap: 0.25rem; padding-block: 0.25rem; }
	.single-form span { font-size: var(--font-sz-venus); opacity: 0.8; }
	@media (max-width: 50rem) { .choose-form { grid-template-columns: 1fr; } }
</style>
