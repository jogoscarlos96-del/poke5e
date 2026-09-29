<script lang="ts">
	import { Card } from "$lib/ui/page"
	import { Button } from "$lib/ui/elements"
	import type { TrainerStore } from "./trainers"
	import { goto } from "$app/navigation"
	import { Title } from "$lib/ui/layout"
	import { PokemonSpecies, SpeciesField } from "$lib/poke5e/species"
	import { SearchFakemonById, type SearchFakemonByIdDetail } from "$lib/fakemon/search"
	import type { Fakemon } from "$lib/fakemon"
	import type { Readable } from "svelte/store"
	import { Url } from "$lib/site/url"
	import SearchByTransferCode from "./pokemon-transfer/SearchByTransferCode.svelte"
	import type { TransferCode } from "./pokemon-transfer"
	import { ActionArea } from "$lib/ui/forms"
	import { m } from "$lib/site/i18n"
	import { SafariCaptureCode, type SafariCaptureCode as SafariCaptureCodeType } from "$lib/safari"

	export let trainer: TrainerStore
	export let allSpecies: Readable<PokemonSpecies[]>
	$: canAdd = $trainer.update != null
	$: readKey = $trainer.info.readKey

	let saving = false
	const onSelect = (p: PokemonSpecies) => () => {
		saving = true
		$trainer.update?.addToTeam(p).then(({ id }) => {
			goto(Url.trainers(readKey, id))
		}).catch(() => {
			saving = false
		})
	}

	let fakemon: Fakemon
	const onFakemonSearch = (e: CustomEvent<SearchFakemonByIdDetail>) => {
		fakemon = e.detail.value
	}

	let transferError: string | undefined = undefined
	const onTransferSubmit = (code: TransferCode) => {
		saving = true
		transferError = undefined
		$trainer.update?.acceptTransfer(code).then((pokemon) => {
			goto(Url.trainers(readKey, pokemon.id))
		}).catch(() => {
			saving = false
			transferError = "Could not find pokemon by transfer code"
		})
	}

	let safariCode = ""
	let safariError: string | undefined = undefined
	const onSafariSubmit = () => {
		const code = SafariCaptureCode.from(safariCode)
		if (!SafariCaptureCode.isValid(code)) {
			safariError = "Enter a Safari Capture Code in the format S.XXXXXXXXXXXXX."
			return
		}

		saving = true
		safariError = undefined
		$trainer.update?.redeemSafariCapture(code as SafariCaptureCodeType).then((pokemon) => {
			goto(Url.trainers(readKey, pokemon.id))
		}).catch(() => {
			saving = false
			safariError = "This Safari Capture Code is invalid or has already been redeemed."
		})
	}
</script>

<Title value="Add Pokemon" />
<Card title="Add to {$trainer.info.name}'s team">
	{#if canAdd}
		<section>
			<p>Start typing the pokemon's species, then select from the provided list.</p>
			<div class="font-lg">
				<SpeciesField label="Species" value="" name="species" allSpecies={$allSpecies} disabled={saving} on:change={(e) => onSelect(e.detail.species)()} explicitSubmit required />
			</div>
		</section>
		<section>
			<h2>Fakémon ID</h2>
			<p>Or you can add a <a href="{Url.fakemon()}">Fakémon</a> by its ID.</p>
			<SearchFakemonById on:found={onFakemonSearch} />
			<div class="min-height">
				{#if fakemon != null}
					<p class="font-lg">
						<Button on:click={onSelect(fakemon.species)}>{fakemon.species.data.name}</Button>
					</p>
				{/if}
			</div>
		</section>
		<section>
			<h2>Transfer Code</h2>
			<p>Or, you can accept a pokemon from another trainer using a Transfer Code.</p>
			<SearchByTransferCode onsubmit={onTransferSubmit} error={transferError} searching={saving} />
			<div class="min-height"></div>
		</section>
		<section>
			<h2>Safari Capture Code</h2>
			<p>Redeem a one-use <code>S.</code> code earned in the Safari Zone.</p>
			<form class="code-row" on:submit|preventDefault={onSafariSubmit}>
				<label for="safari-capture-code">Safari Capture Code</label>
				<input
					id="safari-capture-code"
					type="text"
					maxlength="15"
					placeholder="S.7KD4QPX82MZ1A"
					bind:value={safariCode}
					disabled={saving}
				/>
				<Button type="submit" disabled={saving}>Redeem Safari Capture</Button>
			</form>
			{#if safariError}<p class="error">{safariError}</p>{/if}
		</section>
	{:else}
		<section>
			<p>You do not have permission to add pokemon to this trainer.</p>
		</section>
	{/if}
	<ActionArea>
		<Button href={Url.trainers($trainer.info.readKey)} variant="subtle">{m.back()}</Button>
	</ActionArea>
</Card>

<style>
	.font-lg {
		font-size: var(--font-sz-neptune);
	}

	.min-height {
		min-block-size: 3em;
	}

	.code-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.5rem;
		align-items: end;
	}

	.code-row label {
		grid-column: 1;
		font-weight: bold;
	}

	.code-row input {
		grid-column: 1;
		min-height: 2.25rem;
	}

	.code-row :global(.button) {
		grid-column: 2;
		grid-row: 2;
	}

	.error {
		font-weight: bold;
		color: var(--skin-danger-text, currentColor);
	}

	@media (max-width: 36rem) {
		.code-row {
			grid-template-columns: 1fr;
		}

		.code-row :global(.button) {
			grid-column: 1;
			grid-row: auto;
		}
	}
</style>