import { describe, expect, test } from "vitest"
import { Move } from "$lib/moves/Move"
import { CustomMove } from "../CustomMove"

describe("CustomMove", () => {
	test("uses a namespaced client-side id", () => {
		expect(CustomMove.id("1234")).toBe("custom:1234")
		expect(CustomMove.uuid("custom:1234")).toBe("1234")
		expect(CustomMove.uuid("1234")).toBe("1234")
		expect(CustomMove.isCustom("custom:1234")).toBe(true)
		expect(CustomMove.isCustom("earthquake")).toBe(false)
	})

	test("round trips stored move data", () => {
		const original = new Move({
			id: "custom:1234",
			...CustomMove.blank(),
			name: "Faultline Smash",
			type: "ground",
		})

		const stored = CustomMove.toStoredData(original)
		const restored = CustomMove.fromRow({ id: "1234", move_data: stored })

		expect(restored.id).toBe("custom:1234")
		expect(restored.name).toBe("Faultline Smash")
		expect(restored.type).toBe("ground")
		expect(restored.pp).toBe(original.pp)
	})
})
