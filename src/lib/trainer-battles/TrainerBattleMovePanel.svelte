<script lang="ts">
	import { createEventDispatcher } from "svelte"
	import { Button } from "$lib/ui/elements"
	import MoveDescription from "$lib/moves/MoveDescription.svelte"
	import { MoveRange } from "$lib/moves/range"
	import { MoveTime } from "$lib/moves/time"
	import type { Move } from "$lib/moves/Move"
	import type { MoveStats } from "$lib/moves/MoveStats"
	import { TrainerBattleProvider } from "./provider"
	import { battleMoveRangeFeet, calculateBattleMoveStats, resolveBattleMove } from "./battle-moves"
	import type {
		BattleMoveSnapshot,
		BattlePokemonSnapshot,
		PublicOpponentPokemon,
		TrainerBattleMoveResult,
		TrainerBattlePlayerView,
		TrainerBattleSide,
	} from "./types"

	type LoadedMove = {
		snapshot: BattleMoveSnapshot,
		move?: Move,
		stats?: MoveStats,
		error?: string,
	}

	type TargetOption = {
		id: string,
		label: string,
		side: TrainerBattleSide,
	}

	export let playerView: TrainerBattlePlayerView
	export let pokemon: BattlePokemonSnapshot

	const dispatch = createEventDispatcher<{ changed: void }>()
	let loadedPokemonId = ""
	let loadedMoves: LoadedMove[] = []
	let loading = false
	let busy = false
	let errorMessage = ""
	let selectedTargetId = ""
	let applyActionId = ""
	let applyAmount = 0

	$: if (pokemon.id !== loadedPokemonId) {
		loadedPokemonId = pokemon.id
		void loadMoves(pokemon.id)
	}

	$: opponentTargets = (playerView.opponentBattle?.pokemon ?? [])
		.filter((target) => target.activeSlot != null && !target.fainted && target.position != null)
		.map((target) => ({
			id: target.id,
			label: publicPokemonLabel(target),
			side: otherSide(playerView.viewerSide),
		}))
	$: allyTargets = playerView.self.pokemon
		.filter((target) => target.activeSlot != null && !target.fainted && target.position != null)
		.map((target) => ({
			id: target.id,
			label: pokemonLabel(target),
			side: playerView.viewerSide,
		}))
	$: targetOptions = [...opponentTargets, ...allyTargets]
	$: if (selectedTargetId && !targetOptions.some((target) => target.id === selectedTargetId)) selectedTargetId = ""
	$: if (!selectedTargetId && opponentTargets.length > 0) selectedTargetId = opponentTargets[0].id

	$: battleState = playerView.battleState
	$: lastAction = battleState?.lastAction ?? null
	$: if ((lastAction?.id ?? "") !== applyActionId) {
		applyActionId = lastAction?.id ?? ""
		applyAmount = lastAction?.damage?.total ?? 0
	}
	$: ownUnappliedDamage = lastAction != null
		&& lastAction.side === playerView.viewerSide
		&& lastAction.pokemonId === pokemon.id
		&& lastAction.damage != null
		&& lastAction.targetPokemonId != null
		&& lastAction.appliedAmount == null
		? lastAction
		: null

	async function loadMoves(forPokemonId: string) {
		loading = true
		errorMessage = ""
		try {
			const entries = await Promise.all(pokemon.moves.map(async (snapshot): Promise<LoadedMove> => {
				try {
					const move = await resolveBattleMove(snapshot.moveId)
					if (move == null) return { snapshot, error: "Move details could not be loaded." }
					return {
						snapshot,
						move,
						stats: calculateBattleMoveStats(move, pokemon, playerView.settings.scaling),
					}
				} catch (error) {
					return { snapshot, error: error instanceof Error ? error.message : "Move details could not be loaded." }
				}
			}))
			if (loadedPokemonId === forPokemonId) loadedMoves = entries
		} finally {
			if (loadedPokemonId === forPokemonId) loading = false
		}
	}

	function pokemonLabel(target: BattlePokemonSnapshot): string {
		const species = target.pokemonId.data
		return target.nickname?.trim() ? `${target.nickname} (${species})` : species
	}

	function publicPokemonLabel(target: PublicOpponentPokemon): string {
		const species = target.pokemonId.data
		return target.nickname?.trim() ? `${target.nickname} (${species})` : species
	}

	function otherSide(side: TrainerBattleSide): TrainerBattleSide {
		return side === "a" ? "b" : "a"
	}

	function signed(value: number): string {
		return value >= 0 ? `+${value}` : `${value}`
	}

	function damageText(stats: MoveStats): string | null {
		if (stats.damage == null) return null
		return `${stats.damage.dice}${stats.damage.mod === 0 ? "" : ` ${signed(stats.damage.mod)}`}${stats.damage.isHealing ? " healing" : " damage"}`
	}

	function resourceSpent(move: Move): boolean {
		if (move.time.unit === "action") return battleState?.actionUsed ?? false
		if (move.time.unit === "bonus action") return battleState?.bonusActionUsed ?? false
		return true
	}

	function moveNeedsTarget(move: Move): boolean {
		return move.range.type !== "self" || move.shape != null
	}

	function targetForMove(move: Move): string | null {
		if (move.range.type === "self" && move.shape == null) return pokemon.id
		return selectedTargetId || null
	}

	function canUse(entry: LoadedMove): boolean {
		if (entry.move == null || entry.stats == null) return false
		if (entry.snapshot.pp.current <= 0 || busy) return false
		if (entry.move.time.unit === "reaction" || resourceSpent(entry.move)) return false
		if (moveNeedsTarget(entry.move) && targetForMove(entry.move) == null) return false
		return true
	}

	function accessKey(): string {
		const key = TrainerBattleProvider.getStoredAccessKey(playerView.id)
		if (!key) throw new Error("This browser no longer has control of this Trainer Battle slot.")
		return key
	}

	async function useMove(entry: LoadedMove) {
		if (!entry.move || !entry.stats || !canUse(entry)) return
		busy = true
		errorMessage = ""
		try {
			await TrainerBattleProvider.useMove(accessKey(), {
				pokemonId: pokemon.id,
				moveSnapshotId: entry.snapshot.id,
				moveName: entry.move.name,
				targetPokemonId: targetForMove(entry.move),
				timeUnit: entry.move.time.unit,
				attackBonus: entry.stats.toHit ?? null,
				saveDc: entry.stats.save?.dc ?? null,
				saveAttributes: entry.stats.save?.attribute ?? [],
				damageDice: entry.stats.damage?.dice ?? null,
				damageModifier: entry.stats.damage?.mod ?? 0,
				isHealing: entry.stats.damage?.isHealing ?? false,
				rangeFeet: battleMoveRangeFeet(entry.move),
			})
			dispatch("changed")
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : "Could not use that move."
		} finally {
			busy = false
		}
	}

	async function applyLastDamage(action: TrainerBattleMoveResult) {
		const amount = Number.isFinite(applyAmount) ? Math.max(0, Math.min(9999, Math.trunc(applyAmount))) : action.damage?.total ?? 0
		busy = true
		errorMessage = ""
		try {
			await TrainerBattleProvider.applyLastDamage(accessKey(), amount)
			dispatch("changed")
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : "Could not apply the rolled amount."
		} finally {
			busy = false
		}
	}
</script>

<div class="move-panel">
	<div class="sheet-header">
		<div>
			<h3>{pokemonLabel(pokemon)}</h3>
			<p>HP <strong>{pokemon.hp.current}/{pokemon.hp.max}</strong> · AC <strong>{pokemon.ac}</strong> · Movement <strong>{pokemon.movementRemainingFeet} ft</strong></p>
		</div>
		<div class="resources">
			<span class:spent={battleState?.actionUsed}>Action {battleState?.actionUsed ? "used" : "ready"}</span>
			<span class:spent={battleState?.bonusActionUsed}>Bonus Action {battleState?.bonusActionUsed ? "used" : "ready"}</span>
		</div>
	</div>

	<label class="target-select">
		<span>Selected target</span>
		<select bind:value={selectedTargetId} disabled={busy}>
			<option value="">— No target —</option>
			{#if opponentTargets.length > 0}<optgroup label="Opponent">{#each opponentTargets as target}<option value={target.id}>{target.label}</option>{/each}</optgroup>{/if}
			{#if allyTargets.length > 0}<optgroup label="Your side">{#each allyTargets as target}<option value={target.id}>{target.label}</option>{/each}</optgroup>{/if}
		</select>
	</label>

	<p class="resolution-note">Choose a target, then use a move. PP and action economy are synchronized. Attack rolls, saving throws, and damage dice are rolled by the battle server. Damage is not applied until you confirm the amount, so half-damage and other special move rules can still be handled correctly.</p>

	{#if loading}
		<p>Loading moves…</p>
	{:else}
		<div class="move-grid">
			{#each loadedMoves as entry}
				<article class="move-card">
					{#if entry.move && entry.stats}
						<div class="move-heading">
							<div><strong>{entry.move.name}</strong><span>{entry.move.type.toUpperCase()}</span></div>
							<span class:empty={entry.snapshot.pp.current <= 0}>PP {entry.snapshot.pp.current}/{entry.snapshot.pp.max}</span>
						</div>
						<p class="move-meta">{MoveTime.display(entry.move.time)} · {MoveRange.display(entry.move.range, entry.move.shape)}</p>
						<div class="roll-stats">
							{#if entry.stats.toHit != null}<span>Attack <strong>{signed(entry.stats.toHit)}</strong></span>{/if}
							{#if entry.stats.save}<span>Save <strong>DC {entry.stats.save.dc}</strong> {entry.stats.save.attribute.map((attribute) => attribute.toUpperCase()).join("/")}</span>{/if}
							{#if damageText(entry.stats)}<span><strong>{damageText(entry.stats)}</strong></span>{/if}
						</div>
						{#if entry.snapshot.notes}<p class="move-notes">{entry.snapshot.notes}</p>{/if}
						{#if entry.move.time.unit === "reaction"}
							<p class="move-warning">Reaction timing is not enabled in this battle slice yet.</p>
						{:else if resourceSpent(entry.move)}
							<p class="move-warning">Its {entry.move.time.unit} has already been used this turn.</p>
						{/if}
						{#if entry.move.shape != null}<p class="move-warning">Area moves currently resolve one selected target at a time. Apply any additional targets/effects manually.</p>{/if}
						<div class="move-actions"><Button variant="success" disabled={!canUse(entry)} on:click={() => useMove(entry)}>{busy ? "Rolling…" : `Use ${entry.move.name}`}</Button></div>
						<details><summary>Move details</summary><MoveDescription move={entry.move} /></details>
					{:else}
						<strong>{entry.snapshot.moveId}</strong>
						<p class="move-warning">{entry.error ?? "Move details could not be loaded."}</p>
					{/if}
				</article>
			{/each}
		</div>
	{/if}

	{#if ownUnappliedDamage}
		<div class="apply-card">
			<h4>{ownUnappliedDamage.damage?.isHealing ? "Apply healing" : "Apply damage"}</h4>
			<p>The server rolled <strong>{ownUnappliedDamage.damage?.total}</strong>. Change the amount below for half damage or another rule, then confirm it.</p>
			{#if ownUnappliedDamage.attack && !ownUnappliedDamage.attack.hit}<p class="move-warning">The attack roll missed. Only apply damage if the move has a rule that still deals damage.</p>{/if}
			{#if ownUnappliedDamage.save?.success}<p class="move-warning">The target succeeded on its save. Adjust the amount if the move deals half or reduced damage on a success.</p>{/if}
			<label class="apply-amount"><span>Amount to apply</span><input type="number" min="0" max="9999" step="1" bind:value={applyAmount} /></label>
			<Button variant="success" disabled={busy} on:click={() => applyLastDamage(ownUnappliedDamage)}>{busy ? "Applying…" : ownUnappliedDamage.damage?.isHealing ? "Apply Healing" : "Apply Damage"}</Button>
		</div>
	{/if}

	{#if errorMessage}<p class="panel-error" role="alert">{errorMessage}</p>{/if}
</div>

<style>
	.move-panel { margin-top: 1rem; padding: 1rem; border-radius: .75rem; background: var(--skin-input-bg); }
	.sheet-header { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; flex-wrap: wrap; }
	.sheet-header h3, .sheet-header p { margin-block: 0 .35rem; }
	.resources { display: flex; flex-wrap: wrap; gap: .4rem; }
	.resources span { padding: .35rem .55rem; border-radius: 999px; background: var(--skin-content); font-size: .9em; }
	.resources span.spent { opacity: .55; text-decoration: line-through; }
	.target-select { display: grid; gap: .35rem; max-width: 28rem; margin-block: .8rem; }
	.target-select select, .apply-amount input { font: inherit; padding: .5rem; }
	.resolution-note { font-size: .9em; font-style: italic; max-width: 58rem; }
	.move-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr)); gap: .75rem; margin-top: .85rem; }
	.move-card { padding: .85rem; border-radius: .65rem; background: var(--skin-content); }
	.move-heading { display: flex; justify-content: space-between; gap: .75rem; align-items: flex-start; }
	.move-heading > div { display: flex; gap: .5rem; align-items: baseline; flex-wrap: wrap; }
	.move-heading > div span { font-size: .75em; font-weight: 700; opacity: .7; }
	.move-heading > span { white-space: nowrap; font-size: .9em; }
	.move-heading > span.empty { color: var(--skin-danger-text); font-weight: 700; }
	.move-meta { margin-block: .35rem; font-size: .9em; }
	.roll-stats { display: flex; gap: .65rem; flex-wrap: wrap; margin-block: .55rem; }
	.roll-stats span { padding: .25rem .45rem; border-radius: .4rem; background: var(--skin-input-bg); font-size: .9em; }
	.move-notes, .move-warning { font-size: .88em; }
	.move-warning { font-style: italic; }
	.move-actions { margin-block: .65rem; }
	details { margin-top: .55rem; }
	summary { cursor: pointer; font-weight: 700; }
	.apply-card { margin-top: 1rem; padding: .85rem; border: 1px solid currentColor; border-radius: .65rem; }
	.apply-card h4 { margin-block: 0 .4rem; }
	.apply-amount { display: grid; grid-template-columns: 1fr 7rem; align-items: center; gap: .5rem; max-width: 22rem; margin-block: .75rem; }
	.panel-error { padding: .7rem .85rem; border: 1px solid currentColor; border-radius: .5rem; color: var(--skin-danger-text); }
</style>
