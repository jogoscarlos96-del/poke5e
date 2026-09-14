CREATE TABLE private.pokemon_mega (
	pokemon_id INT PRIMARY KEY REFERENCES private.pokemon(id) ON DELETE CASCADE,
	forms JSONB NOT NULL DEFAULT '[]'::JSONB,
	active_form_id VARCHAR(128)
);

ALTER TABLE private.pokemon_mega ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private.pokemon_mega FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE private.pokemon_mega TO service_role;

CREATE OR REPLACE FUNCTION public.get_pokemon_mega(
	_pokemon_id INT,
	_read_key VARCHAR(32)
) RETURNS TABLE (
	forms JSONB,
	active_form_id VARCHAR(128)
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
	SELECT
		COALESCE(m.forms, '[]'::JSONB),
		m.active_form_id
	FROM private.pokemon p
	INNER JOIN private.trainers t ON t.id = p.trainer_id
	LEFT JOIN private.pokemon_mega m ON m.pokemon_id = p.id
	WHERE p.id = _pokemon_id AND t.read_key = _read_key;
$$;

CREATE OR REPLACE FUNCTION public.update_pokemon_mega(
	_write_key VARCHAR(32),
	_pokemon_id INT,
	_mega_forms JSONB,
	_mega_active_form_id VARCHAR(128)
) RETURNS INT
LANGUAGE PLPGSQL
VOLATILE
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
DECLARE
	affected_rows INT := 0;
	validated_active_form_id VARCHAR(128);
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM private.pokemon p
		INNER JOIN private.trainers t ON t.id = p.trainer_id
		WHERE p.id = _pokemon_id AND t.write_key = _write_key
	) THEN
		RETURN 0;
	END IF;

	validated_active_form_id := CASE
		WHEN _mega_active_form_id IS NULL THEN NULL
		WHEN EXISTS (
			SELECT 1
			FROM jsonb_array_elements(COALESCE(_mega_forms, '[]'::JSONB)) form
			WHERE form->>'id' = _mega_active_form_id
		) THEN _mega_active_form_id
		ELSE NULL
	END;

	INSERT INTO private.pokemon_mega (pokemon_id, forms, active_form_id)
	VALUES (_pokemon_id, COALESCE(_mega_forms, '[]'::JSONB), validated_active_form_id)
	ON CONFLICT (pokemon_id) DO UPDATE SET
		forms = EXCLUDED.forms,
		active_form_id = EXCLUDED.active_form_id;

	GET DIAGNOSTICS affected_rows := ROW_COUNT;
	RETURN affected_rows;
END $$;

REVOKE ALL ON FUNCTION public.get_pokemon_mega(INT, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_pokemon_mega(VARCHAR, INT, JSONB, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pokemon_mega(INT, VARCHAR) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_pokemon_mega(VARCHAR, INT, JSONB, VARCHAR) TO anon, authenticated, service_role;
