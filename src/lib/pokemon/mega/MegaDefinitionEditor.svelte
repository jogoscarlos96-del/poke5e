<script lang="ts">
	import { Ability, AbilityStore } from "$lib/pokemon/ability"
	import { SpeciesField, type PokemonSpecies } from "$lib/poke5e/species"
	import { PokemonType, type PokeType } from "$lib/pokemon/types"
	import { Button } from "$lib/ui/elements"
	import { ImageField, SelectField, TextareaField, TextField, type ImageInputValue } from "$lib/ui/forms"
	import { createEventDispatcher } from "svelte"
	import type { DraftMegaDefinition, MegaDefinition } from "./MegaDefinition"

	type AbilityMode = "none" | "reference" | "custom"

	export let value: MegaDefinition | undefined = undefined
	export let allSpecies: PokemonSpecies[] = []
	export let disabled = false
	export let submitLabel = "Save Mega Evolution"

	const dispatch = createEventDispatcher<{
		save: {
			value: DraftMegaDefinition,
			portrait?: ImageInputValue,
			sprite?: ImageInputValue,
		}
	}>()

	let speciesId = value?.speciesId ?? ""
	let name = value?.name ?? ""
	let primaryType: string = value?.type?.primary ?? ""
	let secondaryType: string = value?.type?.secondary ?? ""
	let abilityMode: AbilityMode = value?.ability?.referenceId ? "reference" : value?.ability ? "custom" : "none"
	let abilityReferenceId = value?.ability?.referenceId ?? ""
	let customAbilityName = value?.ability?.custom ? value.ability.name : ""
	let customAbilityDescription = value?.ability?.custom ? value.ability.description : ""
	let portrait: ImageInputValue | undefined
	let sprite: ImageInputValue | undefined
	let portraitValid = true
	let spriteValid = true
	let error: string | undefined

	const noOverride = { name: "Use base Pokémon", value: "" }
	const typeOptions = [
		noOverride,
		...PokemonType.list.map((type) => ({ name: PokemonType.name(type), value: type })),
	]
	const secondaryTypeOptions = [
		{ name: "None", value: "" },
		...PokemonType.list.map((type) => ({ name: PokemonType.name(type), value: type })),
	]
	const abilityModeOptions = [
		{ name: "Use base Pokémon", value: "none" },
		{ name: "Published ability", value: "reference" },
		{ name: "Custom ability", value: "custom" },
	]
	$: abilityOptions = [
		{ name: "Select an ability", value: "" },
		...($AbilityStore.result ?? [])
			.filter((ability) => ability.referenceId != null)
			.map((ability) => ({ name: ability.name, value: ability.referenceId })),
	]

	const save = async () => {
		error = undefined
		if (!speciesId) {
			error = "Select a base species."
			return
		}
		if (!name.trim()) {
			error = "Enter a Mega Evolution name."
			return
		}
		if (!portraitValid || !spriteValid) {
			error = "Portrait and sprite uploads must each be 512 KiB or smaller."
			return
		}

		const typeValues = [primaryType, secondaryType]
			.filter(PokemonType.isPokeType)
			.filter((type, index, values) => values.indexOf(type) === index) as PokeType[]
		const type = primaryType && typeValues.length > 0 ? new PokemonType(typeValues) : undefined

		let ability: Ability | undefined
		if (abilityMode === "reference") {
			if (!abilityReferenceId) {
				error = "Select an ability override."
				return
			}
			ability = await Ability.resolve(abilityReferenceId)
		} else if (abilityMode === "custom") {
			if (!customAbilityName.trim()) {
				error = "Enter a name for the custom ability."
				return
			}
			ability = new Ability({
				name: customAbilityName.trim(),
				description: customAbilityDescription.trim(),
			})
		}

		dispatch("save", {
			value: {
				speciesId,
				name: name.trim(),
				type,
				ability,
				// Any explicit media change replaces/removes legacy URL fallbacks. The
				// uploaded filenames themselves are stored separately by updateMedia().
				portrait: portrait == null ? value?.portrait : undefined,
				sprite: sprite == null ? value?.sprite : undefined,
			},
			portrait,
			sprite,
		})
	}
</script>

<form on:submit|preventDefault={save}>
	<div class="form-grid">
		<SpeciesField
			label="Base species"
			name="mega-base-species"
			value={speciesId}
			{allSpecies}
			required
			{disabled}
			on:change={(event) => speciesId = event.detail.species?.id.data ?? ""}
		/>
		<TextField label="Mega Evolution name" bind:value={name} required {disabled} maxlength={80} />
	</div>

	<fieldset>
		<legend>Type override</legend>
		<p class="hint">Leave this unchanged to keep the base Pokémon's type while Mega Evolved.</p>
		<div class="form-grid">
			<SelectField label="Primary type" value={primaryType} options={typeOptions} {disabled} on:change={(event) => {
				primaryType = event.detail.value
				if (!primaryType) secondaryType = ""
			}} />
			<SelectField label="Secondary type" value={secondaryType} options={secondaryTypeOptions} disabled={disabled || !primaryType} on:change={(event) => secondaryType = event.detail.value} />
		</div>
	</fieldset>

	<fieldset>
		<legend>Ability override</legend>
		<SelectField label="Mega ability" value={abilityMode} options={abilityModeOptions} {disabled} on:change={(event) => abilityMode = event.detail.value as AbilityMode} />
		{#if abilityMode === "reference"}
			<SelectField label="Published ability" value={abilityReferenceId} options={abilityOptions} {disabled} on:change={(event) => abilityReferenceId = event.detail.value} />
		{:else if abilityMode === "custom"}
			<div class="form-grid custom-ability">
				<TextField label="Custom ability name" bind:value={customAbilityName} required {disabled} />
				<TextareaField label="Custom ability description" bind:value={customAbilityDescription} rows={4} {disabled} />
			</div>
		{/if}
	</fieldset>

	<fieldset>
		<legend>Images</legend>
		<p class="hint">Portrait and sprite are independent. Each image may be up to 512 KiB.</p>
		<div class="media-grid">
			<ImageField label="Mega portrait" previousValue={value?.portrait?.href} maxbytes={512 * 1024} {disabled} bind:currentValue={portrait} bind:isValid={portraitValid} />
			<ImageField label="Mega sprite" previousValue={value?.sprite?.href} maxbytes={512 * 1024} {disabled} bind:currentValue={sprite} bind:isValid={spriteValid} />
		</div>
	</fieldset>

	{#if error}<p class="error">{error}</p>{/if}
	<div class="actions"><Button type="submit" variant="success" {disabled}>{submitLabel}</Button></div>
</form>

<style>
	form { display: flex; flex-direction: column; gap: 1rem; max-width: 52rem; }
	fieldset { border: 1px solid var(--skin-input-bg); border-radius: 0.5rem; padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
	legend { font-weight: bold; padding-inline: 0.25rem; }
	.form-grid, .media-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
	.custom-ability { margin-top: 0.25rem; }
	.hint { margin: 0; opacity: 0.75; font-size: var(--font-sz-venus); }
	.actions { display: flex; justify-content: flex-end; }
	.error { color: var(--skin-danger-text, currentColor); font-weight: bold; }
	@media (max-width: 42rem) {
		.form-grid, .media-grid { grid-template-columns: 1fr; }
	}
</style>
