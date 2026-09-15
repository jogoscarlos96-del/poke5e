import { expect, test, vi } from "vitest"
import { preloadKnownTrainers } from "../preload"

test("preloads every known trainer detail", async () => {
	const get = vi.fn(async () => undefined)
	const store = { get }

	await preloadKnownTrainers(store as never, ["trainer-a", "trainer-b"])

	expect(get).toHaveBeenCalledTimes(2)
	expect(get).toHaveBeenCalledWith("trainer-a")
	expect(get).toHaveBeenCalledWith("trainer-b")
})
