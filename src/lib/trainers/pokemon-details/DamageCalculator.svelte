<script lang="ts">
	import { tick } from "svelte"
	import { Button } from "$lib/ui/elements"
	import { IntField } from "$lib/ui/forms"
	import { PokemonType, TypeTag, type PokeType } from "$lib/pokemon/types"
	import {
		calculateTypeDamage,
		type DamageSpecialRule,
		type TypeEffectivenessTier,
	} from "$lib/pokemon/damage"

	export let targetName: string
	export let currentHp: number
	export let maxHp: number
	export let defenderType: PokemonType
	export let defenderProficiencyBonus: number

	let open = false
	let dialog: HTMLDialogElement | undefined = undefined
	let incomingDamage = 0
	let attackType: PokeType | undefined = undefined
	let specialRule: DamageSpecialRule = "automatic"

	const SPECIAL_RULES: { value: DamageSpecialRule, label: string }[] = [
		{ value: "automatic", label: "Automatic" },
		{ value: "neutral", label: "Neutral" },
		{ value: "effectiveness-up", label: "Effectiveness +1" },
		{ value: "resistance-up", label: "Resistance +1" },
	]

	const EFFECTIVENESS_LABELS: Record<TypeEffectivenessTier, string> = {
		"double-resistance": "Double Resistance",
		"resistance": "Resistance",
		"neutral": "Neutral",
		"weakness": "Weakness",
		"double-weakness": "Double Weakness",
		"immunity": "Immunity",
	}

	$: result = attackType == null
		? undefined
		: calculateTypeDamage({
			incomingDamage,
			attackType,
			defenderType,
			defenderProficiencyBonus,
			specialRule,
		})
	$: hpAfterDamage = result == null
		? undefined
		: Math.max(0, currentHp - result.finalDamage)

	const openDrawer = async () => {
		open = true
		await tick()
		if (dialog != null && !dialog.open) dialog.showModal()
	}

	const close = () => {
		if (dialog?.open) {
			dialog.close()
		} else {
			open = false
		}
	}

	const selectType = (type: PokeType) => attackType = type
	const selectSpecialRule = (rule: DamageSpecialRule) => specialRule = rule

	const effectivenessLabel = (value: TypeEffectivenessTier | undefined) =>
		value == null ? "Select an attack type" : EFFECTIVENESS_LABELS[value]

	const onCancel = (e: Event) => {
		e.preventDefault()
		close()
	}
</script>

<div class="trigger">
	<Button variant="subtle" on:click={openDrawer}>Damage Calculator</Button>
</div>

{#if open}
	<dialog
		bind:this={dialog}
		class="drawer"
		aria-labelledby="damage-calculator-title"
		on:close={() => open = false}
		on:cancel={onCancel}
	>
		<header>
			<div class="header-row">
				<h2 id="damage-calculator-title" class="drawer-title">Damage Calculator</h2>
				<Button variant="ghost" on:click={close}>Close</Button>
			</div>
			<p class="target">{targetName}</p>
		</header>

		<div class="hp-summary">
			<span>Current HP</span>
			<strong>{currentHp} / {maxHp}</strong>
		</div>

		<IntField label="Incoming Damage" bind:value={incomingDamage} min={0} />

		<section>
			<h3>Attack Type</h3>
			<div class="type-grid">
				{#each PokemonType.list as type}
					<button
						type="button"
						class="type-button"
						class:selected={attackType === type}
						style:--type-bg="var(--skin-{type}-bg)"
						aria-pressed={attackType === type}
						on:click={() => selectType(type)}
					>
						{PokemonType.name(type)}
					</button>
				{/each}
			</div>
		</section>

		<section class="target-type">
			<h3>Target Effective Typing</h3>
			<span class="target-type-tag">
				<TypeTag type={defenderType.data} />
			</span>
		</section>

		<div class="effectiveness-row">
			<span>Base Effectiveness</span>
			<strong>{effectivenessLabel(result?.baseEffectiveness)}</strong>
		</div>

		<section>
			<h3>Special Rule</h3>
			<div class="rule-grid">
				{#each SPECIAL_RULES as rule}
					<Button
						variant={specialRule === rule.value ? "solid" : "subtle"}
						width="full"
						on:click={() => selectSpecialRule(rule.value)}
					>
						{rule.label}
					</Button>
				{/each}
			</div>
		</section>

		<dl class="preview">
			<div>
				<dt>Final Effectiveness</dt>
				<dd>{effectivenessLabel(result?.effectiveness)}</dd>
			</div>
			<div>
				<dt>Final Damage</dt>
				<dd>{result?.finalDamage ?? "—"}</dd>
			</div>
			<div>
				<dt>HP After Damage</dt>
				<dd>{hpAfterDamage ?? "—"}</dd>
			</div>
		</dl>
	</dialog>
{/if}

<style>
	.trigger {
		display: flex;
		justify-content: flex-end;
		margin-block-start: 0.375em;
	}

	.drawer {
		position: fixed;
		inset: 1rem auto 1rem 1rem;
		margin: 0;
		width: min(28rem, calc(100vw - 2rem));
		height: auto;
		max-height: calc(100vh - 2rem);
		max-height: calc(100dvh - 2rem);
		overflow-y: auto;
		scrollbar-width: none;
		-ms-overflow-style: none;
		box-sizing: border-box;
		padding: 0.9em 1.25em 1.25em;
		border: none;
		background: var(--skin-content);
		background-clip: padding-box;
		color: var(--skin-content-text);
		border-radius: 1rem;
		box-shadow: var(--elev-cirrus);
	}

	.drawer::-webkit-scrollbar {
		display: none;
		width: 0;
		height: 0;
	}

	.drawer::backdrop {
		background: rgb(0 0 0 / 0.35);
	}

	header {
		margin-block-end: 1em;
	}

	.header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1em;
		margin-block-end: 0.125em;
	}

	h2, h3, p, dl {
		margin-block-start: 0;
	}

	.drawer-title {
		display: inline-block;
		width: fit-content;
		max-width: 100%;
		box-sizing: border-box;
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
		display: none;
	}

	h3 {
		font-size: var(--font-sz-mars);
		margin-block-end: 0.5em;
	}

	.target {
		margin: 0;
		font-weight: bold;
	}

	.hp-summary, .effectiveness-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1em;
		margin-block-end: 1em;
		padding: 0.75em;
		background: var(--skin-input-bg);
		border-radius: 0.75em;
	}

	section {
		margin-block-start: 1.25em;
	}

	.type-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.5em;
	}

	.type-button {
		border: 0.15em solid transparent;
		border-radius: 1em;
		padding: 0.4em 0.5em;
		background: var(--type-bg);
		color: var(--skin-bg-text);
		filter: var(--elev-stratus-filter);
		cursor: pointer;
		font: inherit;
		font-size: var(--font-sz-venus);
	}

	.type-button.selected {
		border-color: var(--skin-bg-text);
		outline: 0.15em solid var(--skin-content-text);
		outline-offset: 0.05em;
	}

	.target-type {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1em;
	}

	.target-type h3 {
		margin-block-end: 0;
	}

	.target-type-tag {
		display: inline-flex;
		flex: 0 0 auto;
		white-space: nowrap;
	}

	.rule-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5em;
	}

	.preview {
		display: grid;
		gap: 0.5em;
		margin-block-start: 1.25em;
	}

	.preview div {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1em;
		padding: 0.75em;
		background: var(--skin-input-bg);
		border-radius: 0.75em;
	}

	dt {
		font-weight: bold;
	}

	dd {
		margin: 0;
		text-align: right;
	}

	@media (max-width: 32rem) {
		.drawer {
			inset: 0.5rem auto 0.5rem 0.5rem;
			width: calc(100vw - 1rem);
			max-height: calc(100vh - 1rem);
			max-height: calc(100dvh - 1rem);
			padding: 0.8em 1em 1em;
			border-radius: 0.75rem;
		}
	}

	@media (max-width: 28rem) {
		.type-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.rule-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
