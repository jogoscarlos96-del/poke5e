<script lang="ts">
	import { getContext } from "svelte"
	import { Button } from "$lib/ui/elements"
	import type { MoveStats } from "../MoveStats"
	import BaseMoveDamageRoll from "./BaseMoveDamageRoll.svelte"
	import {
		getDynamicMoveDamageProfile,
		healthTotalMultiplier,
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
	let conditionActive = false
	let conditionCount = 0
	let roundResults: RoundResult[] = []
	let roundDiceRolls: number[] = []
	let roundTotal: number | undefined = undefined
	let roundError: string | undefined = undefined
	let pendingBaseTotal: number | undefined = undefined

	$: effectiveMoveName = moveName ?? contextMoveName?.() ?? ""
	$: profile = getDynamicMoveDamageProfile(effectiveMoveName)
	$: resolvedDamage = resolveDynamicMoveDamage(profile, damage, {
		stage,
		magnitudeRoll,
		conditionActive,
		count: conditionCount,
	})
	$: magnitudeBase = magnitudeRoll != null ? magnitudeBaseDice(magnitudeRoll) : undefined
	$: magnitudeMultiplier = profile?.kind === "magnitude" ? magnitudeLevelMultiplier(damage.dice) : undefined
	$: totalMultiplier = profile?.kind === "health-total" ? healthTotalMultiplier(currentHp, maxHp) : 1
	$: hpPercent = currentHp != null && maxHp != null && maxHp > 0 ? Math.max(0, currentHp) / maxHp * 100 : undefined
	$: finalTotal = pendingBaseTotal != null ? pendingBaseTotal * totalMultiplier : undefined
	$: rollKey = `${profile?.kind ?? "standard"}:${stage}:${magnitudeRoll ?? "pending"}:${conditionActive}:${conditionCount}:${totalMultiplier}:${resolvedDamage?.dice ?? "pending"}`

	const signed = (value: number) => value >= 0 ? `+${value}` : `${value}`

	const parseDice = (expression: string) => {
		const match = expression.trim().match(/^(\d+)d(\d+)$/i)
		if (match == null) return undefined
		const count = Number.parseInt(match[1], 10)
		const sides = Number.parseInt(match[2], 10)
		if (count <= 0 || sides <= 0) return undefined
		return { count, sides }
	}

	const rollMagnitude = () => {
		magnitudeRoll = Math.floor(Math.random() * 100) + 1
	}

	const clearRoundRoll = () => {
		roundDiceRolls = []
		roundTotal = undefined
		roundError = undefined
	}

	const rollRoundSequenceDamage = () => {
		if (resolvedDamage == null) return
		const parsed = parseDice(resolvedDamage.dice)
		if (parsed == null) {
			clearRoundRoll()
			roundError = `Unable to roll ${resolvedDamage.dice}.`
			return
		}

		roundDiceRolls = Array.from({ length: parsed.count }, () => Math.floor(Math.random() * parsed.sides) + 1)
		roundTotal = roundDiceRolls.reduce((sum, value) => sum + value, 0) + resolvedDamage.mod
		roundError = undefined
	}

	const confirmRoundSequenceDamage = () => {
		if (profile?.kind !== "round-sequence") return
		roundResults = [...roundResults, { round: stage, total: roundTotal }]

		if (stage < profile.multipliers.length) {
			stage += 1
			clearRoundRoll()
			return
		}

		onconfirm(roundTotal)
	}

	const confirmDamage = (value?: number) => {
		if (profile?.kind === "health-total" && value != null && totalMultiplier > 1) {
			pendingBaseTotal = value
			return
		}

		onconfirm(value)
	}

	const confirmFinalTotal = () => {
		onconfirm(finalTotal)
	}
</script>

{#if pendingBaseTotal != null && profile?.kind === "health-total"}
	<section class="dynamic-rule final-total-card">
		<div class="rule-heading">
			<strong>{effectiveMoveName} final damage</strong>
			<span>{totalMultiplier}× total</span>
		</div>
		<div class="final-total-breakdown">
			<div><span>Rolled damage</span><strong>{pendingBaseTotal}</strong></div>
			<div><span>HP multiplier</span><strong>×{totalMultiplier}</strong></div>
			<div class="final-total-row"><span>Final damage</span><strong>{finalTotal}</strong></div>
		</div>
		<p>{profile.note}</p>
		<Button variant="success" width="full" on:click={confirmFinalTotal}>Confirm Final Damage</Button>
	</section>
{:else}
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

		{#if resolvedDamage != null}
			<section class="round-sequence-roll">
				<h3>Damage Roll</h3>
				<div class="round-formula">
					<span>{resolvedDamage.dice}</span>
					<strong>{signed(resolvedDamage.mod)}</strong>
				</div>

				{#if roundTotal == null}
					<Button variant="solid" width="full" on:click={rollRoundSequenceDamage}>Roll Damage</Button>
				{:else}
					<dl class="round-result">
						<div><dt>Dice</dt><dd>{roundDiceRolls.join(", ")}</dd></div>
						<div><dt>Modifier</dt><dd>{signed(resolvedDamage.mod)}</dd></div>
						<div class="round-total"><dt>Total Damage</dt><dd>{roundTotal}</dd></div>
					</dl>
					<div class="round-actions">
						<Button variant="subtle" width="full" on:click={rollRoundSequenceDamage}>Roll Again</Button>
						<Button variant="success" width="full" on:click={confirmRoundSequenceDamage}>Confirm</Button>
					</div>
				{/if}

				{#if roundError != null}
					<p class="error">{roundError} Resolve this round manually.</p>
					<Button variant="solid" width="full" on:click={confirmRoundSequenceDamage}>Confirm</Button>
				{/if}
			</section>
		{:else}
			<div class="error-card">
				<strong>Dynamic damage could not be resolved.</strong>
				<span>The move uses {damage.dice}, which is not a supported dynamic dice expression yet.</span>
			</div>
		{/if}
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
	{:else if profile?.kind === "conditional-dice"}
		<section class="dynamic-rule">
			<div class="rule-heading">
				<strong>{effectiveMoveName} condition</strong>
				<span>{conditionActive ? `${profile.multiplier}× dice` : "Normal dice"}</span>
			</div>
			<label class="checkbox-row" for="dynamic-condition-active">
				<input id="dynamic-condition-active" type="checkbox" bind:checked={conditionActive} />
				<span>{profile.label}</span>
			</label>
			{#if resolvedDamage != null}
				<div class="resolved-line"><span>Damage dice</span><strong>{resolvedDamage.dice}</strong></div>
			{/if}
			<p>{profile.note}</p>
		</section>
	{:else if profile?.kind === "health-total"}
		<section class="dynamic-rule">
			<div class="rule-heading">
				<strong>{effectiveMoveName} HP scaling</strong>
				<span>{totalMultiplier}× total damage</span>
			</div>
			<div class="resolved-line">
				<span>Current HP</span>
				<strong>{currentHp ?? "?"} / {maxHp ?? "?"}{hpPercent != null ? ` · ${hpPercent.toFixed(0)}%` : ""}</strong>
			</div>
			<p>{profile.note}</p>
		</section>
	{:else if profile?.kind === "extra-dice-count"}
		<section class="dynamic-rule">
			<div class="rule-heading">
				<strong>{effectiveMoveName} bonus dice</strong>
				<span>{resolvedDamage?.dice ?? damage.dice}</span>
			</div>
			<div class="count-control">
				<label for="dynamic-condition-count">{profile.label}</label>
				<input id="dynamic-condition-count" type="number" min="0" bind:value={conditionCount} />
			</div>
			{#if resolvedDamage != null}
				<div class="resolved-line"><span>Resolved damage dice</span><strong>{resolvedDamage.dice}</strong></div>
			{/if}
			<p>{profile.note}</p>
		</section>
	{/if}

	{#if profile?.kind !== "round-sequence"}
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
	{/if}
{/if}

<style>
	.dynamic-rule,
	.error-card,
	.round-sequence-roll {
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
	.round-history > div,
	.final-total-breakdown > div,
	.round-formula,
	.round-result > div {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75em;
	}

	.rule-heading span,
	.dynamic-rule p,
	.error-card span,
	.magnitude-result span,
	.round-history span,
	.checkbox-row span,
	.final-total-breakdown span {
		font-size: 0.78rem;
	}

	.dynamic-rule p,
	.error-card span,
	.round-sequence-roll p {
		margin: 0;
		line-height: 1.35;
	}

	.dynamic-rule label {
		font-size: 0.78rem;
		font-weight: bold;
	}

	.dynamic-rule select,
	.dynamic-rule input[type="number"] {
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

	.checkbox-row {
		display: flex;
		align-items: flex-start;
		gap: 0.55em;
		padding: 0.55em 0.65em;
		background: var(--skin-content);
		border-radius: 0.55em;
	}

	.checkbox-row input {
		margin-block-start: 0.1em;
	}

	.count-control {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 5em;
		align-items: center;
		gap: 0.55em;
	}

	.count-control input {
		text-align: center;
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

	.magnitude-result,
	.resolved-line,
	.round-formula,
	.round-result > div {
		padding: 0.55em 0.65em;
		background: var(--skin-content);
		border-radius: 0.55em;
	}

	.round-sequence-roll h3 {
		margin: 0;
	}

	.round-result {
		display: grid;
		gap: 0.35em;
		margin: 0;
	}

	.round-result .round-total {
		font-size: var(--font-sz-neptune);
	}

	.round-result dd {
		margin: 0;
		text-align: right;
	}

	.round-actions {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5em;
	}

	.round-history,
	.final-total-breakdown {
		display: grid;
		gap: 0.3em;
	}

	.round-history > div,
	.final-total-breakdown > div {
		padding: 0.45em 0.55em;
		background: var(--skin-content);
		border-radius: 0.5em;
	}

	.final-total-breakdown .final-total-row {
		font-size: var(--font-sz-neptune);
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