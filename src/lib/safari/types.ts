import type { Skill } from "$lib/dnd/skills"

export type SafariBiomeDefinition = {
	id: string
	biomeId?: string
	name: string
	description: string
	active: boolean
	speciesIds: string[]
}

export type SafariParkData = {
	name: string
	description: string
	active: boolean
	biomes: SafariBiomeDefinition[]
}

export type SafariPark = SafariParkData & {
	id: string
	createdAt?: string
	updatedAt?: string
}

export type SafariGaugeValue = -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5

export type SafariStealthTier = "failed" | "basic" | "expert" | "natural20"

export type SafariStealthState = {
	naturalRoll: number
	total: number
	tier: SafariStealthTier
}

export type SafariCaptureSummary = {
	speciesId: string
	name: string
	code: string
}

export type SafariEncounterState = {
	speciesId: string
	gauge: SafariGaugeValue
	repetitions: Record<string, number>
	noChangeCount: number
	stealth?: SafariStealthState
	stealthCaptureFailed: boolean
	lastInteraction?: {
		name: string
		baseDelta: number
		appliedDelta: number
	}
	lastSkillRoll?: {
		skill: Skill
		naturalRoll: number
		total: number
	}
	lastCaptureRoll?: {
		rolls: number[]
		kept: number
		total: number
		dc: number
		success: boolean
	}
}

export type SafariSessionEndReason = "voluntary" | "out-of-balls" | "three-captures"

export type SafariSessionState = {
	id: string
	trainerReadKey: string
	trainerName: string
	trainerLevel: number
	parkId: string
	parkName: string
	biomeId: string
	safariBallsStart: number
	safariBallsRemaining: number
	pokeblocksRemaining: number
	captures: SafariCaptureSummary[]
	biomeChangeUsed: boolean
	pendingStealth?: SafariStealthState
	encounter?: SafariEncounterState
	ended: boolean
	endReason?: SafariSessionEndReason
}

export type SafariCapturePayload = {
	speciesId: string
	nickname: string
	type: string[]
	nature: string
	level: number
	gender: string
	attributes: {
		str: number
		dex: number
		con: number
		int: number
		wis: number
		cha: number
	}
	ac: number
	hp: number
	skillRanks: Record<Skill, number>
	saves: string[]
	abilities: ({ referenceId: string } | { name: string, description: string })[]
	notes: string
	teraType: string
	exp: number
}
