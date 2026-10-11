import { describe, expect, it } from "vitest"
import { battleMaxHp, battleScaleContext, TRAINER_BATTLE_SCALE_LEVEL } from "./scaling"

describe("Trainer Battle scaling", () => {
	it("keeps HP unchanged when scaling is disabled", () => {
		expect(battleMaxHp(101, 20, "keep")).toBe(101)
	})

	it("keeps level 10 HP unchanged", () => {
		expect(battleMaxHp(101, 10, "scale")).toBe(101)
	})

	it("halves HP above level 10 and rounds down", () => {
		expect(battleMaxHp(101, 20, "scale")).toBe(50)
	})

	it("uses level 10 only as the damage tier while preserving actual level", () => {
		expect(battleScaleContext(20, "scale")).toEqual({
			actualLevel: 20,
			damageTierLevel: TRAINER_BATTLE_SCALE_LEVEL,
		})
	})
})
