<script lang="ts">
	import { browser } from "$app/environment"
	import { goto } from "$app/navigation"
	import { page } from "$app/stores"
	import { Move } from "$lib/moves/Move"
	import PokeMove from "$lib/moves/PokeMove.svelte"
	import { CustomMove, CustomMoveLocalStorage, CustomMovesStore } from "$lib/moves/custom"
	import CustomMoveEditor from "$lib/moves/custom/CustomMoveEditor.svelte"
	import { Url } from "$lib/site/url"
	import { Button, Loader } from "$lib/ui/elements"
	import { TextField } from "$lib/ui/forms"
	import { HitIcon } from "$lib/ui/icons"
	import { Page, Title } from "$lib/ui/layout"
	import { MAIN_SEARCH_ID } from "$lib/ui/layout/SkipLinks.svelte"
	import { onMount } from "svelte"

	let draft: Move | undefined
	let draftFor = ""
	let saving = false
	let error: string | undefined
	let accessKey = ""
	let accessError: string | undefined
	let canEdit = false
	let copied: "view" | "edit" | undefined

	$: selectedParam = browser ? ($page.url.searchParams.get("id") ?? "") : ""
	$: selectedId = selectedParam ? CustomMove.id(CustomMove.uuid(selectedParam)) : ""
	$: action = browser ? ($page.url.searchParams.get("action") ?? "") : ""
	$: selected = $CustomMovesStore.result?.find((it) => it.id === selectedId)
	$: sortedCustomMoves = [...($CustomMovesStore.result ?? [])]
		.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
	$: isNew = action === "new"
	$: isEditing = isNew || action === "edit"

	$: if (isNew && draftFor !== "new") {
		draft = new Move({ id: "custom:new", ...CustomMove.blank() })
		draftFor = "new"
		canEdit = true
	}

	$: if (!isNew && selected && selected.id !== draftFor) {
		draft = selected.copy()
		draftFor = selected.id
		canEdit = CustomMovesStore.canEdit(selected.id)
	}

	$: if (!selectedId && !isNew) {
		draft = undefined
		draftFor = ""
		canEdit = false
	}

	const absoluteUrl = (path: string) => browser ? new URL(path, window.location.origin).toString() : path

	$: viewUrl = selected ? absoluteUrl(Url.customMoves(selected.id)) : ""
	$: localWriteKey = selected ? CustomMoveLocalStorage.getWriteKey(CustomMove.uuid(selected.id)) : undefined
	$: editUrl = selected && localWriteKey ? absoluteUrl(Url.customMoves(selected.id, "edit", localWriteKey)) : ""

	onMount(async () => {
		try {
			await CustomMovesStore.refresh()
			const keyFromUrl = $page.url.searchParams.get("access_key")
			if (selectedParam && keyFromUrl) {
				const valid = await CustomMovesStore.verifyAccess(selectedParam, keyFromUrl)
				canEdit = valid
				if (!valid) accessError = "That edit key is not valid for this move."
			}
		} catch (e) {
			error = e instanceof Error ? e.message : String(e)
		}
	})

	const saveNew = async (event: CustomEvent<{ value: Move }>) => {
		saving = true
		error = undefined
		try {
			const created = await CustomMovesStore.create(CustomMove.toStoredData(event.detail.value))
			await goto(Url.customMoves(created.id, "edit"))
		} catch (e) {
			error = e instanceof Error ? e.message : String(e)
		} finally {
			saving = false
		}
	}

	const saveExisting = async (event: CustomEvent<{ value: Move }>) => {
		saving = true
		error = undefined
		try {
			await CustomMovesStore.update(event.detail.value)
			await goto(Url.customMoves(event.detail.value.id))
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
			canEdit = await CustomMovesStore.verifyAccess(selected.id, accessKey)
			if (!canEdit) accessError = "That edit key is not valid for this move."
		} catch (e) {
			accessError = e instanceof Error ? e.message : String(e)
		}
	}

	const remove = async () => {
		if (!selected || !browser || !confirm(`Delete ${selected.name}? This cannot be undone.`)) return
		error = undefined
		try {
			await CustomMovesStore.remove(selected.id)
			await goto(Url.customMoves())
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

<Title value="Custom Moves" />
<Page theme="blue">
	<HitIcon slot="icon" />
	<nav id={MAIN_SEARCH_ID} slot="side" aria-label="Custom Move List">
		<div class="side-heading">
			<h1>Custom Moves</h1>
			<Button variant="success" href={Url.customMoves(undefined, "new")}>+ New Move</Button>
		</div>
		<p class="intro">Campaign moves stored in Kornia's shared database. They can be selected on Fakémon and Trainer Pokémon just like published moves.</p>
		{#if $CustomMovesStore.fetching && !$CustomMovesStore.result}
			<Loader />
		{:else if $CustomMovesStore.error}
			<p class="error">{$CustomMovesStore.error.message}</p>
		{:else if ($CustomMovesStore.result?.length ?? 0) === 0}
			<p>No custom moves yet.</p>
		{:else}
			<ul class="move-list">
				{#each sortedCustomMoves as move (move.id)}
					<li class:selected={move.id === selectedId}>
						<a href={Url.customMoves(move.id)}>
							<strong>{move.name}</strong>
							<span class="type">{move.type}</span>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</nav>

	{#if error}
		<p class="error">{error}</p>
	{/if}

	{#if isNew && draft}
		<section>
			<h1>Create Custom Move</h1>
			<p>Once saved, the move becomes available in Fakémon move pools and Trainer Pokémon move selectors.</p>
			<CustomMoveEditor value={draft} disabled={saving} submitLabel={saving ? "Saving…" : "Create Move"} on:save={saveNew} />
		</section>
	{:else if selected && draft}
		<section>
			{#if isEditing}
				<div class="heading-row">
					<div>
						<h1>{selected.name}</h1>
						<p class="move-id">{selected.id}</p>
					</div>
				</div>

				{#if canEdit}
					<CustomMoveEditor value={draft} disabled={saving} submitLabel={saving ? "Saving…" : "Save Move"} on:save={saveExisting} />
				{:else}
					<div class="access-box">
						<h2>Edit Access Required</h2>
						<p>Enter this move's edit key, or open an edit link that contains the key.</p>
						<div class="access-row">
							<TextField label="Edit Key" bind:value={accessKey} />
							<Button on:click={verifyKey}>Unlock</Button>
						</div>
						{#if accessError}<p class="error">{accessError}</p>{/if}
					</div>
				{/if}
			{:else}
				<div class="view-actions">
					{#if canEdit}
						<Button href={Url.customMoves(selected.id, "edit")}>Edit Custom Move</Button>
					{/if}
				</div>
				<PokeMove move={selected} dismissToHref={Url.customMoves()} />
				<div class="share-box">
					<h2>Share</h2>
					<div class="share-row"><code>{viewUrl}</code><Button on:click={() => copyUrl("view", viewUrl)}>{copied === "view" ? "Copied" : "Copy View Link"}</Button></div>
					{#if editUrl}
						<div class="share-row"><code>{editUrl}</code><Button on:click={() => copyUrl("edit", editUrl)}>{copied === "edit" ? "Copied" : "Copy Edit Link"}</Button></div>
						<p class="warning">Anyone with the edit link can change or delete this move. Share it only with people you trust.</p>
					{/if}
				</div>
				{#if canEdit}
					<div class="danger-zone"><Button variant="danger" on:click={remove}>Delete Move</Button></div>
				{/if}
			{/if}
		</section>
	{:else if selectedId && !$CustomMovesStore.fetching}
		<section><h1>Custom Move Not Found</h1><p>The move may have been deleted, or the link may be incorrect.</p></section>
	{:else if !selectedId && !isNew}
		<section>
			<h1>Custom Moves</h1>
			<p>Create reusable campaign moves here. Custom moves are stored centrally, so everyone using the Kornia site sees the same move definition.</p>
			<p>Select a move from the list, or create a new one.</p>
		</section>
	{/if}
</Page>

<style>
	nav { display: flex; flex-direction: column; height: 100%; overflow: auto; }
	.side-heading, .heading-row, .share-row, .access-row { display: flex; gap: 0.75rem; align-items: center; }
	.side-heading { justify-content: space-between; }
	.side-heading h1 { margin: 0; }
	.intro { font-size: var(--font-sz-venus); opacity: 0.8; }
	.move-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.25rem; }
	.move-list a { display: flex; justify-content: space-between; gap: 0.75rem; padding: 0.5rem 0.75rem; text-decoration: none; color: inherit; background: var(--skin-content); border-radius: 0.25rem; }
	.move-list li.selected a, .move-list a:hover, .move-list a:focus { background: var(--skin-input-bg); }
	.type { text-transform: capitalize; opacity: 0.75; }
	section { height: 100%; overflow: auto; padding: 0.5rem; }
	.heading-row { justify-content: space-between; align-items: flex-start; }
	.view-actions { display: flex; justify-content: flex-end; margin-bottom: 0.75rem; }
	.move-id { font-size: var(--font-sz-mars); opacity: 0.65; margin-top: -0.5rem; }
	.access-box, .share-box { background: var(--skin-content); padding: 1rem; border-radius: 0.5rem; margin-block: 1rem; }
	.share-row { margin-block: 0.5rem; align-items: flex-start; }
	.share-row code { flex: 1; overflow-wrap: anywhere; padding: 0.5rem; background: var(--skin-input-bg); }
	.warning, .error { color: var(--skin-danger-text, currentColor); font-weight: bold; }
	.danger-zone { display: flex; justify-content: flex-end; margin-block: 2rem; }
	@media (max-width: 37.5rem) {
		.share-row, .access-row { flex-direction: column; align-items: stretch; }
	}
</style>
