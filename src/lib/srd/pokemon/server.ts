import { translateData } from "$lib/site/i18n"
import { chooseEditionData, type Edition } from "../editions"
import type { PokemonJson, PokemonListJson } from "./schema"
import en2024 from "../data/2024/pokemon/en.json"
import en2018 from "../data/2018/pokemon/en.json"

async function all(edition: Edition): Promise<PokemonListJson> {
	const values2024 = await translateData<PokemonJson>(
		en2024.values as PokemonJson[],
		async (locale) => (await import(`./data/2024/pokemon/${locale}.json`)).values,
	)

	const values2018 = await translateData<PokemonJson>(
		en2018.values as PokemonJson[],
		async (locale) => (await import(`./data/2018/pokemon/${locale}.json`)).values,
	)

	const values = chooseEditionData<PokemonJson>(edition, values2024, {
		"2018": values2018,
	})

	return { values }
}

function ids(): string[] {
	return en2024.values.map((it) => it.id)
}

async function one(id: string, edition: Edition): Promise<PokemonJson | undefined> {
	const values = await all(edition)

	const single = values.values.find((it) => it.id === id)

	return single
}

export const PokemonSrd = {
	all,
	one,
	ids,
} as const
