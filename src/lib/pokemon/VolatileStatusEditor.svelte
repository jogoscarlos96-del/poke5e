<script lang="ts" context="module">
	export type ChangeDetail = {
		value: AnyVolatileStatus | null
	}
</script>

<script lang="ts">
	import { createEventDispatcher } from "svelte"
	import {
		VolatileStatus,
		VolatileStatus2018,
		type AnyVolatileStatus,
	} from "$lib/pokemon/status"
	import { currentEdition } from "$lib/site/edition"
	import VisuallyHidden from "$lib/ui/elements/VisuallyHidden.svelte"

	const dispatch = createEventDispatcher()

	export let id: string
	export let value: AnyVolatileStatus | null
	export let disabled = false

	$: currentList = $currentEdition === "2018"
		? Object.values(VolatileStatus2018)
		: Object.values(VolatileStatus)
	$: currentIds = currentList.map((status) => status.id)
	$: legacySelected = value != null && !currentIds.includes(value)
		? (VolatileStatus2018[value as keyof typeof VolatileStatus2018] ?? VolatileStatus[value as keyof typeof VolatileStatus])
		: undefined

	const onChange = (e: Event) => {
		const target = e.target as HTMLSelectElement
		value = target.value ? target.value as AnyVolatileStatus : null
		dispatch("change", { value } as ChangeDetail)
	}

	const onKeyUp = (e: KeyboardEvent) => {
		if (e.key === "Enter") {
			const target = e.target as HTMLSelectElement
			if ("showPicker" in HTMLSelectElement.prototype) target.showPicker()
		}
	}
</script>

<div class="overlapping interactive-container">
	<label for={id} class="smaller interactive" class:invert={value == null}>
		<span aria-hidden="true">{value == null ? "Add Volatile" : "Edit Volatile"}</span>
		<VisuallyHidden>{value == null ? "Add volatile condition" : "Edit volatile condition"}</VisuallyHidden>
	</label>
	<select {id} {value} on:change={onChange} class="overlay" on:keyup={onKeyUp} {disabled}>
		<option value="">None</option>
		{#if legacySelected}
			<option value={legacySelected.id}>{legacySelected.name}</option>
		{/if}
		{#each currentList as status}
			<option value={status.id}>{status.name}</option>
		{/each}
	</select>
</div>

<style>
	.overlapping {
		position: relative;
	}

	.overlapping > :last-child {
		position: absolute;
		inset: 0;
	}

	select { cursor: pointer; }

	.interactive {
		padding: 0.0625em 0.5em;
		border-radius: 1em;
	}

	.interactive.invert {
		background: var(--skin-input-bg);
	}

	.interactive-container:hover .interactive,
	.interactive-container:focus-within .interactive {
		background: var(--skin-input-bg);
	}

	.interactive-container:hover .interactive.invert,
	.interactive-container:focus-within .interactive.invert {
		background: none;
	}

	.overlay { opacity: 0; }
	.smaller { font-size: var(--font-sz-venus); }
</style>
