<script lang="ts">
	import type { MoveStats } from "../MoveStats"
	import DynamicMoveDamageRoll from "./DynamicMoveDamageRoll.svelte"

	export let moveName: string | undefined = undefined
	export let damage: NonNullable<MoveStats["damage"]>
	export let onconfirm: (value?: number) => void
	export let critical = false
	export let criticalDiceMultiplier = 2
	export let moveType: string | undefined = undefined
	export let currentHp: number | undefined = undefined
	export let maxHp: number | undefined = undefined
	export let onapplyhealing: ((value: number) => void) | undefined = undefined
</script>

<DynamicMoveDamageRoll
	{moveName}
	{damage}
	{onconfirm}
	{critical}
	{criticalDiceMultiplier}
	{moveType}
	{currentHp}
	{maxHp}
	{onapplyhealing}
/>
