export type AttackRollMode = "advantage" | "normal" | "disadvantage"
export type MultiHitSource = "standard" | "custom"

export type ComboMultiHitProfile = {
	kind: "combo",
	source: MultiHitSource,
	additionalDice: string,
	maxAdditionalHits: number,
	note?: string,
}

export type RepeatedMultiHitProfile = {
	kind: "repeated",
	source: MultiHitSource,
	totalAttacks: number,
	stopOnMiss: boolean,
	repeatModifier: "move" | "none",
	repeatFlatBonus: number,
	repeatDiceCount?: number,
	note?: string,
	naturalReminder?: {
		threshold: number,
		text: string,
	},
}

export type UnsupportedMultiHitProfile = {
	kind: "unsupported",
	source: "standard",
	reason: string,
}

export type MultiHitProfile = ComboMultiHitProfile | RepeatedMultiHitProfile | UnsupportedMultiHitProfile
export type AutomatedMultiHitProfile = ComboMultiHitProfile | RepeatedMultiHitProfile

const normalizeMoveName = (name: string) => name.trim().toLowerCase().replace(/[-\s]+/g, " ")

const STANDARD_COMBO_MOVES = new Set([
	"arm thrust",
	"bone rush",
	"bullet seed",
	"comet punch",
	"double slap",
	"fury attack",
	"fury swipes",
	"icicle spear",
	"pin missile",
	"rock blast",
	"spike cannon",
	"tail slap",
	"water shuriken",
])

const repeated = (
	totalAttacks: number,
	options: Partial<Omit<RepeatedMultiHitProfile, "kind" | "source" | "totalAttacks">> = {},
): RepeatedMultiHitProfile => ({
	kind: "repeated",
	source: "standard",
	totalAttacks,
	stopOnMiss: options.stopOnMiss ?? false,
	repeatModifier: options.repeatModifier ?? "move",
	repeatFlatBonus: options.repeatFlatBonus ?? 0,
	repeatDiceCount: options.repeatDiceCount,
	note: options.note,
	naturalReminder: options.naturalReminder,
})

const STANDARD_REPEATED_MOVES: Record<string, RepeatedMultiHitProfile> = {
	"double hit": repeated(2),
	"double kick": repeated(2),
	"bonemerang": repeated(2),
	"dual chop": repeated(2),
	"gear grind": repeated(2),
	"twin beam": repeated(2),
	"dual wingbeat": repeated(2),
	"double iron bash": repeated(2, {
		naturalReminder: { threshold: 16, text: "A natural 16+ triggers this move's flinch effect." },
	}),
	"twineedle": repeated(2, {
		naturalReminder: { threshold: 19, text: "A natural 19+ triggers this move's poison effect for that target." },
	}),
	"dragon darts": repeated(2, {
		note: "Dragon Darts may split its attacks between up to two creatures. If the attacks target different creatures, resolve target-specific STAB or other bonuses manually where needed.",
	}),
	"triple dive": repeated(3),
	"surging strikes": repeated(3, { repeatFlatBonus: 5 }),
	"triple axel": repeated(3, { stopOnMiss: true }),
	"triple kick": repeated(3, { stopOnMiss: true }),
	"bubble": repeated(3, { repeatModifier: "none" }),
	"scale shot": repeated(5, {
		repeatModifier: "none",
		note: "Scale Shot uses the move's current scaled damage dice on each successful attack and adds MOVE only once if at least one attack hits. Remember its movement and AC effect after resolving the attacks.",
	}),
}

const STANDARD_UNSUPPORTED_MOVES: Record<string, string> = {
	"barrage": "Barrage first rolls for its projectile count, so its damage sequence does not match the normal combo or repeated-attack pattern.",
	"beat up": "Beat Up's number of attacks depends on the trainer's currently carried conscious creatures.",
	"population bomb": "Population Bomb uses ten attacks with a special fixed per-hit damage expression.",
	"tachyon cutter": "Tachyon Cutter has its own guaranteed two-hit resolution rather than the normal repeated-attack flow.",
	"hyperspace fury": "Hyperspace Fury uses a special multi-projectile resolution that is safer to resolve from the move text.",
}

export const getStandardMultiHitProfile = (moveName: string): MultiHitProfile | undefined => {
	const name = normalizeMoveName(moveName)

	if (STANDARD_COMBO_MOVES.has(name)) {
		return {
			kind: "combo",
			source: "standard",
			additionalDice: "1d4",
			maxAdditionalHits: 4,
		}
	}

	if (name === "thrash") {
		return {
			kind: "combo",
			source: "standard",
			additionalDice: "1d10",
			maxAdditionalHits: 2,
			note: "After Thrash finishes, remember to resolve its Confused effect manually.",
		}
	}

	if (STANDARD_REPEATED_MOVES[name] != null) return STANDARD_REPEATED_MOVES[name]

	const unsupportedReason = STANDARD_UNSUPPORTED_MOVES[name]
	if (unsupportedReason != null) {
		return {
			kind: "unsupported",
			source: "standard",
			reason: unsupportedReason,
		}
	}

	return undefined
}
