import "@supabase/functions-js"
import { Responses } from "./Responses.ts"
import { DataProvider } from "./DataProvider.ts"

import { getUploadUrl, removeAsset, UserAssetError } from "./user-assets.ts"
import { initSupabase } from "./supabase.ts"
import { initS3 } from "./s3.ts"
import { UserAssetsProvider } from "./UserAssetsProvider.ts"
import { env } from "./env.ts"
import { handleCors } from "./cors.ts"

const createProviders = () => {
	const supabase = initSupabase()
	const s3 = initS3()
	return {
		dataProvider: new DataProvider(supabase),
		userAssetsProvider: new UserAssetsProvider(s3, env.S3_BUCKET_NAME),
	}
}

type Providers = ReturnType<typeof createProviders>

Deno.serve((req) => {
	return handleCors(req, async (req) => {
		try {
			if (req.method === "POST")
				return await POST(req, createProviders())
			else if (req.method === "DELETE")
				return await DELETE(req, createProviders())
			else
				return Responses.methodNotAllowed()
		} catch (e) {
			if (e instanceof UserAssetError) {
				return Responses.badRequest({
					message: e.message,
				})
			}

			if (typeof e === "string") {
				return Responses.internalServerError({ message: e })
			} else {
				return Responses.internalServerError({ message: (e as Error).message })
			}
		}
	})
})

async function POST(req: Request, providers: Providers): Promise<Response> {
	const body = await req.json()
	const urlResult = await getUploadUrl(providers, body)
	const response = { values: urlResult }
	return Responses.ok(response)
}

async function DELETE(req: Request, providers: Providers): Promise<Response> {
	const body = await req.json()
	await removeAsset(providers, body)

	// note: supabase invoke always requires a body to parse
	return Responses.ok({})
}
