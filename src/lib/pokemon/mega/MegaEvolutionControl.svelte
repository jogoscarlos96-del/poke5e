<script lang="ts">
	import { onMount } from "svelte"
	import { Button } from "$lib/ui/elements"
	import { SelectField } from "$lib/ui/forms"
	import { EvolutionStore } from "$lib/pokemon/evolution"
	import type { PokemonSpecies } from "$lib/poke5e/species"
	import type { TrainerStore } from "$lib/trainers/trainers"
	import type { TrainerPokemon } from "$lib/trainers/types"
	import { MegaEvolution, MegaEvolutionStore } from "."

	const evolutions = EvolutionStore.all()

	export let pokemon: TrainerPokemon
	export let species: PokemonSpecies
	export let trainer: TrainerStore

	let saving = false
	let error: string | undefined
	let selectedFormId = ""

	$: state = $MegaEvolutionStore[pokemon.id] ?? MegaEvolution.empty()
	$: activeForm = MegaEvolution.activeForm(state)
	$: isActive = activeForm != null
	$: formOptions = state.forms.map((form) => ({ name: form.name, value: form.id }))
	$: if (!selectedFormId && state.forms.length > 0) selectedFormId = state.forms[0].id

	$: hasMegalite = MegaEvolution.hasMegaliteStone(pokemon)
	$: highEnoughLevel = pokemon.level.data >= 10
	$: isFinalEvolution = ($evolutions?.evolvesTo(species.id).length ?? 0) === 0
	$: canEdit = $trainer.update != null && $trainer.writeKey != null
	$: canMegaEvolve = canEdit && state.forms.length > 0 && hasMegalite && highEnoughLevel && isFinalEvolution

	$: unavailableReason = !canEdit ? "Read-only sheet."
		: state.forms.length === 0 ? "Configure a Mega form in Edit Pokémon first."
		: !highEnoughLevel ? "Mega Evolution requires level 10 or higher."
		: !isFinalEvolution ? "Mega Evolution requires a final-stage Pokémon."
		: !hasMegalite ? "This Pokémon must hold a Megalite Stone."
		: undefined

	onMount(() => {
		MegaEvolutionStore.refresh(pokemon.id, $trainer.info.readKey).catch((e) => {
			error = e instanceof Error ? e.message : String(e)
		})
	})

	const setActive = async (activeFormId: string | null) => {
		if (!$trainer.writeKey) return
		saving = true
		error = undefined
		try {
			await MegaEvolutionStore.save(pokemon.id, $trainer.writeKey, {
				...state,
				activeFormId,
			})
		} catch (e) {
			error = e instanceof Error ? e.message : String(e)
		} finally {
			saving = false
		}
	}
</script>

<div class:active={isActive} class="mega-control">
	<div class="heading">
		<div>
			<strong>{isActive ? activeForm?.name : "Mega Evolution"}</strong>
			{#if isActive}<span class="badge">MEGA</span>{/if}
		</div>
		{#if isActive}
			<Button on:click={() => setActive(null)} disabled={saving || !canEdit} variant="subtle">{saving ? "Reverting…" : "Revert"}</Button>
		{/if}
	</div>

	{#if isActive}
		<p class="rules">+2 AC · doubled ability modifiers for attacks, damage, saving throws, and save DCs{#if activeForm?.type} · {activeForm.type.toString()} type{/if}</p>
	{:else if state.forms.length === 1}
		<Button on:click={() => setActive(state.forms[0].id)} disabled={saving || !canMegaEvolve}>{saving ? "Transforming…" : `Mega Evolve — ${state.forms[0].name}`}</Button>
	{:else if state.forms.length > 1}
		<div class="choose-form">
			<SelectField label="Mega Form" options={formOptions} bind:value={selectedFormId} disabled={saving} />
			<Button on:click={() => setActive(selectedFormId)} disabled={saving || !canMegaEvolve || !selectedFormId}>{saving ? "Transforming…" : "Mega Evolve"}</Button>
		</div>
	{/if}

	{#if !isActive && unavailableReason}<p class="hint">{unavailableReason}</p>{/if}
	{#if error}<p class="error">{error}</p>{/if}
</div>

<style>
	.mega-control { margin-block: 0.5rem 1rem; padding: 0.75rem 1rem; border: 0.0625rem solid var(--skin-input-bg); border-radius: 0.5rem; }
	.mega-control.active { border-width: 0.125rem; }
	.heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
	.badge { margin-inline-start: 0.5em; padding: 0.15em 0.4em; border-radius: 0.25em; background: var(--skin-bg); color: var(--skin-bg-text); font-size: var(--font-sz-mars); font-weight: bold; }
	.rules, .hint, .error { margin: 0.5em 0 0; font-size: var(--font-sz-venus); }
	.hint { opacity: 0.8; }
	.error { color: var(--red-text); font-weight: bold; }
	.choose-form { display: grid; grid-template-columns: minmax(10rem, 1fr) auto; align-items: end; gap: 0.5rem; margin-block-start: 0.75rem; }
	@media (max-width: 37.5rem) { .choose-form { grid-template-columns: 1fr; } }
</style>
