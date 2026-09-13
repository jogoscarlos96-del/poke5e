<script lang="ts">
	import type { Attribute } from "$lib/dnd/attributes"
	import type { Move } from "$lib/moves/Move"
	import { PokemonType } from "$lib/pokemon/types"
	import { Button } from "$lib/ui/elements"
	import { IntField, MarkdownField, SelectField, TextField, type SelectFieldChangeEvent } from "$lib/ui/forms"
	import { createEventDispatcher } from "svelte"

	export let value: Move
	export let disabled = false
	export let submitLabel = "Save Move"

	const dispatch = createEventDispatcher()

	const attributes: { value: Attribute, name: string }[] = [
		{ value: "str", name: "STR" },
		{ value: "dex", name: "DEX" },
		{ value: "con", name: "CON" },
		{ value: "int", name: "INT" },
		{ value: "wis", name: "WIS" },
		{ value: "cha", name: "CHA" },
	]

	const typeOptions = PokemonType.list.map((type) => ({ name: type, value: type }))
		.concat([
			{ name: "Typeless", value: "typeless" },
			{ name: "Varies", value: "varies" },
		])

	const timeOptions = [
		{ name: "Action", value: "action" },
		{ name: "Bonus Action", value: "bonus action" },
		{ name: "Reaction", value: "reaction" },
	]

	const rangeOptions = [
		{ name: "Melee", value: "melee" },
		{ name: "Distance", value: "distance" },
		{ name: "Self", value: "self" },
		{ name: "Varies", value: "varies" },
	]

	const durationOptions = [
		{ name: "Instantaneous", value: "instantaneous" },
		{ name: "Rounds", value: "round" },
		{ name: "Minutes", value: "minute" },
		{ name: "Varies", value: "varies" },
	]

	const attackOptions = [
		{ name: "No attack roll", value: "" },
		{ name: "Melee attack", value: "melee" },
		{ name: "Ranged attack", value: "ranged" },
	]

	const saveOptions = [
		{ name: "No saving throw", value: "" },
		...attributes.map((it) => ({ name: `${it.name} save`, value: it.value })),
	]

	const diceTypeOptions = [
		{ name: "Damage", value: "damage" },
		{ name: "Healing", value: "healing" },
		{ name: "Reduction", value: "reduction" },
	]

	$: power = Array.isArray(value.data.power) ? value.data.power : []
	$: rangeType = value.data.range.type
	$: durationUnit = value.data.duration.unit
	$: attackScope = value.data.attack?.scope ?? ""
	$: saveAttribute = value.data.save?.attribute?.[0] ?? ""
	$: hasDice = value.data.dice != null

	const togglePower = (attribute: Attribute) => (event: Event) => {
		const checked = (event.currentTarget as HTMLInputElement).checked
		const current = Array.isArray(value.data.power) ? value.data.power : []
		value.data.power = checked
			? [...current, attribute]
			: current.filter((it) => it !== attribute)
		value = value
	}

	const changeRange = (event: SelectFieldChangeEvent) => {
		switch (event.detail.value) {
		case "distance": value.data.range = { type: "distance", value: 30, unit: "feet" }; break
		case "self": value.data.range = { type: "self" }; break
		case "varies": value.data.range = { type: "varies" }; break
		default: value.data.range = { type: "melee" }; break
		}
		value = value
	}

	const changeDuration = (event: SelectFieldChangeEvent) => {
		const concentration = value.data.duration.concentration ?? false
		switch (event.detail.value) {
		case "round": value.data.duration = { unit: "round", value: 1, concentration }; break
		case "minute": value.data.duration = { unit: "minute", value: 1, concentration }; break
		case "varies": value.data.duration = { unit: "varies", concentration }; break
		default: value.data.duration = { unit: "instantaneous", concentration: false }; break
		}
		value = value
	}

	const changeAttack = (event: SelectFieldChangeEvent) => {
		value.data.attack = event.detail.value === "melee" || event.detail.value === "ranged"
			? { scope: event.detail.value }
			: undefined
		value = value
	}

	const changeSave = (event: SelectFieldChangeEvent) => {
		const attribute = event.detail.value as Attribute | ""
		value.data.save = attribute
			? { attribute: [attribute], dc: "MOVE" }
			: undefined
		value = value
	}

	const toggleDice = (event: Event) => {
		const checked = (event.currentTarget as HTMLInputElement).checked
		value.data.dice = checked
			? {
				class: "custom",
				tiers: ["1d6", "1d8", "2d6", "3d6"],
				modifier: "MOVE",
				type: "damage",
			}
			: undefined
		value = value
	}

	const submit = () => dispatch("save", { value })
</script>

<div class="editor">
	<div class="grid two">
		<TextField label="Name" bind:value={value.data.name} {disabled} required />
		<SelectField label="Type" options={typeOptions} bind:value={value.data.type} {disabled} />
		<IntField label="PP" bind:value={value.data.pp} min={0} {disabled} />
		<SelectField label="Move Time" options={timeOptions} bind:value={value.data.time.unit} {disabled} />
	</div>

	<fieldset>
		<legend>Move Power</legend>
		<div class="checks">
			{#each attributes as attribute}
				<label><input type="checkbox" checked={power.includes(attribute.value)} on:change={togglePower(attribute.value)} {disabled} /> {attribute.name}</label>
			{/each}
		</div>
		<p class="hint">Leave all unchecked for a move that does not use Move Power.</p>
	</fieldset>

	<div class="grid two">
		<SelectField label="Range" options={rangeOptions} value={rangeType} on:change={changeRange} {disabled} />
		{#if value.data.range.type === "distance"}
			<IntField label="Range (feet)" bind:value={value.data.range.value} min={0} {disabled} />
		{:else if value.data.range.type === "melee"}
			<IntField label="Reach (feet, optional)" value={value.data.range.reach?.value ?? 0} min={0} optional on:change={(e) => {
				const feet = e.detail.value
				value.data.range = feet > 0 ? { type: "melee", reach: { value: feet, unit: "feet" } } : { type: "melee" }
				value = value
			}} {disabled} />
		{/if}
		<SelectField label="Duration" options={durationOptions} value={durationUnit} on:change={changeDuration} {disabled} />
		{#if value.data.duration.unit === "round" || value.data.duration.unit === "minute"}
			<IntField label="Duration value" bind:value={value.data.duration.value} min={1} {disabled} />
		{/if}
	</div>

	{#if value.data.duration.unit !== "instantaneous"}
		<label class="standalone"><input type="checkbox" bind:checked={value.data.duration.concentration} {disabled} /> Requires concentration</label>
	{/if}

	<div class="grid two">
		<SelectField label="Attack Roll" options={attackOptions} value={attackScope} on:change={changeAttack} {disabled} />
		<SelectField label="Saving Throw" options={saveOptions} value={saveAttribute} on:change={changeSave} {disabled} />
	</div>

	<fieldset>
		<legend>Damage / Healing Dice</legend>
		<label class="standalone"><input type="checkbox" checked={hasDice} on:change={toggleDice} {disabled} /> This move uses scalable dice</label>
		{#if value.data.dice}
			<div class="grid four">
				<TextField label="Base" bind:value={value.data.dice.tiers[0]} {disabled} />
				<TextField label="Level 5" bind:value={value.data.dice.tiers[1]} {disabled} />
				<TextField label="Level 10" bind:value={value.data.dice.tiers[2]} {disabled} />
				<TextField label="Level 17" bind:value={value.data.dice.tiers[3]} {disabled} />
			</div>
			<div class="grid two">
				<TextField label="Modifier" bind:value={value.data.dice.modifier} placeholder="MOVE" {disabled} />
				<SelectField label="Dice Purpose" options={diceTypeOptions} bind:value={value.data.dice.type} {disabled} />
			</div>
		{/if}
	</fieldset>

	<MarkdownField label="Description" bind:value={value.data.description} rows={9} {disabled} />
	<p class="hint">You may use <code>{'{dice}'}</code>, <code>{'{type}'}</code>, and <code>{'{save}'}</code> in the description. The sheet resolves them like official Poke5e moves.</p>

	{#if !disabled}
		<div class="actions"><Button variant="success" on:click={submit}>{submitLabel}</Button></div>
	{/if}
</div>

<style>
	.editor { display: flex; flex-direction: column; gap: 1rem; padding-block: 0.5rem 2rem; }
	.grid { display: grid; gap: 0.75rem; }
	.grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	.grid.four { grid-template-columns: repeat(4, minmax(0, 1fr)); }
	fieldset { border: 0.0625rem solid var(--skin-border); padding: 0.75rem; }
	legend { font-weight: bold; }
	.checks { display: flex; flex-wrap: wrap; gap: 0.75rem; }
	.standalone { font-size: var(--font-sz-venus); font-weight: bold; }
	.hint { margin: 0.35rem 0 0; opacity: 0.75; font-size: var(--font-sz-venus); }
	.actions { display: flex; justify-content: flex-end; }
	@media (max-width: 37.5rem) {
		.grid.two, .grid.four { grid-template-columns: 1fr; }
	}
</style>
