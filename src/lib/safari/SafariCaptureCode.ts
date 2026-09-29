export type SafariCaptureCode = `S.${string}`

export const SafariCaptureCode = {
	from(raw: string): SafariCaptureCode {
		const normalized = raw.trim().toUpperCase()
		return (normalized.startsWith("S.") ? normalized : `S.${normalized}`) as SafariCaptureCode
	},
	raw(code: string): string {
		const normalized = code.trim().toUpperCase()
		return normalized.startsWith("S.") ? normalized.slice(2) : normalized
	},
	isValid(code: string): boolean {
		return /^S\.[0-9A-Z]{13}$/.test(SafariCaptureCode.from(code))
	},
} as const
