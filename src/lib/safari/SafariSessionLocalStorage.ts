import type { SafariSessionState } from "./types"

const PREFIX = "kornia:safari-session::"
const keyFor = (trainerReadKey: string) => `${PREFIX}${trainerReadKey}`

function get(trainerReadKey: string): SafariSessionState | undefined {
	if (typeof localStorage === "undefined") return undefined
	const raw = localStorage.getItem(keyFor(trainerReadKey))
	if (!raw) return undefined

	try {
		return JSON.parse(raw) as SafariSessionState
	} catch {
		localStorage.removeItem(keyFor(trainerReadKey))
		return undefined
	}
}

function set(session: SafariSessionState): void {
	if (typeof localStorage === "undefined") return
	localStorage.setItem(keyFor(session.trainerReadKey), JSON.stringify(session))
}

function remove(trainerReadKey: string): void {
	if (typeof localStorage === "undefined") return
	localStorage.removeItem(keyFor(trainerReadKey))
}

export const SafariSessionLocalStorage = { get, set, remove } as const
