<script lang="ts">
	import { Button } from "$lib/ui/elements"
	import type { MoveStats } from "../MoveStats"

	export let damage: NonNullable<MoveStats["damage"]>
	export let onconfirm: () => void
	export let critical = false
	export let criticalDiceMultiplier = 2
	export let moveType: string | undefined = undefined
	export let currentHp: number | undefined = undefined
	export let maxHp: number | undefined = undefined
	export let onapplyhealing: ((value: number) => void) | undefined = undefined

	let diceRolls: number[] = []
	let criticalDiceRolls: number[] = []
	let normalTotal: number | undefined = undefined
	let criticalBonus: number | undefined = undefined
	let total: number | undefined = undefined
	let error: string | undefined = undefined

	$: label = damage.isHealing ? "Healing" : "Damage"
	$: canApplyHealing = damage.isHealing && onapplyhealing != null
	$: healingPreview = canApplyHealing && total != null && currentHp != null && maxHp != null
		? Math.min(maxHp, currentHp + Math.max(0, total))
		: undefined
	$: effectiveCriticalMultiplier = Math.max(2, Math.floor(criticalDiceMultiplier))
	$: moveTypeBackground = moveType != null ? `var(--skin-${moveType}-bg)` : "var(--skin-bg-dark)"

	const signed = (value: number) => value >= 0 ? `+${value}` : `${value}`

	const roll = () => {
		const match = damage.dice.trim().match(/^(\d+)d(\d+)$/i)
		if (match == null) {
			diceRolls = []
			criticalDiceRolls = []
			normalTotal = undefined
			criticalBonus = undefined
			total = undefined
			error = `Unable to roll ${damage.dice}.`
			return
		}

		const count = Number.parseInt(match[1], 10)
		const sides = Number.parseInt(match[2], 10)
		if (count <= 0 || sides <= 0) {
			diceRolls = []
			criticalDiceRolls = []
			normalTotal = undefined
			criticalBonus = undefined
			total = undefined
			error = `Unable to roll ${damage.dice}.`
			return
		}

		diceRolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1)
		normalTotal = diceRolls.reduce((sum, value) => sum + value, 0) + damage.mod

		const extraDiceCount = critical && !damage.isHealing ? count * (effectiveCriticalMultiplier - 1) : 0
		criticalDiceRolls = Array.from({ length: extraDiceCount }, () => Math.floor(Math.random() * sides) + 1)
		criticalBonus = criticalDiceRolls.reduce((sum, value) => sum + value, 0)
		total = normalTotal + criticalBonus
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

<section class="damage-roll" style:--move-type-bg={moveTypeBackground}>
	<h3>{critical && !damage.isHealing ? "Critical Damage Roll" : `${label} Roll`}</h3>
	<div class="formula">
		<span>{damage.dice}</span>
		<strong>{signed(damage.mod)}</strong>
	</div>
	{#if critical && !damage.isHealing}
		<p class="critical-rule">Critical hit: roll {effectiveCriticalMultiplier}× the normal damage dice; apply the flat modifier once.</p>
	{/if}

	{#if total == null}
		<Button variant="solid" width="full" on:click={roll}>Roll {critical && !damage.isHealing ? "Critical Damage" : label}</Button>
	{:else}
		<dl class="result">
			<div>
				<dt>{critical && !damage.isHealing ? "Normal Dice" : "Dice"}</dt>
				<dd>{diceRolls.join(", ")}</dd>
			</div>
			<div>
				<dt>Modifier</dt>
				<dd>{signed(damage.mod)}</dd>
			</div>
			{#if critical && !damage.isHealing && normalTotal != null && criticalBonus != null}
				<div class="normal-damage-row">
					<dt>Normal Damage</dt>
					<dd>{normalTotal}</dd>
				</div>
				<div class="critical-result-row critical-bonus-row">
					<dt>Critical Bonus Dice</dt>
					<dd>{criticalDiceRolls.join(", ")}</dd>
				</div>
				<div class="critical-result-row critical-bonus-row">
					<dt>Critical Bonus</dt>
					<dd>{criticalBonus}</dd>
				</div>
				<div class="total-row critical-result-row critical-total-row">
					<dt>Critical Total</dt>
					<dd>{total}</dd>
				</div>
			{:else}
				<div class="total-row">
					<dt>Total {label}</dt>
					<dd>{total}</dd>
				</div>
			{/if}
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
		{#if critical && !damage.isHealing}
			<p class="critical-immunity-note">If the target has Battle Armor, Shell Armor, or Solid Rock, ignore the Critical Bonus and use Normal Damage.</p>
		{/if}
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

	.result div.normal-damage-row,
	.result div.critical-total-row {
		background-color: var(--move-type-bg);
		color: var(--skin-bg-text);
	}

	.result div.critical-result-row {
		border: none;
		position: relative;
		overflow: hidden;
	}

	.result div.critical-bonus-row {
		background-color: var(--skin-input-bg);
		background-image: linear-gradient(125deg, transparent 18%, rgb(255 255 255 / 0.04) 34%, rgb(255 255 255 / 0.5) 50%, rgb(255 255 255 / 0.08) 66%, transparent 82%);
		background-size: 42% 240%;
		background-repeat: no-repeat;
		background-position: -80% 160%;
		animation: critical-row-shimmer 5s linear infinite;
	}

	.result div.critical-total-row {
		background-image: linear-gradient(125deg, transparent 18%, rgb(255 255 255 / 0.08) 34%, rgb(255 255 255 / 0.72) 50%, rgb(255 255 255 / 0.14) 66%, transparent 82%);
		background-size: 42% 240%;
		background-repeat: no-repeat;
		background-position: -80% 160%;
		animation: critical-row-shimmer 5s linear infinite;
	}

	.total-row {
		font-size: var(--font-sz-neptune);
	}

	.critical-total-row dt,
	.critical-total-row dd {
		font-weight: 800;
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

	.error,
	.critical-rule,
	.critical-immunity-note {
		font-size: var(--font-sz-venus);
	}

	.critical-rule {
		margin-block: -0.35em 1em;
	}

	.critical-immunity-note {
		margin-block: 0 1em;
	}

	@keyframes critical-row-shimmer {
		0% { background-position: -80% 160%; }
		60% { background-position: 180% -60%; }
		60.001%, 100% { background-position: 180% -60%; }
	}

	@media (prefers-reduced-motion: reduce) {
		.result div.critical-bonus-row,
		.result div.critical-total-row {
			animation: none;
			background-image: none;
		}
	}
</style>
