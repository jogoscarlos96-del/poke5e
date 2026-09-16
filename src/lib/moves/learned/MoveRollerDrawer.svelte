<script lang="ts">
	import { tick } from "svelte"
	import { Button } from "$lib/ui/elements"
	import type { MoveStats } from "../MoveStats"
	import MoveDamageRoll from "./MoveDamageRoll.svelte"

	export let open = false
	export let moveName: string
	export let moveType: string
	export let stats: MoveStats
	export let currentHp: number | undefined = undefined
	export let maxHp: number | undefined = undefined
	export let onapplyhealing: ((value: number) => void) | undefined = undefined

	type SaveOutcome = "failed" | "succeeded"

	let dialog: HTMLDialogElement | undefined = undefined
	let wasOpen = false
	let attackDie: number | undefined = undefined
	let attackTotal: number | undefined = undefined
	let hitConfirmed = false
	let saveOutcome: SaveOutcome | undefined = undefined
	let rollAfterSuccessfulSave = false

	$: resolution = stats.toHit != null
		? "attack"
		: stats.save != null
			? "save"
			: stats.damage != null
				? "direct"
				: "none"

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
		attackDie = undefined
		attackTotal = undefined
		hitConfirmed = false
		saveOutcome = undefined
		rollAfterSuccessfulSave = false
	}

	const close = () => {
		open = false
		if (dialog?.open) dialog.close()
	}

	const rollD20 = () => {
		if (stats.toHit == null) return
		attackDie = Math.floor(Math.random() * 20) + 1
		attackTotal = attackDie + stats.toHit
		hitConfirmed = false
	}

	const confirmHit = () => {
		hitConfirmed = true
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
				<h3>Attack Roll</h3>
				<div class="roll-formula">
					<span>d20</span>
					<strong>{signed(stats.toHit ?? 0)}</strong>
				</div>

				{#if attackDie == null || attackTotal == null}
					<Button variant="solid" width="full" on:click={rollD20}>Roll Attack</Button>
				{:else if !hitConfirmed}
					<dl class="roll-result">
						<div>
							<dt>Natural Roll</dt>
							<dd>{attackDie}</dd>
						</div>
						<div>
							<dt>Attack Modifier</dt>
							<dd>{signed(stats.toHit ?? 0)}</dd>
						</div>
						<div class="total-row">
							<dt>Total</dt>
							<dd>{attackTotal}</dd>
						</div>
					</dl>
					<p class="instruction">Compare the total against the target's AC, then choose the result.</p>
					<div class="decision-grid">
						<Button variant="subtle" width="full" on:click={confirmMiss}>Miss</Button>
						<Button variant="success" width="full" on:click={confirmHit}>Hit</Button>
					</div>
				{:else if stats.damage != null}
					<div class="confirmed"><strong>Hit confirmed.</strong></div>
					<MoveDamageRoll damage={stats.damage} onconfirm={close} />
				{:else}
					<div class="confirmed">
						<strong>Hit confirmed.</strong>
						<p>This move has no structured damage or healing roll.</p>
					</div>
					<Button variant="solid" width="full" on:click={close}>Confirm</Button>
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
	.instruction {
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
	.direct-note {
		margin-block-end: 1em;
		padding: 0.8em;
		background: var(--skin-input-bg);
		border-radius: 0.75em;
	}

	.roll-formula,
	.save-summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1em;
	}

	.roll-formula {
		font-size: var(--font-sz-neptune);
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
	}
</style>