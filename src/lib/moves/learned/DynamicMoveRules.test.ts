import { describe, expect, test } from "vitest"
import {
	getDynamicMoveDamageProfile,
	magnitudeBaseDice,
	magnitudeLevelMultiplier,
	resolveDynamicMoveDamage,
	resolveMagnitudeDice,
	scaleDamageDice,
} from "./DynamicMoveRules"

const damage = (dice: string) => ({
	dice,
	mod: 8,
	isHealing: false,
	stabApplied: true,
	moveModifier: 4,
})

describe("dynamic move damage rules", () => {
	test("recognizes the supported dynamic moves", () => {
		expect(getDynamicMoveDamageProfile("Rollout")).toMatchObject({ kind: "progressive", move: "rollout" })
		expect(getDynamicMoveDamageProfile("Fury Cutter")).toMatchObject({ kind: "progressive", move: "fury-cutter" })
		expect(getDynamicMoveDamageProfile("Outrage")).toMatchObject({ kind: "round-sequence", move: "outrage" })
		expect(getDynamicMoveDamageProfile("Magnitude")).toMatchObject({ kind: "magnitude", move: "magnitude" })
		expect(getDynamicMoveDamageProfile("Tackle")).toBeUndefined()
	})

	test("scales Rollout's symbolic R die by consecutive-hit stage", () => {
		expect(scaleDamageDice("Rd10", 1)).toBe("1d10")
		expect(scaleDamageDice("Rd10", 4)).toBe("4d10")
		expect(scaleDamageDice("Rd10", 16)).toBe("16d10")
	})

	test("scales ordinary dice for Fury Cutter", () => {
		expect(scaleDamageDice("1d8", 8)).toBe("8d8")
		expect(scaleDamageDice("2d6", 8)).toBe("16d6")
	})

	test("maps Magnitude's d100 table boundaries", () => {
		expect(magnitudeBaseDice(1)).toBe("1d4")
		expect(magnitudeBaseDice(5)).toBe("1d4")
		expect(magnitudeBaseDice(6)).toBe("1d8")
		expect(magnitudeBaseDice(15)).toBe("1d8")
		expect(magnitudeBaseDice(16)).toBe("1d10")
		expect(magnitudeBaseDice(35)).toBe("1d10")
		expect(magnitudeBaseDice(36)).toBe("1d12")
		expect(magnitudeBaseDice(65)).toBe("1d12")
		expect(magnitudeBaseDice(66)).toBe("2d6")
		expect(magnitudeBaseDice(85)).toBe("2d6")
		expect(magnitudeBaseDice(86)).toBe("2d8")
		expect(magnitudeBaseDice(95)).toBe("2d8")
		expect(magnitudeBaseDice(96)).toBe("2d12")
		expect(magnitudeBaseDice(100)).toBe("2d12")
		expect(magnitudeBaseDice(0)).toBeUndefined()
		expect(magnitudeBaseDice(101)).toBeUndefined()
	})

	test("applies Magnitude's level-tier multiplier", () => {
		expect(magnitudeLevelMultiplier("dice")).toBe(1)
		expect(magnitudeLevelMultiplier("2×dice")).toBe(2)
		expect(magnitudeLevelMultiplier("3×dice")).toBe(3)
		expect(magnitudeLevelMultiplier("4×dice")).toBe(4)
		expect(resolveMagnitudeDice("3×dice", 70)).toBe("6d6")
		expect(resolveMagnitudeDice("4×dice", 100)).toBe("8d12")
	})

	test("resolves progressive and round-sequence damage without changing modifiers", () => {
		const rollout = getDynamicMoveDamageProfile("Rollout")
		const outrage = getDynamicMoveDamageProfile("Outrage")
		const furyCutter = getDynamicMoveDamageProfile("Fury Cutter")

		expect(resolveDynamicMoveDamage(rollout, damage("Rd10"), { stage: 3 })).toEqual({
			...damage("Rd10"),
			dice: "4d10",
		})
		expect(resolveDynamicMoveDamage(outrage, damage("Rd10"), { stage: 3 })?.dice).toBe("4d10")
		expect(resolveDynamicMoveDamage(furyCutter, damage("2d6"), { stage: 4 })?.dice).toBe("16d6")
	})

	test("waits for Magnitude's d100 result before producing rollable dice", () => {
		const magnitude = getDynamicMoveDamageProfile("Magnitude")
		expect(resolveDynamicMoveDamage(magnitude, damage("3×dice"))).toBeUndefined()
		expect(resolveDynamicMoveDamage(magnitude, damage("3×dice"), { magnitudeRoll: 42 })?.dice).toBe("3d12")
	})
})
