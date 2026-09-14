import { Ability } from "$lib/pokemon/ability"
import { PokemonType, type PokeType } from "$lib/pokemon/types"
import { userAssets } from "$lib/site/user-assets"

type StoredMegaAbility = {
	referenceId: string,
} | {
	name: string,
	description: string,
}

export type MegaDefinitionData = {
	name: string,
	type?: PokeType[],
	ability?: StoredMegaAbility,
	portraitUrl?: string,
	spriteUrl?: string,
}

export type MegaDefinitionRow = {
	id: string,
	species_id: string,
	mega_data: MegaDefinitionData,
	portrait_filename?: string | null,
	sprite_filename?: string | null,
	created_at?: string,
	updated_at?: string,
}

export type MegaMediaResource = {
	name: string,
	href: string,
}

export type MegaDefinition = {
	id: string,
	speciesId: string,
	name: string,
	type?: PokemonType,
	ability?: Ability,
	portrait?: MegaMediaResource,
	sprite?: MegaMediaResource,
	createdAt?: string,
	updatedAt?: string,
}

export type DraftMegaDefinition = Omit<MegaDefinition, "id" | "createdAt" | "updatedAt">

const isReferenceAbility = (ability: StoredMegaAbility): ability is { referenceId: string } =>
	"referenceId" in ability && ability.referenceId.length > 0

const mediaResource = (filename?: string | null, fallbackUrl?: string): MegaMediaResource | undefined => {
	if (filename) return { name: filename, href: userAssets.getAssetUrl(filename) }
	const href = fallbackUrl?.trim()
	return href ? { name: href, href } : undefined
}

export const MegaDefinitions = {
	fromRow: async (row: MegaDefinitionRow): Promise<MegaDefinition> => {
		const data = row.mega_data ?? { name: "Mega Form" }
		const type = data.type?.filter(PokemonType.isPokeType) ?? []
		return {
			id: row.id,
			speciesId: row.species_id,
			name: data.name || "Mega Form",
			type: type.length > 0 ? new PokemonType(type) : undefined,
			ability: data.ability
				? isReferenceAbility(data.ability)
					? await Ability.resolve(data.ability.referenceId)
					: new Ability({ name: data.ability.name, description: data.ability.description })
				: undefined,
			portrait: mediaResource(row.portrait_filename, data.portraitUrl),
			sprite: mediaResource(row.sprite_filename, data.spriteUrl),
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		}
	},

	toStoredData: (definition: Pick<MegaDefinition, "name" | "type" | "ability" | "portrait" | "sprite">): MegaDefinitionData => ({
		name: definition.name.trim() || "Mega Form",
		type: definition.type?.data,
		ability: definition.ability
			? definition.ability.referenceId
				? { referenceId: definition.ability.referenceId }
				: { name: definition.ability.name, description: definition.ability.description }
			: undefined,
		portraitUrl: definition.portrait?.name === definition.portrait?.href ? definition.portrait.href : undefined,
		spriteUrl: definition.sprite?.name === definition.sprite?.href ? definition.sprite.href : undefined,
	}),
} as const
