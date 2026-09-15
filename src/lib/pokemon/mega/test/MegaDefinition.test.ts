import { expect, test } from "vitest"
import { MegaDefinitions } from "../MegaDefinition"

test("serializing a Mega definition without media does not throw", () => {
	const stored = MegaDefinitions.toStoredData({ name: "Mega Charizard Y" })

	expect(stored.name).toBe("Mega Charizard Y")
	expect(stored.portraitUrl).toBeUndefined()
	expect(stored.spriteUrl).toBeUndefined()
})

test("legacy media URLs are preserved only when a resource is URL-backed", () => {
	const url = "https://example.com/mega.png"
	const stored = MegaDefinitions.toStoredData({
		name: "Mega Charizard Y",
		portrait: { name: url, href: url },
		sprite: { name: "uploaded.png", href: "https://assets.example/uploaded.png" },
	})

	expect(stored.portraitUrl).toBe(url)
	expect(stored.spriteUrl).toBeUndefined()
})
