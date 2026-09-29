import type { SafariGaugeValue, SafariStealthTier } from "./types"

export const SAFARI_GAUGE_VALUES: SafariGaugeValue[] = [-2, -1, 0, 1, 2, 3, 4, 5]

export type SafariCaptureEffect = {
	flee: boolean
	advantage: boolean
	dcModifier: number
}

export function captureEffectForGauge(gauge: SafariGaugeValue): SafariCaptureEffect {
	if (gauge <= -2) return { flee: true, advantage: false, dcModifier: 0 }
	if (gauge <= 0) return { flee: false, advantage: false, dcModifier: 0 }
	if (gauge === 1) return { flee: false, advantage: false, dcModifier: -3 }
	if (gauge <= 3) return { flee: false, advantage: true, dcModifier: -5 }
	return { flee: false, advantage: true, dcModifier: -10 }
}

export function clampGauge(value: number): SafariGaugeValue {
	return Math.max(-2, Math.min(5, Math.trunc(value))) as SafariGaugeValue
}

export function applyGaugeDelta(gauge: SafariGaugeValue, delta: number): SafariGaugeValue {
	return clampGauge(gauge + Math.trunc(delta))
}

/**
 * repeatIndex is zero for the first use, one for the first repeat, etc.
 * Positive values halve on each repeat and always round down.
 * Negative values become one point worse on each repeat.
 */
export function repeatedInteractionValue(baseDelta: number, repeatIndex: number): number {
	const normalized = Math.trunc(baseDelta)
	const repeats = Math.max(0, Math.trunc(repeatIndex))

	if (normalized > 0) {
		let value = normalized
		for (let i = 0; i < repeats; i++) value = Math.floor(value / 2)
		return value
	}

	if (normalized < 0) return normalized - repeats
	return 0
}

export function nextNoChangeCount(previous: SafariGaugeValue, next: SafariGaugeValue, currentCount: number): number {
	return previous === next ? currentCount + 1 : 0
}

export function isBored(noChangeCount: number): boolean {
	return noChangeCount >= 2
}

export function stealthTier(naturalRoll: number, total: number): SafariStealthTier {
	if (naturalRoll === 20) return "natural20"
	if (total >= 16) return "expert"
	if (total >= 10) return "basic"
	return "failed"
}

export function stealthCaptureEffect(tier?: SafariStealthTier): {
	advantage: boolean
	dcModifier: number
	gaugeCost: number
	automaticSuccess: boolean
} {
	switch (tier) {
		case "natural20":
			return { advantage: true, dcModifier: -10, gaugeCost: 0, automaticSuccess: true }
		case "expert":
			return { advantage: true, dcModifier: -10, gaugeCost: 0, automaticSuccess: false }
		case "basic":
			return { advantage: true, dcModifier: -5, gaugeCost: 1, automaticSuccess: false }
		default:
			return { advantage: false, dcModifier: 0, gaugeCost: 2, automaticSuccess: false }
	}
}
