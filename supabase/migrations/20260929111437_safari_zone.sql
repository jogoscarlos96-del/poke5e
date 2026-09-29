CREATE TABLE private.safari_parks (
	id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
	park_data JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(park_data) = 'object'),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE private.safari_capture_claims (
	code VARCHAR(13) PRIMARY KEY DEFAULT nanoid(13),
	session_id UUID NOT NULL,
	source_trainer_id UUID REFERENCES private.trainers(id) ON DELETE SET NULL,
	species_id VARCHAR(255) NOT NULL,
	pokemon_data JSONB NOT NULL CHECK (jsonb_typeof(pokemon_data) = 'object'),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	redeemed_at TIMESTAMPTZ,
	redeemed_trainer_id UUID REFERENCES private.trainers(id) ON DELETE SET NULL
);

CREATE INDEX safari_capture_claims_session_id_idx ON private.safari_capture_claims(session_id);
CREATE INDEX safari_capture_claims_source_trainer_id_idx ON private.safari_capture_claims(source_trainer_id);

ALTER TABLE private.safari_parks ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.safari_capture_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.safari_parks, private.safari_capture_claims FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE private.safari_parks, private.safari_capture_claims TO service_role;

CREATE OR REPLACE FUNCTION public.list_safari_parks()
RETURNS TABLE (
	id UUID,
	park_data JSONB,
	created_at TIMESTAMPTZ,
	updated_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
	SELECT
		p.id,
		jsonb_set(
			p.park_data,
			'{biomes}',
			COALESCE((
				SELECT jsonb_agg(biome ORDER BY ord)
				FROM jsonb_array_elements(COALESCE(p.park_data->'biomes', '[]'::JSONB))
					WITH ORDINALITY AS biomes(biome, ord)
				WHERE COALESCE((biome->>'active')::BOOLEAN, TRUE)
			), '[]'::JSONB),
			TRUE
		) AS park_data,
		p.created_at,
		p.updated_at
	FROM private.safari_parks p
	WHERE COALESCE((p.park_data->>'active')::BOOLEAN, TRUE)
	ORDER BY LOWER(COALESCE(p.park_data->>'name', '')), p.created_at, p.id;
$$;

CREATE OR REPLACE FUNCTION public.list_all_safari_parks(_management_key TEXT)
RETURNS TABLE (
	id UUID,
	park_data JSONB,
	created_at TIMESTAMPTZ,
	updated_at TIMESTAMPTZ
)
LANGUAGE PLPGSQL
STABLE
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
BEGIN
	IF _management_key IS DISTINCT FROM 'de33140c5dcd22058216950f9d52ab590719278c66e5800c486ca4d5efe8feba' THEN
		RAISE EXCEPTION 'Invalid Safari management key.' USING ERRCODE = '42501';
	END IF;

	RETURN QUERY
	SELECT p.id, p.park_data, p.created_at, p.updated_at
	FROM private.safari_parks p
	ORDER BY LOWER(COALESCE(p.park_data->>'name', '')), p.created_at, p.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.new_safari_park(
	_management_key TEXT,
	_park_data JSONB
) RETURNS UUID
LANGUAGE PLPGSQL
VOLATILE
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
DECLARE ret_id UUID;
BEGIN
	IF _management_key IS DISTINCT FROM 'de33140c5dcd22058216950f9d52ab590719278c66e5800c486ca4d5efe8feba' THEN
		RAISE EXCEPTION 'Invalid Safari management key.' USING ERRCODE = '42501';
	END IF;

	IF _park_data IS NULL OR jsonb_typeof(_park_data) IS DISTINCT FROM 'object' THEN
		RAISE EXCEPTION 'Safari park data must be an object.';
	END IF;

	INSERT INTO private.safari_parks (park_data)
	VALUES (_park_data)
	RETURNING id INTO ret_id;

	RETURN ret_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_safari_park(
	_management_key TEXT,
	_id UUID,
	_park_data JSONB
) RETURNS INT
LANGUAGE PLPGSQL
VOLATILE
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
DECLARE affected_rows INT := 0;
BEGIN
	IF _management_key IS DISTINCT FROM 'de33140c5dcd22058216950f9d52ab590719278c66e5800c486ca4d5efe8feba' THEN
		RAISE EXCEPTION 'Invalid Safari management key.' USING ERRCODE = '42501';
	END IF;

	IF _park_data IS NULL OR jsonb_typeof(_park_data) IS DISTINCT FROM 'object' THEN
		RETURN 0;
	END IF;

	UPDATE private.safari_parks
	SET park_data = _park_data, updated_at = NOW()
	WHERE id = _id;

	GET DIAGNOSTICS affected_rows := ROW_COUNT;
	RETURN affected_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_safari_park(
	_management_key TEXT,
	_id UUID
) RETURNS INT
LANGUAGE PLPGSQL
VOLATILE
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
DECLARE affected_rows INT := 0;
BEGIN
	IF _management_key IS DISTINCT FROM 'de33140c5dcd22058216950f9d52ab590719278c66e5800c486ca4d5efe8feba' THEN
		RAISE EXCEPTION 'Invalid Safari management key.' USING ERRCODE = '42501';
	END IF;

	DELETE FROM private.safari_parks WHERE id = _id;
	GET DIAGNOSTICS affected_rows := ROW_COUNT;
	RETURN affected_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.new_safari_capture_claim(
	_trainer_read_key VARCHAR(32),
	_session_id UUID,
	_species_id VARCHAR(255),
	_species_sr NUMERIC,
	_pokemon_data JSONB
) RETURNS VARCHAR(13)
LANGUAGE PLPGSQL
VOLATILE
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
DECLARE
	trainer_id UUID;
	trainer_level INT;
	max_sr NUMERIC;
	ret_code VARCHAR(13);
BEGIN
	SELECT t.id, t.level INTO trainer_id, trainer_level
	FROM private.trainers t
	WHERE t.read_key = _trainer_read_key;

	IF trainer_id IS NULL THEN
		RETURN NULL;
	END IF;

	max_sr := CASE
		WHEN trainer_level <= 2 THEN 2
		WHEN trainer_level <= 5 THEN 5
		WHEN trainer_level <= 7 THEN 8
		WHEN trainer_level <= 10 THEN 10
		WHEN trainer_level <= 13 THEN 12
		WHEN trainer_level <= 16 THEN 14
		ELSE 15
	END;

	IF _species_sr IS NULL OR _species_sr > max_sr THEN
		RAISE EXCEPTION 'This trainer cannot capture a Pokemon of this SR.';
	END IF;

	IF NULLIF(BTRIM(_species_id), '') IS NULL
		OR _pokemon_data IS NULL
		OR jsonb_typeof(_pokemon_data) IS DISTINCT FROM 'object'
		OR COALESCE(_pokemon_data->>'speciesId', '') IS DISTINCT FROM _species_id
	THEN
		RAISE EXCEPTION 'Invalid Safari capture payload.';
	END IF;

	INSERT INTO private.safari_capture_claims (
		session_id,
		source_trainer_id,
		species_id,
		pokemon_data
	)
	VALUES (_session_id, trainer_id, _species_id, _pokemon_data)
	RETURNING code INTO ret_code;

	RETURN ret_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_safari_capture(
	_trainer_write_key VARCHAR(32),
	_capture_code VARCHAR(13)
) RETURNS INT
LANGUAGE PLPGSQL
VOLATILE
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
DECLARE
	target_trainer_id UUID;
	claim private.safari_capture_claims%ROWTYPE;
	payload JSONB;
	ret_id INT;
	next_rank INT;
BEGIN
	SELECT t.id INTO target_trainer_id
	FROM private.trainers t
	WHERE t.write_key = _trainer_write_key;

	IF target_trainer_id IS NULL THEN
		RETURN NULL;
	END IF;

	SELECT c.* INTO claim
	FROM private.safari_capture_claims c
	WHERE c.code = UPPER(BTRIM(_capture_code))
		AND c.redeemed_at IS NULL
	FOR UPDATE;

	IF claim.code IS NULL THEN
		RETURN NULL;
	END IF;

	payload := claim.pokemon_data;

	SELECT COALESCE(MAX(p.rank), 0) + 1 INTO next_rank
	FROM private.pokemon p
	WHERE p.trainer_id = target_trainer_id
		AND p.storage = 'party';

	INSERT INTO private.pokemon (
		trainer_id, species, nickname, nature, level, gender,
		strength, dexterity, constitution, intelligence, wisdom, charisma,
		ac, hp_cur, hp_max, hit_dice_cur, hit_dice_max,
		prof_athletics, prof_acrobatics, prof_sleight_of_hand, prof_stealth,
		prof_arcana, prof_history, prof_investigation, prof_nature, prof_religion,
		prof_animal_handling, prof_insight, prof_medicine, prof_perception,
		prof_survival, prof_deception, prof_intimidation, prof_performance, prof_persuasion,
		save_str, save_dex, save_con, save_int, save_wis, save_cha,
		ability, abilities, notes, type, tera_type, exp, status, held_item, is_shiny,
		bond_level, bond_points_cur, bond_points_max,
		rank_athletics, rank_acrobatics, rank_sleight_of_hand, rank_stealth,
		rank_arcana, rank_history, rank_investigation, rank_nature, rank_religion,
		rank_animal_handling, rank_insight, rank_medicine, rank_perception,
		rank_survival, rank_deception, rank_intimidation, rank_performance, rank_persuasion,
		rank, stab_base, stab_bonus, tags, storage
	)
	VALUES (
		target_trainer_id,
		claim.species_id,
		COALESCE(NULLIF(payload->>'nickname', ''), claim.species_id),
		COALESCE(NULLIF(payload->>'nature', ''), 'Hardy'),
		COALESCE((payload->>'level')::INT, 1),
		COALESCE(NULLIF(payload->>'gender', ''), 'none'),
		COALESCE((payload->'attributes'->>'str')::INT, 10),
		COALESCE((payload->'attributes'->>'dex')::INT, 10),
		COALESCE((payload->'attributes'->>'con')::INT, 10),
		COALESCE((payload->'attributes'->>'int')::INT, 10),
		COALESCE((payload->'attributes'->>'wis')::INT, 10),
		COALESCE((payload->'attributes'->>'cha')::INT, 10),
		COALESCE((payload->>'ac')::INT, 10),
		COALESCE((payload->>'hp')::INT, 1),
		COALESCE((payload->>'hp')::INT, 1),
		COALESCE((payload->>'level')::INT, 1),
		COALESCE((payload->>'level')::INT, 1),
		COALESCE((payload->'skillRanks'->>'athletics')::INT, 0) > 0,
		COALESCE((payload->'skillRanks'->>'acrobatics')::INT, 0) > 0,
		COALESCE((payload->'skillRanks'->>'sleight of hand')::INT, 0) > 0,
		COALESCE((payload->'skillRanks'->>'stealth')::INT, 0) > 0,
		COALESCE((payload->'skillRanks'->>'arcana')::INT, 0) > 0,
		COALESCE((payload->'skillRanks'->>'history')::INT, 0) > 0,
		COALESCE((payload->'skillRanks'->>'investigation')::INT, 0) > 0,
		COALESCE((payload->'skillRanks'->>'nature')::INT, 0) > 0,
		COALESCE((payload->'skillRanks'->>'religion')::INT, 0) > 0,
		COALESCE((payload->'skillRanks'->>'animal handling')::INT, 0) > 0,
		COALESCE((payload->'skillRanks'->>'insight')::INT, 0) > 0,
		COALESCE((payload->'skillRanks'->>'medicine')::INT, 0) > 0,
		COALESCE((payload->'skillRanks'->>'perception')::INT, 0) > 0,
		COALESCE((payload->'skillRanks'->>'survival')::INT, 0) > 0,
		COALESCE((payload->'skillRanks'->>'deception')::INT, 0) > 0,
		COALESCE((payload->'skillRanks'->>'intimidation')::INT, 0) > 0,
		COALESCE((payload->'skillRanks'->>'performance')::INT, 0) > 0,
		COALESCE((payload->'skillRanks'->>'persuasion')::INT, 0) > 0,
		COALESCE(payload->'saves', '[]'::JSONB) ? 'str',
		COALESCE(payload->'saves', '[]'::JSONB) ? 'dex',
		COALESCE(payload->'saves', '[]'::JSONB) ? 'con',
		COALESCE(payload->'saves', '[]'::JSONB) ? 'int',
		COALESCE(payload->'saves', '[]'::JSONB) ? 'wis',
		COALESCE(payload->'saves', '[]'::JSONB) ? 'cha',
		NULL,
		COALESCE(payload->'abilities', '[]'::JSONB)::JSON,
		COALESCE(payload->>'notes', ''),
		ARRAY(SELECT jsonb_array_elements_text(COALESCE(payload->'type', '[]'::JSONB)))::VARCHAR(255)[],
		COALESCE(payload->>'teraType', ''),
		COALESCE((payload->>'exp')::INT, 0),
		NULL,
		NULL,
		FALSE,
		0, 0, 0,
		COALESCE((payload->'skillRanks'->>'athletics')::INT, 0),
		COALESCE((payload->'skillRanks'->>'acrobatics')::INT, 0),
		COALESCE((payload->'skillRanks'->>'sleight of hand')::INT, 0),
		COALESCE((payload->'skillRanks'->>'stealth')::INT, 0),
		COALESCE((payload->'skillRanks'->>'arcana')::INT, 0),
		COALESCE((payload->'skillRanks'->>'history')::INT, 0),
		COALESCE((payload->'skillRanks'->>'investigation')::INT, 0),
		COALESCE((payload->'skillRanks'->>'nature')::INT, 0),
		COALESCE((payload->'skillRanks'->>'religion')::INT, 0),
		COALESCE((payload->'skillRanks'->>'animal handling')::INT, 0),
		COALESCE((payload->'skillRanks'->>'insight')::INT, 0),
		COALESCE((payload->'skillRanks'->>'medicine')::INT, 0),
		COALESCE((payload->'skillRanks'->>'perception')::INT, 0),
		COALESCE((payload->'skillRanks'->>'survival')::INT, 0),
		COALESCE((payload->'skillRanks'->>'deception')::INT, 0),
		COALESCE((payload->'skillRanks'->>'intimidation')::INT, 0),
		COALESCE((payload->'skillRanks'->>'performance')::INT, 0),
		COALESCE((payload->'skillRanks'->>'persuasion')::INT, 0),
		next_rank,
		'default',
		0,
		ARRAY[]::VARCHAR(255)[],
		'party'
	)
	RETURNING id INTO ret_id;

	UPDATE private.safari_capture_claims
	SET redeemed_at = NOW(), redeemed_trainer_id = target_trainer_id
	WHERE code = claim.code;

	RETURN ret_id;
END;
$$;

REVOKE ALL ON FUNCTION public.list_safari_parks() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_all_safari_parks(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.new_safari_park(TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_safari_park(TEXT, UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_safari_park(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.new_safari_capture_claim(VARCHAR, UUID, VARCHAR, NUMERIC, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_safari_capture(VARCHAR, VARCHAR) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.list_safari_parks() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_all_safari_parks(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.new_safari_park(TEXT, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_safari_park(TEXT, UUID, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_safari_park(TEXT, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.new_safari_capture_claim(VARCHAR, UUID, VARCHAR, NUMERIC, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.redeem_safari_capture(VARCHAR, VARCHAR) TO anon, authenticated, service_role;
