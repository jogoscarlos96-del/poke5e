<script lang="ts">
	import { Button } from "$lib/ui/elements"
	import type { MoveStats } from "../MoveStats"
	import { criticalDiceCount } from "./AbilityInteractions"

	export let damage: NonNullable<MoveStats["damage"]>
	export let onconfirm: (value?: number) => void
	export let critical = false
	export let criticalDiceMultiplier = 2
	export let moveType: string | undefined = undefined
	export let currentHp: number | undefined = undefined
	export let maxHp: number | undefined = undefined
	export let onapplyhealing: ((value: number) => void) | undefined = undefined

	let transientDamageBonus = 0
	let extraDice = ""
	let diceRolls: number[] = []
	let extraDiceRolls: number[] = []
	let criticalDiceRolls: number[] = []
	let criticalExtraDiceRolls: number[] = []
	let normalTotal: number | undefined = undefined
	let criticalBonus: number | undefined = undefined
	let total: number | undefined = undefined
	let error: string | undefined = undefined
	let previousDamageDice = damage.dice

	$: label = damage.isHealing ? "Healing" : "Damage"
	$: canApplyHealing = damage.isHealing && onapplyhealing != null
	$: healingPreview = canApplyHealing && total != null && currentHp != null && maxHp != null
		? Math.min(maxHp, currentHp + Math.max(0, total))
		: undefined
	$: effectiveCriticalMultiplier = Math.max(2, Math.floor(criticalDiceMultiplier))
	$: moveTypeBackground = moveType != null ? `var(--skin-${moveType}-bg)` : "var(--skin-bg-dark)"
	$: effectiveModifier = damage.mod + transientDamageBonus

	const signed = (value: number) => value >= 0 ? `+${value}` : `${value}`

	const clearRoll = () => {
		diceRolls = []
		extraDiceRolls = []
		criticalDiceRolls = []
		criticalExtraDiceRolls = []
		normalTotal = undefined
		criticalBonus = undefined
		total = undefined
		error = undefined
	}

	$: if (damage.dice !== previousDamageDice) {
		previousDamageDice = damage.dice
		transientDamageBonus = 0
		extraDice = ""
		clearRoll()
	}

	const changeTransientDamageBonus = (amount: number) => {
		transientDamageBonus += amount
		clearRoll()
	}

	const onExtraDiceInput = () => {
		clearRoll()
	}

	const parseDice = (expression: string) => {
		const match = expression.trim().match(/^(\d+)d(\d+)$/i)
		if (match == null) return undefined

		const count = Number.parseInt(match[1], 10)
		const sides = Number.parseInt(match[2], 10)
		if (count <= 0 || sides <= 0) return undefined

		return { count, sides }
	}

	const rollDice = (count: number, sides: number) =>
		Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1)

	const roll = () => {
		const baseDice = parseDice(damage.dice)
		if (baseDice == null) {
			clearRoll()
			error = `Unable to roll ${damage.dice}.`
			return
		}

		const trimmedExtraDice = extraDice.trim()
		const parsedExtraDice = trimmedExtraDice.length > 0 ? parseDice(trimmedExtraDice) : undefined
		if (trimmedExtraDice.length > 0 && parsedExtraDice == null) {
			clearRoll()
			error = `Unable to roll extra dice ${trimmedExtraDice}.`
			return
		}

		diceRolls = rollDice(baseDice.count, baseDice.sides)
		extraDiceRolls = parsedExtraDice != null ? rollDice(parsedExtraDice.count, parsedExtraDice.sides) : []

		const baseDiceTotal = diceRolls.reduce((sum, value) => sum + value, 0)
		const extraDiceTotal = extraDiceRolls.reduce((sum, value) => sum + value, 0)
		normalTotal = baseDiceTotal + extraDiceTotal + effectiveModifier

		const isCriticalDamage = critical && !damage.isHealing
		const criticalBaseDiceCount = criticalDiceCount(baseDice.count, isCriticalDamage, effectiveCriticalMultiplier) - baseDice.count
		const criticalAddedDiceCount = parsedExtraDice != null
			? criticalDiceCount(parsedExtraDice.count, isCriticalDamage, effectiveCriticalMultiplier) - parsedExtraDice.count
			: 0
		criticalDiceRolls = rollDice(criticalBaseDiceCount, baseDice.sides)
		criticalExtraDiceRolls = parsedExtraDice != null
			? rollDice(criticalAddedDiceCount, parsedExtraDice.sides)
			: []
		criticalBonus = [...criticalDiceRolls, ...criticalExtraDiceRolls].reduce((sum, value) => sum + value, 0)
		total = normalTotal + criticalBonus
		error = undefined
	}

	const confirm = () => {
		if (canApplyHealing && total != null) {
			onapplyhealing?.(Math.max(0, total))
			return
		}
		onconfirm(total)
	}
</script>

<section class="damage-roll" style:--move-type-bg={moveTypeBackground}>
	<h3>{critical && !damage.isHealing ? "Critical Damage Roll" : `${label} Roll`}</h3>
	<div class="formula">
		<span>{damage.dice}{extraDice.trim() ? ` + ${extraDice.trim()}` : ""}</span>
		<strong>{signed(effectiveModifier)}</strong>
	</div>

	<div class="temporary-bonus-control">
		<div>
			<strong>Temporary {label} Bonus</strong>
			<span>This roll · Current {signed(transientDamageBonus)}</span>
		</div>
		<div class="bonus-stepper">
			<Button variant="subtle" on:click={() => changeTransientDamageBonus(-1)}>−</Button>
			<strong>{signed(transientDamageBonus)}</strong>
			<Button variant="subtle" on:click={() => changeTransientDamageBonus(1)}>+</Button>
		</div>
	</div>

	<div class="extra-dice-control">
		<label for="move-roller-extra-dice">Extra {label} Dice</label>
		<input
			id="move-roller-extra-dice"
			type="text"
			inputmode="text"
			placeholder="e.g. 1d6"
			bind:value={extraDice}
			on:input={onExtraDiceInput}
		/>
		<span>Optional; applies to this damage roll only. If the attack is critical, these dice use the same critical multiplier.</span>
	</div>

	{#if critical && !damage.isHealing}
		<p class="critical-rule">Critical hit: roll {effectiveCriticalMultiplier}× all damage dice involved in this attack; apply flat modifiers once.</p>
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
			{#if transientDamageBonus !== 0}
				<div>
					<dt>Temporary Bonus</dt>
					<dd>{signed(transientDamageBonus)}</dd>
				</div>
			{/if}
			{#if extraDiceRolls.length > 0}
				<div>
					<dt>Extra Dice</dt>
					<dd>{extraDiceRolls.join(", ")}</dd>
				</div>
			{/if}
			{#if critical && !damage.isHealing && normalTotal != null && criticalBonus != null}
				<div class="normal-damage-row">
					<dt>Normal Damage</dt>
					<dd>{normalTotal}</dd>
				</div>
				<div class="critical-result-row critical-bonus-row">
					<dt>Critical Bonus Dice</dt>
					<dd>{criticalDiceRolls.join(", ")}</dd>
				</div>
				{#if criticalExtraDiceRolls.length > 0}
					<div class="critical-result-row critical-bonus-row">
						<dt>Extra Dice Critical Bonus</dt>
						<dd>{criticalExtraDiceRolls.join(", ")}</dd>
					</div>
				{/if}
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
		<p class="error">{error} Use an NdM expression such as 1d6, or resolve the move manually.</p>
		<Button variant="solid" width="full" on:click={() => onconfirm(undefined)}>Confirm</Button>
	{/if}
</section>

<style>
	h3 {
		margin-block: 0 0.65em;
		font-size: var(--font-sz-mars);
	}

	.formula,
	.result div,
	.temporary-bonus-control,
	.extra-dice-control {
		padding: 0.7em 0.8em;
		background: var(--skin-input-bg);
		border-radius: 0.75em;
	}

	.formula,
	.result div,
	.temporary-bonus-control {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1em;
	}

	.formula {
		margin-block-end: 0.75em;
		font-size: var(--font-sz-neptune);
	}

	.temporary-bonus-control {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.5em;
		margin-block-end: 0.75em;
	}

	.temporary-bonus-control > div:first-child {
		display: grid;
		gap: 0.1em;
		min-width: 0;
	}

	.temporary-bonus-control > div:first-child strong {
		font-size: 0.88rem;
		line-height: 1.15;
	}

	.temporary-bonus-control > div:first-child span,
	.extra-dice-control span {
		font-size: 0.78rem;
	}

	.bonus-stepper {
		display: grid;
		grid-template-columns: auto minmax(2em, auto) auto;
		align-items: center;
		gap: 0.1em;
		text-align: center;
	}

	.bonus-stepper :global(.button) {
		min-width: 1.8em;
		padding-inline: 0.35em;
	}

	.bonus-stepper :global(.button:hover::before),
	.bonus-stepper :global(.button:focus::before),
	.bonus-stepper :global(.button:active::before) {
		content: none;
		display: none;
	}

	.extra-dice-control {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 5.5em;
		align-items: center;
		gap: 0.35em 0.65em;
		margin-block-end: 1em;
	}

	.extra-dice-control label {
		font-weight: bold;
		font-size: 0.88rem;
	}

	.extra-dice-control input {
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		padding: 0.35em 0.45em;
		border: 1px solid var(--skin-border, currentColor);
		border-radius: 0.4em;
		background: var(--skin-content);
		color: var(--skin-content-text);
		font: inherit;
		font-size: 0.82rem;
		text-align: center;
	}

	.extra-dice-control span {
		grid-column: 1 / -1;
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
