import { describe, expect, test } from "vitest"
import {
	criticalDiceCount,
	hasHustleCritical,
	supportsParentalBondSpecial,
} from "./AbilityInteractions"
import { getSpecialMultiHitProfile } from "./SpecialMultiHit"

describe("ability interactions", () => {
	test("propagates a shared critical to combo continuation dice", () => {
		expect(criticalDiceCount(2, false, 2)).toBe(2)
		expect(criticalDiceCount(2, true, 2)).toBe(4)
		expect(criticalDiceCount(2, true, 3)).toBe(6)
	})

	test("detects Hustle when any attack in the sequence crits", () => {
		expect(hasHustleCritical(false, [false, false])).toBe(false)
		expect(hasHustleCritical(true, [])).toBe(true)
		expect(hasHustleCritical(false, [false, true])).toBe(true)
	})

	test("only exposes Parental Bond for special moves that actually make attack rolls", () => {
		const barrage = getSpecialMultiHitProfile("Barrage", 1)
		const beatUp = getSpecialMultiHitProfile("Beat Up", 1)
		const populationBomb = getSpecialMultiHitProfile("Population Bomb", 1)
		const tachyonCutter = getSpecialMultiHitProfile("Tachyon Cutter", 1)
		const hyperspaceFury = getSpecialMultiHitProfile("Hyperspace Fury", 1)

		if (barrage == null || beatUp == null || populationBomb == null || tachyonCutter == null || hyperspaceFury == null) {
			throw new Error("Expected all special multi-hit profiles")
		}

		expect(supportsParentalBondSpecial(barrage)).toBe(true)
		expect(supportsParentalBondSpecial(beatUp)).toBe(true)
		expect(supportsParentalBondSpecial(populationBomb)).toBe(true)
		expect(supportsParentalBondSpecial(tachyonCutter)).toBe(false)
		expect(supportsParentalBondSpecial(hyperspaceFury)).toBe(false)
	})
})
