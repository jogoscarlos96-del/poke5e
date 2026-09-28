<script lang="ts">
	import { browser } from "$app/environment"
	import type { Fakemon } from "$lib/fakemon"
	import { fakemonStore } from "$lib/fakemon/store"
	import { Ability, AbilityStore } from "$lib/pokemon/ability"
	import { MegaDefinitionsStore, type MegaDefinition } from "$lib/pokemon/mega"
	import { SpeciesStore, type PokemonSpecies } from "$lib/poke5e/species"
	import { Url } from "$lib/site/url"
	import { Button, Loader } from "$lib/ui/elements"
	import { TextField } from "$lib/ui/forms"
	import { HeartIcon } from "$lib/ui/icons"
	import { Page, Title } from "$lib/ui/layout"
	import { MAIN_SEARCH_ID } from "$lib/ui/layout/SkipLinks.svelte"
	import { onMount } from "svelte"
	import type { Unsubscriber } from "svelte/store"

	type AbilityUser = {
		id: string,
		name: string,
		href: string,
		number?: number,
		custom: boolean,
		detail?: string,
	}

	type AbilityIndexEntry = {
		key: string,
		name: string,
		aliases: string[],
		description: string,
		custom: boolean,
		normal: AbilityUser[],
		hidden: AbilityUser[],
	}

	type SortMode = "name" | "users-desc" | "users-asc"

	const pokemon = SpeciesStore.canonList()

	let fakemon: Fakemon[] = []
	let fakemonUnsubscribe: Unsubscriber | undefined
	let fakemonError: string | undefined
	let search = ""
	let sort: SortMode = "name"

	const normalize = (value: string) => value.trim().toLocaleLowerCase()
	const customAbilityKey = (ability: Ability) => `custom:${normalize(ability.name)}:${normalize(ability.description)}`
	const abilityKey = (ability: Ability) => ability.referenceId ? `reference:${ability.referenceId}` : customAbilityKey(ability)

	const userSort = (a: AbilityUser, b: AbilityUser) =>
		(a.number ?? Number.MAX_SAFE_INTEGER) - (b.number ?? Number.MAX_SAFE_INTEGER)
		|| a.name.localeCompare(b.name, undefined, { sensitivity: "base" })

	const addUser = (entry: AbilityIndexEntry, user: AbilityUser, hidden: boolean) => {
		const list = hidden ? entry.hidden : entry.normal
		if (!list.some((it) => it.id === user.id)) list.push(user)
	}

	const buildIndex = (
		abilities: Ability[],
		species: PokemonSpecies[],
		customSpecies: Fakemon[],
		megaDefinitions: MegaDefinition[],
	): AbilityIndexEntry[] => {
		const entries = new Map<string, AbilityIndexEntry>()

		const ensureEntry = (ability: Ability): AbilityIndexEntry => {
			const key = abilityKey(ability)
			const existing = entries.get(key)
			if (existing) return existing

			const entry: AbilityIndexEntry = {
				key,
				name: ability.name || "Unnamed Ability",
				aliases: ability.aliases,
				description: ability.description,
				custom: ability.custom,
				normal: [],
				hidden: [],
			}
			entries.set(key, entry)
			return entry
		}

		for (const ability of abilities.filter((it) => !it.deprecated)) ensureEntry(ability)

		const addSpeciesAbilities = (pokemonSpecies: PokemonSpecies, user: AbilityUser) => {
			for (const ability of pokemonSpecies.abilities.normal) addUser(ensureEntry(ability), user, false)
			for (const ability of pokemonSpecies.abilities.hidden) addUser(ensureEntry(ability), user, true)
		}

		for (const pokemonSpecies of species) {
			addSpeciesAbilities(pokemonSpecies, {
				id: `pokemon:${pokemonSpecies.id.data}`,
				name: pokemonSpecies.name,
				href: Url.pokemon(pokemonSpecies.id.data),
				number: pokemonSpecies.number,
				custom: false,
			})
		}

		for (const value of customSpecies) {
			const pokemonSpecies = value.species
			addSpeciesAbilities(pokemonSpecies, {
				id: `fakemon:${value.data.readKey}`,
				name: pokemonSpecies.name,
				href: Url.fakemon(value.data.readKey),
				number: pokemonSpecies.number,
				custom: true,
				detail: "Fakémon",
			})
		}

		for (const definition of megaDefinitions) {
			const ability = definition.ability
			if (!ability?.custom) continue
			addUser(ensureEntry(ability), {
				id: `mega:${definition.id}`,
				name: definition.name,
				href: Url.megaEvolutions(definition.id),
				custom: true,
				detail: "Mega Evolution",
			}, false)
		}

		for (const entry of entries.values()) {
			entry.normal.sort(userSort)
			entry.hidden.sort(userSort)
		}

		return [...entries.values()]
	}

	$: abilities = $AbilityStore.result ?? []
	$: species = $pokemon ?? []
	$: megaDefinitions = $MegaDefinitionsStore.result ?? []
	$: index = buildIndex(abilities, species, fakemon, megaDefinitions)
	$: normalizedSearch = normalize(search)
	$: filtered = index.filter((entry) => {
		if (!normalizedSearch) return true
		const searchable = [
			entry.name,
			...entry.aliases,
			entry.description,
			...entry.normal.flatMap((user) => [user.name, user.detail ?? ""]),
			...entry.hidden.flatMap((user) => [user.name, user.detail ?? ""]),
		].join(" ").toLocaleLowerCase()
		return searchable.includes(normalizedSearch)
	})
	$: view = [...filtered].sort((a, b) => {
		const aUsers = a.normal.length + a.hidden.length
		const bUsers = b.normal.length + b.hidden.length
		if (sort === "users-desc") return bUsers - aUsers || a.name.localeCompare(b.name)
		if (sort === "users-asc") return aUsers - bUsers || a.name.localeCompare(b.name)
		return a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
	})
	$: uniqueUsers = new Set(view.flatMap((entry) => [...entry.normal, ...entry.hidden].map((user) => user.id))).size
	$: assignmentCount = view.reduce((sum, entry) => sum + entry.normal.length + entry.hidden.length, 0)
	$: customCount = view.filter((entry) => entry.custom).length
	$: loading = $AbilityStore.fetching || $pokemon == null
	$: customSourceError = fakemonError ?? $MegaDefinitionsStore.error?.message

	onMount(() => {
		let disposed = false
		void fakemonStore.all()
			.then((store) => {
				if (disposed) return
				fakemonUnsubscribe = store.subscribe((value) => {
					fakemon = value
					fakemonError = undefined
				})
			})
			.catch((error) => {
				fakemonError = error instanceof Error ? error.message : String(error)
			})

		void MegaDefinitionsStore.refresh().catch(() => {
			// The store exposes its own error state. Standard Abilitydex data remains usable.
		})

		return () => {
			disposed = true
			fakemonUnsubscribe?.()
		}
	})

	const clear = () => {
		search = ""
		sort = "name"
	}

	const csvEscape = (value: unknown) => {
		const text = String(value ?? "")
		return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
	}

	const exportCsv = () => {
		if (!browser) return
		const rows = [["Ability", "Effect", "Normal Pokémon", "Hidden Pokémon", "Custom"]]
		for (const entry of view) {
			rows.push([
				entry.name,
				entry.description,
				entry.normal.map((user) => user.name).join("; "),
				entry.hidden.map((user) => user.name).join("; "),
				entry.custom ? "Yes" : "No",
			])
		}

		const csv = "\uFEFF" + rows.map((row) => row.map(csvEscape).join(",")).join("\n")
		const href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
		const link = document.createElement("a")
		link.href = href
		link.download = "Kornia_Poke5e_Abilitydex.csv"
		document.body.appendChild(link)
		link.click()
		link.remove()
		setTimeout(() => URL.revokeObjectURL(href), 1000)
	}
</script>

<Title value="Abilitydex" />
<Page theme="navy">
	<HeartIcon slot="icon" />
	<aside id={MAIN_SEARCH_ID} slot="side" aria-label="Abilitydex controls">
		<h1>Abilitydex</h1>
		<p class="intro">Search Poke5e abilities by name, effect, or Pokémon. Custom abilities from your Fakémon and Mega Evolutions are included automatically.</p>

		<TextField label="Search" bind:value={search} placeholder="Ability, effect, or Pokémon" />

		<label class="sort-field" for="abilitydex-sort">
			<span>Sort</span>
			<select id="abilitydex-sort" bind:value={sort}>
				<option value="name">Ability A–Z</option>
				<option value="users-desc">Most Pokémon</option>
				<option value="users-asc">Fewest Pokémon</option>
			</select>
		</label>

		<div class="side-actions">
			<Button on:click={clear}>Clear</Button>
			<Button variant="success" on:click={exportCsv} disabled={view.length === 0}>Export CSV</Button>
		</div>

		<div class="stats" aria-label="Abilitydex summary">
			<div><strong>{view.length}</strong><span>abilities shown</span></div>
			<div><strong>{uniqueUsers}</strong><span>Pokémon / forms</span></div>
			<div><strong>{assignmentCount}</strong><span>assignments</span></div>
			<div><strong>{customCount}</strong><span>custom abilities</span></div>
		</div>

		<p class="legend"><span class="dot hidden-dot"></span> Hidden ability user</p>
		<p class="legend"><span class="dot custom-dot"></span> Custom content</p>
		{#if customSourceError}
			<p class="warning">Standard abilities loaded. Some custom ability sources could not be refreshed: {customSourceError}</p>
		{/if}
	</aside>

	<section class="abilitydex-content">
		<div class="content-heading">
			<div>
				<h1>Ability Index</h1>
				<p>Current Poke5e abilities plus custom abilities used by Kornia content.</p>
			</div>
			<span class="result-count">{view.length} result{view.length === 1 ? "" : "s"}</span>
		</div>

		{#if loading && index.length === 0}
			<Loader caption="Loading abilities..." />
		{:else if view.length === 0}
			<div class="empty-state">
				<h2>No matching abilities</h2>
				<p>Try a different ability name, effect keyword, or Pokémon name.</p>
				<Button on:click={clear}>Clear Search</Button>
			</div>
		{:else}
			<div class="ability-list">
				{#each view as entry (entry.key)}
					<article class="ability-card" class:custom={entry.custom}>
						<div class="ability-heading">
							<div>
								<h2>{entry.name}</h2>
								{#if entry.aliases.length > 0}<p class="aliases">Also: {entry.aliases.join(", ")}</p>{/if}
							</div>
							{#if entry.custom}<span class="custom-badge">Custom</span>{/if}
						</div>

						<p class="effect">{entry.description || "No effect description provided."}</p>

						<div class="users-grid">
							<section class="user-group">
								<div class="user-heading"><h3>Normal Ability Users</h3><span>{entry.normal.length}</span></div>
								{#if entry.normal.length > 0}
									<div class="pills">
										{#each entry.normal as user (user.id)}
											<a class:custom-user={user.custom} href={user.href}>
												{user.name}{#if user.detail}<small>{user.detail}</small>{/if}
											</a>
										{/each}
									</div>
								{:else}
									<p class="none">None</p>
								{/if}
							</section>

							<section class="user-group hidden-users">
								<div class="user-heading"><h3>Hidden Ability Users</h3><span>{entry.hidden.length}</span></div>
								{#if entry.hidden.length > 0}
									<div class="pills">
										{#each entry.hidden as user (user.id)}
											<a class="hidden-user" class:custom-user={user.custom} href={user.href}>
												{user.name}{#if user.detail}<small>{user.detail}</small>{/if}
											</a>
										{/each}
									</div>
								{:else}
									<p class="none">None</p>
								{/if}
							</section>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</section>
</Page>

<style>
	aside {
		display: flex;
		flex-direction: column;
		gap: 0.9em;
		height: 100%;
	}

	aside h1,
	.content-heading h1,
	.ability-heading h2,
	.user-heading h3,
	.empty-state h2 {
		margin: 0;
	}

	.intro,
	.content-heading p,
	.aliases,
	.none,
	.legend,
	.warning {
		margin: 0;
	}

	.intro,
	.content-heading p,
	.aliases,
	.none,
	.legend {
		font-size: 0.86rem;
	}

	.sort-field {
		display: grid;
		gap: 0.3em;
	}

	.sort-field span {
		font-weight: bold;
		font-size: 0.88rem;
	}

	.sort-field select {
		box-sizing: border-box;
		width: 100%;
		padding: 0.55em 0.65em;
		border: 1px solid var(--skin-border, currentColor);
		border-radius: 0.5em;
		background: var(--skin-content);
		color: var(--skin-content-text);
		font: inherit;
	}

	.side-actions {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5em;
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5em;
	}

	.stats > div {
		display: grid;
		gap: 0.1em;
		padding: 0.65em;
		border-radius: 0.6em;
		background: var(--skin-input-bg);
	}

	.stats strong {
		font-size: 1.15rem;
	}

	.stats span {
		font-size: 0.72rem;
	}

	.legend {
		display: flex;
		align-items: center;
		gap: 0.45em;
	}

	.dot {
		width: 0.7em;
		height: 0.7em;
		border-radius: 999px;
		background: currentColor;
	}

	.hidden-dot { color: var(--skin-purple-text, #8b5cf6); }
	.custom-dot { color: var(--skin-green-text, #087f5b); }

	.warning {
		padding: 0.65em;
		border-radius: 0.6em;
		background: var(--skin-input-bg);
		font-size: 0.78rem;
	}

	.abilitydex-content {
		display: grid;
		gap: 1em;
	}

	.content-heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1em;
	}

	.result-count,
	.custom-badge,
	.user-heading span {
		flex: none;
		padding: 0.3em 0.55em;
		border-radius: 999px;
		background: var(--skin-input-bg);
		font-size: 0.75rem;
		font-weight: bold;
	}

	.ability-list {
		display: grid;
		gap: 0.8em;
	}

	.ability-card {
		display: grid;
		gap: 0.85em;
		padding: 1em;
		border: 1px solid transparent;
		border-radius: 0.85em;
		background: var(--skin-content);
	}

	.ability-card.custom {
		border-color: var(--skin-border, currentColor);
	}

	.ability-heading,
	.user-heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75em;
	}

	.ability-heading h2 {
		font-size: calc(1em + 2pt);
		font-weight: 700;
	}

	.aliases {
		margin-block-start: 0.2em;
		opacity: 0.75;
	}

	.custom-badge {
		background: var(--skin-input-bg);
	}

	.effect {
		margin: 0;
		line-height: 1.45;
	}

	.users-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75em;
	}

	.user-group {
		display: grid;
		align-content: start;
		gap: 0.55em;
		padding: 0.75em;
		border-radius: 0.7em;
		background: var(--skin-input-bg);
	}

	.user-heading h3 {
		font-size: 0.88rem;
	}

	.pills {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4em;
	}

	.pills a {
		display: inline-flex;
		align-items: center;
		gap: 0.35em;
		padding: 0.35em 0.55em;
		border: 1px solid var(--skin-border, currentColor);
		border-radius: 999px;
		background: var(--skin-content);
		color: inherit;
		font-size: 0.8rem;
		text-decoration: none;
	}

	.pills a:hover,
	.pills a:focus-visible {
		text-decoration: underline;
	}

	.pills a.hidden-user {
		border-style: dashed;
	}

	.pills a.custom-user {
		font-weight: bold;
	}

	.pills small {
		opacity: 0.68;
	}

	.empty-state {
		display: grid;
		justify-items: start;
		gap: 0.65em;
		padding: 1.2em;
		border-radius: 0.85em;
		background: var(--skin-content);
	}

	.empty-state p {
		margin: 0;
	}

	@media (max-width: 48rem) {
		.users-grid {
			grid-template-columns: 1fr;
		}

		.content-heading {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>
