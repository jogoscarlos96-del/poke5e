import { describe, expect, test } from "vitest"
import { getSpecialMultiHitProfile, getSpecialSequenceCount } from "./SpecialMultiHit"

describe("getSpecialMultiHitProfile", () => {
	test("models Barrage as a hit-gated projectile count", () => {
		expect(getSpecialMultiHitProfile("Barrage", 1)).toMatchObject({
			kind: "barrage",
			projectileCountDice: "1d4",
			damage: {
				kind: "dice",
				source: "stats",
				applyMoveModifier: false,
			},
		})
	})

	test("models Beat Up with a party-dependent attack count", () => {
		const profile = getSpecialMultiHitProfile("Beat Up", 1)
		expect(profile).toMatchObject({
			kind: "repeated-special",
			count: {
				kind: "party",
				min: 1,
			},
			damage: {
				kind: "dice",
				source: "fixed",
				dice: "2d6",
				applyMoveModifier: false,
			},
		})
		if (profile?.kind !== "repeated-special") throw new Error("Beat Up should be a repeated special profile")
		expect(getSpecialSequenceCount(profile, 0)).toBe(1)
		expect(getSpecialSequenceCount(profile, 3)).toBe(4)
		expect(getSpecialSequenceCount(profile, 99)).toBe(100)
	})

	test("models Population Bomb as ten fixed-damage attack rolls", () => {
		expect(getSpecialMultiHitProfile("Population Bomb", 1)).toMatchObject({
			kind: "repeated-special",
			count: {
				kind: "fixed",
				total: 10,
			},
			damage: {
				kind: "flat",
				base: 1,
				applyMoveModifier: true,
			},
		})
	})

	test("models Tachyon Cutter as two guaranteed hits", () => {
		expect(getSpecialMultiHitProfile("Tachyon Cutter", 1)).toMatchObject({
			kind: "automatic-special",
			totalHits: 2,
			canSplitTargets: false,
			damage: {
				kind: "dice",
				source: "stats",
				applyMoveModifier: true,
			},
		})
	})

	test.each([
		[1, 3],
		[5, 4],
		[10, 5],
		[17, 6],
		[20, 6],
	])("scales Hyperspace Fury projectile count at level %i", (level, expected) => {
		expect(getSpecialMultiHitProfile("Hyperspace Fury", level)).toMatchObject({
			kind: "automatic-special",
			totalHits: expected,
			canSplitTargets: true,
			damage: {
				kind: "dice",
				source: "fixed",
				dice: "1d6",
				applyMoveModifier: false,
			},
		})
	})
})
