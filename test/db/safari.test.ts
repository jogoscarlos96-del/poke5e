import { expect, test } from "vitest"
import { call, callAll, expectError, supabase } from "./supabase"

const MANAGEMENT_KEY = "de33140c5dcd22058216950f9d52ab590719278c66e5800c486ca4d5efe8feba"

test("Safari Parks are managed with the campaign key and only active content is public", async () => {
	await expectError("42501", () => supabase.rpc("new_safari_park", {
		_management_key: "wrong",
		_park_data: {
			name: "Denied Park",
			description: "",
			active: true,
			biomes: [],
		},
	}))

	const parkId = await call<string>("new_safari_park", {
		_management_key: MANAGEMENT_KEY,
		_park_data: {
			name: "Test Safari",
			description: "Database test park.",
			active: false,
			biomes: [{
				id: "forest",
				name: "Forest",
				description: "",
				active: true,
				speciesIds: ["pikachu"],
			}, {
				id: "secret",
				name: "Secret Cave",
				description: "",
				active: false,
				speciesIds: ["mew"],
			}],
		},
	})

	const hiddenPublic = await callAll<{ id: string }>("list_safari_parks", {})
	expect(hiddenPublic.some((park) => park.id === parkId)).toBe(false)

	expect(await call<number>("update_safari_park", {
		_management_key: MANAGEMENT_KEY,
		_id: parkId,
		_park_data: {
			name: "Test Safari",
			description: "Database test park.",
			active: true,
			biomes: [{
				id: "forest",
				name: "Forest",
				description: "",
				active: true,
				speciesIds: ["pikachu"],
			}, {
				id: "secret",
				name: "Secret Cave",
				description: "",
				active: false,
				speciesIds: ["mew"],
			}],
		},
	})).toBe(1)

	const publicParks = await callAll<{ id: string, park_data: { biomes: { id: string }[] } }>("list_safari_parks", {})
	const publicPark = publicParks.find((park) => park.id === parkId)
	expect(publicPark).toBeDefined()
	expect(publicPark?.park_data.biomes.map((biome) => biome.id)).toEqual(["forest"])

	const managedParks = await callAll<{ id: string, park_data: { biomes: { id: string }[] } }>("list_all_safari_parks", {
		_management_key: MANAGEMENT_KEY,
	})
	const managedPark = managedParks.find((park) => park.id === parkId)
	expect(managedPark?.park_data.biomes.map((biome) => biome.id)).toEqual(["forest", "secret"])

	expect(await call<number>("remove_safari_park", {
		_management_key: MANAGEMENT_KEY,
		_id: parkId,
	})).toBe(1)
})

test("Safari Capture Codes redeem once into a Trainer Pokemon", async () => {
	const {
		ret_id: trainerId,
		ret_read_key: readKey,
		ret_write_key: writeKey,
	} = await call<{
		ret_id: string
		ret_read_key: string
		ret_write_key: string
	}>("new_trainer", Iris())

	const code = await call<string>("new_safari_capture_claim", {
		_trainer_read_key: readKey,
		_session_id: "11111111-1111-4111-8111-111111111111",
		_species_id: "pikachu",
		_species_sr: 2,
		_pokemon_data: {
			speciesId: "pikachu",
			nickname: "Pikachu",
			type: ["electric"],
			nature: "Hardy",
			level: 1,
			gender: "none",
			attributes: { str: 8, dex: 14, con: 10, int: 8, wis: 12, cha: 12 },
			ac: 12,
			hp: 16,
			skillRanks: EmptyRanks(),
			saves: ["dex"],
			abilities: [{ referenceId: "static" }],
			notes: "",
			teraType: "electric",
			exp: 0,
		},
	})

	expect(code).toHaveLength(13)

	const pokemonId = await call<number>("redeem_safari_capture", {
		_trainer_write_key: writeKey,
		_capture_code: code,
	})
	expect(pokemonId).toBeGreaterThan(0)

	await call("redeem_safari_capture", {
		_trainer_write_key: writeKey,
		_capture_code: code,
	}, { assertNull: true })

	const pokemon = await callAll<{ id: number, species: string, nickname: string, level: number }>("get_pokemon", {
		_trainer_id: trainerId,
	})
	const redeemed = pokemon.find((entry) => entry.id === pokemonId)
	expect(redeemed?.species).toBe("pikachu")
	expect(redeemed?.nickname).toBe("Pikachu")
	expect(redeemed?.level).toBe(1)

	await call("delete_trainer", {
		_write_key: writeKey,
		_id: trainerId,
	})
})

const EmptyRanks = () => ({
	"athletics": 0,
	"acrobatics": 0,
	"sleight of hand": 0,
	"stealth": 0,
	"arcana": 0,
	"history": 0,
	"investigation": 0,
	"nature": 0,
	"religion": 0,
	"animal handling": 0,
	"insight": 0,
	"medicine": 0,
	"perception": 0,
	"survival": 0,
	"deception": 0,
	"intimidation": 0,
	"performance": 0,
	"persuasion": 0,
})

const Iris = () => ({
	_name: "Safari Tester",
	_description: "Temporary Safari database test trainer.",
	_level: 6,
	_ac: 11,
	_hp_cur: 50,
	_hp_max: 50,
	_hit_dice_cur: 6,
	_hit_dice_max: 6,
	_strength: 10,
	_dexterity: 16,
	_constitution: 10,
	_intelligence: 13,
	_wisdom: 11,
	_charisma: 15,
	_save_str: false,
	_save_dex: true,
	_save_con: false,
	_save_int: false,
	_save_wis: false,
	_save_cha: true,
	_species: "Human",
	_gender: null,
	_age: null,
	_home_region: null,
	_background: null,
	_money: 0,
	_special_normal: 0,
	_special_fighting: 0,
	_special_flying: 0,
	_special_poison: 0,
	_special_ground: 0,
	_special_rock: 0,
	_special_bug: 0,
	_special_ghost: 0,
	_special_steel: 0,
	_special_fire: 0,
	_special_water: 0,
	_special_grass: 1,
	_special_electric: 0,
	_special_psychic: 0,
	_special_ice: 0,
	_special_dragon: 0,
	_special_dark: 0,
	_special_fairy: 0,
	_path_name: "Nurse",
	_path_resource: 3,
	_path_rank_1_name: "",
	_path_rank_1_desc: "",
	_path_rank_2_name: "",
	_path_rank_2_desc: "",
	_path_rank_3_name: "",
	_path_rank_3_desc: "",
	_path_rank_4_name: "",
	_path_rank_4_desc: "",
	_rank_athletics: 0,
	_rank_acrobatics: 2,
	_rank_sleight_of_hand: 0,
	_rank_stealth: 1,
	_rank_arcana: 0,
	_rank_history: 0,
	_rank_investigation: 0,
	_rank_nature: 0,
	_rank_religion: 0,
	_rank_animal_handling: 1,
	_rank_insight: 0,
	_rank_medicine: 0,
	_rank_perception: 0,
	_rank_survival: 0,
	_rank_deception: 1,
	_rank_intimidation: 0,
	_rank_performance: 0,
	_rank_persuasion: 0,
})
