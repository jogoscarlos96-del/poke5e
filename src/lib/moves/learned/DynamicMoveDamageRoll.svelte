<script lang="ts">
	import { getContext } from "svelte"
	import { Button } from "$lib/ui/elements"
	import type { MoveStats } from "../MoveStats"
	import BaseMoveDamageRoll from "./BaseMoveDamageRoll.svelte"
	import {
		getDynamicMoveDamageProfile,
		magnitudeBaseDice,
		magnitudeLevelMultiplier,
		MOVE_ROLLER_MOVE_NAME_CONTEXT,
		resolveDynamicMoveDamage,
	} from "./DynamicMoveRules"

	export let moveName: string | undefined = undefined
	export let damage: NonNullable<MoveStats["damage"]>
	export let onconfirm: (value?: number) => void
	export let critical = false
	export let criticalDiceMultiplier = 2
	export let moveType: string | undefined = undefined
	export let currentHp: number | undefined = undefined
	export let maxHp: number | undefined = undefined
	export let onapplyhealing: ((value: number) => void) | undefined = undefined

	type RoundResult = {
		round: number,
		total?: number,
	}

	const contextMoveName = getContext<(() => string | undefined) | undefined>(MOVE_ROLLER_MOVE_NAME_CONTEXT)

	let stage = 1
	let magnitudeRoll: number | undefined = undefined
	let roundResults: RoundResult[] = []

	$: effectiveMoveName = moveName ?? contextMoveName?.() ?? ""
	$: profile = getDynamicMoveDamageProfile(effectiveMoveName)
	$: resolvedDamage = resolveDynamicMoveDamage(profile, damage, { stage, magnitudeRoll })
	$: magnitudeBase = magnitudeRoll != null ? magnitudeBaseDice(magnitudeRoll) : undefined
	$: magnitudeMultiplier = profile?.kind === "magnitude" ? magnitudeLevelMultiplier(damage.dice) : undefined
	$: rollKey = `${profile?.kind ?? "standard"}:${stage}:${magnitudeRoll ?? "pending"}:${resolvedDamage?.dice ?? "pending"}`

	const rollMagnitude = () => {
		magnitudeRoll = Math.floor(Math.random() * 100) + 1
	}

	const confirmDamage = (value?: number) => {
		if (profile?.kind === "round-sequence") {
			roundResults = [...roundResults, { round: stage, total: value }]
			if (stage < profile.multipliers.length) {
				stage += 1
				return
			}
		}

		onconfirm(value)
	}
</script>

{#if profile?.kind === "progressive"}
	<section class="dynamic-rule">
		<div class="rule-heading">
			<strong>{effectiveMoveName} progression</strong>
			<span>{resolvedDamage?.dice ?? damage.dice}</span>
		</div>
		<label for="dynamic-progress-stage">{profile.label}</label>
		<select id="dynamic-progress-stage" bind:value={stage}>
			{#each profile.multipliers as multiplier, index}
				<option value={index + 1}>Hit {index + 1} · {multiplier}× dice</option>
			{/each}
		</select>
		<p>{profile.note}</p>
	</section>
{:else if profile?.kind === "round-sequence"}
	<section class="dynamic-rule">
		<div class="rule-heading">
			<strong>{effectiveMoveName} sequence</strong>
			<span>Round {stage} of {profile.multipliers.length}</span>
		</div>
		<div class="resolved-line">
			<span>{profile.label}</span>
			<strong>{resolvedDamage?.dice ?? damage.dice}</strong>
		</div>
		<p>{profile.note}</p>
		{#if roundResults.length > 0}
			<div class="round-history">
				{#each roundResults as result}
					<div>
						<span>Round {result.round}</span>
						<strong>{result.total != null ? `Damage ${result.total}` : "Damage manual"}</strong>
					</div>
				{/each}
			</div>
		{/if}
	</section>
{:else if profile?.kind === "magnitude"}
	<section class="dynamic-rule">
		<div class="rule-heading">
			<strong>Magnitude damage</strong>
			<span>{magnitudeMultiplier != null ? `${magnitudeMultiplier}× level dice` : damage.dice}</span>
		</div>
		<div class="magnitude-controls">
			<label for="magnitude-d100">d100 result</label>
			<input id="magnitude-d100" type="number" min="1" max="100" bind:value={magnitudeRoll} placeholder="1–100" />
			<Button variant="solid" on:click={rollMagnitude}>{magnitudeRoll == null ? "Roll d100" : "Roll Again"}</Button>
		</div>
		{#if magnitudeRoll != null && resolvedDamage != null}
			<div class="magnitude-result">
				<span>d100 {magnitudeRoll}</span>
				<span>Base {magnitudeBase}</span>
				<strong>Resolved {resolvedDamage.dice}</strong>
			</div>
		{:else if magnitudeRoll != null}
			<p class="error">Enter a d100 result from 1 to 100.</p>
		{/if}
		<p>{profile.note}</p>
	</section>
{/if}

{#if resolvedDamage != null}
	{#key rollKey}
		<BaseMoveDamageRoll
			damage={resolvedDamage}
			onconfirm={confirmDamage}
			{critical}
			{criticalDiceMultiplier}
			{moveType}
			{currentHp}
			{maxHp}
			{onapplyhealing}
		/>
	{/key}
{:else if profile?.kind !== "magnitude"}
	<div class="error-card">
		<strong>Dynamic damage could not be resolved.</strong>
		<span>The move uses {damage.dice}, which is not a supported dynamic dice expression yet.</span>
	</div>
{/if}

<style>
	.dynamic-rule,
	.error-card {
		display: grid;
		gap: 0.55em;
		margin-block-end: 0.75em;
		padding: 0.7em 0.8em;
		background: var(--skin-input-bg);
		border-radius: 0.75em;
	}

	.rule-heading,
	.resolved-line,
	.magnitude-result,
	.round-history > div {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75em;
	}

	.rule-heading span,
	.dynamic-rule p,
	.error-card span,
	.magnitude-result span,
	.round-history span {
		font-size: 0.78rem;
	}

	.dynamic-rule p,
	.error-card span {
		margin: 0;
		line-height: 1.35;
	}

	.dynamic-rule label {
		font-size: 0.78rem;
		font-weight: bold;
	}

	.dynamic-rule select,
	.dynamic-rule input {
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		padding: 0.35em 0.45em;
		border: 1px solid var(--skin-border, currentColor);
		border-radius: 0.4em;
		background: var(--skin-content);
		color: var(--skin-content-text);
		font: inherit;
	}

	.magnitude-controls {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 5.5em auto;
		align-items: center;
		gap: 0.45em;
	}

	.magnitude-controls :global(.button) {
		min-width: 0;
		padding-inline: 0.65em;
	}

	.magnitude-result {
		padding: 0.55em 0.65em;
		background: var(--skin-content);
		border-radius: 0.55em;
	}

	.round-history {
		display: grid;
		gap: 0.3em;
	}

	.round-history > div {
		padding: 0.45em 0.55em;
		background: var(--skin-content);
		border-radius: 0.5em;
	}

	.error,
	.error-card {
		font-size: 0.82rem;
	}

	@media (max-width: 32rem) {
		.magnitude-controls {
			grid-template-columns: minmax(0, 1fr) 5em;
		}

		.magnitude-controls :global(.button) {
			grid-column: 1 / -1;
		}
	}
</style>
