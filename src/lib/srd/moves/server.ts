import { translateData } from "$lib/site/i18n"
import { chooseEditionData, type Edition } from "../editions"
import type { MoveJson, MovesListJson } from "./schema"
import en2024 from "../data/2024/moves/en.json"
import en2018 from "../data/2018/moves/en.json"

async function all(edition: Edition): Promise<MovesListJson> {
	const values2024 = await translateData<MoveJson>(
		en2024.values as MoveJson[],
		async (locale) => (await import(`../data/2024/moves/${locale}.json`)).values,
	)

	const values2018 = await translateData<MoveJson>(
		en2018.values as MoveJson[],
		async (locale) => (await import(`../data/2018/moves/${locale}.json`)).values,
	)

	const values = chooseEditionData<MoveJson>(edition, values2024, {
		"2018": values2018,
	})

	return { values }
}

function ids(): string[] {
	return en2024.values.map((it) => it.id)
}

async function one(id: string, edition: Edition): Promise<MoveJson | undefined> {
	const moves = await all(edition)

	const single = moves.values.find((it) => it.id === id)

	return single
}

export const MovesSrd = {
	all,
	one,
	ids,
} as const
