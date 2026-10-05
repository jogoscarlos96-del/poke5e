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
	} from "./types"

	export let playerView: TrainerBattlePlayerView | null = null
	export let spectatorView: TrainerBattleSpectatorView | null = null

	const dispatch = createEventDispatcher<{ changed: void }>()
	let selectedActiveIds: string[] = []
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
	$: allUnits = playerView ? playerUnits : spectatorUnits
	$: currentUnit = battleState?.turnPokemonId == null ? undefined : allUnits.find((unit) => unit.id === battleState?.turnPokemonId)
	$: isMyTurn = playerView != null && battleState?.turnSide === playerView.viewerSide
	$: myTurnPokemon = playerView?.self.pokemon.find((pokemon) => pokemon.id === battleState?.turnPokemonId)

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

	function toggleActive(id: string) {
		if (playerView?.self.ready) return
		if (selectedActiveIds.includes(id)) {
			selectedActiveIds = selectedActiveIds.filter((pokemonId) => pokemonId !== id)
			return
		}
		if (selectedActiveIds.length >= activeRequired) return
		selectedActiveIds = [...selectedActiveIds, id]
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
						<input
							type="checkbox"
							checked={selectedActiveIds.includes(pokemon.id)}
							disabled={!selectedActiveIds.includes(pokemon.id) && selectedActiveIds.length >= activeRequired}
							on:change={() => toggleActive(pokemon.id)}
						/>
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
			<div class="start-row"><Button variant="success" disabled={busy} on:click={startBattle}>{busy ? "Starting…" : "Start Battle"}</Button></div>
		{:else if playerView.viewerSide === "b" && playerView.self.ready && playerView.opponent?.ready}
			<p class="ready-note">Both players are ready. Waiting for the host to start the battle.</p>
		{/if}
	</div>
{:else if (playerView?.status === "active" || spectatorView?.status === "active") && battleState}
	<div class="battle-stage">
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
				{@const unit = allUnits.find((candidate) => candidate.id === entry.pokemonId)}
				<span class:current={index === battleState.turnIndex}>{unit?.label ?? "Pokémon"} ({entry.initiative})</span>
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
	.turn-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: .75rem; }
	.turn-header > div:first-child { display: flex; gap: .65rem; align-items: baseline; }
	.movement-counter { padding: .45rem .7rem; border-radius: .5rem; background: var(--skin-input-bg); }
	.initiative-strip { display: flex; gap: .4rem; flex-wrap: wrap; margin-bottom: .75rem; }
	.initiative-strip span { padding: .3rem .55rem; border-radius: 999px; background: var(--skin-input-bg); }
	.initiative-strip span.current { outline: 2px solid currentColor; font-weight: 800; }
	.stage-error { padding: .75rem 1rem; border: 1px solid currentColor; border-radius: .5rem; color: var(--skin-danger-text); }
</style>
