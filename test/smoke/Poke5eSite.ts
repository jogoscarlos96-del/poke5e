import type { Page } from "@playwright/test"
import { Ui } from "./Ui"
import { FakemonPage } from "./FakemonPage"
import { TrainersPage } from "./TrainersPage"

export class Poke5eSite {
	static async startJourney(journeyName: string, page: Page): Promise<Poke5eSite> {
		console.log(`Starting Journey: ${journeyName}`)
		await page.goto("/")

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
