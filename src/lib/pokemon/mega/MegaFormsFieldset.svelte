<script lang="ts">
	import { Ability, AbilityStore } from "$lib/pokemon/ability"
	import { PokemonType, type PokeType } from "$lib/pokemon/types"
	import { Button } from "$lib/ui/elements"
	import { Fieldset, MarkdownField, SelectField, TextField, type SelectFieldChangeEvent } from "$lib/ui/forms"
	import { MegaEvolution, type MegaForm } from "./MegaEvolution"

	export let forms: MegaForm[] = []
	export let disabled = false

	const none = { name: "— None —", value: "" }
	const customAbility = { name: "— Custom Ability —", value: "__custom__" }
	const typeOptions = [none, ...PokemonType.list.map((type) => ({ name: PokemonType.name(type), value: type }))]
	$: abilityOptions = [none, ...($AbilityStore.result ?? []).filter((ability) => !ability.deprecated).map((ability) => ({
		name: ability.name,
		value: ability.referenceId,
	})), customAbility]

	const touch = () => { forms = [...forms] }

	const addForm = () => {
		const label = forms.length === 0 ? "Mega" : `Mega ${String.fromCharCode(88 + Math.min(forms.length - 1, 2))}`
		forms = [...forms, MegaEvolution.newForm(label)]
	}

	const removeForm = (id: string) => {
		forms = forms.filter((form) => form.id !== id)
	}

	const changePrimaryType = (form: MegaForm, event: SelectFieldChangeEvent) => {
		const primary = event.detail.value as PokeType | ""
		if (!primary) {
			form.type = undefined
		} else {
			const secondary = form.type?.data[1]
			form.type = new PokemonType([primary, ...(secondary && secondary !== primary ? [secondary] : [])])
		}
		touch()
	}

	const changeSecondaryType = (form: MegaForm, event: SelectFieldChangeEvent) => {
		if (!form.type) return
		const secondary = event.detail.value as PokeType | ""
		const primary = form.type.primary
		form.type = new PokemonType([primary, ...(secondary && secondary !== primary ? [secondary] : [])])
		touch()
	}

	const changeAbility = async (form: MegaForm, event: SelectFieldChangeEvent) => {
		if (!event.detail.value) {
			form.ability = undefined
		} else if (event.detail.value === customAbility.value) {
			form.ability = Ability.createNewCustom()
		} else {
			form.ability = await Ability.resolve(event.detail.value)
		}
		touch()
	}
</script>

<Fieldset title="Mega Forms">
	<div class="intro">
		<p>Configure one or more Mega forms. Every form automatically receives the universal Mega Evolution rules (+2 AC and doubled ability-score modifiers for attacks, damage, saves, and save DCs).</p>
		<p>Type, ability, and portrait are optional overrides. HP, known moves, and PP are never part of a Mega form.</p>
	</div>

	{#if forms.length === 0}
		<p class="empty">No Mega forms configured.</p>
	{/if}

	{#each forms as form, index (form.id)}
		<div class="mega-form">
			<div class="form-heading">
				<strong>{form.name || `Mega Form ${index + 1}`}</strong>
				<Button variant="danger" on:click={() => removeForm(form.id)} {disabled}>Remove</Button>
			</div>
			<div class="fields">
				<TextField label="Form Name" bind:value={form.name} on:change={touch} {disabled} required />
				<TextField label="Mega Portrait URL (optional)" value={form.imageUrl ?? ""} on:change={(event) => { form.imageUrl = event.detail.value || undefined; touch() }} {disabled} />
				<SelectField label="Primary Type Override" options={typeOptions} value={form.type?.primary ?? ""} on:change={(event) => changePrimaryType(form, event)} {disabled} />
				<SelectField label="Secondary Type Override" options={typeOptions} value={form.type?.secondary ?? ""} on:change={(event) => changeSecondaryType(form, event)} disabled={disabled || !form.type} />
				<SelectField label="Mega Ability Override" options={abilityOptions} value={form.ability?.custom ? customAbility.value : form.ability?.referenceId ?? ""} on:change={(event) => changeAbility(form, event)} {disabled} />
				{#if form.ability?.custom}
					<div class="custom-ability">
						<TextField label="Custom Ability Name" bind:value={form.ability.data.name} on:change={touch} {disabled} required />
						<MarkdownField label="Custom Ability Description" bind:value={form.ability.data.description} on:change={touch} {disabled} />
					</div>
				{/if}
			</div>
		</div>
	{/each}

	<div class="add-row">
		<Button on:click={addForm} variant="subtle" {disabled}>+ Add Mega Form</Button>
	</div>
</Fieldset>

<style>
	.intro, .empty { grid-column: 1 / -1; font-size: var(--font-sz-venus); }
	.intro p { margin-block: 0 0.5em; }
	.mega-form { grid-column: 1 / -1; border: 0.0625em solid var(--skin-input-bg); border-radius: 0.5em; padding: 0.75em; }
	.form-heading { display: flex; justify-content: space-between; align-items: center; gap: 1em; margin-block-end: 1em; }
	.fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1em 0.5em; }
	.custom-ability { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1em 0.5em; }
	.add-row { grid-column: 1 / -1; display: flex; justify-content: flex-end; }
	@media (max-width: 50rem) {
		.fields, .custom-ability { grid-template-columns: 1fr; }
	}
</style>
