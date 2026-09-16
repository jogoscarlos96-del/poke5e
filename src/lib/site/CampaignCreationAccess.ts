import { browser } from "$app/environment"

const STORAGE_KEY = "kornia:campaign-creation-unlocked"
const EXPECTED_PASSWORD_HASH = "de33140c5dcd22058216950f9d52ab590719278c66e5800c486ca4d5efe8feba"

const sha256 = async (value: string): Promise<string> => {
	if (!browser || globalThis.crypto?.subtle == null) return ""

	const encoded = new TextEncoder().encode(value)
	const digest = await globalThis.crypto.subtle.digest("SHA-256", encoded)

	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("")
}

const isUnlocked = (): boolean =>
	browser && localStorage.getItem(STORAGE_KEY) === "1"

const unlock = async (password: string): Promise<boolean> => {
	if (!browser) return false

	const valid = await sha256(password) === EXPECTED_PASSWORD_HASH
	if (valid) localStorage.setItem(STORAGE_KEY, "1")

	return valid
}

export const CampaignCreationAccess = {
	isUnlocked,
	unlock,
} as const
