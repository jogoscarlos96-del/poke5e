const PREFIX = "custom-move::"

const keyFor = (id: string) => `${PREFIX}${id}`

function getWriteKey(id: string): string | undefined {
	if (typeof localStorage === "undefined") return undefined
	return localStorage.getItem(keyFor(id)) ?? undefined
}

function setWriteKey(id: string, writeKey: string): void {
	if (typeof localStorage === "undefined") return
	localStorage.setItem(keyFor(id), writeKey)
}

function removeWriteKey(id: string): void {
	if (typeof localStorage === "undefined") return
	localStorage.removeItem(keyFor(id))
}

export const CustomMoveLocalStorage = {
	getWriteKey,
	setWriteKey,
	removeWriteKey,
} as const
