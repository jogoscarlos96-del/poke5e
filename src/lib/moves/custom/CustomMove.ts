import type { Data } from "$lib/DataClass"
import { Move } from "$lib/moves/Move"

export const CUSTOM_MOVE_PREFIX = "custom:"

export type CustomMoveId = `${typeof CUSTOM_MOVE_PREFIX}${string}`
export type CustomMoveData = Omit<Data<Move>, "id" | "contest" | "tm" | "updated">

export const CustomMove = {
	id: (uuid: string): CustomMoveId => `${CUSTOM_MOVE_PREFIX}${uuid}`,
	uuid: (id: string): string => id.startsWith(CUSTOM_MOVE_PREFIX) ? id.slice(CUSTOM_MOVE_PREFIX.length) : id,
	isCustom: (id: string): id is CustomMoveId => id.startsWith(CUSTOM_MOVE_PREFIX),
	fromRow: (row: { id: string, move_data: CustomMoveData }): Move => new Move({
		...row.move_data,
		id: CustomMove.id(row.id),
	}),
	toStoredData: (move: Move): CustomMoveData => {
		const { id: _id, contest: _contest, tm: _tm, updated: _updated, ...data } = move.data
		return structuredClone(data)
	},
	blank: (): CustomMoveData => ({
		name: "New Custom Move",
		type: "normal",
		power: ["str"],
		time: { unit: "action" },
		pp: 5,
		duration: { unit: "instantaneous", concentration: false },
		range: { type: "melee" },
		description: "Describe what this move does.",
		dice: {
			class: "custom",
			tiers: ["1d6", "1d8", "2d6", "3d6"],
			modifier: "MOVE",
			type: "damage",
		},
		attack: { scope: "melee" },
	}),
} as const
