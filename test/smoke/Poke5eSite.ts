import type { Page } from "@playwright/test"
import { Ui } from "./Ui"
import { FakemonPage } from "./FakemonPage"
import { TrainersPage } from "./TrainersPage"

export class Poke5eSite {
	static async startJourney(journeyName: string, page: Page): Promise<Poke5eSite> {
		console.log(`Starting Journey: ${journeyName}`)
		const response = await page.goto("/")

		const siteNav = page.getByLabel("Site")
		try {
			await siteNav.waitFor({ state: "visible", timeout: 10_000 })
		} catch {
			const title = await page.title()
			const bodyText = (await page.locator("body").innerText())
				.replace(/\s+/g, " ")
				.trim()
				.slice(0, 800)
			throw new Error(
				`Expected app Site navigation did not render. `
				+ `status=${response?.status() ?? "unknown"}; `
				+ `url=${page.url()}; title=${JSON.stringify(title)}; `
				+ `body=${JSON.stringify(bodyText)}`,
			)
		}

		const ui = new Ui(page)
		return new Poke5eSite(ui)
	}

	constructor(private readonly ui: Ui) {}

	private siteNavLink(name: string | RegExp) {
		return this.ui.page.getByLabel("Site").getByRole("link", { name, exact: true }).filter({ visible: true })
	}

	async navToFakemon(): Promise<FakemonPage> {
		await this.siteNavLink("Fakémon").click()
		return new FakemonPage(this.ui)
	}

	async navToTrainers(): Promise<TrainersPage> {
		await this.siteNavLink("Trainers").click()
		return new TrainersPage(this.ui)
	}
}
