<script lang="ts" context="module">
	export type UpdateDetail = {
		currentHp: number,
		currentHitDice: number,
		currentStatus: NonVolatileStatus | null,
		exp: number,
	}
</script>

<script lang="ts">
	import { createEventDispatcher } from "svelte"
	import { VisuallyHidden, ResourceBar } from "$lib/ui/elements"
	import {
		NumericResourceField,
		type NumericChangeDetail,
	} from "$lib/ui/forms"
	import {
		VolatileStatus,
		VolatileStatus2018,
		type AnyVolatileStatus,
		type NonVolatileStatus,
	} from "$lib/pokemon/status"
	import StatusEditor, { type ChangeDetail as StatusChangeDetail } from "$lib/pokemon/StatusEditor.svelte"
	import VolatileStatusEditor, { type ChangeDetail as VolatileStatusChangeDetail } from "$lib/pokemon/VolatileStatusEditor.svelte"
	import StatusTag from "$lib/pokemon/StatusTag.svelte"
	import { PokemonVolatileStatus } from "$lib/pokemon/volatile-status"
	import { experienceNeededAtLevel, experienceNeededUntilLevelUp, formatExp } from "$lib/poke5e/experience"
	import { Popover } from "$lib/ui/elements"
	import { HelpIcon } from "$lib/ui/icons"
	import type { Level } from "$lib/dnd/level"
	import type { HitDice } from "$lib/dnd/hit-dice"
	import type { Resource } from "$lib/poke5e/resource"
	import { currentEdition } from "$lib/site/edition"
	import { error as siteError } from "$lib/site/errors"
	import { Markdown } from "$lib/ui/rendering"

	const dispatch = createEventDispatcher()

	export let hp: Resource
	export let hitDice: Resource
	export let dieSize: HitDice
	export let exp: number
	export let level: Level
	export let status: NonVolatileStatus | null
	export let hasStatusAndExp: boolean = false
	export let editable: boolean
	export let pokemonId: string | undefined = undefined
	export let trainerReadKey: string | undefined = undefined
	export let writeKey: string | undefined = undefined

	$: hpCur = hp.current
	$: hitDiceCur = hitDice.current
	$: statusCur = status

	let volatileStatusCur: AnyVolatileStatus | null = null
	let volatileStatusLoaded = false
	let volatileStatusSaving = false
	let volatileLoadKey = ""

	$: currentVolatileList = $currentEdition === "2018"
		? Object.values(VolatileStatus2018)
		: Object.values(VolatileStatus)
	$: volatileDescription = volatileStatusCur == null
		? undefined
		: currentVolatileList.find((it) => it.id === volatileStatusCur)
			?? Object.values(VolatileStatus2018).find((it) => it.id === volatileStatusCur)
			?? Object.values(VolatileStatus).find((it) => it.id === volatileStatusCur)

	const loadVolatileStatus = async (readKey: string, id: string, key: string) => {
		volatileLoadKey = key
		volatileStatusLoaded = false
		volatileStatusCur = null

		try {
			const result = await PokemonVolatileStatus.get(readKey, id)
			if (volatileLoadKey === key) volatileStatusCur = result
		} catch (e) {
			console.error("Could not load volatile condition.", e)
		} finally {
			if (volatileLoadKey === key) volatileStatusLoaded = true
		}
	}

	$: if (pokemonId != null && trainerReadKey != null) {
		const key = `${trainerReadKey}:${pokemonId}`
		if (key !== volatileLoadKey) void loadVolatileStatus(trainerReadKey, pokemonId, key)
	} else {
		volatileStatusLoaded = true
	}

	const onChangeHp = (e: CustomEvent<NumericChangeDetail>) => {
		dispatch("update", {
			currentHp: e.detail.value,
			currentHitDice: hitDiceCur,
			currentStatus: status,
			exp: exp,
		} as UpdateDetail)
	}

	const onChangeHitDice = (e: CustomEvent<NumericChangeDetail>) => {
		dispatch("update", {
			currentHp: hpCur,
			currentHitDice: e.detail.value,
			currentStatus: status,
			exp: exp,
		} as UpdateDetail)
	}

	const onChangeStatus = (e: CustomEvent<StatusChangeDetail>) => {
		dispatch("update", {
			currentHp: hpCur,
			currentHitDice: hitDiceCur,
			currentStatus: e.detail.value,
			exp: exp,
		} as UpdateDetail)
	}

	const onChangeVolatileStatus = async (e: CustomEvent<VolatileStatusChangeDetail>) => {
		if (pokemonId == null || writeKey == null) return

		const previous = volatileStatusCur
		volatileStatusCur = e.detail.value
		volatileStatusSaving = true

		try {
			await PokemonVolatileStatus.set(writeKey, pokemonId, volatileStatusCur)
		} catch (e) {
			volatileStatusCur = previous
			siteError.show("updatePokemonVolatileStatus", e)
		} finally {
			volatileStatusSaving = false
		}
	}

	const onChangeExp = (e: CustomEvent<NumericChangeDetail>) => {
		dispatch("update", {
			currentHp: hpCur,
			currentHitDice: hitDiceCur,
			currentStatus: status,
			exp: e.detail.value,
		} as UpdateDetail)
	}

	$: expBarMax = experienceNeededUntilLevelUp(experienceNeededAtLevel(level.data), level.data)
	$: expNeeded = experienceNeededUntilLevelUp(exp, level.data)
	$: expBarCur = expBarMax - expNeeded
</script>

<div class="grid">
	<span class="bar"><ResourceBar current={hpCur} max={hp.max} /></span>
	<span class="hp">
		<VisuallyHidden><label for="current-hp">HP</label></VisuallyHidden>
		<span class="current-hp">
			{#if editable}
				<NumericResourceField id="current-hp" value={hpCur} on:change={onChangeHp} />
			{:else}
				{hp.current}
			{/if}
		</span>
		<span class="max-hp">/ {hp.max}</span>
	</span>
	<span class="hit-dice">
		<span class="hit-dice-bar"><ResourceBar variant="secondary" current={hitDiceCur} max={hitDice.max} /></span>
		<span class="hit-dice-text">
			<VisuallyHidden><label for="current-hit-dice">Hit Dice</label></VisuallyHidden>
			<span class="current-hit-dice">
				{#if editable}
					<NumericResourceField id="current-hit-dice" value={hitDiceCur} on:change={onChangeHitDice} />
				{:else}
					{hitDice.current}
				{/if}
			</span>
			<span class="max-hit-dice">/ {hitDice.max} ({dieSize.data})</span>
		</span>
	</span>
	{#if hasStatusAndExp}
		<span class="conditions">
			<span class="row">
				{#if status != null}
					<StatusTag value={status} />
				{/if}
				{#if editable}
					<StatusEditor id="current-status" value={statusCur} on:change={onChangeStatus} />
				{/if}
			</span>
			<span class="row volatile-row">
				{#if volatileDescription != null}
					<span class="volatile-tag" title={volatileDescription.effect}>{volatileDescription.name}</span>
				{/if}
				{#if editable && volatileStatusLoaded}
					<VolatileStatusEditor
						id="current-volatile-status"
						value={volatileStatusCur}
						disabled={volatileStatusSaving}
						on:change={onChangeVolatileStatus}
					/>
				{/if}
			</span>
		</span>
		<span class="exp">
			<span class="exp-bar"><ResourceBar variant="tertiary" current={expBarCur} max={expBarMax} /></span>
			<span class="exp-text">
				<Popover id="exp-remaining">
					<HelpIcon slot="activator" label="Exp Needed" />
					<p style:text-align="center">{formatExp(expNeeded)} needed until level up.</p>
				</Popover>
				<label for="current-experience">Exp:</label>
				<span class="current-exp">
					{#if editable}
						<NumericResourceField id="current-experience" value={exp} on:change={onChangeExp} />
					{:else}
						{formatExp(exp)}
					{/if}
				</span>
			</span>
		</span>
		{#if volatileDescription != null}
			<div class="volatile-rules">
				<h3>{volatileDescription.name}</h3>
				<Markdown value={volatileDescription.effect} />
				{#if volatileDescription.immunity}
					<p>{volatileDescription.immunity}</p>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: 2fr 1fr;
		align-items: center;
		gap: 0.125em;
	}

	.bar {
		grid-column: span 2;
		display: flex;
	}

	.hp {
		font-size: var(--font-sz-neptune);
	}

	.current-hp {
		--input-min-width: 3ch;
		display: inline-block;
	}

	.hit-dice, .exp {
		display: flex;
		flex-direction: column;
		font-size: var(--font-sz-mars);
	}

	.exp {
		place-self: start stretch;
	}

	.hit-dice-bar, .exp-bar {
		margin-bottom: 0.125em;
	}

	.current-hit-dice, .current-exp {
		--input-min-width: 3ch;
		display: inline-block;
	}

	.hit-dice-text, .exp-text {
		align-self: flex-end;
	}

	.exp-text {
		display: flex;
		align-items: center;
		gap: 0.25em;
	}

	.conditions {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.35em 0.6em;
		margin-block: 0.5em;
	}

	.row {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 0.25em;
	}

	.volatile-tag {
		display: inline-block;
		padding: 0.0625em 0.45em;
		border-radius: 1em;
		background: var(--skin-bg-dark);
		color: var(--skin-bg-text);
		box-shadow: var(--elev-stratus);
		font-size: var(--font-sz-venus);
		font-weight: bold;
	}

	.volatile-rules {
		grid-column: span 2;
		margin-block: 0.35em 0.65em;
		padding: 0.75em 1em;
		background: var(--skin-input-bg);
		border-radius: 0.75em;
		font-size: var(--font-sz-venus);
		line-height: 1.35;
	}

	.volatile-rules h3 {
		margin: 0 0 0.35em;
		font-size: var(--font-sz-mars);
	}

	.volatile-rules :global(p:first-child) {
		margin-block-start: 0;
	}

	.volatile-rules :global(p:last-child) {
		margin-block-end: 0;
	}
</style>