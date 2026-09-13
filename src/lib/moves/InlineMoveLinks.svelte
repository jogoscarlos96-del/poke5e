<script lang="ts">
	import { MovesStore as allMoves } from "./store"
	import { CustomMove } from "./custom"
	import { Url } from "$lib/site/url"

	export let moves: string[]

	const name = (m: string) => $allMoves.result?.find(it => it.id === m)?.name
	const href = (m: string) => CustomMove.isCustom(m) ? Url.customMoves(m) : Url.moves(m)
</script>

{#if $allMoves.result !== undefined}
	<ul>
		{#each moves as move}
			<li><a href={href(move)}>{name(move)}</a></li>
		{/each}
	</ul>
{:else}
	<span class="loading" aria-label="Loading">...</span>
{/if}

<style>
	ul {
		list-style: none;
		display: inline;
		padding: 0;
		margin: 0;
	}

	li {
		display: inline;
	}

	li::after {
		content: ', '
	}

	li:last-child::after {
		display: none;
	}

	.loading {
		opacity: 0.5;
	}
</style>