import { derived, type Readable } from "svelte/store"
import type { ContestEffectListJson } from "$lib/srd/contest-effects/schema"
import type { ContestListJson } from "$lib/srd/contest/schema"
import type { MovesListJson } from "$lib/srd/moves/schema"
import type { TmListJson } from "$lib/srd/tms/schema"
import type { Fetched } from "$lib/site/stores"
import { srdStore } from "$lib/site/stores"
import { Move } from "./Move"
import { CustomMovesStore } from "./custom"

const toMoves = ([moves, contests, effects, tms]: [MovesListJson, ContestListJson, ContestEffectListJson, TmListJson]): Move[] => {
	const contestByMove = new Map(contests.values.map((it) => [it.id, it]))
	const effectById = new Map(effects.values.map((it) => [it.id, it]))
	const tmByMove = new Map(tms.values.map((it) => [it.move, it]))

	return moves.values.map((move) => {
		const contest = contestByMove.get(move.id)

		return Move.fromJson(move, {
			contest: contest,
			contestEffect: contest != null ? effectById.get(contest.effect) : undefined,
			tm: tmByMove.get(move.id),
		})
	})
}

/** Published Poke5e moves only. Use this for the canonical /moves reference page. */
export const OfficialMovesStore = srdStore((client) =>
	Promise.all([
		client.moves.all(),
		client.contest.all(),
		client.contestEffects.all(),
		client.tms.all(),
	]).then(toMoves),
)

/**
 * Gameplay catalogue. Trainer sheets, Fakemon move pools, leveling, and other
 * tools use this so custom moves behave like ordinary moves everywhere.
 */
export const MovesStore: Readable<Fetched<Move[]>> = derived(
	[OfficialMovesStore, CustomMovesStore],
	([$official, $custom]) => {
		const result = $official.result == null
			? undefined
			: [...$official.result, ...($custom.result ?? [])]
				.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))

		return {
			result,
			fetching: $official.fetching || $custom.fetching,
			error: $official.error ?? $custom.error,
		}
	},
	{ result: undefined, fetching: true, error: undefined },
)
