import { expect, test, type Locator, type Page } from "@playwright/test"
import { Poke5eSite } from "./Poke5eSite"

const MOVE_IDS = ["ember", "fury-swipes", "double-kick", "population-bomb"] as const
const DYNAMIC_MOVE_IDS = ["rollout", "magnitude", "fury-cutter", "outrage"] as const

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

test("Move Roller resolves standard, combo, repeated, and special multi-hit flows", async ({ page }) => {
	// Live Vercel + Supabase round-trips make this full end-to-end journey slower than
	// the local smoke suite. Keep enough headroom for all four move families.
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

	// Manual PP correction is not a move use and must not open the roller.
	const emberCard = moveCard(page, "Ember")
	const emberPp = emberCard.locator('input[id^="current-pp-"]')
	await expect(emberPp).toBeVisible()
	await emberPp.fill("2")
	await emberPp.press("Tab")
	await page.waitForTimeout(650)
	await assertNoUnexpectedDialog(page, "Unexpected dialog after manual Ember PP correction")
	await expect(moveRollerDialog(page)).toHaveCount(0)

	// Standard attack -> hit -> damage -> close.
	let dialog = await openMoveRoller(page, "Ember")
	await assertNoHorizontalOverflow(dialog)
	await resolveInitialHitAndDamage(dialog)
	await expect(dialog).not.toBeVisible()

	// Same-roll Combo family, including continuation and final total.
	dialog = await openMoveRoller(page, "Fury Swipes")
	await resolveInitialHitAndDamage(dialog)
	await expect(dialog.getByText("Combo Hits", { exact: true })).toBeVisible()

	const comboPanel = dialog.locator("section.multi-hit-continuation")
	await expect(comboPanel).toBeVisible()
	const comboButton = comboPanel.locator("button")
	for (let hit = 2; hit <= 5; hit += 1) {
		// The combo panel exposes exactly one action at a time. Read the rendered
		// action instead of relying on a specific accessible name while Svelte
		// swaps continuation for the final confirmation state.
		await expect(comboButton).toHaveCount(1)
		await expect(comboButton).toBeVisible()
		const actionLabel = (await comboButton.innerText()).trim()
		if (actionLabel === "Confirm Total") break
		await comboButton.click()
		// Every combo attempt adds a history row, whether it succeeds or ends the combo.
		await expect(dialog.getByText(`Hit ${hit}`, { exact: true })).toBeVisible()
	}
	await expect(comboButton).toHaveCount(1)
	await expect(comboButton).toHaveText("Confirm Total")
	await comboButton.click()
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

test("Move Roller resolves progressive, table-driven, and round-sequence damage", async ({ page }) => {
	test.setTimeout(180_000)

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

	// Rollout resolves its symbolic R die from the selected consecutive-hit stage.
	let dialog = await openMoveRoller(page, "Rollout")
	await dialog.getByRole("button", { name: "Roll Attack", exact: true }).click()
	await dialog.getByRole("button", { name: "Hit", exact: true }).click()
	await expect(dialog.getByText("Rollout progression", { exact: true })).toBeVisible()
	await dialog.getByLabel("Consecutive successful hit").selectOption("3")
	await dialog.getByRole("button", { name: /^Roll (Critical )?Damage$/ }).click()
	await expect(dialog.getByText(/Unable to roll/)).toHaveCount(0)
	await dialog.getByRole("button", { name: "Confirm", exact: true }).click()
	await expect(dialog).not.toBeVisible()

	// Fury Cutter uses the same progressive framework even though its base dice are ordinary NdM dice.
	dialog = await openMoveRoller(page, "Fury Cutter")
	await dialog.getByRole("button", { name: "Roll Attack", exact: true }).click()
	await dialog.getByRole("button", { name: "Hit", exact: true }).click()
	await expect(dialog.getByText("Fury Cutter progression", { exact: true })).toBeVisible()
	await dialog.getByLabel("Consecutive successful hit").selectOption("4")
	await dialog.getByRole("button", { name: /^Roll (Critical )?Damage$/ }).click()
	await expect(dialog.getByText(/Unable to roll/)).toHaveCount(0)
	await dialog.getByRole("button", { name: "Confirm", exact: true }).click()
	await expect(dialog).not.toBeVisible()

	// Magnitude converts a d100 table result into a concrete rollable expression.
	dialog = await openMoveRoller(page, "Magnitude")
	await dialog.getByRole("button", { name: "Save Failed", exact: true }).click()
	await expect(dialog.getByText("Magnitude damage", { exact: true })).toBeVisible()
	await dialog.getByLabel("d100 result").fill("70")
	await expect(dialog.getByText(/Resolved \d+d\d+/)).toBeVisible()
	await dialog.getByRole("button", { name: "Roll Damage", exact: true }).click()
	await expect(dialog.getByText(/Unable to roll/)).toHaveCount(0)
	await dialog.getByRole("button", { name: "Confirm", exact: true }).click()
	await expect(dialog).not.toBeVisible()

	// Outrage spends PP once, then keeps the drawer open for its three automatic-hit rounds.
	dialog = await openMoveRoller(page, "Outrage")
	for (let round = 1; round <= 3; round += 1) {
		await expect(dialog.getByText(`Round ${round} of 3`, { exact: true })).toBeVisible()
		await dialog.getByRole("button", { name: "Roll Damage", exact: true }).click()
		await expect(dialog.getByText(/Unable to roll/)).toHaveCount(0)
		await dialog.getByRole("button", { name: "Confirm", exact: true }).click()
		if (round < 3) await expect(dialog).toBeVisible()
	}
	await expect(dialog).not.toBeVisible()

	await trainers.removeTrainer(readKey)
})
