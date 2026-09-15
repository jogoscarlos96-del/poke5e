import { assertEquals, assertExists, assertRejects } from "@std/assert"
import type { DataProvider } from "../DataProvider.ts"
import type { UserAssetsProvider } from "../UserAssetsProvider.ts"
import { getUploadUrl, removeAsset, UserAssetError, type Providers } from "../user-assets.ts"

const providers = (options?: {
	filenames?: { portrait?: string, sprite?: string },
	onRemove?: (params: unknown) => void,
}): Providers => ({
	dataProvider: {
		newMegaMediaFilenames: async () => options?.filenames ?? {},
		removeMegaMedia: async (params: unknown) => {
			options?.onRemove?.(params)
			return true
		},
	} as unknown as DataProvider,
	userAssetsProvider: {
		generatePresignedUploadUrl: async (filename: string) => `https://uploads.example/${filename}`,
	} as unknown as UserAssetsProvider,
})

Deno.test("Mega media returns independent portrait and sprite upload targets", async () => {
	const result = await getUploadUrl(providers({
		filenames: {
			portrait: "mega-portrait.png",
			sprite: "mega-sprite.webp",
		},
	}), {
		type: "mega-media",
		params: {
			id: "mega-id",
			key: "write-key",
			portrait: { mimetype: "image/png", sizeInBytes: 524288 },
			sprite: { mimetype: "image/webp", sizeInBytes: 1024 },
		},
	}) as {
		portrait?: { filename: string, uploadUrl: string },
		sprite?: { filename: string, uploadUrl: string },
	}

	assertEquals(result.portrait?.filename, "mega-portrait.png")
	assertEquals(result.portrait?.uploadUrl, "https://uploads.example/mega-portrait.png")
	assertEquals(result.sprite?.filename, "mega-sprite.webp")
	assertEquals(result.sprite?.uploadUrl, "https://uploads.example/mega-sprite.webp")
})

Deno.test("Mega portrait upload is independently optional", async () => {
	const result = await getUploadUrl(providers({
		filenames: { sprite: "mega-sprite.png" },
	}), {
		type: "mega-media",
		params: {
			id: "mega-id",
			key: "write-key",
			sprite: { mimetype: "image/png", sizeInBytes: 100 },
		},
	}) as {
		portrait?: { filename: string, uploadUrl: string },
		sprite?: { filename: string, uploadUrl: string },
	}

	assertEquals(result.portrait, undefined)
	assertExists(result.sprite)
})

Deno.test("Mega sprite upload is independently optional", async () => {
	const result = await getUploadUrl(providers({
		filenames: { portrait: "mega-portrait.jpg" },
	}), {
		type: "mega-media",
		params: {
			id: "mega-id",
			key: "write-key",
			portrait: { mimetype: "image/jpeg", sizeInBytes: 100 },
		},
	}) as {
		portrait?: { filename: string, uploadUrl: string },
		sprite?: { filename: string, uploadUrl: string },
	}

	assertExists(result.portrait)
	assertEquals(result.sprite, undefined)
})

Deno.test("Mega media rejects either image above 512 KiB", async () => {
	await assertRejects(
		() => getUploadUrl(providers(), {
			type: "mega-media",
			params: {
				id: "mega-id",
				key: "write-key",
				portrait: { mimetype: "image/png", sizeInBytes: 524289 },
			},
		}),
		UserAssetError,
	)

	await assertRejects(
		() => getUploadUrl(providers(), {
			type: "mega-media",
			params: {
				id: "mega-id",
				key: "write-key",
				sprite: { mimetype: "image/png", sizeInBytes: 524289 },
			},
		}),
		UserAssetError,
	)
})

Deno.test("Mega portrait and sprite removal remain independent", async () => {
	let removed: unknown
	await removeAsset(providers({ onRemove: (params) => { removed = params } }), {
		type: "mega-media",
		params: {
			id: "mega-id",
			key: "write-key",
			portrait: true,
			sprite: false,
		},
	})

	assertEquals(removed, {
		id: "mega-id",
		key: "write-key",
		portrait: true,
		sprite: false,
	})
})
