import { describe, expect, test } from "vitest"
import { getStandardMultiHitProfile } from "./MultiHit"

describe("getStandardMultiHitProfile", () => {
	test("models stop-on-miss triple attacks", () => {
		const tripleAxel = getStandardMultiHitProfile("Triple Axel")
		const tripleKick = getStandardMultiHitProfile("Triple Kick")

		expect(tripleAxel).toMatchObject({
			kind: "repeated",
			totalAttacks: 3,
			stopOnMiss: true,
			repeatModifier: "move",
		})
		expect(tripleKick).toMatchObject({
			kind: "repeated",
			totalAttacks: 3,
			stopOnMiss: true,
			repeatModifier: "move",
		})
	})

	test("models repeated-hit modifier exceptions", () => {
		expect(getStandardMultiHitProfile("Bubble")).toMatchObject({
			kind: "repeated",
			totalAttacks: 3,
			repeatModifier: "none",
		})
		expect(getStandardMultiHitProfile("Scale Shot")).toMatchObject({
			kind: "repeated",
			totalAttacks: 5,
			repeatModifier: "none",
		})
		expect(getStandardMultiHitProfile("Surging Strikes")).toMatchObject({
			kind: "repeated",
			totalAttacks: 3,
			repeatModifier: "move",
			repeatFlatBonus: 5,
		})
	})

	test("keeps natural-roll effects available for the repeated sequence", () => {
		expect(getStandardMultiHitProfile("Double Iron Bash")).toMatchObject({
			kind: "repeated",
			naturalReminder: {
				threshold: 16,
			},
		})
		expect(getStandardMultiHitProfile("Twineedle")).toMatchObject({
			kind: "repeated",
			naturalReminder: {
				threshold: 19,
			},
		})
	})

	test.each(["Dual Chop", "Gear Grind", "Twineedle", "Dragon Darts"])(
		"documents split-target handling for %s",
		(moveName) => {
			const profile = getStandardMultiHitProfile(moveName)
			expect(profile).toMatchObject({ kind: "repeated" })
			if (profile?.kind !== "repeated") throw new Error(`${moveName} should use the repeated profile`)
			expect(profile.note).toContain("STAB applies once per move per target")
		},
	)
})
