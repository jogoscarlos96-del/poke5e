import { expect, test } from "vitest"
import { call } from "./supabase"

test("Mega Evolution state respects trainer read and write keys", async () => {
	const {
		ret_id: trainerId,
		ret_read_key: readKey,
		ret_write_key: writeKey,
	} = await call<{
		ret_id: string,
		ret_read_key: string,
		ret_write_key: string,
	}>("new_trainer", Iris())

	const pokemonId = await call<number>("add_pokemon", {
		_write_key: writeKey,
		...SunnyYellow(),
	})

	const initial = await call<{
		selected_mega_id: string | null,
	}>("get_pokemon_mega", {
		_pokemon_id: pokemonId,
		_read_key: readKey,
	})

	expect(initial.selected_mega_id).toBeNull()

	const {
		ret_id: vivillonMegaId,
		ret_write_key: vivillonMegaWriteKey,
	} = await call<{
		ret_id: string,
		ret_write_key: string,
	}>("new_mega_evolution", {
		_species_id: "vivillon",
		_mega_data: {
			name: "Mega Vivillon",
			type: ["bug", "dragon"],
			ability: { referenceId: "tough-claws" },
			portraitUrl: "https://example.invalid/mega-vivillon.png",
		},
	})

	const updated = await call<number>("update_pokemon_mega", {
		_write_key: writeKey,
		_pokemon_id: pokemonId,
		_selected_mega_id: vivillonMegaId,
	})

	expect(updated).toEqual(1)

	const stored = await call<{
		selected_mega_id: string | null,
	}>("get_pokemon_mega", {
		_pokemon_id: pokemonId,
		_read_key: readKey,
	})

	expect(stored.selected_mega_id).toEqual(vivillonMegaId)

	const denied = await call<number>("update_pokemon_mega", {
		_write_key: "INCORRECTKEY",
		_pokemon_id: pokemonId,
		_selected_mega_id: null,
	})

	expect(denied).toEqual(0)

	const unchanged = await call<{
		selected_mega_id: string | null,
	}>("get_pokemon_mega", {
		_pokemon_id: pokemonId,
		_read_key: readKey,
	})

	expect(unchanged.selected_mega_id).toEqual(vivillonMegaId)

	await call("get_pokemon_mega", {
		_pokemon_id: pokemonId,
		_read_key: "INCORRECTKEY",
	}, {
		assertNull: true,
	})

	const {
		ret_id: charizardMegaId,
		ret_write_key: charizardMegaWriteKey,
	} = await call<{
		ret_id: string,
		ret_write_key: string,
	}>("new_mega_evolution", {
		_species_id: "charizard",
		_mega_data: {
			name: "Mega Charizard X",
		},
	})

	const mismatched = await call<number>("update_pokemon_mega", {
		_write_key: writeKey,
		_pokemon_id: pokemonId,
		_selected_mega_id: charizardMegaId,
	})

	expect(mismatched).toEqual(1)

	const validated = await call<{
		selected_mega_id: string | null,
	}>("get_pokemon_mega", {
		_pokemon_id: pokemonId,
		_read_key: readKey,
	})

	expect(validated.selected_mega_id).toBeNull()

	expect(await call<number>("remove_mega_evolution", {
		_id: vivillonMegaId,
		_write_key: vivillonMegaWriteKey,
	})).toEqual(1)

	expect(await call<number>("remove_mega_evolution", {
		_id: charizardMegaId,
		_write_key: charizardMegaWriteKey,
	})).toEqual(1)

	await call("delete_trainer", {
		_write_key: writeKey,
		_id: trainerId,
	})

	await call("get_pokemon_mega", {
		_pokemon_id: pokemonId,
		_read_key: readKey,
	}, {
		assertNull: true,
	})
})

const Iris = () => ({
	_name: "Iris",
	_description: "A trainer who loves colors.",
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

const SunnyYellow = () => ({
	_nickname: "Sunny Yellow",
	_species: "vivillon",
	_nature: "Quirky",
	_type: ["bug", "flying"],
	_level: 6,
	_gender: "female",
	_strength: 12,
	_dexterity: 17,
	_constitution: 16,
	_intelligence: 6,
	_wisdom: 14,
	_charisma: 10,
	_ac: 14,
	_hp_cur: 66,
	_hp_max: 66,
	_hit_dice_cur: 6,
	_hit_dice_max: 6,
	_save_str: false,
	_save_dex: false,
	_save_con: false,
	_save_int: false,
	_save_wis: false,
	_save_cha: false,
	_ability: "shield-dust",
	_abilities: [],
	_notes: "",
	_tera_type: "fairy",
	_exp: 5400,
	_status: null,
	_held_item: null,
	_is_shiny: false,
	_custom_size: null,
	_hit_dice_size: null,
	_speed_walking: null,
	_speed_climbing: null,
	_speed_swimming: null,
	_speed_flying: null,
	_speed_hover: null,
	_speed_burrowing: null,
	_sense_darkvision: null,
	_sense_blindsight: null,
	_sense_tremorsense: null,
	_sense_truesight: null,
	_bond_level: 0,
	_bond_points_cur: 0,
	_bond_points_max: 0,
	_rank_athletics: 0,
	_rank_acrobatics: 2,
	_rank_sleight_of_hand: 0,
	_rank_stealth: 0,
	_rank_arcana: 0,
	_rank_history: 0,
	_rank_investigation: 0,
	_rank_nature: 0,
	_rank_religion: 0,
	_rank_animal_handling: 0,
	_rank_insight: 0,
	_rank_medicine: 0,
	_rank_perception: 0,
	_rank_survival: 0,
	_rank_deception: 0,
	_rank_intimidation: 0,
	_rank_performance: 0,
	_rank_persuasion: 1,
	_rank: 0,
	_stab_base: "default",
	_stab_bonus: 0,
})
