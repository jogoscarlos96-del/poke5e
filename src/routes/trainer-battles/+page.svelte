<script lang="ts">
	import { onDestroy, onMount } from "svelte"
	import { Page } from "$lib/ui/layout"
	import Card from "$lib/ui/page/Card.svelte"
	import { Button } from "$lib/ui/elements"
	import { provider as trainerProvider, type TrainerData } from "$lib/trainers/data"
	import type { Trainer, TrainerPokemon } from "$lib/trainers/types"
	import { createBattleParticipant } from "$lib/trainer-battles/snapshot"
	import { TrainerBattleProvider } from "$lib/trainer-battles/provider"
	import { DEFAULT_TRAINER_BATTLE_SETTINGS } from "$lib/trainer-battles/config"
	import { TRAINER_BATTLE_SCALE_WARNING } from "$lib/trainer-battles/constants"
	import type {
		TrainerBattleFormat,
		TrainerBattleJoinPreview,
		TrainerBattlePlayerView,
		TrainerBattleScaling,
		TrainerBattleSpectatorView,
		TrainerBattleTeamSize,
	} from "$lib/trainer-battles/types"

	type Mode = "home" | "host" | "join" | "watch"

	let mode: Mode = "home"
	let format: TrainerBattleFormat = DEFAULT_TRAINER_BATTLE_SETTINGS.format
	let teamSize: TrainerBattleTeamSize = DEFAULT_TRAINER_BATTLE_SETTINGS.teamSize
	let scaling: TrainerBattleScaling = DEFAULT_TRAINER_BATTLE_SETTINGS.scaling
	let code = ""
	let knownTrainers: Trainer[] = []
	let selectedTrainerKey = ""
	let selectedTrainerData: TrainerData | undefined
	let selectedPokemonIds: string[] = []
	let joinPreview: TrainerBattleJoinPreview | null = null
	let playerView: TrainerBattlePlayerView | null = null
	let spectatorView: TrainerBattleSpectatorView | null = null
	let busy = false
	let errorMessage = ""
	let refreshTimer: ReturnType<typeof setInterval> | undefined

	onMount(() => {
		void loadKnownTrainers()
	})

	onDestroy(() => stopRefreshing())

	async function loadKnownTrainers() {
		try {
			knownTrainers = await trainerProvider.allTrainers()
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : "Could not load local Trainers."
		}
	}

	function setMode(next: Mode) {
		stopRefreshing()
		mode = next
		code = ""
		joinPreview = null
		playerView = null
		spectatorView = null
		errorMessage = ""
		selectedTrainerKey = ""
		selectedTrainerData = undefined
		selectedPokemonIds = []
	}

	async function loadTrainer(readKey: string) {
		selectedPokemonIds = []
		selectedTrainerData = undefined
		if (!readKey) return

		busy = true
		errorMessage = ""
		try {
			selectedTrainerData = await trainerProvider.getTrainer(readKey)
			if (selectedTrainerData == null) throw new Error("Trainer could not be loaded.")
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : "Trainer could not be loaded."
		} finally {
			busy = false
		}
	}

	function togglePokemon(id: string, limit: number) {
		if (selectedPokemonIds.includes(id)) {
			selectedPokemonIds = selectedPokemonIds.filter((pokemonId) => pokemonId !== id)
			return
		}
		if (selectedPokemonIds.length >= limit) return
		selectedPokemonIds = [...selectedPokemonIds, id]
	}

	function pokemonLabel(pokemon: TrainerPokemon): string {
		const species = pokemon.pokemonId.data
		return pokemon.nickname?.trim() ? `${pokemon.nickname} (${species})` : species
	}

	function selectionValid(limit: number): boolean {
		return selectedTrainerData != null && selectedPokemonIds.length > 0 && selectedPokemonIds.length <= limit
	}

	function stopRefreshing() {
		if (refreshTimer != null) clearInterval(refreshTimer)
		refreshTimer = undefined
	}

	function startPlayerRefreshing(accessKey: string) {
		stopRefreshing()
		refreshTimer = setInterval(() => {
			void TrainerBattleProvider.getPlayer(accessKey).then((view) => {
				if (view != null) playerView = view
			})
		}, 3000)
	}

	function startSpectatorRefreshing(spectatorCode: string) {
		stopRefreshing()
		refreshTimer = setInterval(() => {
			void TrainerBattleProvider.getSpectator(spectatorCode).then((view) => {
				if (view != null) spectatorView = view
			})
		}, 3000)
	}

	async function hostBattle() {
		if (!selectedTrainerData || !selectionValid(teamSize)) return
		busy = true
		errorMessage = ""
		try {
			const settings = { format, teamSize, scaling }
			const participant = createBattleParticipant({
				trainer: selectedTrainerData,
				pokemonIds: selectedPokemonIds,
				side: "a",
				scaling,
			})
			const created = await TrainerBattleProvider.create(settings, participant)
			TrainerBattleProvider.storeAccessKey(created.id, created.accessKey)
			playerView = await TrainerBattleProvider.getPlayer(created.accessKey)
			startPlayerRefreshing(created.accessKey)
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : "Could not create Trainer Battle."
		} finally {
			busy = false
		}
	}

	async function findJoinBattle() {
		busy = true
		errorMessage = ""
		joinPreview = null
		try {
			joinPreview = await TrainerBattleProvider.getJoinPreview(code)
			if (joinPreview == null) throw new Error("Trainer Battle not found.")
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : "Could not find Trainer Battle."
		} finally {
			busy = false
		}
	}

	async function joinBattle() {
		if (!joinPreview || !selectedTrainerData || !selectionValid(joinPreview.settings.teamSize)) return
		busy = true
		errorMessage = ""
		try {
			const participant = createBattleParticipant({
				trainer: selectedTrainerData,
				pokemonIds: selectedPokemonIds,
				side: "b",
				scaling: joinPreview.settings.scaling,
			})
			const joined = await TrainerBattleProvider.join(code, participant)
			TrainerBattleProvider.storeAccessKey(joined.id, joined.accessKey)
			playerView = await TrainerBattleProvider.getPlayer(joined.accessKey)
			startPlayerRefreshing(joined.accessKey)
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : "Could not join Trainer Battle."
		} finally {
			busy = false
		}
	}

	async function watchBattle() {
		busy = true
		errorMessage = ""
		try {
			spectatorView = await TrainerBattleProvider.getSpectator(code)
			if (spectatorView == null) throw new Error("Trainer Battle not found.")
			startSpectatorRefreshing(code)
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : "Could not watch Trainer Battle."
		} finally {
			busy = false
		}
	}

	async function copyCode(value: string | null) {
		if (!value) return
		await navigator.clipboard?.writeText(value)
	}
</script>

<Page theme="navy">
	<Card title="Trainer Battles">
		{#if mode === "home"}
			<section>
				<p>Run a synchronized sanctioned Trainer Battle using isolated battle copies of your Trainers and Pokémon. Your normal Trainer sheets are never changed by battle-session HP, PP, statuses, or scaling.</p>
				<div class="actions">
					<Button width="full" on:click={() => setMode("host")}>Host Battle</Button>
					<Button width="full" on:click={() => setMode("join")}>Join Battle</Button>
					<Button width="full" on:click={() => setMode("watch")}>Watch Battle</Button>
				</div>
			</section>
		{:else if mode === "host"}
			<section>
				<h2>Host Battle</h2>
				{#if playerView == null}
					<div class="settings-grid">
						<label><span>Battle Format</span><select bind:value={format}><option value="singles">Singles — 1 active Pokémon</option><option value="doubles">Doubles — 2 active Pokémon</option></select></label>
						<label><span>Team Size</span><select bind:value={teamSize} on:change={() => selectedPokemonIds = selectedPokemonIds.slice(0, teamSize)}><option value={3}>3v3</option><option value={4}>4v4</option><option value={6}>6v6</option></select></label>
						<label><span>Stats</span><select bind:value={scaling}><option value="keep">Keep Stats</option><option value="scale">Scale Stats</option></select></label>
					</div>
					{#if scaling === "scale"}<p class="warning"><strong>Scale Stats:</strong> {TRAINER_BATTLE_SCALE_WARNING}</p>{/if}

					<h3>Select Trainer</h3>
					<label>
						<span>Local Trainer</span>
						<select bind:value={selectedTrainerKey} on:change={() => loadTrainer(selectedTrainerKey)} disabled={busy}>
							<option value="">— Select Trainer —</option>
							{#each knownTrainers as trainer}<option value={trainer.readKey}>{trainer.name}</option>{/each}
						</select>
					</label>
					{#if knownTrainers.length === 0}<p>No Trainers are currently stored in this browser's local Trainer list.</p>{/if}

					{#if selectedTrainerData}
						<h3>Choose Team <small>({selectedPokemonIds.length}/{teamSize})</small></h3>
						<div class="team-list">
							{#each selectedTrainerData.pokemon as pokemon}
								<label class="pokemon-choice">
									<input type="checkbox" checked={selectedPokemonIds.includes(pokemon.id)} disabled={!selectedPokemonIds.includes(pokemon.id) && selectedPokemonIds.length >= teamSize} on:change={() => togglePokemon(pokemon.id, teamSize)} />
									<span><strong>{pokemonLabel(pokemon)}</strong> — Lv. {pokemon.level.data}</span>
								</label>
							{/each}
						</div>
					{/if}

					<div class="footer-actions"><Button on:click={() => setMode("home")}>Back</Button><Button variant="success" disabled={busy || !selectionValid(teamSize)} on:click={hostBattle}>{busy ? "Creating…" : "Create Battle"}</Button></div>
				{:else}
					<div class="codes">
						<div><strong>Join Code</strong><code>{playerView.joinCode}</code><Button on:click={() => copyCode(playerView?.joinCode ?? null)}>Copy</Button></div>
						<div><strong>Spectator Code</strong><code>{playerView.spectatorCode}</code><Button on:click={() => copyCode(playerView?.spectatorCode ?? null)}>Copy</Button></div>
					</div>
					<div class="lobby">
						<h3>Battle Lobby</h3>
						<p><strong>Your Trainer:</strong> {playerView.self.trainer.name}</p>
						<div class="roster">{#each playerView.self.pokemon as pokemon}<span>{pokemonLabel(pokemon)}</span>{/each}</div>
						{#if playerView.opponent}<p><strong>Opponent:</strong> {playerView.opponent.trainerName} ({playerView.opponent.teamCount} Pokémon selected)</p>{:else}<p><strong>Opponent:</strong> Waiting for Player 2…</p>{/if}
						<p class="privacy-note">Your opponent's unrevealed roster, HP, PP, moves, and build details are not included in this player view.</p>
					</div>
					<p class="placeholder">The shared battle board and active-Pokémon selection are the next implementation slice.</p>
					<Button on:click={() => setMode("home")}>Leave View</Button>
				{/if}
			</section>
		{:else if mode === "join"}
			<section>
				<h2>Join Battle</h2>
				{#if playerView == null}
					<label><span>Join Code</span><input bind:value={code} autocomplete="off" placeholder="J-XXXXXXXX" /></label>
					<Button disabled={busy || code.trim() === ""} on:click={findJoinBattle}>Find Battle</Button>
					{#if joinPreview}
						<div class="battle-summary">
							<h3>Battle found</h3>
							<p><strong>Host:</strong> {joinPreview.hostTrainerName}</p>
							<p><strong>Format:</strong> {joinPreview.settings.format === "singles" ? "Singles" : "Doubles"} · <strong>Team limit:</strong> {joinPreview.settings.teamSize} · <strong>Stats:</strong> {joinPreview.settings.scaling === "scale" ? "Scaled" : "Kept"}</p>
							{#if joinPreview.occupied}<p class="warning">This battle already has a second player.</p>
							{:else if joinPreview.status !== "lobby"}<p class="warning">This battle has already started.</p>
							{:else}
								<h3>Select Trainer</h3>
								<label><span>Local Trainer</span><select bind:value={selectedTrainerKey} on:change={() => loadTrainer(selectedTrainerKey)} disabled={busy}><option value="">— Select Trainer —</option>{#each knownTrainers as trainer}<option value={trainer.readKey}>{trainer.name}</option>{/each}</select></label>
								{#if selectedTrainerData}
									<h3>Choose Team <small>({selectedPokemonIds.length}/{joinPreview.settings.teamSize})</small></h3>
									<div class="team-list">
										{#each selectedTrainerData.pokemon as pokemon}
											<label class="pokemon-choice">
												<input type="checkbox" checked={selectedPokemonIds.includes(pokemon.id)} disabled={!selectedPokemonIds.includes(pokemon.id) && selectedPokemonIds.length >= joinPreview.settings.teamSize} on:change={() => togglePokemon(pokemon.id, joinPreview!.settings.teamSize)} />
												<span><strong>{pokemonLabel(pokemon)}</strong> — Lv. {pokemon.level.data}</span>
											</label>
										{/each}
									</div>
								{/if}
								<Button variant="success" disabled={busy || !selectionValid(joinPreview.settings.teamSize)} on:click={joinBattle}>{busy ? "Joining…" : "Join Battle"}</Button>
							{/if}
						</div>
					{/if}
				{:else}
					<div class="lobby">
						<h3>Battle Lobby</h3>
						<p><strong>Your Trainer:</strong> {playerView.self.trainer.name}</p>
						<div class="roster">{#each playerView.self.pokemon as pokemon}<span>{pokemonLabel(pokemon)}</span>{/each}</div>
						{#if playerView.opponent}<p><strong>Opponent:</strong> {playerView.opponent.trainerName} ({playerView.opponent.teamCount} Pokémon selected)</p>{/if}
						<p class="privacy-note">Your opponent's unrevealed roster, HP, PP, moves, and build details are not included in this player view.</p>
					</div>
					<p class="placeholder">The shared battle board and active-Pokémon selection are the next implementation slice.</p>
				{/if}
				<div class="footer-actions"><Button on:click={() => setMode("home")}>Back</Button></div>
			</section>
		{:else}
			<section>
				<h2>Watch Battle</h2>
				{#if spectatorView == null}
					<label><span>Spectator Code</span><input bind:value={code} autocomplete="off" placeholder="W-XXXXXXXX" /></label>
					<Button disabled={busy || code.trim() === ""} on:click={watchBattle}>{busy ? "Loading…" : "Watch Battle"}</Button>
				{:else}
					<h3>Spectator View</h3>
					<p>Read-only battle view. Spectators receive no control key.</p>
					<div class="spectator-grid">
						{#each ["a", "b"] as side}
							{@const participant = spectatorView.participants[side as "a" | "b"]}
							<div class="participant-card">
								{#if participant}
									<h4>{participant.trainer.name}</h4>
									{#each participant.pokemon as pokemon}<p>{pokemonLabel(pokemon)} — HP {pokemon.hp.current}/{pokemon.hp.max}</p>{/each}
								{:else}<h4>Waiting for Player 2</h4>{/if}
							</div>
						{/each}
					</div>
				{/if}
				<div class="footer-actions"><Button on:click={() => setMode("home")}>Back</Button></div>
			</section>
		{/if}

		{#if errorMessage}<p class="error" role="alert">{errorMessage}</p>{/if}
	</Card>
</Page>

<style>
	.actions { display: grid; gap: 1rem; max-width: 30rem; }
	.settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: 1rem; max-width: 48rem; }
	label { display: grid; gap: .35rem; margin-bottom: 1rem; max-width: 32rem; }
	select, input { font: inherit; padding: .65rem; }
	.warning, .error { max-width: 48rem; padding: .75rem 1rem; border: 1px solid currentColor; border-radius: .5rem; }
	.error { color: var(--skin-danger-text); }
	.placeholder, .privacy-note { font-style: italic; }
	.team-list { display: grid; gap: .5rem; max-width: 42rem; margin-bottom: 1rem; }
	.pokemon-choice { display: flex; align-items: center; gap: .65rem; margin: 0; padding: .65rem .8rem; background: var(--skin-input-bg); border-radius: .5rem; }
	.footer-actions { display: flex; gap: .75rem; margin-top: 1.25rem; }
	.codes { display: grid; gap: .75rem; max-width: 36rem; margin-bottom: 1.5rem; }
	.codes > div { display: grid; grid-template-columns: 8rem 1fr auto; align-items: center; gap: .75rem; }
	code { font-size: 1.1em; padding: .4rem .6rem; background: var(--skin-input-bg); border-radius: .35rem; }
	.battle-summary, .lobby, .participant-card { padding: 1rem; background: var(--skin-input-bg); border-radius: .75rem; margin-block: 1rem; }
	.roster { display: flex; flex-wrap: wrap; gap: .5rem; }
	.roster span { padding: .3rem .55rem; background: var(--skin-content); border-radius: 999px; }
	.spectator-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: 1rem; }
</style>
