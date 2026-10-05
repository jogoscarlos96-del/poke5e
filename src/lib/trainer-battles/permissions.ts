import type { TrainerBattleRole } from "./types"

export const TrainerBattlePermissions = {
	canControl(role: TrainerBattleRole): boolean {
		return role === "player"
	},
	canViewPrivateBattleState(role: TrainerBattleRole): boolean {
		return role === "spectator"
	},
} as const
