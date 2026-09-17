<script lang="ts">
	import { tick } from "svelte"
	import { Button } from "$lib/ui/elements"
	import type { MoveStats } from "../MoveStats"
	import MoveDamageRoll from "./MoveDamageRoll.svelte"

	export let open = false
	export let moveName: string
	export let moveType: string
	export let stats: MoveStats
	export let abilityNames: string[] = []
	export let currentHp: number | undefined = undefined
	export let maxHp: number | undefined = undefined
	export let onapplyhealing: ((value: number) => void) | undefined = undefined

	type SaveOutcome = "failed" | "succeeded"
	type AttackRollMode = "advantage" | "normal" | "disadvantage"

	const CRITICAL_THRESHOLDS = Array.from({ length: 19 }, (_, index) => 20 - index)

	let dialog: HTMLDialogElement | undefined = undefined
	let wasOpen = false
	let attackRollMode: AttackRollMode = "normal"
	let transientAttackBonus = 0
	let attackRolls: number[] = []
	let attackDie: number | undefined = undefined
	let attackTotal: number | undefined = undefined
	let hitConfirmed = false
	let saveOutcome: SaveOutcome | undefined = undefined
	let rollAfterSuccessfulSave = false
	let criticalThreshold = 20
	let criticalSelected = false

	$: resolution = stats.toHit != null
		? "attack"
		: stats.save != null
			? "save"
			: stats.damage != null
				? "direct"
				: "none"
	$: normalizedAbilityNames = abilityNames.map((name) => name.trim().toLowerCase())
	$: hasSuperLuck = normalizedAbilityNames.includes("super luck")
	$: hasSniper = normalizedAbilityNames.includes("sniper")
	$: hasHustle = normalizedAbilityNames.includes("hustle")
	$: criticalDiceMultiplier = hasSniper ? 3 : 2
	$: automaticCritical = attackDie != null && attackDie >= criticalThreshold
	$: effectiveAttackModifier = (stats.toHit ?? 0) + transientAttackBonus

	$: if (open && !wasOpen) {
		wasOpen = true
		resetResolution()
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

	const resetResolution = () => {
		attackRollMode = "normal"
		transientAttackBonus = 0
		attackRolls = []
		attackDie = undefined
		attackTotal = undefined
		hitConfirmed = false
		saveOutcome = undefined
		rollAfterSuccessfulSave = false
		criticalThreshold = abilityNames.some((name) => name.trim().toLowerCase() === "super luck") ? 19 : 20
		criticalSelected = false
	}

	const close = () => {
		open = false
		if (dialog?.open) dialog.close()
	}

	const setAttackRollMode = (mode: AttackRollMode) => {
		attackRollMode = mode
		attackRolls = []
		attackDie = undefined
		attackTotal = undefined
		hitConfirmed = false
		criticalSelected = false
	}

	const changeTransientAttackBonus = (amount: number) => {
		transientAttackBonus += amount
		attackRolls = []
		attackDie = undefined
		attackTotal = undefined
		hitConfirmed = false
		criticalSelected = false
	}

	const rollD20 = () => {
		if (stats.toHit == null) return

		const firstRoll = Math.floor(Math.random() * 20) + 1
		if (attackRollMode === "normal") {
			attackRolls = [firstRoll]
			attackDie = firstRoll
		} else {
			const secondRoll = Math.floor(Math.random() * 20) + 1
			attackRolls = [firstRoll, secondRoll]
			attackDie = attackRollMode === "advantage"
				? Math.max(firstRoll, secondRoll)
				: Math.min(firstRoll, secondRoll)
		}

		attackTotal = (attackDie ?? 0) + effectiveAttackModifier
		hitConfirmed = false
		criticalSelected = false
	}

	const confirmHit = () => {
		hitConfirmed = true
		criticalSelected = automaticCritical
	}

	const confirmMiss = () => {
		close()
	}

	const selectSaveOutcome = (outcome: SaveOutcome) => {
		saveOutcome = outcome
		rollAfterSuccessfulSave = false
	}

	const applyDirectHealing = (value: number) => {
		onapplyhealing?.(value)
		close()
	}

	const onCancel = (e: Event) => {
		e.preventDefault()
		close()
	}

	const signed = (value: number) => value >= 0 ? `+${value}` : `${value}`
	const saveAttribute = () => stats.save?.attribute.map((it) => it.toUpperCase()).join("/") ?? "—"
</script>

{#if open}
	<dialog
		bind:this={dialog}
		class="drawer"
		aria-labelledby="move-roller-title"
		on:close={() => {
			open = false
			wasOpen = false
		}}
		on:cancel={onCancel}
	>
		<header>
			<div class="header-row">
				<h2 id="move-roller-title" class="drawer-title">Move Roller</h2>
				<Button variant="ghost" on:click={close}>Close</Button>
			</div>
			<div class="move-heading" style:--type-bg="var(--skin-{moveType}-bg)">
				<strong>{moveName}</strong>
				<span>{moveType}</span>
			</div>
			<p class="spent-note">PP has already been spent for this move.</p>
		</header>

		{#if resolution === "attack"}
			<section>
				{#if !hitConfirmed}
					<h3>Attack Roll</h3>
					<div class="roll-formula">
						<span>d20</span>
						<strong>{signed(effectiveAttackModifier)}</strong>
					</div>
					<div class="attack-mode-control">
						<span class="control-label">Roll Mode</span>
						<div class="attack-mode-grid">
							<Button variant={attackRollMode === "advantage" ? "solid" : "subtle"} width="full" on:click={() => setAttackRollMode("advantage")}>Advantage</Button>
							<Button variant={attackRollMode === "normal" ? "solid" : "subtle"} width="full" on:click={() => setAttackRollMode("normal")}>Normal</Button>
							<Button variant={attackRollMode === "disadvantage" ? "solid" : "subtle"} width="full" on:click={() => setAttackRollMode("disadvantage")}>Disadvantage</Button>
						</div>
					</div>

					<div class="temporary-bonus-control">
						<div>
							<strong>Temporary Attack Bonus</strong>
							<span>Current {signed(transientAttackBonus)}</span>
						</div>
						<div class="bonus-stepper">
							<Button variant="subtle" on:click={() => changeTransientAttackBonus(-1)}>−</Button>
							<strong>{signed(transientAttackBonus)}</strong>
							<Button variant="subtle" on:click={() => changeTransientAttackBonus(1)}>+</Button>
						</div>
					</div>

					<div class="critical-range">
						<label for="move-roller-critical-range">Critical Range</label>
						<select id="move-roller-critical-range" bind:value={criticalThreshold}>
							{#each CRITICAL_THRESHOLDS as threshold}
								<option value={threshold}>{threshold}+</option>
							{/each}
						</select>
					</div>
					{#if hasSuperLuck}
						<p class="ability-note">Super Luck sets the default critical range to 19+.</p>
					{/if}

					{#if attackDie == null || attackTotal == null}
						<Button variant="solid" width="full" on:click={rollD20}>Roll Attack</Button>
					{:else}
						<dl class="roll-result">
							{#if attackRolls.length > 1}
								<div>
									<dt>{attackRollMode === "advantage" ? "Advantage Rolls" : "Disadvantage Rolls"}</dt>
									<dd>{attackRolls.join(", ")}</dd>
								</div>
							{/if}
							<div>
								<dt>Natural Roll</dt>
								<dd>{attackDie}</dd>
							</div>
							<div>
								<dt>Attack Modifier</dt>
								<dd>{signed(stats.toHit ?? 0)}</dd>
							</div>
							{#if transientAttackBonus !== 0}
								<div>
									<dt>Temporary Bonus</dt>
									<dd>{signed(transientAttackBonus)}</dd>
								</div>
							{/if}
							<div class="total-row">
								<dt>Total</dt>
								<dd>{attackTotal}</dd>
							</div>
						</dl>
						{#if automaticCritical}
							<div class="critical-detected">
								<strong>Critical detected</strong>
								<span>{criticalThreshold}+</span>
							</div>
						{/if}
						<p class="instruction">Compare the total against the target's AC, then choose the result.</p>
						<div class="decision-grid">
							<Button variant="subtle" width="full" on:click={confirmMiss}>Miss</Button>
							<Button variant="success" width="full" on:click={confirmHit}>Hit</Button>
						</div>
					{/if}
				{:else}
					<div class="attack-summary" class:critical-summary={automaticCritical}>
						<strong>{automaticCritical ? "Critical Hit" : "Attack — Hit"}</strong>
						<span>Natural {attackDie} · Total {attackTotal}</span>
					</div>

					{#if stats.damage != null}
						{#if !stats.damage.isHealing}
							<div class="critical-control">
								<div class="critical-control-heading">
									<strong>Critical Hit?</strong>
									<span>{criticalThreshold}+ range</span>
								</div>
								<div class="decision-grid critical-toggle">
									<div class="critical-toggle-option">
										<Button variant={criticalSelected ? "subtle" : "solid"} width="full" on:click={() => criticalSelected = false}>Normal</Button>
									</div>
									<div class="critical-toggle-option critical-toggle-special" class:active={criticalSelected} style:--critical-type-bg="var(--skin-{moveType}-bg)">
										<Button variant="subtle" width="full" on:click={() => criticalSelected = true}>Critical</Button>
									</div>
								</div>
								{#if criticalSelected && hasSniper}
									<p class="ability-note"><strong>Sniper:</strong> critical damage uses three times the normal damage dice.</p>
								{/if}
								{#if criticalSelected && hasHustle}
									<p class="ability-note"><strong>Hustle:</strong> resolve its critical-hit additional-action effect.</p>
								{/if}
							</div>
						{/if}
						{#key criticalSelected}
							<MoveDamageRoll
								damage={stats.damage}
								critical={criticalSelected && !stats.damage.isHealing}
								{criticalDiceMultiplier}
								{moveType}
								onconfirm={close}
							/>
						{/key}
					{:else}
						<div class="confirmed">
							<strong>Hit confirmed.</strong>
							<p>This move has no structured damage or healing roll.</p>
						</div>
						<Button variant="solid" width="full" on:click={close}>Confirm</Button>
					{/if}
				{/if}
			</section>
		{:else if resolution === "save"}
			<section>
				<h3>Saving Throw</h3>
				<div class="save-summary">
					<span>{saveAttribute()} Save</span>
					<strong>DC {stats.save?.dc}</strong>
				</div>

				{#if saveOutcome == null}
					<p class="instruction">The target resolves this saving throw, then choose the result.</p>
					<div class="decision-grid">
						<Button variant="subtle" width="full" on:click={() => selectSaveOutcome("succeeded")}>Save Succeeded</Button>
						<Button variant="success" width="full" on:click={() => selectSaveOutcome("failed")}>Save Failed</Button>
					</div>
				{:else if saveOutcome === "failed" && stats.damage != null}
					<div class="confirmed"><strong>Save failed.</strong></div>
					<MoveDamageRoll damage={stats.damage} onconfirm={close} />
				{:else if saveOutcome === "failed"}
					<div class="confirmed">
						<strong>Save failed.</strong>
						<p>This move has no structured damage or healing roll.</p>
					</div>
					<Button variant="solid" width="full" on:click={close}>Confirm</Button>
				{:else if rollAfterSuccessfulSave && stats.damage != null}
					<div class="confirmed"><strong>Save succeeded.</strong></div>
					<MoveDamageRoll damage={stats.damage} onconfirm={close} />
				{:else}
					<div class="confirmed">
						<strong>Save succeeded.</strong>
						<p>Resolve any successful-save effects from the move description.</p>
					</div>
					{#if stats.damage != null}
						<p class="instruction">If this move still deals damage or healing on a successful save, you can roll its normal expression.</p>
						<div class="decision-grid">
							<Button variant="subtle" width="full" on:click={close}>Confirm</Button>
							<Button variant="solid" width="full" on:click={() => rollAfterSuccessfulSave = true}>Roll Anyway</Button>
						</div>
					{:else}
						<Button variant="solid" width="full" on:click={close}>Confirm</Button>
					{/if}
				{/if}
			</section>
		{:else if resolution === "direct" && stats.damage != null}
			<section>
				<div class="direct-note">No attack or save roll is required.</div>
				<MoveDamageRoll
					damage={stats.damage}
					onconfirm={close}
					currentHp={stats.damage.isHealing ? currentHp : undefined}
					maxHp={stats.damage.isHealing ? maxHp : undefined}
					onapplyhealing={stats.damage.isHealing && onapplyhealing != null ? applyDirectHealing : undefined}
				/>
			</section>
		{:else}
			<section>
				<h3>No Roll Required</h3>
				<p class="instruction">This move has no structured attack roll, saving throw, damage roll, or healing roll.</p>
				<Button variant="solid" width="full" on:click={close}>Confirm</Button>
			</section>
		{/if}
	</dialog>
{/if}

<style>
	.drawer {
		position: fixed;
		inset: 50% 1rem auto auto;
		transform: translateY(-50%);
		margin: 0;
		width: min(20rem, calc(100vw - 2rem));
		height: fit-content;
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
		margin-block-end: 0.75em;
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

	.move-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1em;
		padding: 0.7em 0.85em;
		background: var(--type-bg);
		color: var(--skin-bg-text);
		border-radius: 0.75em;
	}

	.move-heading span {
		text-transform: capitalize;
		font-size: var(--font-sz-venus);
	}

	.spent-note,
	.instruction,
	.ability-note {
		font-size: var(--font-sz-venus);
	}

	.spent-note {
		margin: 0.5em 0 0;
	}

	h3 {
		margin-block: 0 0.65em;
		font-size: var(--font-sz-mars);
	}

	.roll-formula,
	.save-summary,
	.confirmed,
	.direct-note,
	.critical-range,
	.critical-detected,
	.critical-control,
	.attack-mode-control,
	.temporary-bonus-control,
	.attack-summary {
		margin-block-end: 1em;
		padding: 0.8em;
		background: var(--skin-input-bg);
		border-radius: 0.75em;
	}

	.roll-formula,
	.save-summary,
	.critical-range,
	.critical-detected,
	.critical-control-heading,
	.temporary-bonus-control {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1em;
	}

	.roll-formula {
		font-size: var(--font-sz-neptune);
	}

	.control-label,
	.critical-range label,
	.critical-detected strong,
	.critical-control-heading strong,
	.temporary-bonus-control strong {
		font-weight: bold;
	}

	.attack-mode-control {
		display: grid;
		gap: 0.55em;
	}

	.attack-mode-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.25em;
		min-width: 0;
	}

	.attack-mode-grid :global(.button) {
		min-width: 0;
		padding-inline: 0.25em;
		font-size: 0.78rem;
		line-height: 1.15;
		white-space: nowrap;
	}

	.attack-mode-grid :global(.button:hover::before),
	.attack-mode-grid :global(.button:focus::before),
	.attack-mode-grid :global(.button:active::before) {
		content: none;
		display: none;
	}

	.temporary-bonus-control {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.5em;
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

	.temporary-bonus-control > div:first-child span {
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

	.attack-summary {
		display: grid;
		gap: 0.15em;
		margin-block-end: 0.75em;
	}

	.attack-summary strong {
		white-space: nowrap;
		font-size: 0.95rem;
		line-height: 1.15;
	}

	.attack-summary span {
		font-size: 0.8rem;
		line-height: 1.2;
		white-space: nowrap;
	}

	.attack-summary.critical-summary {
		background: var(--skin-bg-dark);
		color: var(--skin-bg-text);
	}

	.critical-range select {
		min-width: 4.5em;
		padding: 0.25em 0.4em;
	}

	.critical-detected {
		background: var(--skin-bg-dark);
		color: var(--skin-bg-text);
	}

	.critical-control-heading {
		margin-block-end: 0.65em;
	}

	.critical-control-heading span {
		font-size: var(--font-sz-venus);
	}

	.critical-control .ability-note:last-child {
		margin-block-end: 0;
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
		background-color: var(--critical-type-bg);
		background-image: linear-gradient(125deg, transparent 28%, rgb(255 255 255 / 0.08) 38%, rgb(255 255 255 / 0.7) 48%, rgb(255 255 255 / 0.12) 58%, transparent 68%);
		background-size: 280% 280%;
		color: var(--skin-bg-text);
		font-weight: 800;
		text-shadow: 0 1px 2px rgb(0 0 0 / 0.4);
		animation: critical-button-shimmer 6s linear infinite;
	}

	.roll-result {
		display: grid;
		gap: 0.5em;
		margin-block: 1em;
	}

	.roll-result div {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1em;
		padding: 0.7em 0.8em;
		background: var(--skin-input-bg);
		border-radius: 0.75em;
	}

	.roll-result .total-row {
		font-size: var(--font-sz-neptune);
	}

	dt {
		font-weight: bold;
	}

	dd {
		margin: 0;
		text-align: right;
	}

	.decision-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5em;
	}

	.confirmed p:last-child {
		margin-block-end: 0;
	}

	.direct-note {
		font-size: var(--font-sz-venus);
	}

	@keyframes critical-button-shimmer {
		0% { background-position: 190% 190%; }
		66.667%, 100% { background-position: -120% -120%; }
	}

	@media (prefers-reduced-motion: reduce) {
		.critical-toggle-special.active :global(.button) {
			animation: none;
			background-image: none;
		}
	}

	@media (max-width: 32rem) {
		.drawer {
			inset: 0.5rem 0.5rem auto auto;
			transform: none;
			width: min(20rem, calc(100vw - 1rem));
			max-height: calc(100vh - 1rem);
			max-height: calc(100dvh - 1rem);
			padding: 0.8em 1em 1em;
			border-radius: 0.75rem;
		}

		.attack-mode-grid :global(.button) {
			font-size: 0.74rem;
		}
	}
</style>