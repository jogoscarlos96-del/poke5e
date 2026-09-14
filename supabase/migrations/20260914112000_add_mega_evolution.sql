ALTER TABLE private.pokemon
	ADD COLUMN IF NOT EXISTS mega_forms JSONB NOT NULL DEFAULT '[]'::JSONB,
	ADD COLUMN IF NOT EXISTS mega_active_form_id VARCHAR(128);

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
	affected_rows INT;
BEGIN
	UPDATE private.pokemon p SET
		mega_forms = COALESCE(_mega_forms, '[]'::JSONB),
		mega_active_form_id = CASE
			WHEN _mega_active_form_id IS NULL THEN NULL
			WHEN EXISTS (
				SELECT 1
				FROM jsonb_array_elements(COALESCE(_mega_forms, '[]'::JSONB)) form
				WHERE form->>'id' = _mega_active_form_id
			) THEN _mega_active_form_id
			ELSE NULL
		END
	FROM private.trainers t
	WHERE
		p.id = _pokemon_id
		AND p.trainer_id = t.id
		AND t.write_key = _write_key;

	GET DIAGNOSTICS affected_rows := ROW_COUNT;
	RETURN affected_rows;
END $$;

REVOKE ALL ON FUNCTION public.update_pokemon_mega(VARCHAR, INT, JSONB, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_pokemon_mega(VARCHAR, INT, JSONB, VARCHAR) TO anon, authenticated, service_role;
