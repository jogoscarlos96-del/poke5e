import { describe, expect, test } from "vitest"
import {
	applyGaugeDelta,
	captureEffectForGauge,
	isBored,
	nextNoChangeCount,
	repeatedInteractionValue,
	stealthCaptureEffect,
	stealthTier,
} from "../rules"

describe("Safari Gauge capture effects", () => {
	test("-1 and 0 are normal captures", () => {
		expect(captureEffectForGauge(-1)).toEqual({ flee: false, advantage: false, dcModifier: 0 })
		expect(captureEffectForGauge(0)).toEqual({ flee: false, advantage: false, dcModifier: 0 })
	})

	test("positive gauge levels grant the configured bonuses", () => {
		expect(captureEffectForGauge(1)).toEqual({ flee: false, advantage: false, dcModifier: -3 })
		expect(captureEffectForGauge(2)).toEqual({ flee: false, advantage: true, dcModifier: -5 })
		expect(captureEffectForGauge(3)).toEqual({ flee: false, advantage: true, dcModifier: -5 })
		expect(captureEffectForGauge(4)).toEqual({ flee: false, advantage: true, dcModifier: -10 })
		expect(captureEffectForGauge(5)).toEqual({ flee: false, advantage: true, dcModifier: -10 })
	})

	test("-2 flees immediately", () => {
		expect(captureEffectForGauge(-2).flee).toBe(true)
	})
})

describe("Safari interaction repetition", () => {
	test("positive repeats halve and round down", () => {
		expect(repeatedInteractionValue(3, 0)).toBe(3)
		expect(repeatedInteractionValue(3, 1)).toBe(1)
		expect(repeatedInteractionValue(3, 2)).toBe(0)
		expect(repeatedInteractionValue(2, 1)).toBe(1)
		expect(repeatedInteractionValue(1, 1)).toBe(0)
	})

	test("negative repeats worsen by one", () => {
		expect(repeatedInteractionValue(-1, 0)).toBe(-1)
		expect(repeatedInteractionValue(-1, 1)).toBe(-2)
		expect(repeatedInteractionValue(-2, 2)).toBe(-4)
	})

	test("gauge clamps to -2 through 5", () => {
		expect(applyGaugeDelta(4, 3)).toBe(5)
		expect(applyGaugeDelta(-1, -4)).toBe(-2)
	})

	test("two consecutive unchanged interactions cause boredom", () => {
		const first = nextNoChangeCount(2, 2, 0)
		const second = nextNoChangeCount(2, 2, first)
		expect(first).toBe(1)
		expect(isBored(first)).toBe(false)
		expect(second).toBe(2)
		expect(isBored(second)).toBe(true)
	})
})

describe("Safari Stealth", () => {
	test("uses natural 20 before total thresholds", () => {
		expect(stealthTier(20, 8)).toBe("natural20")
		expect(stealthTier(12, 16)).toBe("expert")
		expect(stealthTier(8, 12)).toBe("basic")
		expect(stealthTier(4, 9)).toBe("failed")
	})

	test("sets capture bonuses and gauge costs", () => {
		expect(stealthCaptureEffect("basic")).toEqual({ advantage: true, dcModifier: -5, gaugeCost: 1, automaticSuccess: false })
		expect(stealthCaptureEffect("expert")).toEqual({ advantage: true, dcModifier: -10, gaugeCost: 0, automaticSuccess: false })
		expect(stealthCaptureEffect("natural20").automaticSuccess).toBe(true)
		expect(stealthCaptureEffect("failed").gaugeCost).toBe(2)
	})
})
