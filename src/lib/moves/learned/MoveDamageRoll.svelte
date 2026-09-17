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
		--shimmer-edge: rgb(255 255 255 / 0.08);
		--shimmer-peak: rgb(255 255 255 / 0.5);
		border: none;
		position: relative;
		overflow: hidden;
	}

	.result div.critical-bonus-row {
		background-color: var(--skin-input-bg);
	}

	.result div.critical-total-row {
		--shimmer-edge: rgb(255 255 255 / 0.14);
		--shimmer-peak: rgb(255 255 255 / 0.72);
	}

	.result div.critical-result-row::after,
	:global(.critical-toggle-special.active .button)::after {
		content: "";
		position: absolute;
		top: -65%;
		bottom: -65%;
		left: -52%;
		width: 36%;
		pointer-events: none;
		background: linear-gradient(115deg, transparent 0%, rgb(255 255 255 / 0.015) 18%, var(--shimmer-edge, rgb(255 255 255 / 0.1)) 34%, var(--shimmer-peak, rgb(255 255 255 / 0.7)) 50%, var(--shimmer-edge, rgb(255 255 255 / 0.1)) 66%, rgb(255 255 255 / 0.015) 82%, transparent 100%);
		filter: blur(2px);
		will-change: transform;
		animation: critical-shimmer-sweep 4s linear infinite;
	}

	:global(.critical-toggle-special.active .button) {
		--shimmer-edge: rgb(255 255 255 / 0.12);
		--shimmer-peak: rgb(255 255 255 / 0.7);
		position: relative;
		overflow: hidden;
		background-image: none !important;
		animation: none !important;
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

	@keyframes critical-shimmer-sweep {
		0% { transform: translate3d(0, 0, 0); }
		50% { transform: translate3d(500%, 0, 0); }
		50.001%, 100% { transform: translate3d(500%, 0, 0); }
	}

	@media (prefers-reduced-motion: reduce) {
		.result div.critical-result-row::after,
		:global(.critical-toggle-special.active .button)::after {
			display: none;
			animation: none;
		}
	}
</style>
