import { describe, expect, test } from "vitest"
import { rollDice } from "../DiceRoller"

const sequence = (...values: number[]) => {
	let index = 0
	return () => values[index++] ?? 0
}

describe("rollDice", () => {
	test("rolls multiple dice and applies a modifier", () => {
		const result = rollDice({
			count: 3,
			sides: 6,
			modifier: 2,
		}, sequence(0, 0.5, 0.999))

		expect(result.rolls).toEqual([1, 4, 6])
		expect(result.subtotal).toBe(11)
		expect(result.total).toBe(13)
	})

	test("keeps the higher d20 with advantage", () => {
		const result = rollDice({
			count: 1,
			sides: 20,
			modifier: 3,
			mode: "advantage",
		}, sequence(0.1, 0.9))

		expect(result.rolls).toEqual([3, 19])
		expect(result.keptRolls).toEqual([19])
		expect(result.total).toBe(22)
	})

	test("keeps the lower d20 with disadvantage", () => {
		const result = rollDice({
			count: 1,
			sides: 20,
			modifier: -1,
			mode: "disadvantage",
		}, sequence(0.25, 0.75))

		expect(result.rolls).toEqual([6, 16])
		expect(result.keptRolls).toEqual([6])
		expect(result.total).toBe(5)
	})

	test("rejects advantage on non-d20 expressions", () => {
		expect(() => rollDice({
			count: 2,
			sides: 6,
			mode: "advantage",
		})).toThrow("single d20")
	})
})
