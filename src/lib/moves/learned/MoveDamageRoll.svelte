<script lang="ts">
	import { Button } from "$lib/ui/elements"
	import type { MoveStats } from "../MoveStats"

	export let damage: NonNullable<MoveStats["damage"]>
	export let onconfirm: () => void
	export let currentHp: number | undefined = undefined
	export let maxHp: number | undefined = undefined
	export let onapplyhealing: ((value: number) => void) | undefined = undefined

	let diceRolls: number[] = []
	let total: number | undefined = undefined
	let error: string | undefined = undefined

	$: label = damage.isHealing ? "Healing" : "Damage"
	$: expression = `${damage.dice} ${signed(damage.mod)}`
	$: canApplyHealing = damage.isHealing && onapplyhealing != null
	$: healingPreview = canApplyHealing && total != null && currentHp != null && maxHp != null
		? Math.min(maxHp, currentHp + Math.max(0, total))
		: undefined

	const signed = (value: number) => value >= 0 ? `+${value}` : `${value}`

	const roll = () => {
		const match = damage.dice.trim().match(/^(\d+)d(\d+)$/i)
		if (match == null) {
			diceRolls = []
			total = undefined
			error = `Unable to roll ${damage.dice}.`
			return
		}

		const count = Number.parseInt(match[1], 10)
		const sides = Number.parseInt(match[2], 10)
		if (count <= 0 || sides <= 0) {
			diceRolls = []
			total = undefined
			error = `Unable to roll ${damage.dice}.`
			return
		}

		diceRolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1)
		total = diceRolls.reduce((sum, value) => sum + value, 0) + damage.mod
		error = undefined
	}

	const confirm = () => {
		if (canApplyHealing && total != null) {
			onapplyhealing?.(Math.max(0, total))
			return
		}
		onconfirm()
	}
</script>

<section class="damage-roll">
	<h3>{label} Roll</h3>
	<div class="formula">
		<span>{damage.dice}</span>
		<strong>{signed(damage.mod)}</strong>
	</div>

	{#if total == null}
		<Button variant="solid" width="full" on:click={roll}>Roll {label}</Button>
	{:else}
		<dl class="result">
			<div>
				<dt>Dice</dt>
				<dd>{diceRolls.join(", ")}</dd>
			</div>
			<div>
				<dt>Modifier</dt>
				<dd>{signed(damage.mod)}</dd>
			</div>
			<div class="total-row">
				<dt>Total {label}</dt>
				<dd>{total}</dd>
			</div>
			{#if healingPreview != null && currentHp != null && maxHp != null}
				<div>
					<dt>Current HP</dt>
					<dd>{currentHp} / {maxHp}</dd>
				</div>
				<div class="total-row">
					<dt>HP After Healing</dt>
					<dd>{healingPreview} / {maxHp}</dd>
				</div>
			{/if}
		</dl>
		<div class="actions">
			<Button variant="subtle" width="full" on:click={roll}>Roll Again</Button>
			<Button variant="success" width="full" on:click={confirm}>{canApplyHealing ? "Apply Healing" : "Confirm"}</Button>
		</div>
	{/if}

	{#if error != null}
		<p class="error">{error} Use the move's listed expression manually.</p>
		<Button variant="solid" width="full" on:click={onconfirm}>Confirm</Button>
	{/if}
</section>

<style>
	h3 {
		margin-block: 0 0.65em;
		font-size: var(--font-sz-mars);
	}

	.formula,
	.result div {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1em;
		padding: 0.7em 0.8em;
		background: var(--skin-input-bg);
		border-radius: 0.75em;
	}

	.formula {
		margin-block-end: 1em;
		font-size: var(--font-sz-neptune);
	}

	.result {
		display: grid;
		gap: 0.5em;
		margin-block: 1em;
	}

	.total-row {
		font-size: var(--font-sz-neptune);
	}

	dt {
		font-weight: bold;
	}

	dd {
		margin: 0;
		text-align: right;
		word-break: break-word;
	}

	.actions {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5em;
	}

	.error {
		font-size: var(--font-sz-venus);
	}
</style>