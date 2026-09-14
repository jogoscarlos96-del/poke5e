-- Kornia: reusable, shared Mega Evolution definitions.
--
-- Mega definitions are global reusable records keyed to a base species. Trainer
-- Pokemon only retain a selected definition ID; the transformation remains a
-- temporary overlay and never copies combat resources into the Mega state.

CREATE TABLE private.mega_evolutions (
	id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
	write_key VARCHAR(32) DEFAULT nanoid(16) NOT NULL,
	species_id VARCHAR(255) NOT NULL,
	mega_data JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(mega_data) = 'object'),
	portrait_filename VARCHAR(255),
	sprite_filename VARCHAR(255),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX mega_evolutions_species_id_idx ON private.mega_evolutions(species_id);

ALTER TABLE private.mega_evolutions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.mega_evolutions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE private.mega_evolutions TO service_role;

-- Promote legacy per-Pokemon form definitions before replacing the old state
-- columns. Definitions with the same species/name are collapsed, preferring the
-- most complete stored form. External v1 image URLs are retained as portraitUrl
-- fallbacks until an uploaded portrait replaces them.
CREATE TEMP TABLE legacy_mega_forms ON COMMIT DROP AS
SELECT
	m.pokemon_id,
	p.species::VARCHAR(255) AS species_id,
	form,
	form->>'id' AS legacy_form_id,
	LOWER(COALESCE(NULLIF(BTRIM(form->>'name'), ''), 'mega form')) AS normalized_name,
	m.active_form_id,
	(
		(CASE WHEN form ? 'type' THEN 1 ELSE 0 END) +
		(CASE WHEN form ? 'ability' THEN 1 ELSE 0 END) +
		(CASE WHEN NULLIF(form->>'imageUrl', '') IS NOT NULL THEN 1 ELSE 0 END)
	) AS completeness
FROM private.pokemon_mega m
INNER JOIN private.pokemon p ON p.id = m.pokemon_id
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(m.forms, '[]'::JSONB)) AS form;

CREATE TEMP TABLE legacy_mega_groups ON COMMIT DROP AS
SELECT DISTINCT ON (species_id, normalized_name)
	uuid_generate_v4() AS id,
	species_id,
	normalized_name,
	form
FROM legacy_mega_forms
ORDER BY species_id, normalized_name, completeness DESC, pokemon_id DESC;

INSERT INTO private.mega_evolutions (id, species_id, mega_data)
SELECT
	g.id,
	g.species_id,
	(g.form - 'id' - 'imageUrl') ||
		CASE
			WHEN NULLIF(g.form->>'imageUrl', '') IS NOT NULL
				THEN jsonb_build_object('portraitUrl', g.form->>'imageUrl')
			ELSE '{}'::JSONB
		END
FROM legacy_mega_groups g;

ALTER TABLE private.pokemon_mega
	ADD COLUMN selected_mega_id UUID REFERENCES private.mega_evolutions(id) ON DELETE SET NULL;

UPDATE private.pokemon_mega m
SET selected_mega_id = g.id
FROM legacy_mega_forms f
INNER JOIN legacy_mega_groups g
	ON g.species_id = f.species_id
	AND g.normalized_name = f.normalized_name
WHERE f.pokemon_id = m.pokemon_id
	AND m.active_form_id IS NOT NULL
	AND f.legacy_form_id = m.active_form_id;

DROP FUNCTION public.get_pokemon_mega(INT, VARCHAR);
DROP FUNCTION public.update_pokemon_mega(VARCHAR, INT, JSONB, VARCHAR);

ALTER TABLE private.pokemon_mega
	DROP COLUMN forms,
	DROP COLUMN active_form_id;

CREATE OR REPLACE FUNCTION public.list_mega_evolutions()
RETURNS TABLE (
	id UUID,
	species_id VARCHAR(255),
	mega_data JSONB,
	portrait_filename VARCHAR(255),
	sprite_filename VARCHAR(255),
	created_at TIMESTAMPTZ,
	updated_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
	SELECT
		m.id,
		m.species_id,
		m.mega_data,
		m.portrait_filename,
		m.sprite_filename,
		m.created_at,
		m.updated_at
	FROM private.mega_evolutions m
	ORDER BY m.species_id, LOWER(COALESCE(m.mega_data->>'name', '')), m.created_at, m.id;
$$;

CREATE OR REPLACE FUNCTION public.get_mega_evolution(_id UUID)
RETURNS TABLE (
	id UUID,
	species_id VARCHAR(255),
	mega_data JSONB,
	portrait_filename VARCHAR(255),
	sprite_filename VARCHAR(255),
	created_at TIMESTAMPTZ,
	updated_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
	SELECT
		m.id,
		m.species_id,
		m.mega_data,
		m.portrait_filename,
		m.sprite_filename,
		m.created_at,
		m.updated_at
	FROM private.mega_evolutions m
	WHERE m.id = _id;
$$;

CREATE OR REPLACE FUNCTION public.new_mega_evolution(
	_species_id VARCHAR(255),
	_mega_data JSONB,
	OUT ret_id UUID,
	OUT ret_write_key VARCHAR(32)
)
LANGUAGE PLPGSQL
VOLATILE
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
BEGIN
	IF NULLIF(BTRIM(_species_id), '') IS NULL THEN
		RAISE EXCEPTION 'A base species is required.';
	END IF;

	INSERT INTO private.mega_evolutions (species_id, mega_data)
	VALUES (
		_species_id,
		CASE WHEN jsonb_typeof(_mega_data) = 'object' THEN _mega_data ELSE '{}'::JSONB END
	)
	RETURNING id, write_key INTO ret_id, ret_write_key;
END $$;

CREATE OR REPLACE FUNCTION public.update_mega_evolution(
	_id UUID,
	_write_key VARCHAR(32),
	_species_id VARCHAR(255),
	_mega_data JSONB
) RETURNS INT
LANGUAGE PLPGSQL
VOLATILE
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
DECLARE affected_rows INT := 0;
BEGIN
	IF NULLIF(BTRIM(_species_id), '') IS NULL THEN
		RETURN 0;
	END IF;

	UPDATE private.mega_evolutions SET
		species_id = _species_id,
		mega_data = CASE WHEN jsonb_typeof(_mega_data) = 'object' THEN _mega_data ELSE '{}'::JSONB END,
		updated_at = NOW()
	WHERE id = _id AND write_key = _write_key;

	GET DIAGNOSTICS affected_rows := ROW_COUNT;
	RETURN affected_rows;
END $$;

CREATE OR REPLACE FUNCTION public.remove_mega_evolution(
	_id UUID,
	_write_key VARCHAR(32)
) RETURNS INT
LANGUAGE PLPGSQL
VOLATILE
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
DECLARE affected_rows INT := 0;
BEGIN
	DELETE FROM private.mega_evolutions
	WHERE id = _id AND write_key = _write_key;

	GET DIAGNOSTICS affected_rows := ROW_COUNT;
	RETURN affected_rows;
END $$;

CREATE OR REPLACE FUNCTION public.verify_mega_evolution_write_key(
	_id UUID,
	_write_key VARCHAR(32)
) RETURNS INT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
	SELECT COUNT(*)::INT
	FROM private.mega_evolutions
	WHERE id = _id AND write_key = _write_key;
$$;

CREATE OR REPLACE FUNCTION public.new_mega_media_filenames(
	_id UUID,
	_write_key VARCHAR(32),
	_portrait_extension VARCHAR(32) DEFAULT NULL,
	_sprite_extension VARCHAR(32) DEFAULT NULL
) RETURNS TABLE (
	portrait_filename VARCHAR(255),
	sprite_filename VARCHAR(255)
)
LANGUAGE PLPGSQL
VOLATILE
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
DECLARE
	new_portrait VARCHAR(255) := NULL;
	new_sprite VARCHAR(255) := NULL;
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM private.mega_evolutions
		WHERE id = _id AND write_key = _write_key
	) THEN
		RETURN;
	END IF;

	IF _portrait_extension IS NOT NULL THEN
		new_portrait := uuid_generate_v4()::TEXT || _portrait_extension;
	END IF;
	IF _sprite_extension IS NOT NULL THEN
		new_sprite := uuid_generate_v4()::TEXT || _sprite_extension;
	END IF;

	UPDATE private.mega_evolutions SET
		portrait_filename = COALESCE(new_portrait, private.mega_evolutions.portrait_filename),
		sprite_filename = COALESCE(new_sprite, private.mega_evolutions.sprite_filename),
		updated_at = NOW()
	WHERE id = _id AND write_key = _write_key;

	RETURN QUERY SELECT new_portrait, new_sprite;
END $$;

CREATE OR REPLACE FUNCTION public.remove_mega_media(
	_id UUID,
	_write_key VARCHAR(32),
	_remove_portrait BOOLEAN DEFAULT FALSE,
	_remove_sprite BOOLEAN DEFAULT FALSE
) RETURNS INT
LANGUAGE PLPGSQL
VOLATILE
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
DECLARE affected_rows INT := 0;
BEGIN
	UPDATE private.mega_evolutions SET
		portrait_filename = CASE WHEN _remove_portrait THEN NULL ELSE portrait_filename END,
		sprite_filename = CASE WHEN _remove_sprite THEN NULL ELSE sprite_filename END,
		updated_at = NOW()
	WHERE id = _id AND write_key = _write_key;

	GET DIAGNOSTICS affected_rows := ROW_COUNT;
	RETURN affected_rows;
END $$;

CREATE OR REPLACE FUNCTION public.get_pokemon_mega(
	_pokemon_id INT,
	_read_key VARCHAR(32)
) RETURNS TABLE (
	selected_mega_id UUID
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
	SELECT m.selected_mega_id
	FROM private.pokemon p
	INNER JOIN private.trainers t ON t.id = p.trainer_id
	LEFT JOIN private.pokemon_mega m ON m.pokemon_id = p.id
	WHERE p.id = _pokemon_id AND t.read_key = _read_key;
$$;

CREATE OR REPLACE FUNCTION public.update_pokemon_mega(
	_write_key VARCHAR(32),
	_pokemon_id INT,
	_selected_mega_id UUID
) RETURNS INT
LANGUAGE PLPGSQL
VOLATILE
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
DECLARE affected_rows INT := 0;
DECLARE pokemon_species VARCHAR(255);
DECLARE validated_mega_id UUID := NULL;
BEGIN
	SELECT p.species::VARCHAR(255) INTO pokemon_species
	FROM private.pokemon p
	INNER JOIN private.trainers t ON t.id = p.trainer_id
	WHERE p.id = _pokemon_id AND t.write_key = _write_key;

	IF pokemon_species IS NULL THEN
		RETURN 0;
	END IF;

	IF _selected_mega_id IS NOT NULL AND EXISTS (
		SELECT 1
		FROM private.mega_evolutions m
		WHERE m.id = _selected_mega_id
			AND m.species_id = pokemon_species
	) THEN
		validated_mega_id := _selected_mega_id;
	END IF;

	INSERT INTO private.pokemon_mega (pokemon_id, selected_mega_id)
	VALUES (_pokemon_id, validated_mega_id)
	ON CONFLICT (pokemon_id) DO UPDATE SET
		selected_mega_id = EXCLUDED.selected_mega_id;

	GET DIAGNOSTICS affected_rows := ROW_COUNT;
	RETURN affected_rows;
END $$;

REVOKE ALL ON FUNCTION public.list_mega_evolutions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_mega_evolution(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.new_mega_evolution(VARCHAR, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_mega_evolution(UUID, VARCHAR, VARCHAR, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_mega_evolution(UUID, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_mega_evolution_write_key(UUID, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.new_mega_media_filenames(UUID, VARCHAR, VARCHAR, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_mega_media(UUID, VARCHAR, BOOLEAN, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_pokemon_mega(INT, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_pokemon_mega(VARCHAR, INT, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.list_mega_evolutions() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_mega_evolution(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.new_mega_evolution(VARCHAR, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_mega_evolution(UUID, VARCHAR, VARCHAR, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_mega_evolution(UUID, VARCHAR) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_mega_evolution_write_key(UUID, VARCHAR) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.new_mega_media_filenames(UUID, VARCHAR, VARCHAR, VARCHAR) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_mega_media(UUID, VARCHAR, BOOLEAN, BOOLEAN) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_pokemon_mega(INT, VARCHAR) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_pokemon_mega(VARCHAR, INT, UUID) TO anon, authenticated, service_role;
