<script lang="ts">
	import { createEventDispatcher } from "svelte"
	import { Button } from "$lib/ui/elements"
	import { TrainerBattleProvider } from "./provider"
	import TrainerBattleBoard from "./TrainerBattleBoard.svelte"
	import type {
		BattlePokemonSnapshot,
		PublicOpponentPokemon,
		TrainerBattlePlayerView,
		TrainerBattleSpectatorView,
		TrainerBattleTurnEntry,
	} from "./types"

	export let playerView: TrainerBattlePlayerView | null = null
	export let spectatorView: TrainerBattleSpectatorView | null = null

	const dispatch = createEventDispatcher<{ changed: void }>()
	let selectedActiveIds: string[] = []
	let alertSelections: Record<string, boolean> = {}
	let otherModifiers: Record<string, number> = {}
	let busy = false
	let errorMessage = ""

	$: activeRequired = playerView?.settings.format === "doubles" ? 2 : 1
	$: selfActiveIds = playerView?.self.pokemon
		.filter((pokemon) => pokemon.activeSlot != null)
		.sort((a, b) => (a.activeSlot ?? 0) - (b.activeSlot ?? 0))
		.map((pokemon) => pokemon.id) ?? []
	$: if (playerView?.self.ready && selfActiveIds.length > 0) selectedActiveIds = selfActiveIds

	$: playerUnits = playerView?.status === "active"
		? [
			...playerView.self.pokemon.filter(hasPosition).map((pokemon) => ({
				id: pokemon.id,
				label: pokemonLabel(pokemon),
				side: playerView!.viewerSide,
				position: pokemon.position!,
				movementRemainingFeet: pokemon.movementRemainingFeet,
				avatarHref: pokemon.avatar?.href,
				owned: true,
			})),
			...(playerView.opponentBattle?.pokemon ?? []).filter(hasPublicPosition).map((pokemon) => ({
				id: pokemon.id,
				label: publicPokemonLabel(pokemon),
				side: playerView!.viewerSide === "a" ? "b" as const : "a" as const,
				position: pokemon.position!,
				movementRemainingFeet: 0,
				avatarHref: pokemon.avatar?.href,
				owned: false,
			})),
		]
		: []

	$: spectatorUnits = spectatorView?.status === "active"
		? (["a", "b"] as const).flatMap((side) => (spectatorView?.participants[side]?.pokemon ?? [])
			.filter(hasPosition)
			.map((pokemon) => ({
				id: pokemon.id,
				label: pokemonLabel(pokemon),
				side,
				position: pokemon.position!,
				movementRemainingFeet: pokemon.movementRemainingFeet,
				avatarHref: pokemon.avatar?.href,
				owned: false,
			})))
		: []

	$: battleState = playerView?.battleState ?? spectatorView?.battleState ?? null
	$: battlePhase = battleState?.phase ?? "turns"
	$: initiativeRolls = battleState?.initiativeRolls ?? []
	$: allUnits = playerView ? playerUnits : spectatorUnits
	$: currentUnit = battleState?.turnPokemonId == null ? undefined : allUnits.find((unit) => unit.id === battleState?.turnPokemonId)
	$: isMyTurn = playerView != null && battlePhase === "turns" && battleState?.turnSide === playerView.viewerSide
	$: myTurnPokemon = playerView?.self.pokemon.find((pokemon) => pokemon.id === battleState?.turnPokemonId)
	$: myActivePokemon = playerView?.self.pokemon.filter((pokemon) => pokemon.activeSlot != null && !pokemon.fainted) ?? []

	function hasPosition(pokemon: BattlePokemonSnapshot): pokemon is BattlePokemonSnapshot & { position: NonNullable<BattlePokemonSnapshot["position"]> } {
		return pokemon.activeSlot != null && pokemon.position != null && !pokemon.fainted
	}

	function hasPublicPosition(pokemon: PublicOpponentPokemon): pokemon is PublicOpponentPokemon & { position: NonNullable<PublicOpponentPokemon["position"]> } {
		return pokemon.activeSlot != null && pokemon.position != null && !pokemon.fainted
	}

	function pokemonLabel(pokemon: BattlePokemonSnapshot): string {
		const species = pokemon.pokemonId.data
		return pokemon.nickname?.trim() ? `${pokemon.nickname} (${species})` : species
	}

	function publicPokemonLabel(pokemon: PublicOpponentPokemon): string {
		const species = pokemon.pokemonId.data
		return pokemon.nickname?.trim() ? `${pokemon.nickname} (${species})` : species
	}

	function unitLabel(pokemonId: string): string {
		return allUnits.find((unit) => unit.id === pokemonId)?.label ?? "Pokémon"
	}

	function toggleActive(id: string) {
		if (playerView?.self.ready) return
		if (selectedActiveIds.includes(id)) {
			selectedActiveIds = selectedActiveIds.filter((pokemonId) => pokemonId !== id)
			return
		}
		if (selectedActiveIds.length >= activeRequired) return
		selectedActiveIds = [...selectedActiveIds, id]
	}

	function dexModifier(pokemon: BattlePokemonSnapshot): number {
		return Math.floor((pokemon.attributes.data.dex ?? 10) / 2) - 5
	}

	function hasAlert(pokemon: BattlePokemonSnapshot): boolean {
		return pokemon.feats.some((feat) => feat.name.trim().toLowerCase() === "alert")
	}

	function initiativeRoll(pokemonId: string): TrainerBattleTurnEntry | undefined {
		return initiativeRolls.find((entry) => entry.pokemonId === pokemonId)
	}

	function signed(value: number): string {
		return value >= 0 ? `+${value}` : `${value}`
	}

	function setAlert(pokemonId: string, enabled: boolean) {
		alertSelections = { ...alertSelections, [pokemonId]: enabled }
	}

	function setOtherModifier(pokemonId: string, value: number) {
		const modifier = Number.isFinite(value) ? Math.max(-30, Math.min(30, Math.trunc(value))) : 0
		otherModifiers = { ...otherModifiers, [pokemonId]: modifier }
	}

	function accessKey(): string {
		if (!playerView) throw new Error("Player battle view is unavailable.")
		const key = TrainerBattleProvider.getStoredAccessKey(playerView.id)
		if (!key) throw new Error("This browser no longer has control of this Trainer Battle slot.")
		return key
	}

	async function run(action: () => Promise<void>) {
		busy = true
		errorMessage = ""
		try {
			await action()
			dispatch("changed")
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : "Trainer Battle action failed."
		} finally {
			busy = false
		}
	}

	function ready() {
		if (selectedActiveIds.length !== activeRequired) return
		void run(() => TrainerBattleProvider.setReady(accessKey(), selectedActiveIds))
	}

	function changeSelection() {
		void run(() => TrainerBattleProvider.clearReady(accessKey()))
	}

	function startBattle() {
		void run(() => TrainerBattleProvider.start(accessKey()))
	}

	function rollInitiative(pokemon: BattlePokemonSnapshot) {
		if (initiativeRoll(pokemon.id)) return
		void run(() => TrainerBattleProvider.rollInitiative(
			accessKey(),
			pokemon.id,
			hasAlert(pokemon) && Boolean(alertSelections[pokemon.id]),
			otherModifiers[pokemon.id] ?? 0,
		))
	}

	function movePokemon(event: CustomEvent<{ pokemonId: string, position: { q: number, r: number } }>) {
		void run(() => TrainerBattleProvider.movePokemon(accessKey(), event.detail.pokemonId, event.detail.position))
	}

	function endTurn() {
		void run(() => TrainerBattleProvider.endTurn(accessKey()))
	}
</script>

{#if playerView?.status === "lobby"}
	<div class="battle-stage lobby-stage">
		<h3>Choose Active Pokémon</h3>
		<p>{playerView.settings.format === "singles" ? "Choose 1 Pokémon to start on the field." : "Choose 2 Pokémon to start on the field."}</p>

		{#if !playerView.self.ready}
			<div class="active-list">
				{#each playerView.self.pokemon as pokemon}
					<label class="active-choice">
						<input type="checkbox" checked={selectedActiveIds.includes(pokemon.id)} disabled={!selectedActiveIds.includes(pokemon.id) && selectedActiveIds.length >= activeRequired} on:change={() => toggleActive(pokemon.id)} />
						<span>{pokemonLabel(pokemon)}</span>
					</label>
				{/each}
			</div>
			<Button variant="success" disabled={busy || selectedActiveIds.length !== activeRequired} on:click={ready}>{busy ? "Saving…" : "Ready"}</Button>
		{:else}
			<p class="ready-note"><strong>Ready:</strong> {playerView.self.pokemon.filter((pokemon) => selfActiveIds.includes(pokemon.id)).map(pokemonLabel).join(", ")}</p>
			<Button disabled={busy} on:click={changeSelection}>Change Active Pokémon</Button>
		{/if}

		{#if playerView.opponent}
			<p><strong>Opponent:</strong> {playerView.opponent.ready ? "Ready" : "Choosing active Pokémon…"}</p>
		{:else}
			<p><strong>Opponent:</strong> Waiting for Player 2…</p>
		{/if}

		{#if playerView.viewerSide === "a" && playerView.self.ready && playerView.opponent?.ready}
			<div class="start-row"><Button variant="success" disabled={busy} on:click={startBattle}>{busy ? "Starting…" : "Introduce Pokémon"}</Button></div>
		{:else if playerView.viewerSide === "b" && playerView.self.ready && playerView.opponent?.ready}
			<p class="ready-note">Both players are ready. Waiting for the host to introduce the Pokémon.</p>
		{/if}
	</div>
{:else if (playerView?.status === "active" || spectatorView?.status === "active") && battleState}
	<div class="battle-stage">
		{#if battlePhase === "initiative"}
			<div class="initiative-header">
				<div>
					<h3>Roll Initiative</h3>
					<p>The active Pokémon are on the field. Each player rolls initiative for their own Pokémon before movement begins.</p>
				</div>
				{#if spectatorView}<div class="movement-counter">Spectator — read only</div>{/if}
			</div>

			<TrainerBattleBoard
				format={playerView?.settings.format ?? spectatorView!.settings.format}
				units={allUnits}
				currentTurnPokemonId={null}
				interactive={false}
			/>

			{#if playerView}
				<div class="initiative-cards">
					{#each myActivePokemon as pokemon}
						{@const result = initiativeRoll(pokemon.id)}
						<div class="initiative-card">
							<h4>{pokemonLabel(pokemon)}</h4>
							{#if result}
								<p class="initiative-result"><strong>{result.initiative}</strong> = d20 {result.roll} {signed(result.dexModifier)} DEX{result.alertModifier ? ` + ${result.alertModifier} Alert` : ""}{result.otherModifier ? ` ${signed(result.otherModifier)} other` : ""}</p>
							{:else}
								<p>DEX modifier: <strong>{signed(dexModifier(pokemon))}</strong></p>
								{#if hasAlert(pokemon)}
									<label class="initiative-option"><input type="checkbox" checked={alertSelections[pokemon.id] ?? false} on:change={(event) => setAlert(pokemon.id, event.currentTarget.checked)} /> <span>Use Alert feat (+5)</span></label>
								{/if}
								<label class="other-modifier">
									<span>Other modifier</span>
									<input type="number" min="-30" max="30" step="1" value={otherModifiers[pokemon.id] ?? 0} on:input={(event) => setOtherModifier(pokemon.id, event.currentTarget.valueAsNumber)} />
								</label>
								<p class="modifier-help">Use Other modifier for an item, Trainer feature, or another initiative effect not automatically detected.</p>
								<Button variant="success" disabled={busy} on:click={() => rollInitiative(pokemon)}>{busy ? "Rolling…" : "Roll Initiative"}</Button>
							{/if}
						</div>
					{/each}
				</div>
			{:else}
				<p class="ready-note">Waiting for both players to submit initiative.</p>
			{/if}

			<div class="initiative-strip" aria-label="Submitted initiative rolls">
				{#each initiativeRolls as entry}
					<span>{unitLabel(entry.pokemonId)}: <strong>{entry.initiative}</strong> (d20 {entry.roll} {signed(entry.modifier)})</span>
				{/each}
				{#if initiativeRolls.length === 0}<span>No initiative rolls submitted yet.</span>{/if}
			</div>
		{:else}
			<div class="turn-header">
				<div>
					<strong>Round {battleState.round}</strong>
					<span>{currentUnit ? `${currentUnit.label}'s turn` : "Current turn"}</span>
				</div>
				{#if playerView && isMyTurn && myTurnPokemon}
					<div class="movement-counter">Movement: <strong>{myTurnPokemon.movementRemainingFeet} ft</strong></div>
				{:else if playerView}
					<div class="movement-counter">Waiting for opponent</div>
				{:else}
					<div class="movement-counter">Spectator — read only</div>
				{/if}
			</div>

			<div class="initiative-strip" aria-label="Initiative order">
				{#each battleState.turnOrder as entry, index}
					<span class:current={index === battleState.turnIndex}>{unitLabel(entry.pokemonId)} ({entry.initiative})</span>
				{/each}
			</div>

			<TrainerBattleBoard
				format={playerView?.settings.format ?? spectatorView!.settings.format}
				units={allUnits}
				currentTurnPokemonId={battleState.turnPokemonId}
				interactive={Boolean(playerView && isMyTurn && !busy)}
				on:move={movePokemon}
			/>

			{#if playerView && isMyTurn}
				<div class="turn-actions"><Button variant="success" disabled={busy} on:click={endTurn}>{busy ? "Updating…" : "End Turn"}</Button></div>
			{/if}
		{/if}
	</div>
{/if}

{#if errorMessage}<p class="stage-error" role="alert">{errorMessage}</p>{/if}

<style>
	.battle-stage { margin-block: 1rem; }
	.lobby-stage { padding: 1rem; border-radius: .75rem; background: var(--skin-input-bg); }
	.active-list { display: grid; gap: .45rem; max-width: 36rem; margin-block: 1rem; }
	.active-choice { display: flex; align-items: center; gap: .65rem; padding: .55rem .7rem; border-radius: .45rem; background: var(--skin-content); }
	.ready-note { font-style: italic; }
	.start-row, .turn-actions { margin-top: 1rem; }
	.turn-header, .initiative-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: .75rem; }
	.turn-header > div:first-child { display: flex; gap: .65rem; align-items: baseline; }
	.initiative-header h3, .initiative-header p { margin-block: .2rem; }
	.movement-counter { padding: .45rem .7rem; border-radius: .5rem; background: var(--skin-input-bg); }
	.initiative-strip { display: flex; gap: .4rem; flex-wrap: wrap; margin-block: .75rem; }
	.initiative-strip span { padding: .3rem .55rem; border-radius: 999px; background: var(--skin-input-bg); }
	.initiative-strip span.current { outline: 2px solid currentColor; font-weight: 800; }
	.initiative-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); gap: .75rem; margin-block: 1rem; }
	.initiative-card { padding: .85rem; border-radius: .65rem; background: var(--skin-input-bg); }
	.initiative-card h4 { margin-block: 0 .5rem; }
	.initiative-result { margin-block: .4rem; }
	.initiative-option { display: flex; align-items: center; gap: .45rem; margin-block: .65rem; }
	.other-modifier { display: grid; grid-template-columns: 1fr 5rem; align-items: center; gap: .5rem; margin-block: .65rem; }
	.other-modifier input { font: inherit; padding: .35rem; width: 100%; }
	.modifier-help { font-size: .85em; font-style: italic; margin-block: .4rem .7rem; }
	.stage-error { padding: .75rem 1rem; border: 1px solid currentColor; border-radius: .5rem; color: var(--skin-danger-text); }
</style>
