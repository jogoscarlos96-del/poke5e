export type TrainerBattleAccess = {
	battleId: string,
	role: "player" | "spectator",
	side?: "a" | "b",
}
