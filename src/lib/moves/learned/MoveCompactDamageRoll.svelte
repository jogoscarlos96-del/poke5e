<script lang="ts">
	import { Button } from "$lib/ui/elements"
	import type { MoveStats } from "../MoveStats"

	export let damage: NonNullable<MoveStats["damage"]>
	export let onconfirm: (value?: number) => void
	export let critical = false
	export let criticalDiceMultiplier = 2
	export let moveType: string | undefined = undefined

	let diceRolls: number[] = []
	let criticalDiceRolls: number[] = []
	let normalTotal: number | undefined = undefined
	let criticalBonus: number | undefined = undefined
	let total: number | undefined = undefined
	let error: string | undefined = undefined

	$: effectiveCriticalMultiplier = Math.max(2, Math.floor(criticalDiceMultiplier))
	$: moveTypeBackground = moveType != null ? `var(--skin-${moveType}-bg)` : "var(--skin-bg-dark)"

	const signed = (value: number) => value >= 0 ? `+${value}` : `${value}`

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
		const parsed = parseDice(damage.dice)
		if (parsed == null) {
			diceRolls = []
			criticalDiceRolls = []
			normalTotal = undefined
			criticalBonus = undefined
			total = undefined
			error = `Unable to roll ${damage.dice}.`
			return
		}

		diceRolls = rollDice(parsed.count, parsed.sides)
		normalTotal = diceRolls.reduce((sum, value) => sum + value, 0) + damage.mod

		const criticalExtraDiceCount = critical
			? parsed.count * (effectiveCriticalMultiplier - 1)
			: 0
		criticalDiceRolls = rollDice(criticalExtraDiceCount, parsed.sides)
		criticalBonus = criticalDiceRolls.reduce((sum, value) => sum + value, 0)
		total = normalTotal + criticalBonus
		error = undefined
	}
</script>

<section class="compact-damage-roll" style:--move-type-bg={moveTypeBackground}>
	<div class="compact-heading">
		<div>
			<strong>{critical ? "Critical Hit Damage" : "Hit Damage"}</strong>
			<span>{damage.dice}{damage.mod !== 0 ? ` ${signed(damage.mod)}` : ""}</span>
		</div>
		{#if total != null}
			<strong class="damage-total">{total}</strong>
		{/if}
	</div>

	{#if total == null}
		<Button variant="solid" width="full" on:click={roll}>Roll {damage.dice}</Button>
	{:else}
		<div class="compact-result" class:critical-result={critical}>
			<div>
				<span>{critical ? "Normal roll" : "Roll"}</span>
				<strong>{diceRolls.join(", ")}</strong>
			</div>
			{#if damage.mod !== 0}
				<div>
					<span>Modifier</span>
					<strong>{signed(damage.mod)}</strong>
				</div>
			{/if}
			{#if critical && criticalBonus != null}
				<div>
					<span>Critical bonus</span>
					<strong>{criticalDiceRolls.join(", ")} (+{criticalBonus})</strong>
				</div>
			{/if}
			<div class="compact-total">
				<span>Total Damage</span>
				<strong>{total}</strong>
			</div>
		</div>

		<div class="actions">
			<Button variant="subtle" width="full" on:click={roll}>Roll Again</Button>
			<Button variant="success" width="full" on:click={() => onconfirm(total)}>Confirm Hit</Button>
		</div>
	{/if}

	{#if error != null}
		<p class="error">{error} Resolve this hit manually.</p>
		<Button variant="solid" width="full" on:click={() => onconfirm(undefined)}>Confirm</Button>
	{/if}
</section>

<style>
	.compact-damage-roll {
		display: grid;
		gap: 0.55em;
		min-width: 0;
	}

	.compact-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75em;
		min-width: 0;
		padding: 0.65em 0.75em;
		background: var(--skin-content);
		border-radius: 0.65em;
	}

	.compact-heading > div {
		display: grid;
		gap: 0.05em;
		min-width: 0;
	}

	.compact-heading span,
	.compact-result span,
	.error {
		font-size: 0.78rem;
	}

	.damage-total {
		flex: 0 0 auto;
		font-size: var(--font-sz-neptune);
	}

	.compact-result {
		display: grid;
		gap: 0.3em;
		min-width: 0;
	}

	.compact-result > div {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75em;
		min-width: 0;
		padding: 0.5em 0.7em;
		background: var(--skin-input-bg);
		border-radius: 0.55em;
	}

	.compact-result > div > span {
		min-width: 0;
	}

	.compact-result > div > strong {
		min-width: 0;
		text-align: right;
		overflow-wrap: anywhere;
	}

	.compact-result > .compact-total {
		background: var(--move-type-bg);
		color: var(--skin-bg-text);
		font-size: var(--font-sz-mars);
	}

	.compact-result.critical-result > .compact-total {
		position: relative;
		overflow: hidden;
	}

	.actions {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5em;
	}

	.error {
		margin: 0;
	}

	@media (max-width: 22rem) {
		.actions {
			grid-template-columns: 1fr;
		}
	}
</style>
