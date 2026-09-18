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

const ONCE_PER_MOVE_ROLL_NOTE = "Manual Temporary Damage Bonus and Extra Damage Dice controls apply to the current damage roll only. If an effect says it applies once per move, add it to only one qualifying hit."
const COMBO_MODIFIER_NOTE = "The initial damage roll carries the move's MOVE/STAB modifiers. Additional combo hits use only the move's current scaled damage dice. Apply any manual once-per-move bonus on the initial damage roll before continuing the combo."

const withOncePerMoveNote = (note?: string) => note == null
	? ONCE_PER_MOVE_ROLL_NOTE
	: `${note} ${ONCE_PER_MOVE_ROLL_NOTE}`

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
	note: withOncePerMoveNote(options.note),
	naturalReminder: options.naturalReminder,
})

const SPLIT_TARGET_NOTE = "This move may split its attacks between different creatures. STAB applies once per move per target, so resolve target-specific STAB and other target-dependent bonuses manually when attacks are split."

const STANDARD_REPEATED_MOVES: Record<string, RepeatedMultiHitProfile> = {
	"double hit": repeated(2),
	"double kick": repeated(2),
	"bonemerang": repeated(2),
	"dual chop": repeated(2, {
		note: SPLIT_TARGET_NOTE,
	}),
	"gear grind": repeated(2, {
		note: SPLIT_TARGET_NOTE,
	}),
	"twin beam": repeated(2),
	"dual wingbeat": repeated(2),
	"double iron bash": repeated(2, {
		note: "Attack 1 can also trigger this move's flinch effect on a natural 16+. Later qualifying attacks are flagged automatically.",
		naturalReminder: { threshold: 16, text: "A natural 16+ triggers this move's flinch effect." },
	}),
	"twineedle": repeated(2, {
		note: `Attack 1 can also poison its target on a natural 19+. Later qualifying attacks are flagged automatically. ${SPLIT_TARGET_NOTE}`,
		naturalReminder: { threshold: 19, text: "A natural 19+ triggers this move's poison effect for that target." },
	}),
	"dragon darts": repeated(2, {
		note: SPLIT_TARGET_NOTE,
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

// Bespoke standard moves such as Barrage, Beat Up, Population Bomb, Tachyon Cutter,
// and Hyperspace Fury are routed through SpecialMultiHit.ts instead of this generic flow.
const STANDARD_UNSUPPORTED_MOVES: Record<string, string> = {}

export const getStandardMultiHitProfile = (moveName: string): MultiHitProfile | undefined => {
	const name = normalizeMoveName(moveName)

	if (STANDARD_COMBO_MOVES.has(name)) {
		return {
			kind: "combo",
			source: "standard",
			additionalDice: "1d4",
			maxAdditionalHits: 4,
			note: COMBO_MODIFIER_NOTE,
		}
	}

	if (name === "thrash") {
		return {
			kind: "combo",
			source: "standard",
			additionalDice: "1d10",
			maxAdditionalHits: 2,
			note: `After Thrash finishes, remember to resolve its Confused effect manually. ${COMBO_MODIFIER_NOTE}`,
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
