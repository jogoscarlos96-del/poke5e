<script lang="ts">
	import { Button } from "$lib/ui/elements"
	import type { MoveStats } from "../MoveStats"
	import MoveDamageRoll from "./MoveDamageRoll.svelte"
	import MoveCompactDamageRoll from "./MoveCompactDamageRoll.svelte"
	import type { AttackRollMode, AutomatedMultiHitProfile, ComboMultiHitProfile, RepeatedMultiHitProfile } from "./MultiHit"

	export let profile: AutomatedMultiHitProfile
	export let damage: NonNullable<MoveStats["damage"]>
	export let attackModifier = 0
	export let attackRollMode: AttackRollMode = "normal"
	export let criticalThreshold = 20
	export let criticalDiceMultiplier = 2
	export let moveType: string | undefined = undefined
	export let comboGuaranteeSource: string | undefined = undefined
	export let initialHit = true
	export let initialDamageTotal = 0
	export let initialDamageKnown = true
	export let onconfirm: () => void

	type ComboStep = {
		check?: number,
		guaranteed: boolean,
		success: boolean,
		damageRolls: number[],
		damage: number,
	}

	type RepeatedStep = {
		attack: number,
		hit: boolean,
		natural: number,
		total: number,
		damage?: number,
	}

	let runningTotal = initialDamageTotal
	let hasManualDamage = !initialDamageKnown

	let comboSteps: ComboStep[] = []
	let comboEnded = false
	let comboError: string | undefined = undefined

	let repeatedSteps: RepeatedStep[] = []
	let currentAttack = 2
	let currentAttackRolls: number[] = []
	let currentNatural: number | undefined = undefined
	let currentAttackTotal: number | undefined = undefined
	let repeatedHitConfirmed = false
	let currentCriticalSelected = false
	let repeatedEnded = false
	let repeatedEndNote: string | undefined = undefined
	let hasSuccessfulHit = initialHit

	$: comboProfile = profile.kind === "combo" ? profile as ComboMultiHitProfile : undefined
	$: repeatedProfile = profile.kind === "repeated" ? profile as RepeatedMultiHitProfile : undefined
	$: successfulComboHits = comboSteps.filter((step) => step.success).length
	$: comboDamageDice = comboProfile?.source === "standard" ? damage.dice : comboProfile?.additionalDice ?? damage.dice
	$: currentRepeatedDamage = repeatedProfile != null
		? {
			...damage,
			dice: repeatedProfile.repeatDiceCount != null
				? damage.dice.replace(/^\s*\d+d(\d+)\s*$/i, `${repeatedProfile.repeatDiceCount}d$1`)
				: damage.dice,
			mod: hasSuccessfulHit
				? (repeatedProfile.repeatModifier === "move" ? damage.moveModifier : 0) + repeatedProfile.repeatFlatBonus
				: damage.mod,
			stabApplied: hasSuccessfulHit ? false : damage.stabApplied,
		}
		: damage

	const signed = (value: number) => value >= 0 ? `+${value}` : `${value}`
	const modeLabel = () => attackRollMode === "advantage" ? "Advantage" : attackRollMode === "disadvantage" ? "Disadvantage" : "Normal"

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

	const resolveComboStep = () => {
		if (comboProfile == null || comboEnded) return

		const parsed = parseDice(comboDamageDice)
		if (parsed == null) {
			comboError = `Unable to roll ${comboDamageDice}. Use an NdM expression such as 1d4.`
			return
		}

		const guaranteed = comboGuaranteeSource != null && successfulComboHits === 0
		const check = guaranteed ? undefined : Math.floor(Math.random() * 4) + 1
		const success = guaranteed || (check != null && check >= 3)

		if (!success) {
			comboSteps = [...comboSteps, {
				check,
				guaranteed: false,
				success: false,
				damageRolls: [],
				damage: 0,
			}]
			comboEnded = true
			return
		}

		const damageRolls = rollDice(parsed.count, parsed.sides)
		const extraDamage = damageRolls.reduce((sum, value) => sum + value, 0)
		const nextSuccessfulHits = successfulComboHits + 1
		comboSteps = [...comboSteps, {
			check,
			guaranteed,
			success: true,
			damageRolls,
			damage: extraDamage,
		}]
		runningTotal += extraDamage
		comboError = undefined

		if (nextSuccessfulHits >= comboProfile.maxAdditionalHits) comboEnded = true
	}

	const rollRepeatedAttack = () => {
		if (repeatedProfile == null || repeatedEnded) return
		const first = Math.floor(Math.random() * 20) + 1
		if (attackRollMode === "normal") {
			currentAttackRolls = [first]
			currentNatural = first
		} else {
			const second = Math.floor(Math.random() * 20) + 1
			currentAttackRolls = [first, second]
			currentNatural = attackRollMode === "advantage" ? Math.max(first, second) : Math.min(first, second)
		}
		currentAttackTotal = (currentNatural ?? 0) + attackModifier
		repeatedHitConfirmed = false
		currentCriticalSelected = false
	}

	const resetCurrentAttack = () => {
		currentAttackRolls = []
		currentNatural = undefined
		currentAttackTotal = undefined
		repeatedHitConfirmed = false
		currentCriticalSelected = false
	}

	const advanceRepeatedAttack = () => {
		if (repeatedProfile == null) return
		if (currentAttack >= repeatedProfile.totalAttacks) {
			repeatedEnded = true
			return
		}
		currentAttack += 1
		resetCurrentAttack()
	}

	const confirmRepeatedMiss = () => {
		if (repeatedProfile == null || currentNatural == null || currentAttackTotal == null) return
		repeatedSteps = [...repeatedSteps, {
			attack: currentAttack,
			hit: false,
			natural: currentNatural,
			total: currentAttackTotal,
		}]

		if (repeatedProfile.stopOnMiss) {
			repeatedEnded = true
			repeatedEndNote = `Attack ${currentAttack} missed, so this move's sequence ends.`
			return
		}
		advanceRepeatedAttack()
	}

	const confirmRepeatedHit = () => {
		if (currentNatural == null) return
		repeatedHitConfirmed = true
		currentCriticalSelected = currentNatural >= criticalThreshold
	}

	const confirmRepeatedDamage = (value?: number) => {
		if (repeatedProfile == null || currentNatural == null || currentAttackTotal == null) return
		repeatedSteps = [...repeatedSteps, {
			attack: currentAttack,
			hit: true,
			natural: currentNatural,
			total: currentAttackTotal,
			damage: value,
		}]
		if (value != null) runningTotal += value
		else hasManualDamage = true
		hasSuccessfulHit = true
		advanceRepeatedAttack()
	}
</script>

<section class="multi-hit-continuation" style:--move-type-bg={moveType != null ? `var(--skin-${moveType}-bg)` : "var(--skin-bg-dark)"}>
	{#if comboProfile != null}
		<div class="sequence-heading">
			<div>
				<strong>Combo Hits</strong>
				<span>Additional hit damage: {comboDamageDice}</span>
			</div>
			<strong>{runningTotal}</strong>
		</div>

		{#if comboGuaranteeSource != null && successfulComboHits === 0 && !comboEnded}
			<p class="rule-note"><strong>{comboGuaranteeSource}:</strong> the second hit is guaranteed. Its additional damage will be rolled directly.</p>
		{/if}
		{#if comboProfile.note != null}
			<p class="rule-note">{comboProfile.note}</p>
		{/if}

		{#if comboSteps.length > 0}
			<div class="compact-history">
				{#each comboSteps as step, index}
					<div class:miss={!step.success}>
						<strong>Hit {index + 2}</strong>
						{#if step.success}
							<span>{step.guaranteed ? "Guaranteed" : `d4 ${step.check}`} · +{step.damage} ({step.damageRolls.join(", ")})</span>
						{:else}
							<span>d4 {step.check} · Combo ended</span>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		{#if !comboEnded}
			<Button variant="solid" width="full" on:click={resolveComboStep}>
				{comboGuaranteeSource != null && successfulComboHits === 0 ? "Resolve Guaranteed Hit 2" : "Roll for Additional Hit"}
			</Button>
		{:else}
			<div class="sequence-total">
				<span>{hasManualDamage ? "Tracked Damage" : "Total Damage"}</span>
				<strong>{runningTotal}</strong>
			</div>
			{#if hasManualDamage}
				<p class="rule-note">The initial damage was resolved manually and is not included in the tracked total.</p>
			{/if}
			<Button variant="success" width="full" on:click={onconfirm}>Confirm Total</Button>
		{/if}

		{#if comboError != null}
			<p class="error">{comboError}</p>
		{/if}
	{:else if repeatedProfile != null}
		<div class="sequence-heading">
			<div>
				<strong>Multi-Hit Sequence</strong>
				<span>{repeatedProfile.totalAttacks} separate attacks</span>
			</div>
			<strong>{runningTotal}</strong>
		</div>

		{#if repeatedProfile.note != null}
			<p class="rule-note">{repeatedProfile.note}</p>
		{/if}

		{#if repeatedSteps.length > 0}
			<div class="compact-history">
				{#each repeatedSteps as step}
					<div class:miss={!step.hit}>
						<strong>Attack {step.attack} — {step.hit ? "Hit" : "Miss"}</strong>
						<span>Natural {step.natural} · Total {step.total}{step.hit ? ` · ${step.damage != null ? `Damage ${step.damage}` : "Damage manual"}` : ""}</span>
					</div>
				{/each}
			</div>
		{/if}

		{#if !repeatedEnded}
			<div class="current-attack-card">
				<div class="current-attack-heading">
					<strong>Attack {currentAttack}</strong>
					<span>{modeLabel()} · {signed(attackModifier)}</span>
				</div>

				{#if currentNatural == null || currentAttackTotal == null}
					<Button variant="solid" width="full" on:click={rollRepeatedAttack}>Roll Attack {currentAttack}</Button>
				{:else if !repeatedHitConfirmed}
					{#if currentAttackRolls.length > 1}
						<p class="roll-detail">Rolls: {currentAttackRolls.join(", ")} → Natural {currentNatural}</p>
					{/if}
					<div class="attack-result-line">
						<span>Natural {currentNatural}</span>
						<strong>Total {currentAttackTotal}</strong>
					</div>
					<p class="rule-note">Compare the total against the target's AC.</p>
					<div class="decision-grid">
						<Button variant="subtle" width="full" on:click={confirmRepeatedMiss}>Miss</Button>
						<Button variant="success" width="full" on:click={confirmRepeatedHit}>Hit</Button>
					</div>
				{:else}
					<div class="resolved-current">
						<strong>Attack {currentAttack}</strong>
						<span>Natural {currentNatural} · Total {currentAttackTotal}</span>
					</div>

					{#if repeatedProfile.naturalReminder != null && currentNatural >= repeatedProfile.naturalReminder.threshold}
						<p class="effect-note">{repeatedProfile.naturalReminder.text}</p>
					{/if}

					<div class="critical-control">
						<div class="critical-control-heading">
							<strong>Critical Hit?</strong>
							<span>{criticalThreshold}+ range</span>
						</div>
						<div class="decision-grid critical-toggle">
							<div class="critical-toggle-option">
								<Button variant={currentCriticalSelected ? "subtle" : "solid"} width="full" on:click={() => currentCriticalSelected = false}>Normal</Button>
							</div>
							<div class="critical-toggle-option critical-toggle-special" class:active={currentCriticalSelected}>
								<Button variant="subtle" width="full" on:click={() => currentCriticalSelected = true}>Critical</Button>
							</div>
						</div>
					</div>

					<div class="damage-step-card">
						{#key currentCriticalSelected}
							{#if repeatedProfile.repeatDiceCount != null}
								<MoveCompactDamageRoll
									damage={currentRepeatedDamage}
									critical={currentCriticalSelected}
									{criticalDiceMultiplier}
									{moveType}
									onconfirm={confirmRepeatedDamage}
								/>
							{:else}
								<MoveDamageRoll
									damage={currentRepeatedDamage}
									critical={currentCriticalSelected}
									{criticalDiceMultiplier}
									{moveType}
									onconfirm={confirmRepeatedDamage}
								/>
							{/if}
						{/key}
					</div>
				{/if}
			</div>
		{:else}
			{#if repeatedEndNote != null}
				<p class="rule-note">{repeatedEndNote}</p>
			{/if}
			<div class="sequence-total">
				<span>{hasManualDamage ? "Tracked Damage" : "Total Damage"}</span>
				<strong>{runningTotal}</strong>
			</div>
			{#if hasManualDamage}
				<p class="rule-note">One or more hit damage results were resolved manually and are not included in the tracked total.</p>
			{/if}
			<Button variant="success" width="full" on:click={onconfirm}>Confirm Sequence</Button>
		{/if}
	{/if}
</section>

<style>
	.multi-hit-continuation {
		display: grid;
		gap: 0.6em;
	}

	.sequence-heading,
	.sequence-total,
	.resolved-current,
	.critical-control,
	.current-attack-heading,
	.attack-result-line {
		padding: 0.7em 0.8em;
		background: var(--skin-input-bg);
		border-radius: 0.75em;
	}

	.sequence-heading,
	.sequence-total,
	.current-attack-heading,
	.attack-result-line,
	.critical-control-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75em;
	}

	.sequence-heading > div,
	.resolved-current {
		display: grid;
		gap: 0.1em;
	}

	.sequence-heading span,
	.current-attack-heading span,
	.resolved-current span,
	.roll-detail,
	.rule-note,
	.effect-note,
	.error,
	.compact-history span,
	.critical-control-heading span {
		font-size: 0.78rem;
	}

	.sequence-heading > strong,
	.sequence-total strong {
		font-size: var(--font-sz-neptune);
	}

	.rule-note,
	.effect-note,
	.error,
	.roll-detail {
		margin: 0;
	}

	.effect-note {
		padding: 0.6em 0.7em;
		background: var(--skin-bg-dark);
		color: var(--skin-bg-text);
		border-radius: 0.65em;
	}

	.compact-history {
		display: grid;
		gap: 0.35em;
	}

	.compact-history > div {
		display: grid;
		gap: 0.05em;
		padding: 0.55em 0.7em;
		background: var(--skin-input-bg);
		border-radius: 0.6em;
	}

	.compact-history > div.miss {
		opacity: 0.78;
	}

	.current-attack-card {
		display: grid;
		gap: 0.5em;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: 0;
	}

	.current-attack-heading {
		padding-block: 0.65em;
	}

	.attack-result-line,
	.resolved-current,
	.critical-control,
	.damage-step-card {
		border: none;
	}

	.damage-step-card {
		padding: 0;
		background: transparent;
		border-radius: 0;
	}

	.decision-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5em;
	}

	.critical-control {
		display: grid;
		gap: 0.55em;
	}

	.critical-toggle-option {
		min-width: 0;
	}

	.critical-toggle-option :global(.button) {
		height: 100%;
	}

	.critical-toggle :global(.button:hover::before),
	.critical-toggle :global(.button:focus::before),
	.critical-toggle :global(.button:active::before) {
		content: none;
		display: none;
	}

	.critical-toggle-special :global(.button) {
		border: none;
		background: var(--skin-input-bg);
		color: var(--skin-content-text);
	}

	.critical-toggle-special.active :global(.button) {
		background-color: var(--move-type-bg);
		color: var(--skin-bg-text);
		font-weight: 800;
		text-shadow: 0 1px 2px rgb(0 0 0 / 0.4);
	}

	.damage-step-card :global(.damage-roll) {
		display: grid;
		gap: 0.45em;
	}

	.damage-step-card :global(.damage-roll h3) {
		margin: 0;
		padding: 0.6em 0.7em;
		background: var(--skin-input-bg);
		border-radius: 0.7em;
	}

	.damage-step-card :global(.damage-roll .formula),
	.damage-step-card :global(.damage-roll .temporary-bonus-control),
	.damage-step-card :global(.damage-roll .extra-dice-control) {
		margin-block-end: 0;
		padding: 0.6em 0.7em;
	}

	.damage-step-card :global(.damage-roll .extra-dice-control) {
		margin-block-end: 0;
	}

	.damage-step-card :global(.damage-roll .result) {
		gap: 0.35em;
		margin-block: 0;
	}

	.damage-step-card :global(.damage-roll .result > div) {
		padding: 0.55em 0.7em;
	}

	.damage-step-card :global(.damage-roll .critical-rule),
	.damage-step-card :global(.damage-roll .critical-immunity-note) {
		margin-block: 0;
	}

	.damage-step-card :global(.compact-damage-roll) {
		gap: 0.4em;
	}

	.sequence-total {
		font-size: var(--font-sz-mars);
	}
</style>