<script lang="ts">
	import { createEventDispatcher } from "svelte"
	import {
		allArenaPositions,
		movementDistanceFeet,
		spawnPositions,
		TRAINER_BATTLE_ARENA_COLUMNS,
		TRAINER_BATTLE_ARENA_ROWS,
	} from "./arena"
	import type { HexPosition, TrainerBattleFormat, TrainerBattleSide } from "./types"

	type BattleBoardUnit = {
		id: string,
		label: string,
		side: TrainerBattleSide,
		position: HexPosition,
		movementRemainingFeet: number,
		avatarHref?: string,
		owned: boolean,
	}

	export let format: TrainerBattleFormat
	export let units: BattleBoardUnit[] = []
	export let currentTurnPokemonId: string | null = null
	export let interactive = false

	const dispatch = createEventDispatcher<{ move: { pokemonId: string, position: HexPosition } }>()
	const HEX_SIZE = 29
	const X_STEP = HEX_SIZE * 1.5
	const Y_STEP = Math.sqrt(3) * HEX_SIZE
	const MARGIN = HEX_SIZE * 1.35
	const viewWidth = MARGIN * 2 + X_STEP * (TRAINER_BATTLE_ARENA_COLUMNS - 1) + HEX_SIZE * 2
	const viewHeight = MARGIN * 2 + Y_STEP * (TRAINER_BATTLE_ARENA_ROWS - 0.5) + HEX_SIZE
	const cells = allArenaPositions()

	let selectedId: string | null = null

	$: selectedUnit = selectedId == null ? undefined : units.find((unit) => unit.id === selectedId)
	$: occupied = new Set(units.map((unit) => `${unit.position.q}:${unit.position.r}`))

	function center(position: HexPosition): { x: number, y: number } {
		return {
			x: MARGIN + HEX_SIZE + position.q * X_STEP,
			y: MARGIN + HEX_SIZE + position.r * Y_STEP + (position.q % 2 === 1 ? Y_STEP / 2 : 0),
		}
	}

	function polygonPoints(position: HexPosition): string {
		const { x, y } = center(position)
		return Array.from({ length: 6 }, (_, index) => {
			const angle = Math.PI / 180 * (index * 60)
			return `${x + HEX_SIZE * Math.cos(angle)},${y + HEX_SIZE * Math.sin(angle)}`
		}).join(" ")
	}

	function key(position: HexPosition): string {
		return `${position.q}:${position.r}`
	}

	function isSpawn(position: HexPosition, side: TrainerBattleSide): boolean {
		return spawnPositions(format, side).some((spawn) => spawn.q === position.q && spawn.r === position.r)
	}

	function canControl(unit: BattleBoardUnit): boolean {
		return interactive && unit.owned && unit.id === currentTurnPokemonId
	}

	function canReach(position: HexPosition): boolean {
		if (!selectedUnit || !canControl(selectedUnit)) return false
		if (selectedUnit.position.q === position.q && selectedUnit.position.r === position.r) return true
		if (occupied.has(key(position))) return false
		return movementDistanceFeet(selectedUnit.position, position) <= selectedUnit.movementRemainingFeet
	}

	function selectUnit(unit: BattleBoardUnit) {
		if (canControl(unit)) selectedId = unit.id
	}

	function moveSelected(position: HexPosition) {
		if (!selectedUnit || !canReach(position)) return
		if (selectedUnit.position.q === position.q && selectedUnit.position.r === position.r) {
			selectedId = null
			return
		}
		dispatch("move", { pokemonId: selectedUnit.id, position })
		selectedId = null
	}

	function shortLabel(label: string): string {
		const trimmed = label.trim()
		return trimmed.length <= 3 ? trimmed.toUpperCase() : trimmed.slice(0, 2).toUpperCase()
	}
</script>

<div class="board-shell">
	<svg class="battle-board" viewBox={`0 0 ${viewWidth} ${viewHeight}`} role="img" aria-label="Trainer Battle arena">
		{#each cells as cell}
			<polygon
				points={polygonPoints(cell)}
				class:reachable={canReach(cell)}
				class:spawn-a={isSpawn(cell, "a")}
				class:spawn-b={isSpawn(cell, "b")}
				on:pointerup={() => moveSelected(cell)}
			>
				<title>Hex {cell.q + 1}, {cell.r + 1}</title>
			</polygon>
		{/each}

		{#each units as unit}
			{@const point = center(unit.position)}
			<g
				class="token"
				class:owned={unit.owned}
				class:turn={unit.id === currentTurnPokemonId}
				class:movable={canControl(unit)}
				on:pointerdown|stopPropagation={() => selectUnit(unit)}
			>
				<circle cx={point.x} cy={point.y} r={HEX_SIZE * .64} class={`token-bg side-${unit.side}`} />
				{#if unit.avatarHref}
					<image href={unit.avatarHref} x={point.x - HEX_SIZE * .55} y={point.y - HEX_SIZE * .55} width={HEX_SIZE * 1.1} height={HEX_SIZE * 1.1} preserveAspectRatio="xMidYMid meet" />
				{:else}
					<text x={point.x} y={point.y + 5} text-anchor="middle">{shortLabel(unit.label)}</text>
				{/if}
				<title>{unit.label}</title>
			</g>
		{/each}
	</svg>
</div>

<p class="board-help">Each hex is 5 ft. On your Pokémon's turn, press or click its token and release/click on a highlighted hex to move it.</p>

<style>
	.board-shell {
		inline-size: 100%;
		overflow: auto;
		border: 2px solid var(--skin-bg-dark);
		border-radius: .75rem;
		background: var(--skin-content);
	}

	.battle-board {
		display: block;
		inline-size: max(48rem, 100%);
		block-size: auto;
		touch-action: none;
		user-select: none;
	}

	polygon {
		fill: var(--skin-input-bg);
		stroke: var(--skin-content-text);
		stroke-width: 1.15;
		transition: fill .1s ease, stroke-width .1s ease;
	}

	polygon.spawn-a { fill: color-mix(in srgb, var(--skin-input-bg) 78%, #4ca7ff); }
	polygon.spawn-b { fill: color-mix(in srgb, var(--skin-input-bg) 78%, #ff6d6d); }
	polygon.reachable {
		fill: color-mix(in srgb, var(--skin-input-bg) 58%, #8be38b);
		stroke-width: 2;
		cursor: pointer;
	}

	.token { pointer-events: all; }
	.token.movable { cursor: grab; }
	.token.movable:active { cursor: grabbing; }
	.token-bg { stroke: var(--skin-bg-dark); stroke-width: 2.5; }
	.token-bg.side-a { fill: #69afff; }
	.token-bg.side-b { fill: #ff8585; }
	.token.turn .token-bg { stroke-width: 5; }
	.token text { font-weight: 800; font-size: 13px; fill: #111; pointer-events: none; }
	.token image { pointer-events: none; }

	.board-help { margin-block: .5rem 0; font-size: .9em; font-style: italic; }
</style>
