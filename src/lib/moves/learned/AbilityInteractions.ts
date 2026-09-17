import type { SpecialMultiHitProfile } from "./SpecialMultiHit"

export const criticalDiceCount = (
	baseDiceCount: number,
	critical: boolean,
	criticalDiceMultiplier: number,
) => baseDiceCount * (critical ? criticalDiceMultiplier : 1)

export const hasHustleCritical = (
	initialCritical: boolean,
	laterCriticals: boolean[],
) => initialCritical || laterCriticals.some(Boolean)

export const supportsParentalBondSpecial = (profile: SpecialMultiHitProfile) =>
	profile.kind === "barrage" || profile.kind === "repeated-special"
