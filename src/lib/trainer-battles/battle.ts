import type { TrainerBattleSession, TrainerBattleSide } from "./types"

export function opponentSide(side: TrainerBattleSide): TrainerBattleSide {
	return side === "a" ? "b" : "a"
}

export function participantCount(session: TrainerBattleSession): number {
	return Object.values(session.participants).filter(Boolean).length
}
