<script lang="ts">
	import { Button } from "$lib/ui/elements"
	import {
		DIE_SIZES,
		rollDice,
		type DiceRollMode,
		type DiceRollResult,
		type DieSize,
	} from "./DiceRoller"

	let dialog: HTMLDialogElement
	let count = 1
	let sides: DieSize = 20
	let modifier = 0
	let mode: DiceRollMode = "normal"
	let result: DiceRollResult | undefined = undefined

	$: isD20Check = sides === 20 && count === 1
	$: if (!isD20Check && mode !== "normal") mode = "normal"

	const signed = (value: number) => value >= 0 ? `+${value}` : `${value}`

	const open = () => {
		if (!dialog.open) dialog.showModal()
	}

	const close = () => {
		if (dialog.open) dialog.close()
	}

	const normalizeInputs = () => {
		count = Math.max(1, Math.min(20, Math.floor(Number(count) || 1)))
		modifier = Math.trunc(Number(modifier) || 0)
	}

	const roll = () => {
		normalizeInputs()
		result = rollDice({ count, sides, modifier, mode })
	}

	const changeCount = (amount: number) => {
		count = Math.max(1, Math.min(20, count + amount))
		result = undefined
	}

	const changeModifier = (amount: number) => {
		modifier += amount
		result = undefined
	}

	const onCancel = (event: Event) => {
		event.preventDefault()
		close()
	}
</script>

<button class="dice-roller-launcher" type="button" on:click={open} aria-label="Open Dice Roller">
	<span class="die-badge" aria-hidden="true">d20</span>
	<span>Dice Roller</span>
</button>

<dialog bind:this={dialog} class="drawer" aria-labelledby="dice-roller-title" on:cancel={onCancel}>
	<header>
		<div class="header-row">
			<h2 id="dice-roller-title" class="drawer-title">Dice Roller</h2>
			<Button variant="ghost" on:click={close}>Close</Button>
		</div>
		<p>Roll a quick check, initiative, damage, or any other dice expression.</p>
	</header>

	<form on:submit|preventDefault={roll}>
		<div class="roller-grid">
			<div class="field">
				<label for="dice-roller-count">Dice</label>
				<div class="stepper">
					<Button variant="subtle" on:click={() => changeCount(-1)}>−</Button>
					<input id="dice-roller-count" type="number" min="1" max="20" bind:value={count} on:change={() => result = undefined} />
					<Button variant="subtle" on:click={() => changeCount(1)}>+</Button>
				</div>
			</div>

			<div class="field">
				<label for="dice-roller-sides">Die Type</label>
				<select id="dice-roller-sides" bind:value={sides} on:change={() => result = undefined}>
					{#each DIE_SIZES as die}
						<option value={die}>d{die}</option>
					{/each}
				</select>
			</div>
		</div>

		<div class="modifier-control">
			<div>
				<strong>Modifier</strong>
				<span>Add a skill, initiative, save, or other flat bonus.</span>
			</div>
			<div class="stepper modifier-stepper">
				<Button variant="subtle" on:click={() => changeModifier(-1)}>−</Button>
				<input aria-label="Modifier" type="number" bind:value={modifier} on:change={() => result = undefined} />
				<Button variant="subtle" on:click={() => changeModifier(1)}>+</Button>
			</div>
		</div>

		{#if isD20Check}
			<div class="mode-control">
				<strong>Roll Mode</strong>
				<div class="mode-grid">
					<Button variant={mode === "advantage" ? "solid" : "subtle"} width="full" on:click={() => { mode = "advantage"; result = undefined }}>Advantage</Button>
					<Button variant={mode === "normal" ? "solid" : "subtle"} width="full" on:click={() => { mode = "normal"; result = undefined }}>Normal</Button>
					<Button variant={mode === "disadvantage" ? "solid" : "subtle"} width="full" on:click={() => { mode = "disadvantage"; result = undefined }}>Disadvantage</Button>
				</div>
			</div>
		{/if}

		<div class="expression">
			<span>Rolling</span>
			<strong>{count}d{sides}{modifier === 0 ? "" : ` ${signed(modifier)}`}</strong>
		</div>

		<Button type="submit" variant="solid" width="full">Roll Dice</Button>
	</form>

	{#if result != null}
		<section class="result" aria-live="polite">
			<div class="result-total">
				<span>Total</span>
				<strong>{result.total}</strong>
			</div>

			{#if result.mode !== "normal"}
				<div class="result-line">
					<span>{result.mode === "advantage" ? "Advantage rolls" : "Disadvantage rolls"}</span>
					<strong>{result.rolls.join(", ")}</strong>
				</div>
				<div class="result-line">
					<span>Kept</span>
					<strong>{result.keptRolls[0]}</strong>
				</div>
			{:else}
				<div class="result-line">
					<span>Dice</span>
					<strong>{result.rolls.join(" + ")}</strong>
				</div>
			{/if}

			{#if result.modifier !== 0}
				<div class="result-line">
					<span>Modifier</span>
					<strong>{signed(result.modifier)}</strong>
				</div>
			{/if}
		</section>
	{/if}
</dialog>

<style>
	.dice-roller-launcher {
		position: fixed;
		inset: auto 1rem 1rem auto;
		z-index: 8;
		display: flex;
		align-items: center;
		gap: 0.55em;
		border: none;
		border-radius: 999px;
		padding: 0.55em 0.9em 0.55em 0.6em;
		background: var(--skin-bg-dark);
		color: var(--skin-bg-text);
		box-shadow: var(--elev-cirrus);
		font-weight: bold;
		cursor: pointer;
	}

	.dice-roller-launcher:hover,
	.dice-roller-launcher:focus-visible {
		background: var(--red-main);
	}

	.die-badge {
		display: grid;
		place-items: center;
		inline-size: 2.1em;
		block-size: 2.1em;
		border-radius: 50%;
		background: var(--skin-content);
		color: var(--skin-content-text);
		font-size: var(--font-sz-venus);
		font-weight: 900;
	}

	.drawer {
		position: fixed;
		inset: 50% 1rem auto auto;
		transform: translateY(-50%);
		margin: 0;
		width: min(22rem, calc(100vw - 2rem));
		height: fit-content;
		max-height: calc(100dvh - 2rem);
		overflow-y: auto;
		box-sizing: border-box;
		padding: 0.9em 1.25em 1.25em;
		border: none;
		background: var(--skin-content);
		color: var(--skin-content-text);
		border-radius: 1rem;
		box-shadow: var(--elev-cirrus);
	}

	.drawer::backdrop {
		background: rgb(0 0 0 / 0.35);
	}

	header {
		margin-block-end: 1em;
	}

	header p {
		margin: 0;
		font-size: var(--font-sz-venus);
	}

	.header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1em;
		margin-block-end: 0.65em;
	}

	.drawer-title {
		display: inline-block;
		margin: 0;
		padding: 0.2em 0.65em;
		background: var(--skin-bg-dark);
		color: var(--skin-bg-text);
		border-radius: 0.35em;
		clip-path: none;
		white-space: nowrap;
	}

	.drawer-title::before,
	.drawer-title::after {
		content: none;
	}

	form {
		display: grid;
		gap: 0.8em;
	}

	.roller-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.65em;
	}

	.field {
		display: grid;
		gap: 0.3em;
	}

	label,
	.field > label,
	.mode-control > strong,
	.modifier-control > div:first-child strong {
		font-weight: bold;
		font-size: var(--font-sz-venus);
	}

	input,
	select {
		inline-size: 100%;
		box-sizing: border-box;
		min-block-size: 2.15rem;
	}

	.stepper {
		display: grid;
		grid-template-columns: auto minmax(2.5em, 1fr) auto;
		align-items: center;
		gap: 0.2em;
	}

	.stepper :global(.button) {
		min-inline-size: 2rem;
		padding-inline: 0.45em;
	}

	.stepper :global(.button:hover::before),
	.stepper :global(.button:focus::before) {
		content: none;
	}

	.modifier-control,
	.mode-control,
	.expression,
	.result {
		padding: 0.8em;
		background: var(--skin-input-bg);
		border-radius: 0.75em;
	}

	.modifier-control {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(8rem, 0.75fr);
		align-items: center;
		gap: 0.75em;
	}

	.modifier-control > div:first-child {
		display: grid;
		gap: 0.1em;
	}

	.modifier-control span {
		font-size: 0.76rem;
		line-height: 1.2;
	}

	.mode-control {
		display: grid;
		gap: 0.5em;
	}

	.mode-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.25em;
	}

	.mode-grid :global(.button) {
		min-width: 0;
		padding-inline: 0.2em;
		font-size: 0.76rem;
		white-space: nowrap;
	}

	.mode-grid :global(.button:hover::before),
	.mode-grid :global(.button:focus::before) {
		content: none;
	}

	.expression {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1em;
	}

	.expression strong {
		font-size: var(--font-sz-mars);
	}

	.result {
		display: grid;
		gap: 0.45em;
		margin-block-start: 1em;
	}

	.result-total,
	.result-line {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1em;
	}

	.result-total {
		padding-block-end: 0.5em;
		border-block-end: 1px solid color-mix(in srgb, currentColor 20%, transparent);
	}

	.result-total strong {
		font-size: 2rem;
		line-height: 1;
	}

	.result-line {
		font-size: var(--font-sz-venus);
	}

	@media screen and (max-width: 28rem) {
		.dice-roller-launcher span:last-child {
			display: none;
		}

		.dice-roller-launcher {
			padding: 0.45em;
		}

		.modifier-control {
			grid-template-columns: 1fr;
		}
	}

	@media print {
		.dice-roller-launcher,
		.drawer {
			display: none;
		}
	}
</style>
