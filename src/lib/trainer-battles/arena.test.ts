import { describe, expect, it } from "vitest"
import { Speeds } from "$lib/dnd/movement"
import {
	battleMovementSpeedFeet,
	hexDistance,
	movementDistanceFeet,
	spawnPositions,
} from "./arena"

describe("Trainer Battle arena", () => {
	it("uses 5 feet per neighboring hex", () => {
		expect(hexDistance({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(1)
		expect(movementDistanceFeet({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(5)
	})

	it("keeps spawn positions around 15 feet from each vertical edge", () => {
		expect(spawnPositions("singles", "a")).toEqual([{ q: 2, r: 4 }])
		expect(spawnPositions("singles", "b")).toEqual([{ q: 13, r: 4 }])
	})

	it("uses the fastest available movement speed for the neutral sanctioned arena", () => {
		expect(battleMovementSpeedFeet({ speeds: new Speeds({ walking: 30, flying: 60 }) })).toBe(60)
		expect(battleMovementSpeedFeet({ speeds: new Speeds({ flying: 50 }) })).toBe(50)
	})
})
