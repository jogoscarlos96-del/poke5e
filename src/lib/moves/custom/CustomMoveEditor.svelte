<script lang="ts">
	import type { Attribute } from "$lib/dnd/attributes"
	import type { Move } from "$lib/moves/Move"
	import type { MoveDiceType } from "$lib/moves/dice/MoveDice"
	import { PokemonType } from "$lib/pokemon/types"
	import { Button } from "$lib/ui/elements"
	import {
		ActionArea,
		Fieldset,
		Form,
		IntField,
		MarkdownField,
		SelectField,
		TextField,
		type SelectFieldChangeEvent,
	} from "$lib/ui/forms"
	import type { TextFieldChangeEvent } from "$lib/ui/forms/TextField.svelte"
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

	const typeOptions: { name: string, value: string }[] = [
		...PokemonType.list.map((type) => ({ name: type, value: type })),
		{ name: "Typeless", value: "typeless" },
		{ name: "Varies", value: "varies" },
	]

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
	$: summaryPower = power.length > 0 ? power.map((it) => it.toUpperCase()).join(" / ") : "—"
	$: summaryType = value.data.type === "typeless" || value.data.type === "varies"
		? value.data.type[0].toUpperCase() + value.data.type.slice(1)
		: PokemonType.name(value.data.type)

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

	const changeDiceTier = (index: 0 | 1 | 2 | 3) => (event: TextFieldChangeEvent) => {
		if (!value.data.dice) return
		const tiers = [...value.data.dice.tiers]
		tiers[index] = event.detail.value as typeof tiers[number]
		value.data.dice = {
			...value.data.dice,
			tiers: tiers as unknown as typeof value.data.dice.tiers,
		}
		value = value
	}

	const changeDiceType = (event: SelectFieldChangeEvent) => {
		if (!value.data.dice) return
		value.data.dice = { ...value.data.dice, type: event.detail.value as MoveDiceType }
		value = value
	}

	const submit = () => dispatch("save", { value })
</script>

<Form onsubmit={submit} saving={disabled}>
	<div class="move-summary" aria-label="Custom move summary">
		<div>
			<span class="eyebrow">Custom Move</span>
			<h2>{value.data.name || "Untitled Move"}</h2>
		</div>
		<dl>
			<div><dt>Type</dt><dd>{summaryType}</dd></div>
			<div><dt>Power</dt><dd>{summaryPower}</dd></div>
			<div><dt>PP</dt><dd>{value.data.pp}</dd></div>
		</dl>
	</div>

	<Fieldset title="Basic Info" columns={2}>
		<TextField label="Name" bind:value={value.data.name} {disabled} required />
		<SelectField label="Type" options={typeOptions} bind:value={value.data.type} {disabled} />
		<IntField label="PP" bind:value={value.data.pp} min={0} {disabled} />
		<SelectField label="Move Time" options={timeOptions} bind:value={value.data.time.unit} {disabled} />
	</Fieldset>

	<Fieldset title="Move Power">
		<div class="power-field">
			<div class="checks">
				{#each attributes as attribute}
					<label>
						<input type="checkbox" checked={power.includes(attribute.value)} on:change={togglePower(attribute.value)} {disabled} />
						<span>{attribute.name}</span>
					</label>
				{/each}
			</div>
			<p class="hint">Choose every ability score this move can use for Move Power. Leave all unchecked if the move does not use Move Power.</p>
		</div>
	</Fieldset>

	<Fieldset title="Targeting & Duration" columns={2}>
		<SelectField label="Range" options={rangeOptions} value={rangeType} on:change={changeRange} {disabled} />
		{#if value.data.range.type === "distance"}
			<IntField label="Range (feet)" bind:value={value.data.range.value} min={0} {disabled} />
		{:else if value.data.range.type === "melee"}
			<IntField label="Reach (feet, optional)" value={value.data.range.reach?.value ?? 0} min={0} optional on:change={(e) => {
				const feet = e.detail.value
				value.data.range = feet > 0 ? { type: "melee", reach: { value: feet, unit: "feet" } } : { type: "melee" }
				value = value
			}} {disabled} />
		{:else}
			<div class="field-spacer" aria-hidden="true"></div>
		{/if}

		<SelectField label="Duration" options={durationOptions} value={durationUnit} on:change={changeDuration} {disabled} />
		{#if value.data.duration.unit === "round" || value.data.duration.unit === "minute"}
			<IntField label="Duration value" bind:value={value.data.duration.value} min={1} {disabled} />
		{:else}
			<div class="field-spacer" aria-hidden="true"></div>
		{/if}

		{#if value.data.duration.unit !== "instantaneous"}
			<label class="toggle-row wide"><input type="checkbox" bind:checked={value.data.duration.concentration} {disabled} /> Requires concentration</label>
		{/if}
	</Fieldset>

	<Fieldset title="Resolution" columns={2}>
		<SelectField label="Attack Roll" options={attackOptions} value={attackScope} on:change={changeAttack} {disabled} />
		<SelectField label="Saving Throw" options={saveOptions} value={saveAttribute} on:change={changeSave} {disabled} />
		<p class="hint wide">Use these only when the move explicitly calls for an attack roll or saving throw. Saving throws use the user's Move DC.</p>
	</Fieldset>

	<Fieldset title="Damage / Healing" columns={2} columnsLg={4}>
		<label class="toggle-row wide"><input type="checkbox" checked={hasDice} on:change={toggleDice} {disabled} /> This move uses scalable dice</label>
		{#if value.data.dice}
			<TextField label="Base" value={value.data.dice.tiers[0]} on:change={changeDiceTier(0)} {disabled} />
			<TextField label="Level 5" value={value.data.dice.tiers[1]} on:change={changeDiceTier(1)} {disabled} />
			<TextField label="Level 10" value={value.data.dice.tiers[2]} on:change={changeDiceTier(2)} {disabled} />
			<TextField label="Level 17" value={value.data.dice.tiers[3]} on:change={changeDiceTier(3)} {disabled} />
			<div class="half-lg"><TextField label="Modifier" bind:value={value.data.dice.modifier} placeholder="MOVE" {disabled} /></div>
			<div class="half-lg"><SelectField label="Dice Purpose" options={diceTypeOptions} value={value.data.dice.type} on:change={changeDiceType} {disabled} /></div>
			<p class="hint wide">Enter the four Poke5e damage tiers exactly as dice expressions, for example 3d6, 4d6, 5d8, and 6d10. Use MOVE as the modifier when appropriate.</p>
		{:else}
			<p class="hint wide">Enable scalable dice for moves that deal damage, heal, or reduce damage using level-based dice.</p>
		{/if}
	</Fieldset>

	<Fieldset title="Description & Rules Text">
		<MarkdownField label="Description" bind:value={value.data.description} rows={10} {disabled} />
		<p class="hint">You may use <code>{'{dice}'}</code>, <code>{'{type}'}</code>, and <code>{'{save}'}</code> in the description. Pokémon sheets resolve these placeholders the same way as published Poke5e moves.</p>
	</Fieldset>

	<ActionArea>
		<Button type="submit" {disabled}>{submitLabel}</Button>
	</ActionArea>
</Form>

<style>
	.move-summary {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
		margin: 0.5rem 1rem 1.5rem;
		padding: 1rem;
		background: var(--skin-content);
		border-inline-start: 0.35rem solid var(--skin-bg);
		border-radius: 0.25rem;
	}

	.move-summary h2 {
		margin: 0.15rem 0 0;
	}

	.eyebrow {
		font-size: var(--font-sz-mars);
		font-weight: bold;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		opacity: 0.7;
	}

	.move-summary dl {
		display: flex;
		gap: 1.25rem;
		margin: 0;
	}

	.move-summary dl div {
		display: grid;
		gap: 0.1rem;
		min-inline-size: 3rem;
	}

	.move-summary dt {
		font-size: var(--font-sz-mars);
		font-weight: bold;
		opacity: 0.65;
	}

	.move-summary dd {
		margin: 0;
		font-weight: bold;
	}

	.power-field {
		display: grid;
		gap: 0.6rem;
	}

	.checks {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.checks label,
	.toggle-row {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-weight: bold;
	}

	.checks label {
		min-inline-size: 4.25rem;
		padding: 0.4rem 0.55rem;
		background: var(--skin-input-bg);
		border-radius: 0.25rem;
	}

	.hint {
		margin: 0;
		opacity: 0.75;
		font-size: var(--font-sz-venus);
		line-height: 1.4;
	}

	.wide {
		grid-column: 1 / -1;
	}

	.field-spacer {
		display: block;
	}

	.half-lg {
		grid-column: span 2;
	}

	@media (max-width: 37.5rem) {
		.move-summary {
			align-items: flex-start;
			flex-direction: column;
		}

		.move-summary dl {
			inline-size: 100%;
			justify-content: space-between;
			gap: 0.75rem;
		}

		.half-lg {
			grid-column: 1 / -1;
		}
	}
</style>
