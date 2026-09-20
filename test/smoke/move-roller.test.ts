import { expect, test, type Locator, type Page } from "@playwright/test"
import { Poke5eSite } from "./Poke5eSite"

const MOVE_IDS = ["ember", "fury-swipes", "double-kick"] as const
const DYNAMIC_MOVE_IDS = ["rollout", "magnitude", "fury-cutter"] as const
const CONDITIONAL_MOVE_IDS = ["assurance", "reversal", "stored-power", "last-respects"] as const
const signed = (value: number) => value >= 0 ? `+${value}` : `${value}`

const moveCard = (page: Page, moveName: string) => page
	.locator("div.vstack.space-after")
	.filter({ has: page.getByRole("link", { name: moveName, exact: true }) })
	.first()

const moveRollerDialog = (page: Page) => page.locator([
	'dialog[aria-labelledby="move-roller-title"]',
	'dialog[aria-labelledby="special-move-roller-title"]',
].join(", "))
const errorDialog = (page: Page) => page.locator('dialog[aria-label="Something went wrong"]')

const openMoveRoller = async (page: Page, moveName: string) => {
	const card = moveCard(page, moveName)
	await expect(card).toBeVisible()
	await card.getByRole("button", { name: "decrement" }).click()

	const dialog = moveRollerDialog(page)
	await expect(dialog).toHaveAttribute("open", "", { timeout: 2_500 })
	await expect(dialog.getByText(moveName, { exact: true })).toBeVisible()
	return dialog
}

const assertNoHorizontalOverflow = async (dialog: Locator) => {
	expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
}

const assertNoUnexpectedDialog = async (page: Page, context: string) => {
	const dialog = errorDialog(page)
	if (await dialog.getAttribute("open") !== null) {
		throw new Error(`${context}: ${await dialog.innerText()}`)
	}
}

const resolveInitialHitAndDamage = async (dialog: Locator) => {
	await dialog.getByRole("button", { name: "Roll Attack", exact: true }).click()
	await dialog.getByRole("button", { name: "Hit", exact: true }).click()

	const rollDamage = dialog.getByRole("button", { name: /^Roll (Critical )?Damage$/ })
	await expect(rollDamage).toBeVisible()
	await rollDamage.click()
	await dialog.getByRole("button", { name: "Confirm", exact: true }).click()
}

test("Move Roller resolves standard, combo, and repeated flows", async ({ page }) => {
	test.setTimeout(180_000)

	const site = await Poke5eSite.startJourney("Move Roller integrated verification", page)
	const trainers = await site.navToTrainers()
	const trainerName = `Move Roller Tester ${Math.floor(Math.random() * 999999)}`
	const readKey = await trainers.createTrainer(trainerName)

	await trainers.addPokemon("Charmander")
	await page.getByRole("link", { name: "Edit", exact: true }).click()
	await page.getByLabel("Nickname").fill("Roller Tester")
	await page.getByLabel("Nature").first().selectOption("Serious")
	await page.getByLabel("male", { exact: true }).check()

	for (const moveId of MOVE_IDS) {
		await page.getByRole("button", { name: "Add Move", exact: true }).click()
		await page.getByLabel("Move").last().selectOption(moveId)
	}

	await page.getByRole("button", { name: "Finish!", exact: true }).click()
	await expect(page.getByRole("heading", { name: "Roller Tester", exact: true })).toBeVisible()

	const emberCard = moveCard(page, "Ember")
	const emberPp = emberCard.locator('input[id^="current-pp-"]')
	await expect(emberPp).toBeVisible()
	await emberPp.fill("4")
	await emberPp.press("Tab")
	await page.waitForTimeout(650)
	await assertNoUnexpectedDialog(page, "Unexpected dialog after manual Ember PP correction")
	await expect(moveRollerDialog(page)).toHaveCount(0)

	let dialog = await openMoveRoller(page, "Ember")
	await assertNoHorizontalOverflow(dialog)

	const attackFormula = dialog.locator(".roll-formula strong")
	const baseAttackModifier = Number.parseInt((await attackFormula.innerText()).trim(), 10)
	const attackBonusControl = dialog.locator(".temporary-bonus-control").filter({ hasText: "Temporary Attack Bonus" })
	await attackBonusControl.getByRole("button", { name: "+", exact: true }).click()
	await expect(attackBonusControl.getByText("Current +1", { exact: true })).toBeVisible()
	await expect(attackFormula).toHaveText(signed(baseAttackModifier + 1))
	await dialog.getByRole("button", { name: "Close", exact: true }).click()
	await expect(dialog).not.toBeVisible()

	dialog = await openMoveRoller(page, "Ember")
	const reopenedAttackBonusControl = dialog.locator(".temporary-bonus-control").filter({ hasText: "Temporary Attack Bonus" })
	await expect(reopenedAttackBonusControl.getByText("Current +0", { exact: true })).toBeVisible()
	await expect(dialog.locator(".roll-formula strong")).toHaveText(signed(baseAttackModifier))
	await reopenedAttackBonusControl.getByRole("button", { name: "+", exact: true }).click()
	await expect(reopenedAttackBonusControl.getByText("Current +1", { exact: true })).toBeVisible()
	await expect(dialog.locator(".roll-formula strong")).toHaveText(signed(baseAttackModifier + 1))
	await dialog.getByRole("button", { name: "Roll Attack", exact: true }).click()
	await dialog.getByRole("button", { name: "Hit", exact: true }).click()

	const damageFormula = dialog.locator(".damage-roll .formula strong")
	const baseDamageModifier = Number.parseInt((await damageFormula.innerText()).trim(), 10)
	const damageBonusControl = dialog.locator(".damage-roll .temporary-bonus-control").filter({ hasText: "Temporary Damage Bonus" })
	await damageBonusControl.getByRole("button", { name: "+", exact: true }).click()
	await expect(damageBonusControl.getByText("This roll · Current +1", { exact: true })).toBeVisible()
	await expect(damageFormula).toHaveText(signed(baseDamageModifier + 1))
	await dialog.getByRole("button", { name: /^Roll (Critical )?Damage$/ }).click()
	await dialog.getByRole("button", { name: "Confirm", exact: true }).click()
	await expect(dialog).not.toBeVisible()

	dialog = await openMoveRoller(page, "Ember")
	await expect(dialog.locator(".temporary-bonus-control").filter({ hasText: "Temporary Attack Bonus" }).getByText("Current +0", { exact: true })).toBeVisible()
	await expect(dialog.locator(".roll-formula strong")).toHaveText(signed(baseAttackModifier))
	await dialog.getByRole("button", { name: "Roll Attack", exact: true }).click()
	await dialog.getByRole("button", { name: "Hit", exact: true }).click()
	const reopenedDamageControl = dialog.locator(".damage-roll .temporary-bonus-control").filter({ hasText: "Temporary Damage Bonus" })
	await expect(reopenedDamageControl.getByText("This roll · Current +0", { exact: true })).toBeVisible()
	await expect(dialog.locator(".damage-roll .formula strong")).toHaveText(signed(baseDamageModifier))
	await dialog.getByRole("button", { name: "Close", exact: true }).click()
	await expect(dialog).not.toBeVisible()

	dialog = await openMoveRoller(page, "Fury Swipes")
	await resolveInitialHitAndDamage(dialog)
	await expect(dialog.getByText("Combo Hits", { exact: true })).toBeVisible()

	const comboPanel = dialog.locator("section.multi-hit-continuation")
	await expect(comboPanel).toBeVisible()
	const comboButton = comboPanel.locator("button")
	for (let hit = 2; hit <= 5; hit += 1) {
		await expect(comboButton).toHaveCount(1)
		await expect(comboButton).toBeVisible()
		const actionLabel = (await comboButton.innerText()).trim()
		if (actionLabel === "Confirm Total") break
		await comboButton.click()
		await expect(dialog.getByText(`Hit ${hit}`, { exact: true })).toBeVisible()
	}
	await expect(comboButton).toHaveCount(1)
	await expect(comboButton).toHaveText("Confirm Total")
	await comboButton.click()
	await expect(dialog).not.toBeVisible()

	await page.setViewportSize({ width: 320, height: 700 })
	dialog = await openMoveRoller(page, "Double Kick")
	await assertNoHorizontalOverflow(dialog)
	await resolveInitialHitAndDamage(dialog)
	await expect(dialog.getByText("Multi-Hit Sequence", { exact: true })).toBeVisible()
	await dialog.getByRole("button", { name: "Roll Attack 2", exact: true }).click()
	await dialog.getByRole("button", { name: "Hit", exact: true }).click()
	await assertNoHorizontalOverflow(dialog)

	const repeatedDamage = dialog.getByRole("button", { name: /^Roll \d+d\d+$/ })
	if (await repeatedDamage.isVisible()) {
		await repeatedDamage.click()
		await assertNoHorizontalOverflow(dialog)
		await dialog.getByRole("button", { name: "Confirm Hit", exact: true }).click()
	} else {
		const fullDamage = dialog.getByRole("button", { name: /^Roll (Critical )?Damage$/ })
		await expect(fullDamage).toBeVisible()
		await fullDamage.click()
		await assertNoHorizontalOverflow(dialog)
		await dialog.getByRole("button", { name: "Confirm", exact: true }).click()
	}

	await dialog.getByRole("button", { name: "Confirm Sequence", exact: true }).click()
	await expect(dialog).not.toBeVisible()
	await trainers.removeTrainer(readKey)
})

test("Move Roller continues custom combo and repeated multi-hit flows", async ({ page }) => {
	test.setTimeout(180_000)

	const site = await Poke5eSite.startJourney("Custom multi-hit Move Roller verification", page)
	const trainers = await site.navToTrainers()
	const trainerName = `Custom Multi-Hit Tester ${Math.floor(Math.random() * 999999)}`
	const readKey = await trainers.createTrainer(trainerName)

	await trainers.addPokemon("Charmander")
	await page.getByRole("link", { name: "Edit", exact: true }).click()
	await page.getByLabel("Nickname").fill("Custom Multi-Hit Tester")
	await page.getByLabel("Nature").first().selectOption("Serious")
	await page.getByLabel("male", { exact: true }).check()
	await page.getByRole("button", { name: "Add Move", exact: true }).click()
	const moveSelect = page.getByLabel("Move").last()
	await expect(moveSelect).toContainText("Faultline Smash", { timeout: 10_000 })
	await moveSelect.selectOption({ label: "Faultline Smash" })

	await page.getByRole("button", { name: "Finish!", exact: true }).click()
	await expect(page.getByRole("heading", { name: "Custom Multi-Hit Tester", exact: true })).toBeVisible()

	let dialog = await openMoveRoller(page, "Faultline Smash")
	await dialog.getByLabel("Multi-Hit").selectOption("combo")
	await expect(dialog.getByLabel("Extra-hit dice")).toBeVisible()
	await resolveInitialHitAndDamage(dialog)
	await expect(dialog).toBeVisible()
	await expect(dialog.locator("section.multi-hit-continuation")).toBeVisible()
	await expect(dialog.getByText("Combo Hits", { exact: true })).toBeVisible()
	await dialog.getByRole("button", { name: "Close", exact: true }).click()
	await expect(dialog).not.toBeVisible()

	dialog = await openMoveRoller(page, "Faultline Smash")
	await dialog.getByLabel("Multi-Hit").selectOption("repeated")
	await expect(dialog.getByLabel("Total attacks")).toHaveValue("2")
	await resolveInitialHitAndDamage(dialog)
	await expect(dialog).toBeVisible()
	await expect(dialog.locator("section.multi-hit-continuation")).toBeVisible()
	await expect(dialog.getByText("Multi-Hit Sequence", { exact: true })).toBeVisible()
	await dialog.getByRole("button", { name: "Close", exact: true }).click()
	await expect(dialog).not.toBeVisible()

	await trainers.removeTrainer(readKey)
})

test("Move Roller resolves Population Bomb special multi-hit flow", async ({ page }) => {
	test.setTimeout(180_000)

	const site = await Poke5eSite.startJourney("Population Bomb Move Roller verification", page)
	const trainers = await site.navToTrainers()
	const trainerName = `Population Bomb Roller Tester ${Math.floor(Math.random() * 999999)}`
	const readKey = await trainers.createTrainer(trainerName)

	await trainers.addPokemon("Charmander")
	await page.getByRole("link", { name: "Edit", exact: true }).click()
	await page.getByLabel("Nickname").fill("Population Bomb Tester")
	await page.getByLabel("Nature").first().selectOption("Serious")
	await page.getByLabel("male", { exact: true }).check()
	await page.getByRole("button", { name: "Add Move", exact: true }).click()
	await page.getByLabel("Move").last().selectOption("population-bomb")

	await page.getByRole("button", { name: "Finish!", exact: true }).click()
	await expect(page.getByRole("heading", { name: "Population Bomb Tester", exact: true })).toBeVisible()

	const dialog = await openMoveRoller(page, "Population Bomb")
	await expect(dialog.getByText("Special Multi-Hit", { exact: true })).toBeVisible()
	await assertNoHorizontalOverflow(dialog)

	for (let attack = 1; attack <= 10; attack += 1) {
		await test.step(`Population Bomb attack ${attack}`, async () => {
			await expect(dialog.getByText(`Attack ${attack} of 10`, { exact: true })).toBeVisible()
			const rollAttack = dialog.locator("button").filter({ hasText: "Roll Attack" })
			await expect(rollAttack).toHaveText("Roll Attack")
			await rollAttack.click()
			await dialog.getByRole("button", { name: attack === 1 ? "Hit" : "Miss", exact: true }).click()
		})
	}

	await dialog.getByRole("button", { name: "Confirm Total", exact: true }).click()
	await expect(dialog).not.toBeVisible()
	await trainers.removeTrainer(readKey)
})

test("Move Roller resolves progressive and table-driven damage", async ({ page }) => {
	test.setTimeout(240_000)

	const site = await Poke5eSite.startJourney("Dynamic Move Roller verification", page)
	const trainers = await site.navToTrainers()
	const trainerName = `Dynamic Roller Tester ${Math.floor(Math.random() * 999999)}`
	const readKey = await trainers.createTrainer(trainerName)

	await trainers.addPokemon("Charmander")
	await page.getByRole("link", { name: "Edit", exact: true }).click()
	await page.getByLabel("Nickname").fill("Dynamic Tester")
	await page.getByLabel("Nature").first().selectOption("Serious")
	await page.getByLabel("male", { exact: true }).check()

	for (const moveId of DYNAMIC_MOVE_IDS) {
		await page.getByRole("button", { name: "Add Move", exact: true }).click()
		await page.getByLabel("Move").last().selectOption(moveId)
	}

	await page.getByRole("button", { name: "Finish!", exact: true }).click()
	await expect(page.getByRole("heading", { name: "Dynamic Tester", exact: true })).toBeVisible()

	let dialog = await openMoveRoller(page, "Rollout")
	await dialog.getByRole("button", { name: "Roll Attack", exact: true }).click()
	await dialog.getByRole("button", { name: "Hit", exact: true }).click()
	await expect(dialog.getByText("Rollout progression", { exact: true })).toBeVisible()
	await dialog.getByLabel("Consecutive successful hit").selectOption("3")
	await dialog.getByRole("button", { name: /^Roll (Critical )?Damage$/ }).click()
	await expect(dialog.getByText(/Unable to roll/)).toHaveCount(0)
	await dialog.getByRole("button", { name: "Confirm", exact: true }).click()
	await expect(dialog).not.toBeVisible()

	dialog = await openMoveRoller(page, "Fury Cutter")
	await dialog.getByRole("button", { name: "Roll Attack", exact: true }).click()
	await dialog.getByRole("button", { name: "Hit", exact: true }).click()
	await expect(dialog.getByText("Fury Cutter progression", { exact: true })).toBeVisible()
	await dialog.getByLabel("Consecutive successful hit").selectOption("4")
	await dialog.getByRole("button", { name: /^Roll (Critical )?Damage$/ }).click()
	await expect(dialog.getByText(/Unable to roll/)).toHaveCount(0)
	await dialog.getByRole("button", { name: "Confirm", exact: true }).click()
	await expect(dialog).not.toBeVisible()

	dialog = await openMoveRoller(page, "Magnitude")
	await dialog.getByRole("button", { name: "Save Failed", exact: true }).click()
	await expect(dialog.getByText("Magnitude damage", { exact: true })).toBeVisible()
	await dialog.getByLabel("d100 result").fill("70")
	await expect(dialog.getByText(/Resolved \d+d\d+/)).toBeVisible()
	await dialog.getByRole("button", { name: "Roll Damage", exact: true }).click()
	await expect(dialog.getByText(/Unable to roll/)).toHaveCount(0)
	await dialog.getByRole("button", { name: "Confirm", exact: true }).click()
	await expect(dialog).not.toBeVisible()

	await trainers.removeTrainer(readKey)
})

test("Move Roller resolves Outrage as one three-round sequence roll", async ({ page }) => {
	test.setTimeout(180_000)

	const site = await Poke5eSite.startJourney("Outrage Move Roller verification", page)
	const trainers = await site.navToTrainers()
	const trainerName = `Outrage Roller Tester ${Math.floor(Math.random() * 999999)}`
	const readKey = await trainers.createTrainer(trainerName)

	await trainers.addPokemon("Charmander")
	await page.getByRole("link", { name: "Edit", exact: true }).click()
	await page.getByLabel("Nickname").fill("Outrage Tester")
	await page.getByLabel("Nature").first().selectOption("Serious")
	await page.getByLabel("male", { exact: true }).check()
	await page.getByRole("button", { name: "Add Move", exact: true }).click()
	await page.getByLabel("Move").last().selectOption("outrage")

	await page.getByRole("button", { name: "Finish!", exact: true }).click()
	await expect(page.getByRole("heading", { name: "Outrage Tester", exact: true })).toBeVisible()

	const dialog = await openMoveRoller(page, "Outrage")
	await expect(dialog.getByText("Outrage sequence", { exact: true })).toBeVisible()
	await expect(dialog.getByRole("button", { name: "Roll Outrage Sequence", exact: true })).toBeVisible()
	await dialog.getByRole("button", { name: "Roll Outrage Sequence", exact: true }).click()

	for (let round = 1; round <= 3; round += 1) {
		await expect(dialog.getByText(`Round ${round}`, { exact: true })).toBeVisible()
	}
	await expect(dialog.getByText(/Unable to resolve Outrage/)).toHaveCount(0)
	await dialog.getByRole("button", { name: "Confirm Sequence", exact: true }).click()
	await expect(dialog).not.toBeVisible()

	await trainers.removeTrainer(readKey)
})

test("Move Roller resolves conditional, HP-scaled, and count-based damage rules", async ({ page }) => {
	test.setTimeout(300_000)

	const site = await Poke5eSite.startJourney("Conditional Move Roller verification", page)
	const trainers = await site.navToTrainers()
	const trainerName = `Conditional Roller Tester ${Math.floor(Math.random() * 999999)}`
	const readKey = await trainers.createTrainer(trainerName)

	await trainers.addPokemon("Charmander")
	await page.getByRole("link", { name: "Edit", exact: true }).click()
	await page.getByLabel("Nickname").fill("Conditional Tester")
	await page.getByLabel("Nature").first().selectOption("Serious")
	await page.getByLabel("male", { exact: true }).check()

	for (const moveId of CONDITIONAL_MOVE_IDS) {
		await page.getByRole("button", { name: "Add Move", exact: true }).click()
		await page.getByLabel("Move").last().selectOption(moveId)
	}

	await page.getByRole("button", { name: "Finish!", exact: true }).click()
	await expect(page.getByRole("heading", { name: "Conditional Tester", exact: true })).toBeVisible()

	let dialog = await openMoveRoller(page, "Assurance")
	await dialog.getByRole("button", { name: "Roll Attack", exact: true }).click()
	await dialog.getByRole("button", { name: "Hit", exact: true }).click()
	await expect(dialog.getByText("Assurance condition", { exact: true })).toBeVisible()
	await dialog.getByLabel("Target already took damage this round").check()
	await expect(dialog.getByText(/Damage dice/)).toBeVisible()
	await dialog.getByRole("button", { name: /^Roll (Critical )?Damage$/ }).click()
	await expect(dialog.getByText(/Unable to roll/)).toHaveCount(0)
	await dialog.getByRole("button", { name: "Confirm", exact: true }).click()
	await expect(dialog).not.toBeVisible()

	const hpInput = page.locator("#current-hp")
	await hpInput.fill("0")
	await hpInput.press("Tab")
	await expect(hpInput).toHaveValue("0")
	dialog = await openMoveRoller(page, "Reversal")
	await dialog.getByRole("button", { name: "Roll Attack", exact: true }).click()
	await dialog.getByRole("button", { name: "Hit", exact: true }).click()
	await expect(dialog.getByText("Reversal HP scaling", { exact: true })).toBeVisible()
	await expect(dialog.getByText(/^0 \/ \d+ · 0%$/)).toBeVisible({ timeout: 10_000 })
	await expect(dialog.getByText("3× total damage", { exact: true })).toBeVisible()
	await dialog.getByRole("button", { name: /^Roll (Critical )?Damage$/ }).click()
	await dialog.getByRole("button", { name: "Confirm", exact: true }).click()
	await expect(dialog.getByText("Reversal final damage", { exact: true })).toBeVisible()
	await dialog.getByRole("button", { name: "Confirm Final Damage", exact: true }).click()
	await expect(dialog).not.toBeVisible()

	dialog = await openMoveRoller(page, "Stored Power")
	await dialog.getByRole("button", { name: "Roll Attack", exact: true }).click()
	await dialog.getByRole("button", { name: "Hit", exact: true }).click()
	await expect(dialog.getByText("Stored Power bonus dice", { exact: true })).toBeVisible()
	await dialog.getByLabel("Active stat-changing effects on the user").fill("3")
	await expect(dialog.getByText(/Resolved damage dice/)).toBeVisible()
	await dialog.getByRole("button", { name: /^Roll (Critical )?Damage$/ }).click()
	await expect(dialog.getByText(/Unable to roll/)).toHaveCount(0)
	await dialog.getByRole("button", { name: "Confirm", exact: true }).click()
	await expect(dialog).not.toBeVisible()

	dialog = await openMoveRoller(page, "Last Respects")
	await dialog.getByRole("button", { name: "Roll Attack", exact: true }).click()
	await dialog.getByRole("button", { name: "Hit", exact: true }).click()
	await expect(dialog.getByText("Last Respects bonus dice", { exact: true })).toBeVisible()
	await dialog.getByLabel("Currently downed allies this combat").fill("9")
	await expect(dialog.locator(".dynamic-rule .resolved-line strong")).toHaveText("10d6")
	await dialog.getByRole("button", { name: /^Roll (Critical )?Damage$/ }).click()
	await expect(dialog.getByText(/Unable to roll/)).toHaveCount(0)
	await dialog.getByRole("button", { name: "Confirm", exact: true }).click()
	await expect(dialog).not.toBeVisible()

	await trainers.removeTrainer(readKey)
})
