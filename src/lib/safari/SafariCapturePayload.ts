import { experienceNeededAtLevel } from "$lib/poke5e/experience"
import type { PokemonSpecies } from "$lib/poke5e/species"
import { PokemonGender } from "$lib/pokemon/gender"
import { StandardNatures } from "$lib/pokemon/nature"
import { get } from "svelte/store"
import type { SafariCapturePayload } from "./types"

export function safariCapturePayload(species: PokemonSpecies): SafariCapturePayload {
	const defaultAbility = species.abilities.normal[0]
	const nature = get(StandardNatures)[0] ?? "Hardy"

	return {
		speciesId: species.id.data,
		nickname: species.name,
		type: [...species.type.data],
		nature,
		level: species.minLevel,
		gender: PokemonGender.None,
		attributes: { ...species.attributes.data },
		ac: species.ac,
		hp: species.hp,
		skillRanks: { ...species.skills.data },
		saves: [...species.saves],
		abilities: defaultAbility ? [defaultAbility.collapse()] : [],
		notes: species.data.notes ?? "",
		teraType: species.type.primary,
		exp: experienceNeededAtLevel(species.minLevel),
	}
}
