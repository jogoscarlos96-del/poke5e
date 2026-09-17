export type SpecialDamageProfile =
	| {
		kind: "dice",
		source: "stats" | "fixed",
		dice?: string,
		applyMoveModifier: boolean,
	}
	| {
		kind: "flat",
		base: number,
		applyMoveModifier: boolean,
	}

export type BarrageSpecialProfile = {
	kind: "barrage",
	source: "standard",
	projectileCountDice: "1d4",
	damage: SpecialDamageProfile,
	note: string,
}

export type RepeatedSpecialProfile = {
	kind: "repeated-special",
	source: "standard",
	count: {
		kind: "fixed",
		total: number,
	} | {
		kind: "party",
		min: number,
	},
	damage: SpecialDamageProfile,
	note: string,
}

export type AutomaticSpecialProfile = {
	kind: "automatic-special",
	source: "standard",
	totalHits: number,
	damage: SpecialDamageProfile,
	canSplitTargets: boolean,
	note: string,
}

export type SpecialMultiHitProfile =
	| BarrageSpecialProfile
	| RepeatedSpecialProfile
	| AutomaticSpecialProfile

const normalizeMoveName = (name: string) => name.trim().toLowerCase().replace(/[-\s]+/g, " ")

const hyperspaceFuryProjectiles = (level: number) => {
	if (level >= 17) return 6
	if (level >= 10) return 5
	if (level >= 5) return 4
	return 3
}

export const getSpecialMultiHitProfile = (moveName: string, level: number): SpecialMultiHitProfile | undefined => {
	const name = normalizeMoveName(moveName)

	if (name === "barrage") {
		return {
			kind: "barrage",
			source: "standard",
			projectileCountDice: "1d4",
			damage: {
				kind: "dice",
				source: "stats",
				applyMoveModifier: false,
			},
			note: "One ranged attack determines whether the barrage lands. On a hit, roll 1d4 for the number of projectiles; each projectile uses the move's current level-scaled damage dice.",
		}
	}

	if (name === "beat up") {
		return {
			kind: "repeated-special",
			source: "standard",
			count: {
				kind: "party",
				min: 1,
			},
			damage: {
				kind: "dice",
				source: "fixed",
				dice: "2d6",
				applyMoveModifier: false,
			},
			note: "Make one attack, plus one additional attack for each other conscious creature currently carried by the trainer.",
		}
	}

	if (name === "population bomb") {
		return {
			kind: "repeated-special",
			source: "standard",
			count: {
				kind: "fixed",
				total: 10,
			},
			damage: {
				kind: "flat",
				base: 1,
				applyMoveModifier: true,
			},
			note: "Make 10 separate melee attack rolls. Each hit deals 1 + MOVE normal damage. Critical hits do not add dice because this damage expression contains no dice.",
		}
	}

	if (name === "tachyon cutter") {
		return {
			kind: "automatic-special",
			source: "standard",
			totalHits: 2,
			damage: {
				kind: "dice",
				source: "stats",
				applyMoveModifier: true,
			},
			canSplitTargets: false,
			note: "Both hits are guaranteed unless the target is in an invulnerable stage such as Fly, Dig, Bounce, or Dive.",
		}
	}

	if (name === "hyperspace fury") {
		return {
			kind: "automatic-special",
			source: "standard",
			totalHits: hyperspaceFuryProjectiles(level),
			damage: {
				kind: "dice",
				source: "fixed",
				dice: "1d6",
				applyMoveModifier: false,
			},
			canSplitTargets: true,
			note: "Each projectile automatically deals damage. Protect/Detect-style reactions cannot negate this damage. After use, attacks against the user have advantage until the beginning of its next turn.",
		}
	}

	return undefined
}

export const getSpecialSequenceCount = (
	profile: RepeatedSpecialProfile,
	otherConsciousCarriedCreatures: number,
) => profile.count.kind === "fixed"
	? profile.count.total
	: Math.max(profile.count.min, 1 + Math.max(0, Math.floor(otherConsciousCarriedCreatures)))
