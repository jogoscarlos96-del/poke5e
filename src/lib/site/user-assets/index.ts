import { UserAssets } from "./UserAssets"
import * as publicEnv from "$env/static/public"

export * from "./UserAssets"

// User asset hosting is optional in Kornia deployments. Import the public env
// namespace instead of a named export so a missing PUBLIC_USER_ASSETS_BASE_URL
// does not make static production builds fail.
const userAssetsBaseUrl = (publicEnv as Record<string, string | undefined>).PUBLIC_USER_ASSETS_BASE_URL ?? ""

export const userAssets = new UserAssets(userAssetsBaseUrl)
