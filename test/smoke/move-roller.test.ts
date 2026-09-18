import { expect, test, type Locator, type Page } from "@playwright/test"
import { Poke5eSite } from "./Poke5eSite"

const MOVE_IDS = ["ember", "fury-swipes", "double-kick", "population-bomb"] as const

const moveCard = (page: Page, moveName: string) => page
	.locator("div.vstack.space-after")
	.filter({ has: page.getByRole("link", { name: moveName, exact: true }) })
	.first()

const openMoveRoller = async (page: Page, moveName: string) => {
	const card = moveCard(page, moveName)
	await expect(card).toBeVisible()
	await card.getByRole("button", { name: "decrement" }).click()

	const dialog = page.getByRole("dialog")
	await expect(dialog).toBeVisible({ timeout: 2_500 })
	await expect(dialog.getByText(moveName, { exact: true })).toBeVisible()
	return dialog
}

const assertNoHorizontalOverflow = async (dialog: Locator) => {
	expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
}

const assertNoUnexpectedDialog = async (page: Page, context: string) => {
	const dialog = page.getByRole("dialog")
	if (await dialog.isVisible()) {
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

test("Move Roller resolves standard, combo, repeated, and special multi-hit flows", async ({ page }) => {
	test.setTimeout(90_000)

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

	// Manual PP correction is not a move use and must not open the roller.
	const emberCard = moveCard(page, "Ember")
	const emberPp = emberCard.locator('input[id^="current-pp-"]')
	await expect(emberPp).toBeVisible()
	await emberPp.fill("2")
	await emberPp.press("Tab")
	await page.waitForTimeout(650)
	await assertNoUnexpectedDialog(page, "Unexpected dialog after manual Ember PP correction")

	// Standard attack -> hit -> damage -> close.
	let dialog = await openMoveRoller(page, "Ember")
	await assertNoHorizontalOverflow(dialog)
	await resolveInitialHitAndDamage(dialog)
	await expect(dialog).not.toBeVisible()

	// Same-roll Combo family, including continuation and final total.
	dialog = await openMoveRoller(page, "Fury Swipes")
	await resolveInitialHitAndDamage(dialog)
	await expect(dialog.getByText("Combo Hits", { exact: true })).toBeVisible()

	const confirmCombo = dialog.getByRole("button", { name: "Confirm Total", exact: true })
	for (let attempt = 0; attempt < 5 && !(await confirmCombo.isVisible()); attempt += 1) {
		const continueCombo = dialog.getByRole("button", {
			name: /^(Roll for Additional Hit|Resolve Guaranteed Hit 2)$/,
		})
		await expect(continueCombo).toBeVisible()
		await continueCombo.click()
	}
	await expect(confirmCombo).toBeVisible()
	await confirmCombo.click()
	await expect(dialog).not.toBeVisible()

	// Separate-attack repeated family at a narrow viewport. Resolve hit 2 damage and
	// confirm that the drawer never grows wider than its own viewport allocation.
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

	// Bespoke special family: Population Bomb uses ten independent attacks with
	// fixed per-hit damage. Resolve one hit and nine misses through the real drawer.
	dialog = await openMoveRoller(page, "Population Bomb")
	await expect(dialog.getByText("Special Multi-Hit", { exact: true })).toBeVisible()
	await assertNoHorizontalOverflow(dialog)

	for (let attack = 1; attack <= 10; attack += 1) {
		await expect(dialog.getByText(`Attack ${attack} of 10`, { exact: true })).toBeVisible()
		await dialog.getByRole("button", { name: "Roll Attack", exact: true }).click()
		await dialog.getByRole("button", { name: attack === 1 ? "Hit" : "Miss", exact: true }).click()
	}

	await dialog.getByRole("button", { name: "Confirm Total", exact: true }).click()
	await expect(dialog).not.toBeVisible()

	await trainers.removeTrainer(readKey)
})
