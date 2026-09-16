<script lang="ts">
	import { browser } from "$app/environment"
	import { goto } from "$app/navigation"
	import { page } from "$app/stores"
	import { SpeciesStore, type PokemonSpecies } from "$lib/poke5e/species"
	import MegaDefinitionEditor from "$lib/pokemon/mega/MegaDefinitionEditor.svelte"
	import { MegaDefinitionsStore, type DraftMegaDefinition, type MegaDefinition } from "$lib/pokemon/mega"
	import { CampaignCreationAccess } from "$lib/site/CampaignCreationAccess"
	import { Url } from "$lib/site/url"
	import { Button, Loader } from "$lib/ui/elements"
	import { TextField, type ImageInputValue } from "$lib/ui/forms"
	import { GreatballIcon } from "$lib/ui/icons"
	import { Page, Title } from "$lib/ui/layout"
	import { MAIN_SEARCH_ID } from "$lib/ui/layout/SkipLinks.svelte"
	import { onMount } from "svelte"
	import type { Unsubscriber } from "svelte/store"

	type SaveEvent = CustomEvent<{
		value: DraftMegaDefinition,
		portrait?: ImageInputValue,
		sprite?: ImageInputValue,
	}>

	let allSpecies: PokemonSpecies[] = []
	let speciesUnsubscribe: Unsubscriber | undefined
	let saving = false
	let error: string | undefined
	let accessKey = ""
	let accessError: string | undefined
	let accessFor = ""
	let previousSelectedId = ""
	let copied: "view" | "edit" | undefined
	let search = ""
	let speciesNames = new Map<string, string>()
	let creationUnlocked = browser && CampaignCreationAccess.isUnlocked()
	let creationPassword = ""
	let creationAccessError: string | undefined

	$: selectedId = browser ? ($page.url.searchParams.get("id") ?? "") : ""
	$: action = browser ? ($page.url.searchParams.get("action") ?? "") : ""
	$: selected = $MegaDefinitionsStore.result?.find((definition) => definition.id === selectedId)
	$: isNew = action === "new"
	$: isEditing = !isNew && action === "edit"
	$: canEdit = selected ? (MegaDefinitionsStore.canEdit(selected.id) || accessFor === selected.id) : isNew
	$: speciesNames = new Map(allSpecies.map((species) => [species.id.data, species.name]))
	$: sortedDefinitions = [...($MegaDefinitionsStore.result ?? [])]
		.sort((a, b) => {
			const aSpecies = speciesNames.get(a.speciesId) ?? a.speciesId
			const bSpecies = speciesNames.get(b.speciesId) ?? b.speciesId
			const speciesCompare = aSpecies.localeCompare(bSpecies, undefined, { sensitivity: "base" })
			return speciesCompare || a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
		})
	$: normalizedSearch = search.trim().toLocaleLowerCase()
	$: filteredDefinitions = normalizedSearch
		? sortedDefinitions.filter((definition) => {
			const baseSpecies = speciesNames.get(definition.speciesId) ?? definition.speciesId
			return `${definition.name} ${baseSpecies}`.toLocaleLowerCase().includes(normalizedSearch)
		})
		: sortedDefinitions

	$: if (selectedId !== previousSelectedId) {
		previousSelectedId = selectedId
		accessFor = ""
		accessKey = ""
		accessError = undefined
	}

	const speciesName = (speciesId: string): string => speciesNames.get(speciesId) ?? speciesId
	const absoluteUrl = (path: string) => browser ? new URL(path, window.location.origin).toString() : path
	$: viewUrl = selected ? absoluteUrl(Url.megaEvolutions(selected.id)) : ""
	$: localWriteKey = selected ? MegaDefinitionsStore.getWriteKey(selected.id) : undefined
	$: editUrl = selected && localWriteKey ? absoluteUrl(Url.megaEvolutions(selected.id, "edit", localWriteKey)) : ""

	onMount(() => {
		creationUnlocked = CampaignCreationAccess.isUnlocked()
		void (async () => {
			try {
				await MegaDefinitionsStore.refresh()
				const speciesStore = await SpeciesStore.completeList()
				speciesUnsubscribe = speciesStore.subscribe((value) => { allSpecies = value ?? [] })

				const keyFromUrl = $page.url.searchParams.get("access_key")
				const idFromUrl = $page.url.searchParams.get("id")
				if (idFromUrl && keyFromUrl) {
					const valid = await MegaDefinitionsStore.verifyAccess(idFromUrl, keyFromUrl)
					if (valid) accessFor = idFromUrl
					else accessError = "That edit key is not valid for this Mega Evolution."
				}
			} catch (e) {
				error = e instanceof Error ? e.message : String(e)
			}
		})()

		return () => speciesUnsubscribe?.()
	})

	const unlockCreation = async () => {
		creationAccessError = undefined
		const valid = await CampaignCreationAccess.unlock(creationPassword)
		if (valid) {
			creationUnlocked = true
			creationPassword = ""
		} else {
			creationAccessError = "Incorrect campaign creation password."
		}
	}

	const hasMediaChange = (event: SaveEvent) => event.detail.portrait != null || event.detail.sprite != null

	const saveNew = async (event: SaveEvent) => {
		if (!CampaignCreationAccess.isUnlocked()) {
			creationUnlocked = false
			error = "Creation access is locked."
			return
		}

		saving = true
		error = undefined
		try {
			const created = await MegaDefinitionsStore.create(event.detail.value)
			if (hasMediaChange(event)) {
				await MegaDefinitionsStore.updateMedia(created.id, {
					portrait: event.detail.portrait,
					sprite: event.detail.sprite,
				})
			}
			await goto(Url.megaEvolutions(created.id))
		} catch (e) {
			error = e instanceof Error ? e.message : String(e)
		} finally {
			saving = false
		}
	}

	const saveExisting = async (event: SaveEvent) => {
		if (!selected) return
		saving = true
		error = undefined
		try {
			const updated: MegaDefinition = { ...selected, ...event.detail.value }
			const saved = await MegaDefinitionsStore.update(updated)
			if (!saved) throw new Error("The Mega Evolution could not be updated.")
			if (hasMediaChange(event)) {
				await MegaDefinitionsStore.updateMedia(selected.id, {
					portrait: event.detail.portrait,
					sprite: event.detail.sprite,
				})
			}
			await goto(Url.megaEvolutions(selected.id))
		} catch (e) {
			error = e instanceof Error ? e.message : String(e)
		} finally {
			saving = false
		}
	}

	const verifyKey = async () => {
		if (!selected) return
		accessError = undefined
		try {
			const valid = await MegaDefinitionsStore.verifyAccess(selected.id, accessKey)
			if (valid) accessFor = selected.id
			else accessError = "That edit key is not valid for this Mega Evolution."
		} catch (e) {
			accessError = e instanceof Error ? e.message : String(e)
		}
	}

	const remove = async () => {
		if (!selected || !browser || !confirm(`Delete ${selected.name}? Pokémon using it will have their Mega selection cleared.`)) return
		error = undefined
		try {
			const removed = await MegaDefinitionsStore.remove(selected.id)
			if (!removed) throw new Error("The Mega Evolution could not be deleted.")
			await goto(Url.megaEvolutions())
		} catch (e) {
			error = e instanceof Error ? e.message : String(e)
		}
	}

	const copyUrl = async (kind: "view" | "edit", value: string) => {
		if (!browser || !value) return
		await navigator.clipboard.writeText(value)
		copied = kind
		setTimeout(() => { copied = undefined }, 1500)
	}
</script>

<Title value="Mega Evolutions" />
<Page theme="purple">
	<GreatballIcon slot="icon" />
	<nav id={MAIN_SEARCH_ID} slot="side" aria-label="Mega Evolution List">
		<div class="side-heading">
			<h1>Mega Evolutions</h1>
			<Button variant="success" href={Url.megaEvolutions(undefined, "new")}>+ New Mega</Button>
		</div>
		<p class="intro">Reusable Mega definitions shared across every Trainer Pokémon of the linked base species.</p>
		<TextField label="Search" bind:value={search} placeholder="Name or species" />

		{#if $MegaDefinitionsStore.fetching && !$MegaDefinitionsStore.result}
			<Loader />
		{:else if $MegaDefinitionsStore.error}
			<p class="error">{$MegaDefinitionsStore.error.message}</p>
		{:else if ($MegaDefinitionsStore.result?.length ?? 0) === 0}
			<p>No Mega Evolutions yet.</p>
		{:else if filteredDefinitions.length === 0}
			<p>No Mega Evolutions match that search.</p>
		{:else}
			<ul class="mega-list">
				{#each filteredDefinitions as definition (definition.id)}
					<li class:selected={definition.id === selectedId}>
						<a href={Url.megaEvolutions(definition.id)}>
							<strong>{definition.name}</strong>
							<span>{speciesName(definition.speciesId)}</span>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</nav>

	{#if error}<p class="error">{error}</p>{/if}

	{#if isNew}
		<section>
			<h1>Create Mega Evolution</h1>
			{#if !creationUnlocked}
				<div class="access-box creation-gate">
					<h2>Creation Access Required</h2>
					<p>Enter the campaign creation password to create Custom Moves or Mega Evolutions. This browser will stay unlocked after a successful entry.</p>
					<form class="access-row" on:submit|preventDefault={unlockCreation}>
						<div class="password-field">
							<label for="mega-creation-password">Campaign Password</label>
							<input id="mega-creation-password" type="password" bind:value={creationPassword} autocomplete="current-password" />
						</div>
						<Button type="submit">Unlock Creation</Button>
					</form>
					{#if creationAccessError}<p class="error">{creationAccessError}</p>{/if}
				</div>
			{:else}
				<p>Create the form once and link it to a base species. Every eligible Trainer Pokémon of that species can then select it.</p>
				{#if allSpecies.length === 0}
					<Loader />
				{:else}
					<MegaDefinitionEditor {allSpecies} disabled={saving} submitLabel={saving ? "Saving…" : "Create Mega Evolution"} on:save={saveNew} />
				{/if}
			{/if}
		</section>
	{:else if selected}
		<section>
			{#if isEditing}
				<h1>Edit {selected.name}</h1>
				{#if canEdit}
					{#if allSpecies.length === 0}
						<Loader />
					{:else}
						{#key selected.id}
							<MegaDefinitionEditor value={selected} {allSpecies} disabled={saving} submitLabel={saving ? "Saving…" : "Save Mega Evolution"} on:save={saveExisting} />
						{/key}
					{/if}
				{:else}
					<div class="access-box">
						<h2>Edit Access Required</h2>
						<p>Enter this Mega Evolution's edit key, or open an edit link that contains the key.</p>
						<div class="access-row">
							<TextField label="Edit Key" bind:value={accessKey} />
							<Button on:click={verifyKey}>Unlock</Button>
						</div>
						{#if accessError}<p class="error">{accessError}</p>{/if}
					</div>
				{/if}
			{:else}
				<div class="heading-row">
					<div>
						<h1>{selected.name}</h1>
						<p class="species-name">Base species: <strong>{speciesName(selected.speciesId)}</strong></p>
					</div>
					{#if canEdit}<Button href={Url.megaEvolutions(selected.id, "edit")}>Edit Mega Evolution</Button>{/if}
				</div>

				<div class="definition-grid">
					<div class="definition-card">
						<h2>Overrides</h2>
						<dl>
							<div><dt>Type</dt><dd>{selected.type?.toString() ?? "Use base Pokémon"}</dd></div>
							<div><dt>Ability</dt><dd>{selected.ability?.name ?? "Use base Pokémon"}</dd></div>
						</dl>
						{#if selected.ability?.custom && selected.ability.description}
							<p>{selected.ability.description}</p>
						{/if}
					</div>
					<div class="definition-card">
						<h2>Portrait</h2>
						{#if selected.portrait}<img src={selected.portrait.href} alt="{selected.name} portrait" />{:else}<p>Uses the base Pokémon portrait.</p>{/if}
					</div>
					<div class="definition-card">
						<h2>Sprite</h2>
						{#if selected.sprite}<img class="sprite" src={selected.sprite.href} alt="{selected.name} sprite" />{:else}<p>Uses the base Pokémon sprite.</p>{/if}
					</div>
				</div>

				<div class="share-box">
					<h2>Share</h2>
					<div class="share-row"><code>{viewUrl}</code><Button on:click={() => copyUrl("view", viewUrl)}>{copied === "view" ? "Copied" : "Copy View Link"}</Button></div>
					{#if editUrl}
						<div class="share-row"><code>{editUrl}</code><Button on:click={() => copyUrl("edit", editUrl)}>{copied === "edit" ? "Copied" : "Copy Edit Link"}</Button></div>
						<p class="warning">Anyone with the edit link can change or delete this Mega Evolution. Share it only with people you trust.</p>
					{/if}
				</div>

				{#if canEdit}<div class="danger-zone"><Button variant="danger" on:click={remove}>Delete Mega Evolution</Button></div>{/if}
			{/if}
		</section>
	{:else if selectedId && !$MegaDefinitionsStore.fetching}
		<section><h1>Mega Evolution Not Found</h1><p>The definition may have been deleted, or the link may be incorrect.</p></section>
	{:else if !selectedId && !isNew}
		<section>
			<h1>Mega Evolutions</h1>
			<p>Create reusable Mega Evolution definitions here, then select them on eligible Trainer Pokémon of the linked species.</p>
			<p>Portrait and sprite are stored separately, so each presentation can use the appropriate artwork.</p>
		</section>
	{/if}
</Page>

<style>
	nav { display: flex; flex-direction: column; gap: 0.75rem; height: 100%; overflow: auto; }
	.side-heading, .heading-row, .share-row, .access-row { display: flex; gap: 0.75rem; align-items: center; }
	.side-heading, .heading-row { justify-content: space-between; }
	.side-heading h1, .heading-row h1 { margin: 0; }
	.intro { font-size: var(--font-sz-venus); opacity: 0.8; margin: 0; }
	.mega-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.25rem; }
	.mega-list a { display: flex; flex-direction: column; gap: 0.125rem; padding: 0.5rem 0.75rem; text-decoration: none; color: inherit; background: var(--skin-content); border-radius: 0.25rem; }
	.mega-list a span { font-size: var(--font-sz-venus); opacity: 0.75; }
	.mega-list li.selected a, .mega-list a:hover, .mega-list a:focus { background: var(--skin-input-bg); }
	section { height: 100%; overflow: auto; padding: 0.5rem; }
	.species-name { opacity: 0.8; }
	.definition-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; margin-block: 1rem; }
	.definition-card, .access-box, .share-box { background: var(--skin-content); padding: 1rem; border-radius: 0.5rem; }
	.definition-card h2, .share-box h2, .access-box h2 { margin-top: 0; }
	.definition-card img { display: block; max-width: 100%; max-height: 20rem; margin-inline: auto; object-fit: contain; }
	.definition-card img.sprite { image-rendering: pixelated; max-height: 12rem; }
	dl { margin: 0; }
	dl div { display: grid; grid-template-columns: 5rem 1fr; gap: 0.75rem; margin-block: 0.5rem; }
	dt { font-weight: bold; }
	dd { margin: 0; }
	.access-box, .share-box { margin-block: 1rem; }
	.creation-gate { max-width: 36rem; }
	.password-field { flex: 1; display: flex; flex-direction: column; gap: 0.125rem; }
	.password-field label { font-weight: bold; font-size: var(--font-sz-venus); letter-spacing: -0.04em; }
	.password-field input { inline-size: 100%; }
	.share-row { margin-block: 0.5rem; align-items: flex-start; }
	.share-row code { flex: 1; overflow-wrap: anywhere; padding: 0.5rem; background: var(--skin-input-bg); }
	.warning, .error { color: var(--skin-danger-text, currentColor); font-weight: bold; }
	.danger-zone { display: flex; justify-content: flex-end; margin-block: 2rem; }
	@media (max-width: 50rem) {
		.definition-grid { grid-template-columns: 1fr; }
	}
	@media (max-width: 37.5rem) {
		.heading-row, .share-row, .access-row { flex-direction: column; align-items: stretch; }
	}
</style>
