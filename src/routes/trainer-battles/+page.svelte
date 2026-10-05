<script lang="ts">
	import { Page } from "$lib/ui/layout"
	import Card from "$lib/ui/page/Card.svelte"
	import { Button } from "$lib/ui/elements"
	import { DEFAULT_TRAINER_BATTLE_SETTINGS } from "$lib/trainer-battles/config"
	import { TRAINER_BATTLE_SCALE_WARNING } from "$lib/trainer-battles/constants"
	import type { TrainerBattleFormat, TrainerBattleScaling, TrainerBattleTeamSize } from "$lib/trainer-battles/types"

	type Mode = "home" | "host" | "join" | "watch"

	let mode: Mode = "home"
	let format: TrainerBattleFormat = DEFAULT_TRAINER_BATTLE_SETTINGS.format
	let teamSize: TrainerBattleTeamSize = DEFAULT_TRAINER_BATTLE_SETTINGS.teamSize
	let scaling: TrainerBattleScaling = DEFAULT_TRAINER_BATTLE_SETTINGS.scaling
	let code = ""
</script>

<Page theme="navy">
	<Card title="Trainer Battles">
		{#if mode === "home"}
			<section>
				<p>Run a synchronized sanctioned Trainer Battle using isolated battle copies of your Trainers and Pokémon. Your normal Trainer sheets are never changed by battle-session HP, PP, statuses, or scaling.</p>
				<div class="actions">
					<Button width="full" on:click={() => mode = "host"}>Host Battle</Button>
					<Button width="full" on:click={() => mode = "join"}>Join Battle</Button>
					<Button width="full" on:click={() => mode = "watch"}>Watch Battle</Button>
				</div>
			</section>
		{:else if mode === "host"}
			<section>
				<h2>Host Battle</h2>
				<label>
					<span>Battle Format</span>
					<select bind:value={format}>
						<option value="singles">Singles — 1 active Pokémon</option>
						<option value="doubles">Doubles — 2 active Pokémon</option>
					</select>
				</label>
				<label>
					<span>Team Size</span>
					<select bind:value={teamSize}>
						<option value={3}>3v3</option>
						<option value={4}>4v4</option>
						<option value={6}>6v6</option>
					</select>
				</label>
				<label>
					<span>Stats</span>
					<select bind:value={scaling}>
						<option value="keep">Keep Stats</option>
						<option value="scale">Scale Stats</option>
					</select>
				</label>
				{#if scaling === "scale"}
					<p class="warning"><strong>Scale Stats:</strong> {TRAINER_BATTLE_SCALE_WARNING}</p>
				{/if}
				<p class="placeholder">Trainer/team selection and session code generation are the next implementation step.</p>
				<Button on:click={() => mode = "home"}>Back</Button>
			</section>
		{:else}
			<section>
				<h2>{mode === "join" ? "Join Battle" : "Watch Battle"}</h2>
				<label>
					<span>{mode === "join" ? "Join Code" : "Spectator Code"}</span>
					<input bind:value={code} autocomplete="off" />
				</label>
				<p class="placeholder">Session lookup will be enabled once the Supabase battle-session layer is added.</p>
				<Button on:click={() => mode = "home"}>Back</Button>
			</section>
		{/if}
	</Card>
</Page>

<style>
	.actions {
		display: grid;
		gap: 1rem;
		max-width: 30rem;
	}

	label {
		display: grid;
		gap: .35rem;
		margin-bottom: 1rem;
		max-width: 32rem;
	}

	select, input {
		font: inherit;
		padding: .65rem;
	}

	.warning {
		max-width: 48rem;
		padding: .75rem 1rem;
		border: 1px solid currentColor;
		border-radius: .5rem;
	}

	.placeholder {
		font-style: italic;
	}
</style>
