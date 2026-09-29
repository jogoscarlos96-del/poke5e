<script lang="ts">
	import { onMount } from "svelte"
	import { Title, Page } from "$lib/ui/layout"
	import { Button, Loader } from "$lib/ui/elements"
	import { GreatballIcon } from "$lib/ui/icons"
	import { SpeciesField } from "$lib/poke5e/species"
	import type { PokemonSpecies } from "$lib/poke5e/species"
	import { CampaignCreationAccess } from "$lib/site/CampaignCreationAccess"
	import {
		SafariData,
		type SafariBiomeDefinition,
		type SafariPark,
		type SafariParkData,
	} from "$lib/safari"
	import { loadSafariSpecies, resolveSafariSpecies } from "$lib/safari/SpeciesResolver"

	let unlocked = false
	let password = ""
	let passwordError: string | undefined
	let error: string | undefined
	let loading = false
	let saving = false

	let parks: SafariPark[] = []
	let allSpecies: PokemonSpecies[] = []
	let speciesById = new Map<string, PokemonSpecies>()
	let selectedId: string | undefined
	let draft: SafariParkData | undefined
	let isNew = false
	let manualSpeciesIds: Record<string, string> = {}

	const blankPark = (): SafariParkData => ({
		name: "New Safari Park",
		description: "",
		active: false,
		biomes: [],
	})

	const clonePark = (park: SafariPark): SafariParkData => ({
		name: park.name,
		description: park.description,
		active: park.active,
		biomes: structuredClone(park.biomes),
	})

	const allConfiguredIds = () => parks.flatMap((park) => park.biomes.flatMap((biome) => biome.speciesIds))

	const refreshSpecies = async () => {
		speciesById = await resolveSafariSpecies(allConfiguredIds(), allSpecies)
	}

	const load = async () => {
		loading = true
		error = undefined
		try {
			const [loadedParks, loadedSpecies] = await Promise.all([
				SafariData.listAllParks(),
				loadSafariSpecies(),
			])
			parks = loadedParks
			allSpecies = loadedSpecies
			await refreshSpecies()

			if (selectedId && parks.some((park) => park.id === selectedId)) {
				const selected = parks.find((park) => park.id === selectedId)
				if (selected) draft = clonePark(selected)
			} else if (parks.length > 0) {
				selectPark(parks[0])
			}
		} catch (e) {
			error = e instanceof Error ? e.message : String(e)
		} finally {
			loading = false
		}
	}

	onMount(() => {
		unlocked = CampaignCreationAccess.isUnlocked()
		if (unlocked) void load()
	})

	const unlock = async () => {
		passwordError = undefined
		if (await CampaignCreationAccess.unlock(password)) {
			password = ""
			unlocked = true
			await load()
		} else {
			passwordError = "Incorrect campaign creation password."
		}
	}

	const selectPark = (park: SafariPark) => {
		selectedId = park.id
		draft = clonePark(park)
		isNew = false
		manualSpeciesIds = {}
	}

	const startNew = () => {
		selectedId = undefined
		draft = blankPark()
		isNew = true
		manualSpeciesIds = {}
	}

	const save = async () => {
		if (!draft || !draft.name.trim()) return
		saving = true
		error = undefined
		try {
			if (isNew) {
				const id = await SafariData.createPark(draft)
				await load()
				const created = parks.find((park) => park.id === id)
				if (created) selectPark(created)
			} else if (selectedId) {
				await SafariData.updatePark(selectedId, draft)
				await load()
				const updated = parks.find((park) => park.id === selectedId)
				if (updated) selectPark(updated)
			}
		} catch (e) {
			error = e instanceof Error ? e.message : String(e)
		} finally {
			saving = false
		}
	}

	const remove = async () => {
		if (!selectedId || !draft || !confirm(`Delete ${draft.name}? This cannot be undone.`)) return
		saving = true
		error = undefined
		try {
			await SafariData.removePark(selectedId)
			selectedId = undefined
			draft = undefined
			await load()
		} catch (e) {
			error = e instanceof Error ? e.message : String(e)
		} finally {
			saving = false
		}
	}

	const addBiome = () => {
		if (!draft) return
		draft = {
			...draft,
			biomes: [...draft.biomes, {
				id: crypto.randomUUID(),
				name: "New Biome",
				description: "",
				active: true,
				speciesIds: [],
			}],
		}
	}

	const updateBiome = (id: string, update: Partial<SafariBiomeDefinition>) => {
		if (!draft) return
		draft = {
			...draft,
			biomes: draft.biomes.map((biome) => biome.id === id ? { ...biome, ...update } : biome),
		}
	}

	const removeBiome = (id: string) => {
		if (!draft) return
		draft = { ...draft, biomes: draft.biomes.filter((biome) => biome.id !== id) }
	}

	const addSpecies = (biomeId: string, species: PokemonSpecies) => {
		if (!species || !draft) return
		speciesById = new Map(speciesById).set(species.id.data, species)
		const biome = draft.biomes.find((it) => it.id === biomeId)
		if (!biome || biome.speciesIds.includes(species.id.data)) return
		updateBiome(biomeId, { speciesIds: [...biome.speciesIds, species.id.data] })
	}

	const addManualSpecies = async (biomeId: string) => {
		const raw = (manualSpeciesIds[biomeId] ?? "").trim()
		if (!raw || !draft) return
		const id = raw.startsWith("F.") ? raw : raw.toLocaleLowerCase()
		const biome = draft.biomes.find((it) => it.id === biomeId)
		if (!biome || biome.speciesIds.includes(id)) return

		updateBiome(biomeId, { speciesIds: [...biome.speciesIds, id] })
		manualSpeciesIds = { ...manualSpeciesIds, [biomeId]: "" }
		speciesById = await resolveSafariSpecies([id], [...speciesById.values()])
	}

	const removeSpecies = (biomeId: string, speciesId: string) => {
		const biome = draft?.biomes.find((it) => it.id === biomeId)
		if (!biome) return
		updateBiome(biomeId, { speciesIds: biome.speciesIds.filter((id) => id !== speciesId) })
	}

	const groupsForBiome = (biome: SafariBiomeDefinition) => {
		const groups = new Map<string, { label: string, order: number, ids: string[] }>()
		for (const id of biome.speciesIds) {
			const species = speciesById.get(id)
			const key = species ? `sr:${species.sr.data}` : "unresolved"
			const existing = groups.get(key) ?? {
				label: species ? `SR ${species.sr.toString()}` : "Unresolved species",
				order: species?.sr.data ?? Number.POSITIVE_INFINITY,
				ids: [],
			}
			existing.ids.push(id)
			groups.set(key, existing)
		}

		return [...groups.values()]
			.sort((a, b) => a.order - b.order)
			.map((group) => ({
				...group,
				ids: [...group.ids].sort((a, b) =>
					(speciesById.get(a)?.name ?? a).localeCompare(speciesById.get(b)?.name ?? b),
				),
			}))
	}
</script>

<Title value="Safari Management" />
<Page theme="forest">
	<GreatballIcon slot="icon" />

	<svelte:fragment slot="side">
		{#if unlocked}
			<nav class="park-nav" aria-label="Safari Parks">
				<div class="nav-heading">
					<h1>Safari Parks</h1>
					<Button variant="success" on:click={startNew}>+ New Park</Button>
				</div>
				{#if loading}
					<Loader />
				{:else if parks.length === 0}
					<p>No Safari Parks yet.</p>
				{:else}
					<ul>
						{#each parks as park}
							<li class:selected={selectedId === park.id}>
								<button type="button" on:click={() => selectPark(park)}>
									<strong>{park.name}</strong>
									<span>{park.active ? "Active" : "Hidden"}</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</nav>
		{/if}
	</svelte:fragment>

	{#if !unlocked}
		<section class="gate">
			<h1>Safari Management</h1>
			<p>Create and edit the Safari Parks used by the player-facing Safari Zone.</p>
			<div class="access-box">
				<h2>Campaign Access Required</h2>
				<p>Use the same campaign creation password used for Custom Moves and Mega Evolutions.</p>
				<form on:submit|preventDefault={unlock}>
					<label for="safari-management-password">Campaign Password</label>
					<input id="safari-management-password" type="password" bind:value={password} autocomplete="current-password" />
					<Button type="submit">Unlock Safari Management</Button>
				</form>
				{#if passwordError}<p class="error">{passwordError}</p>{/if}
			</div>
		</section>
	{:else}
		<section class="editor">
			{#if error}<p class="error">{error}</p>{/if}
			{#if loading && !draft}
				<Loader />
			{:else if !draft}
				<h1>Safari Management</h1>
				<p>Select a Park or create a new one.</p>
			{:else}
				<div class="editor-heading">
					<div>
						<h1>{isNew ? "Create Safari Park" : `Edit ${draft.name}`}</h1>
						<p>Species are grouped by their canonical SR automatically. No day/night pool is used.</p>
					</div>
					<label class="active-toggle">
						<input type="checkbox" bind:checked={draft.active} />
						{draft.active ? "Active" : "Hidden"}
					</label>
				</div>

				<div class="fields">
					<label>
						<span>Park Name</span>
						<input bind:value={draft.name} required />
					</label>
					<label>
						<span>Description</span>
						<textarea bind:value={draft.description} rows="3"></textarea>
					</label>
				</div>

				<div class="biomes-heading">
					<h2>Biomes</h2>
					<Button variant="subtle" on:click={addBiome}>+ Add Biome</Button>
				</div>

				{#if draft.biomes.length === 0}
					<p>This Park has no biomes yet.</p>
				{/if}

				<div class="biomes">
					{#each draft.biomes as biome (biome.id)}
						<article class="biome-card">
							<div class="biome-heading">
								<label class="biome-name">
									<span>Biome Name</span>
									<input value={biome.name} on:input={(event) => updateBiome(biome.id, { name: event.currentTarget.value })} />
								</label>
								<label class="active-toggle">
									<input
										type="checkbox"
										checked={biome.active}
										on:change={(event) => updateBiome(biome.id, { active: event.currentTarget.checked })}
									/>
									{biome.active ? "Active" : "Hidden"}
								</label>
							</div>
							<label>
								<span>Description</span>
								<textarea
									rows="2"
									value={biome.description}
									on:input={(event) => updateBiome(biome.id, { description: event.currentTarget.value })}
								></textarea>
							</label>

							<div class="species-section">
								<h3>Pokémon / Fakémon</h3>
								{#if biome.speciesIds.length === 0}
									<p>No species configured.</p>
								{:else}
									{#each groupsForBiome(biome) as group}
										<div class="sr-group">
											<h4>{group.label}</h4>
											<ul>
												{#each group.ids as speciesId}
													<li>
														<span>
															<strong>{speciesById.get(speciesId)?.name ?? speciesId}</strong>
															<small>{speciesId}</small>
														</span>
														<Button variant="subtle" on:click={() => removeSpecies(biome.id, speciesId)}>Remove</Button>
													</li>
												{/each}
											</ul>
										</div>
									{/each}
								{/if}

								<div class="species-add">
									<SpeciesField
										label="Add known Pokémon / Fakémon"
										value=""
										name="species-{biome.id}"
										{allSpecies}
										explicitSubmit
										on:change={(event) => event.detail.species && addSpecies(biome.id, event.detail.species)}
									/>
									<div class="manual-add">
										<label>
											<span>Species ID</span>
											<input
												placeholder="pikachu or F.&lt;Fakémon read key&gt;"
												value={manualSpeciesIds[biome.id] ?? ""}
												on:input={(event) => manualSpeciesIds = { ...manualSpeciesIds, [biome.id]: event.currentTarget.value }}
											/>
										</label>
										<Button variant="subtle" on:click={() => addManualSpecies(biome.id)}>Add ID</Button>
									</div>
								</div>
							</div>

							<div class="remove-biome">
								<Button variant="danger" on:click={() => removeBiome(biome.id)}>Remove Biome</Button>
							</div>
						</article>
					{/each}
				</div>

				<div class="actions">
					{#if !isNew}<Button variant="danger" disabled={saving} on:click={remove}>Delete Park</Button>{/if}
					<Button variant="solid" disabled={saving || !draft.name.trim()} on:click={save}>
						{saving ? "Saving…" : isNew ? "Create Park" : "Save Park"}
					</Button>
				</div>
			{/if}
		</section>
	{/if}
</Page>

<style>
	.gate, .editor { height: 100%; overflow: auto; padding: 1rem; }
	.gate { max-width: 48rem; margin-inline: auto; }
	.access-box, .biome-card { background: var(--skin-content); border-radius: 0.75rem; padding: 1rem; }
	.access-box form { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.75rem; align-items: end; }
	.access-box label { grid-column: 1; font-weight: bold; }
	.access-box input { grid-column: 1; }
	.access-box :global(.button) { grid-column: 2; grid-row: 2; }
	.park-nav { height: 100%; overflow: auto; padding: 0.5rem; }
	.nav-heading, .editor-heading, .biomes-heading, .biome-heading, .actions { display: flex; gap: 0.75rem; justify-content: space-between; align-items: center; }
	.park-nav ul, .sr-group ul { list-style: none; padding: 0; margin: 0; }
	.park-nav li button { width: 100%; display: flex; justify-content: space-between; gap: 0.5rem; border: 0; padding: 0.7rem; background: var(--skin-content); color: inherit; cursor: pointer; }
	.park-nav li.selected button { background: var(--skin-input-bg); font-weight: bold; }
	.park-nav li span { opacity: 0.7; font-size: var(--font-sz-venus); }
	.fields, .biomes { display: grid; gap: 1rem; }
	.fields { margin-block: 1rem; }
	label { display: grid; gap: 0.25rem; }
	label > span { font-weight: bold; }
	input, textarea { width: 100%; box-sizing: border-box; }
	.active-toggle { display: flex; align-items: center; gap: 0.4rem; white-space: nowrap; font-weight: bold; }
	.active-toggle input { width: auto; }
	.biomes-heading { margin-block: 1.25rem 0.75rem; }
	.biome-card { display: grid; gap: 0.85rem; }
	.biome-name { flex: 1; }
	.species-section { border-top: 1px solid color-mix(in srgb, currentColor 18%, transparent); padding-top: 0.75rem; }
	.sr-group { margin-block: 0.75rem; }
	.sr-group h4 { margin-block: 0.25rem; }
	.sr-group li { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.4rem 0; }
	.sr-group li span { display: grid; }
	.sr-group small { opacity: 0.65; }
	.species-add { display: grid; gap: 0.5rem; margin-top: 1rem; }
	.manual-add { display: grid; grid-template-columns: 1fr auto; gap: 0.5rem; align-items: end; }
	.remove-biome, .actions { margin-top: 0.5rem; }
	.remove-biome { display: flex; justify-content: flex-end; }
	.error { font-weight: bold; color: var(--skin-danger-text, currentColor); }
	@media (max-width: 42rem) {
		.access-box form, .manual-add { grid-template-columns: 1fr; }
		.access-box :global(.button) { grid-column: 1; grid-row: auto; }
		.editor-heading, .biome-heading, .actions { align-items: stretch; flex-direction: column; }
	}
</style>
