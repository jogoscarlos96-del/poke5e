<script lang="ts">
	import { tick } from "svelte"
	import { Button } from "$lib/ui/elements"
	import type { MoveStats } from "../MoveStats"
	import MoveDamageRoll from "./MoveDamageRoll.svelte"
	import type { AttackRollMode } from "./MultiHit"
	import {
		getSpecialSequenceCount,
		type SpecialDamageProfile,
		type SpecialMultiHitProfile,
	} from "./SpecialMultiHit"

	export let open = false
	export let moveName: string
	export let moveType: string
	export let stats: MoveStats
	export let profile: SpecialMultiHitProfile
	export let moveModifier = 0
	export let stabBonus = 0
	export let abilityNames: string[] = []

	type AttackStep = {
		attack: number,
		hit: boolean,
		natural: number,
		total: number,
		critical: boolean,
		damage?: number,
	}

	const CRITICAL_THRESHOLDS = Array.from({ length: 19 }, (_, index) => 20 - index)

	let dialog: HTMLDialogElement | undefined = undefined
	let wasOpen = false
	let attackRollMode: AttackRollMode = "normal"
	let transientAttackBonus = 0
	let criticalThreshold = 20
	let attackRolls: number[] = []
	let attackNatural: number | undefined = undefined
	let attackTotal: number | undefined = undefined
	let attackConfirmed = false
	let currentCritical = false

	let otherConsciousCarriedCreatures = 0
	let currentAttack = 1
	let attackSteps: AttackStep[] = []
	let successfulHits = 0
	let damageTotal = 0
	let hasManualDamage = false
	let sequenceEnded = false

	let projectileCount: number | undefined = undefined
	let currentProjectile = 1
	let targetCount = 1
	let barrageAttackHit = false
	let barrageCritical = false

	$: normalizedAbilities = abilityNames.map((name) => name.trim().toLowerCase())
	$: hasSuperLuck = normalizedAbilities.includes("super luck")
	$: hasSniper = normalizedAbilities.includes("sniper")
	$: hasHustle = normalizedAbilities.includes("hustle")
	$: hasParentalBond = normalizedAbilities.includes("parental bond")
	$: criticalDiceMultiplier = hasSniper ? 3 : 2
	$: effectiveAttackModifier = (stats.toHit ?? 0) + transientAttackBonus
	$: repeatedAttackCount = profile.kind === "repeated-special"
		? getSpecialSequenceCount(profile, otherConsciousCarriedCreatures)
		: 0
	$: automaticHitCount = profile.kind === "automatic-special" ? profile.totalHits : 0

	$: if (open && !wasOpen) {
		wasOpen = true
		reset()
		void showDrawer()
	}

	$: if (!open && wasOpen) {
		wasOpen = false
		if (dialog?.open) dialog.close()
	}

	const showDrawer = async () => {
		await tick()
		if (dialog != null && !dialog.open) dialog.showModal()
	}

	const resetAttackRoll = () => {
		attackRolls = []
		attackNatural = undefined
		attackTotal = undefined
		attackConfirmed = false
		currentCritical = false
	}

	const reset = () => {
		attackRollMode = "normal"
		transientAttackBonus = 0
		criticalThreshold = hasSuperLuck ? 19 : 20
		resetAttackRoll()
		otherConsciousCarriedCreatures = 0
		currentAttack = 1
		attackSteps = []
		successfulHits = 0
		damageTotal = 0
		hasManualDamage = false
		sequenceEnded = false
		projectileCount = undefined
		currentProjectile = 1
		targetCount = 1
		barrageAttackHit = false
		barrageCritical = false
	}

	const close = () => {
		open = false
		if (dialog?.open) dialog.close()
	}

	const onCancel = (e: Event) => {
		e.preventDefault()
		close()
	}

	const signed = (value: number) => value >= 0 ? `+${value}` : `${value}`

	const setAttackRollMode = (mode: AttackRollMode) => {
		attackRollMode = mode
		resetAttackRoll()
	}

	const changeTransientAttackBonus = (amount: number) => {
		transientAttackBonus += amount
		resetAttackRoll()
	}

	const rollD20 = () => {
		const first = Math.floor(Math.random() * 20) + 1
		if (attackRollMode === "normal") {
			attackRolls = [first]
			attackNatural = first
		} else {
			const second = Math.floor(Math.random() * 20) + 1
			attackRolls = [first, second]
			attackNatural = attackRollMode === "advantage" ? Math.max(first, second) : Math.min(first, second)
		}
		attackTotal = (attackNatural ?? 0) + effectiveAttackModifier
		attackConfirmed = false
		currentCritical = false
	}

	const sourceDice = (damageProfile: SpecialDamageProfile): string | undefined => {
		if (damageProfile.kind !== "dice") return undefined
		return damageProfile.source === "stats" ? stats.damage?.dice : damageProfile.dice
	}

	const damageForDiceHit = (
		damageProfile: SpecialDamageProfile,
		applyStab: boolean,
	): NonNullable<MoveStats["damage"]> | undefined => {
		if (damageProfile.kind !== "dice") return undefined
		const dice = sourceDice(damageProfile)
		if (dice == null) return undefined
		const modifier = (damageProfile.applyMoveModifier ? moveModifier : 0) + (applyStab ? stabBonus : 0)

		return {
			dice,
			mod: modifier,
			isHealing: false,
			stabApplied: applyStab && stabBonus !== 0,
			moveModifier,
		}
	}

	const recordManualOrDamage = (value?: number) => {
		if (value == null) hasManualDamage = true
		else damageTotal += value
	}

	const advanceRepeatedAttack = () => {
		if (currentAttack >= repeatedAttackCount) {
			sequenceEnded = true
			return
		}
		currentAttack += 1
		resetAttackRoll()
	}

	const confirmRepeatedMiss = () => {
		if (attackNatural == null || attackTotal == null) return
		attackSteps = [...attackSteps, {
			attack: currentAttack,
			hit: false,
			natural: attackNatural,
			total: attackTotal,
			critical: false,
		}]
		advanceRepeatedAttack()
	}

	const confirmRepeatedHit = () => {
		if (profile.kind !== "repeated-special" || attackNatural == null || attackTotal == null) return
		const critical = attackNatural >= criticalThreshold
		currentCritical = critical
		attackConfirmed = true

		if (profile.damage.kind === "flat") {
			const applyStab = successfulHits === 0 && stabBonus !== 0
			const value = profile.damage.base
				+ (profile.damage.applyMoveModifier ? moveModifier : 0)
				+ (applyStab ? stabBonus : 0)
			attackSteps = [...attackSteps, {
				attack: currentAttack,
				hit: true,
				natural: attackNatural,
				total: attackTotal,
				critical,
				damage: value,
			}]
			successfulHits += 1
			damageTotal += value
			advanceRepeatedAttack()
		}
	}

	const confirmRepeatedDamage = (value?: number) => {
		if (attackNatural == null || attackTotal == null) return
		recordManualOrDamage(value)
		attackSteps = [...attackSteps, {
			attack: currentAttack,
			hit: true,
			natural: attackNatural,
			total: attackTotal,
			critical: currentCritical,
			damage: value,
		}]
		successfulHits += 1
		advanceRepeatedAttack()
	}

	const confirmBarrageMiss = () => {
		sequenceEnded = true
		barrageAttackHit = false
	}

	const confirmBarrageHit = () => {
		if (attackNatural == null) return
		barrageAttackHit = true
		barrageCritical = attackNatural >= criticalThreshold
	}

	const rollBarrageCount = () => {
		projectileCount = Math.floor(Math.random() * 4) + 1
		currentProjectile = 1
	}

	const confirmProjectileDamage = (value?: number) => {
		recordManualOrDamage(value)
		if (projectileCount != null) {
			if (currentProjectile >= projectileCount) {
				sequenceEnded = true
			} else {
				currentProjectile += 1
			}
			return
		}

		if (profile.kind === "automatic-special") {
			if (currentProjectile >= profile.totalHits) {
				sequenceEnded = true
			} else {
				currentProjectile += 1
			}
		}
	}

	const barrageDamage = () => profile.kind === "barrage"
		? damageForDiceHit(profile.damage, currentProjectile === 1)
		: undefined

	const repeatedDamage = () => profile.kind === "repeated-special"
		? damageForDiceHit(profile.damage, successfulHits === 0)
		: undefined

	const automaticDamage = () => {
		if (profile.kind !== "automatic-special") return undefined
		const stabApplications = profile.canSplitTargets ? targetCount : 1
		return damageForDiceHit(profile.damage, currentProjectile <= stabApplications)
	}
</script>

{#snippet AttackControls({
	attackRollMode,
	criticalThreshold,
	transientAttackBonus,
	attackRolls,
	attackNatural,
	attackTotal,
	hasSuperLuck,
	onmode,
	onbonus,
	oncritical,
	onroll,
	onmiss,
	onhit,
}: {
	attackRollMode: AttackRollMode,
	criticalThreshold: number,
	transientAttackBonus: number,
	attackRolls: number[],
	attackNatural: number | undefined,
	attackTotal: number | undefined,
	hasSuperLuck: boolean,
	onmode: (mode: AttackRollMode) => void,
	onbonus: (amount: number) => void,
	oncritical: (value: number) => void,
	onroll: () => void,
	onmiss: () => void,
	onhit: () => void,
})}
	<div class="attack-mode-grid">
		<Button variant={attackRollMode === "advantage" ? "solid" : "subtle"} width="full" on:click={() => onmode("advantage")}>Advantage</Button>
		<Button variant={attackRollMode === "normal" ? "solid" : "subtle"} width="full" on:click={() => onmode("normal")}>Normal</Button>
		<Button variant={attackRollMode === "disadvantage" ? "solid" : "subtle"} width="full" on:click={() => onmode("disadvantage")}>Disadvantage</Button>
	</div>
	<div class="bonus-row">
		<span>Temporary Attack Bonus</span>
		<div>
			<Button variant="subtle" on:click={() => onbonus(-1)}>−</Button>
			<strong>{transientAttackBonus >= 0 ? `+${transientAttackBonus}` : transientAttackBonus}</strong>
			<Button variant="subtle" on:click={() => onbonus(1)}>+</Button>
		</div>
	</div>
	<div class="critical-row">
		<label for="special-critical-range">Critical Range</label>
		<select id="special-critical-range" value={criticalThreshold} on:change={(e) => oncritical(Number((e.currentTarget as HTMLSelectElement).value))}>
			{#each CRITICAL_THRESHOLDS as threshold}
				<option value={threshold}>{threshold}+</option>
			{/each}
		</select>
	</div>
	{#if hasSuperLuck}<p class="ability-note">Super Luck sets the default critical range to 19+.</p>{/if}

	{#if attackNatural == null || attackTotal == null}
		<Button variant="solid" width="full" on:click={onroll}>Roll Attack</Button>
	{:else}
		<div class="roll-result">
			{#if attackRolls.length > 1}<span>Rolls {attackRolls.join(", ")}</span>{/if}
			<span>Natural {attackNatural}</span>
			<strong>Total {attackTotal}</strong>
		</div>
		<div class="decision-grid">
			<Button variant="subtle" width="full" on:click={onmiss}>Miss</Button>
			<Button variant="success" width="full" on:click={onhit}>Hit</Button>
		</div>
	{/if}
{/snippet}

{#if open}
	<dialog
		bind:this={dialog}
		class="drawer"
		aria-labelledby="special-move-roller-title"
		on:close={() => {
			open = false
			wasOpen = false
		}}
		on:cancel={onCancel}
	>
		<header>
			<div class="header-row">
				<h2 id="special-move-roller-title" class="drawer-title">Move Roller</h2>
				<Button variant="ghost" on:click={close}>Close</Button>
			</div>
			<div class="move-heading" style:--type-bg="var(--skin-{moveType}-bg)">
				<strong>{moveName}</strong>
				<span>{moveType}</span>
			</div>
			<p class="spent-note">PP has already been spent for this move.</p>
		</header>

		<div class="special-rule">
			<strong>Special Multi-Hit</strong>
			<span>{profile.note}</span>
		</div>

		{#if hasParentalBond}
			<p class="ability-note"><strong>Parental Bond:</strong> its bonus-action second execution is separate from this sequence.</p>
		{/if}

		{#if sequenceEnded}
			<div class="sequence-total">
				<span>{hasManualDamage ? "Tracked Damage" : "Total Damage"}</span>
				<strong>{damageTotal}</strong>
			</div>
			{#if hasManualDamage}
				<p class="ability-note">Any manually resolved damage is not included in the tracked total.</p>
			{/if}
			{#if hasHustle && attackSteps.some((step) => step.critical)}
				<p class="ability-note"><strong>Hustle:</strong> at least one attack was a critical hit; resolve its additional-action effect.</p>
			{/if}
			<Button variant="success" width="full" on:click={close}>Confirm Total</Button>

		{:else if profile.kind === "barrage"}
			{#if stats.toHit == null}
				<div class="error-card">Barrage needs a structured attack modifier to automate safely.</div>
				<Button variant="solid" width="full" on:click={close}>Resolve Manually</Button>
			{:else if !barrageAttackHit}
				<div class="attack-heading">
					<strong>Attack Roll</strong>
					<span>{attackRollMode === "advantage" ? "Advantage" : attackRollMode === "disadvantage" ? "Disadvantage" : "Normal"} · {signed(effectiveAttackModifier)}</span>
				</div>
				{@render AttackControls({
					attackRollMode,
					criticalThreshold,
					transientAttackBonus,
					attackRolls,
					attackNatural,
					attackTotal,
					hasSuperLuck,
					onmode: setAttackRollMode,
					onbonus: changeTransientAttackBonus,
					oncritical: (value) => criticalThreshold = value,
					onroll: rollD20,
					onmiss: confirmBarrageMiss,
					onhit: confirmBarrageHit,
				})}
			{:else if projectileCount == null}
				<div class="attack-heading">
					<strong>Attack Hit{barrageCritical ? " — Critical" : ""}</strong>
					<span>Natural {attackNatural} · Total {attackTotal}</span>
				</div>
				<p class="instruction">Roll 1d4 to determine how many projectiles strike.</p>
				<Button variant="solid" width="full" on:click={rollBarrageCount}>Roll Projectile Count</Button>
			{:else}
				<div class="sequence-heading">
					<strong>Projectile {currentProjectile} of {projectileCount}</strong>
					<span>{barrageCritical ? `${criticalDiceMultiplier}× critical dice` : "Normal damage"}</span>
				</div>
				{#if barrageDamage() != null}
					<MoveDamageRoll
						damage={barrageDamage()!}
						critical={barrageCritical}
						{criticalDiceMultiplier}
						{moveType}
						onconfirm={confirmProjectileDamage}
					/>
				{:else}
					<div class="error-card">The move's level-scaled projectile damage is not available as structured data.</div>
					<Button variant="solid" width="full" on:click={() => confirmProjectileDamage(undefined)}>Mark Damage Manual</Button>
				{/if}
			{/if}

		{:else if profile.kind === "repeated-special"}
			{#if profile.count.kind === "party" && attackSteps.length === 0 && currentAttack === 1 && attackNatural == null}
				<div class="party-count">
					<label for="beat-up-other-conscious"><strong>Other conscious carried creatures</strong></label>
					<input id="beat-up-other-conscious" type="number" min="0" bind:value={otherConsciousCarriedCreatures} />
					<span>Total attacks: {repeatedAttackCount}</span>
				</div>
			{/if}

			{#if attackSteps.length > 0}
				<div class="history">
					{#each attackSteps as step}
						<div class:miss={!step.hit}>
							<strong>Attack {step.attack} — {step.hit ? "Hit" : "Miss"}</strong>
							<span>Natural {step.natural} · Total {step.total}{step.hit ? ` · Damage ${step.damage ?? "manual"}` : ""}</span>
						</div>
					{/each}
				</div>
			{/if}

			{#if stats.toHit == null}
				<div class="error-card">This sequence needs a structured attack modifier to automate safely.</div>
				<Button variant="solid" width="full" on:click={close}>Resolve Manually</Button>
			{:else if !attackConfirmed}
				<div class="attack-heading">
					<strong>Attack {currentAttack} of {repeatedAttackCount}</strong>
					<span>{attackRollMode === "advantage" ? "Advantage" : attackRollMode === "disadvantage" ? "Disadvantage" : "Normal"} · {signed(effectiveAttackModifier)}</span>
				</div>
				{@render AttackControls({
					attackRollMode,
					criticalThreshold,
					transientAttackBonus,
					attackRolls,
					attackNatural,
					attackTotal,
					hasSuperLuck,
					onmode: setAttackRollMode,
					onbonus: changeTransientAttackBonus,
					oncritical: (value) => criticalThreshold = value,
					onroll: rollD20,
					onmiss: confirmRepeatedMiss,
					onhit: confirmRepeatedHit,
				})}
			{:else if profile.damage.kind === "dice"}
				<div class="attack-heading">
					<strong>Attack {currentAttack} — {currentCritical ? "Critical Hit" : "Hit"}</strong>
					<span>Natural {attackNatural} · Total {attackTotal}</span>
				</div>
				{#if repeatedDamage() != null}
					<MoveDamageRoll
						damage={repeatedDamage()!}
						critical={currentCritical}
						{criticalDiceMultiplier}
						{moveType}
						onconfirm={confirmRepeatedDamage}
					/>
				{:else}
					<div class="error-card">The hit's damage expression is not available as structured data.</div>
					<Button variant="solid" width="full" on:click={() => confirmRepeatedDamage(undefined)}>Mark Damage Manual</Button>
				{/if}
			{/if}

		{:else if profile.kind === "automatic-special"}
			{#if profile.canSplitTargets}
				<div class="target-count">
					<label for="special-target-count"><strong>Targets receiving projectiles</strong></label>
					<select id="special-target-count" bind:value={targetCount}>
						{#each Array.from({ length: automaticHitCount }, (_, index) => index + 1) as count}
							<option value={count}>{count}</option>
						{/each}
					</select>
					<span>STAB is applied once per target.</span>
				</div>
			{/if}

			<div class="sequence-heading">
				<strong>Guaranteed Hit {currentProjectile} of {automaticHitCount}</strong>
				<span>No attack roll required</span>
			</div>
			{#if automaticDamage() != null}
				<MoveDamageRoll
					damage={automaticDamage()!}
					critical={false}
					{moveType}
					onconfirm={confirmProjectileDamage}
				/>
			{:else}
				<div class="error-card">The hit's damage expression is not available as structured data.</div>
				<Button variant="solid" width="full" on:click={() => confirmProjectileDamage(undefined)}>Mark Damage Manual</Button>
			{/if}
		{/if}
	</dialog>
{/if}

<style>
	.drawer {
		position: fixed;
		inset: 50% 1rem auto auto;
		transform: translateY(-50%);
		margin: 0;
		width: min(21rem, calc(100vw - 2rem));
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

	.drawer::backdrop { background: rgb(0 0 0 / 0.35); }
	header { margin-block-end: 1em; }
	.header-row { display: flex; align-items: center; justify-content: space-between; gap: 1em; margin-block-end: 0.75em; }
	.drawer-title { margin: 0; padding: 0.2em 0.65em; background: var(--skin-bg-dark); color: var(--skin-bg-text); border-radius: 0.35em; }
	.move-heading { display: flex; align-items: center; justify-content: space-between; gap: 1em; padding: 0.7em 0.85em; background: var(--type-bg); color: var(--skin-bg-text); border-radius: 0.75em; }
	.move-heading span { text-transform: capitalize; font-size: var(--font-sz-venus); }
	.spent-note, .ability-note, .instruction { font-size: var(--font-sz-venus); }
	.spent-note { margin: 0.5em 0 0; }

	.special-rule,
	.attack-heading,
	.sequence-heading,
	.sequence-total,
	.party-count,
	.target-count,
	.roll-result,
	.bonus-row,
	.critical-row,
	.error-card {
		margin-block-end: 0.75em;
		padding: 0.7em 0.8em;
		background: var(--skin-input-bg);
		border-radius: 0.75em;
	}

	.special-rule { display: grid; gap: 0.25em; }
	.special-rule span, .party-count span, .target-count span { font-size: 0.78rem; line-height: 1.3; }
	.attack-heading, .sequence-heading, .sequence-total, .bonus-row, .critical-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75em;
	}
	.attack-heading span, .sequence-heading span { font-size: 0.78rem; }
	.sequence-total strong { font-size: var(--font-sz-neptune); }

	.attack-mode-grid, .decision-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.4em;
		margin-block-end: 0.65em;
	}
	.attack-mode-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
	.attack-mode-grid :global(.button) { min-width: 0; padding-inline: 0.2em; font-size: 0.76rem; }

	.bonus-row > div { display: flex; align-items: center; gap: 0.2em; }
	.bonus-row :global(.button) { min-width: 1.8em; padding-inline: 0.35em; }

	.critical-row select,
	.party-count input,
	.target-count select {
		box-sizing: border-box;
		min-width: 4.5em;
		padding: 0.3em 0.4em;
		border: 1px solid var(--skin-border, currentColor);
		border-radius: 0.4em;
		background: var(--skin-content);
		color: var(--skin-content-text);
		font: inherit;
	}

	.party-count, .target-count { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 0.35em 0.75em; }
	.party-count span, .target-count span { grid-column: 1 / -1; }

	.roll-result { display: grid; grid-template-columns: 1fr auto; gap: 0.25em 0.75em; }
	.roll-result span:first-child:last-of-type { grid-column: 1; }
	.roll-result strong { text-align: right; }

	.history { display: grid; gap: 0.35em; margin-block-end: 0.75em; }
	.history > div { display: grid; gap: 0.1em; padding: 0.55em 0.7em; background: var(--skin-input-bg); border-radius: 0.65em; }
	.history > div.miss { opacity: 0.7; }
	.history span { font-size: 0.76rem; }

	.error-card { border: 1px solid currentColor; font-size: 0.82rem; }

	@media (max-width: 32rem) {
		.drawer {
			inset: 0.5rem 0.5rem auto auto;
			transform: none;
			width: min(21rem, calc(100vw - 1rem));
			max-height: calc(100dvh - 1rem);
			padding: 0.8em 1em 1em;
			border-radius: 0.75rem;
		}
	}
</style>
