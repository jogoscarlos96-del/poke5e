export type MoveRollerHpContext = () => {
	currentHp?: number,
	maxHp?: number,
}

export const MOVE_ROLLER_HP_CONTEXT = Symbol("move-roller-hp")
