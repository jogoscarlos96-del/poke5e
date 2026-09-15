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

function listWriteKeys(): { id: string, writeKey: string }[] {
	if (typeof localStorage === "undefined") return []

	const result: { id: string, writeKey: string }[] = []
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i)
		if (key == null || !key.startsWith(PREFIX)) continue

		const id = key.slice(PREFIX.length)
		const writeKey = localStorage.getItem(key)
		if (id === "" || writeKey == null) continue

		result.push({ id, writeKey })
	}

	return result.sort((a, b) => a.id.localeCompare(b.id))
}

export const CustomMoveLocalStorage = {
	getWriteKey,
	setWriteKey,
	removeWriteKey,
	listWriteKeys,
} as const
