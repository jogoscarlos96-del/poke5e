const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

export function generateTrainerBattleCode(length = 8): string {
	const bytes = new Uint8Array(length)
	crypto.getRandomValues(bytes)
	return Array.from(bytes, (value) => ALPHABET[value % ALPHABET.length]).join("")
}
