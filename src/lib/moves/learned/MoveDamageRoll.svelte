<script lang="ts">
	import { getContext } from "svelte"
	import type { MoveStats } from "../MoveStats"
	import DynamicMoveDamageRoll from "./DynamicMoveDamageRoll.svelte"
	import { MOVE_ROLLER_HP_CONTEXT, type MoveRollerHpContext } from "./MoveRollerContext"

	export let moveName: string | undefined = undefined
	export let damage: NonNullable<MoveStats["damage"]>
	export let onconfirm: (value?: number) => void
	export let critical = false
	export let criticalDiceMultiplier = 2
	export let moveType: string | undefined = undefined
	export let currentHp: number | undefined = undefined
	export let maxHp: number | undefined = undefined
	export let onapplyhealing: ((value: number) => void) | undefined = undefined

	const hpContext = getContext<MoveRollerHpContext | undefined>(MOVE_ROLLER_HP_CONTEXT)
	const contextHp = hpContext?.()
	$: effectiveCurrentHp = currentHp ?? contextHp?.currentHp
	$: effectiveMaxHp = maxHp ?? contextHp?.maxHp
</script>

<DynamicMoveDamageRoll
	{moveName}
	{damage}
	{onconfirm}
	{critical}
	{criticalDiceMultiplier}
	{moveType}
	currentHp={effectiveCurrentHp}
	maxHp={effectiveMaxHp}
	{onapplyhealing}
/>
