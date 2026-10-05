export const TrainerBattleVisibility = {
	playerOpponent: {
		hp: false,
		hpBar: false,
		ppCurrent: false,
		ppMax: false,
		unrevealedMoves: false,
		unrevealedRoster: false,
		revealedMoveUsage: true,
		statuses: true,
	},
	spectator: {
		hp: true,
		hpBar: true,
		ppCurrent: true,
		ppMax: true,
		unrevealedMoves: true,
		unrevealedRoster: true,
		revealedMoveUsage: true,
		statuses: true,
	},
} as const
