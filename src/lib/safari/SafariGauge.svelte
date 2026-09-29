<script lang="ts">
	import { createEventDispatcher } from "svelte"
	import { SAFARI_GAUGE_VALUES } from "./rules"
	import type { SafariGaugeValue } from "./types"

	export let value: SafariGaugeValue = 0
	export let disabled = false

	const dispatch = createEventDispatcher<{ change: { value: SafariGaugeValue } }>()

	const choose = (next: SafariGaugeValue) => {
		if (disabled) return
		dispatch("change", { value: next })
	}
</script>

<div class="safari-gauge" aria-label="Safari Gauge">
	<div class="gauge-title">Safari Gauge</div>
	<div class="gauge-shell">
		<div class="track" aria-hidden="true"></div>
		<div class="points">
			{#each SAFARI_GAUGE_VALUES as point}
				<button
					type="button"
					class:active={point === value}
					class:center={point === 0}
					class:negative={point < 0}
					class:positive={point > 0}
					aria-pressed={point === value}
					aria-label="Set Safari Gauge to {point}"
					on:click={() => choose(point)}
					{disabled}
				>
					<span>{point}</span>
				</button>
			{/each}
		</div>
	</div>
</div>

<style>
	.safari-gauge {
		--cream: #f2e0b8;
		--cream-dark: #b98f5d;
		--brown: #9b5636;
		--orange: #cf7a3e;
		--yellow: #d8ba42;
		--green: #7ea943;
		--teal: #3e9c79;
		position: relative;
		max-width: 48rem;
		margin-inline: auto;
		padding: 2.45rem 1rem 1.15rem;
		border: 0.35rem solid var(--cream-dark);
		border-radius: 1.35rem;
		background:
			radial-gradient(circle at 9% 20%, rgb(255 255 255 / 0.35) 0 0.28rem, transparent 0.32rem),
			linear-gradient(180deg, #fff1cf, var(--cream));
		box-shadow:
			inset 0 0 0 0.18rem rgb(255 255 255 / 0.45),
			0 0.35rem 0.8rem rgb(68 41 16 / 0.2);
	}

	.gauge-title {
		position: absolute;
		inset: -1.15rem auto auto 50%;
		transform: translateX(-50%);
		padding: 0.45rem 1.35rem;
		border: 0.24rem solid var(--cream-dark);
		border-radius: 0.85rem;
		background: linear-gradient(180deg, #fff4d6, #dfbe83);
		color: #5b3e29;
		font-weight: 900;
		letter-spacing: 0.02em;
		box-shadow: inset 0 0 0 0.12rem rgb(255 255 255 / 0.55);
		white-space: nowrap;
	}

	.gauge-shell {
		position: relative;
		padding: 0.45rem;
	}

	.track {
		position: absolute;
		inset: 50% 3% auto;
		height: 1.25rem;
		transform: translateY(-50%);
		border: 0.2rem solid #76543b;
		border-radius: 999px;
		background: linear-gradient(
			90deg,
			var(--brown) 0%,
			var(--orange) 25%,
			var(--yellow) 38%,
			var(--green) 58%,
			var(--teal) 100%
		);
		box-shadow: inset 0 0.15rem 0.2rem rgb(255 255 255 / 0.28);
	}

	.points {
		position: relative;
		z-index: 1;
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		align-items: center;
		gap: 0.2rem;
	}

	button {
		justify-self: center;
		display: grid;
		place-items: center;
		inline-size: 2.65rem;
		block-size: 2.65rem;
		padding: 0;
		border: 0.2rem solid #76543b;
		border-radius: 50%;
		background: #d7ba62;
		color: #3f3224;
		font: inherit;
		font-weight: 900;
		cursor: pointer;
		box-shadow:
			inset 0 0 0 0.14rem rgb(255 255 255 / 0.42),
			0 0.12rem 0.2rem rgb(57 37 19 / 0.28);
		transition: transform 120ms ease, box-shadow 120ms ease, filter 120ms ease;
	}

	button.negative { background: #bf7544; }
	button.positive { background: #69a86a; }
	button:nth-child(n + 6) { background: #54a681; }

	button.center {
		inline-size: 3.45rem;
		block-size: 3.45rem;
		border-width: 0.26rem;
		background: #d7be49;
		font-size: 1.2rem;
	}

	button:hover:not(:disabled),
	button:focus-visible:not(:disabled) {
		transform: translateY(-0.1rem) scale(1.05);
	}

	button.active {
		transform: scale(1.12);
		filter: saturate(1.18) brightness(1.06);
		box-shadow:
			inset 0 0 0 0.14rem rgb(255 255 255 / 0.65),
			0 0 0 0.2rem rgb(255 255 255 / 0.95),
			0 0 0.75rem 0.38rem rgb(255 238 151 / 0.95),
			0 0 1.35rem 0.55rem rgb(255 242 179 / 0.65);
	}

	button.active::after {
		content: "";
		position: absolute;
		inline-size: 0.48rem;
		block-size: 0.48rem;
		border-radius: 50%;
		background: white;
		transform: translate(0.72rem, -0.72rem);
		box-shadow: 0 0 0.55rem white;
	}

	button:disabled { cursor: default; }

	@media (max-width: 34rem) {
		.safari-gauge { padding-inline: 0.35rem; }
		.points { gap: 0; }
		button { inline-size: 2.15rem; block-size: 2.15rem; font-size: 0.8rem; }
		button.center { inline-size: 2.75rem; block-size: 2.75rem; }
	}
</style>
