-- Volatile conditions are independent from the existing non-volatile status.
-- They end manually when combat/switching rules say they do, so this column is
-- intentionally nullable and stores only the currently selected condition.
ALTER TABLE private.pokemon
	ADD COLUMN volatile_status VARCHAR(255) NULL,
	ADD CONSTRAINT must_be_a_known_volatile_status
		CHECK (volatile_status IS NULL OR volatile_status IN ('Asleep', 'Confused', 'Flinched'));

-- Read a pokemon's volatile condition only when the caller owns the trainer's
-- read key. Returning NULL covers both "no volatile condition" and an invalid
-- read key without exposing trainer membership for guessed pokemon ids.
CREATE OR REPLACE FUNCTION public.get_pokemon_volatile_status(
	_read_key VARCHAR(32),
	_pokemon_id INT
) RETURNS VARCHAR(255) AS $$
DECLARE
	_result VARCHAR(255);
BEGIN
	SELECT p.volatile_status
	INTO _result
	FROM private.pokemon p
	INNER JOIN private.trainers t ON p.trainer_id = t.id
	WHERE p.id = _pokemon_id
		AND t.read_key = _read_key;

	RETURN _result;
END $$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog;

-- Update only the volatile condition. Keeping this separate from update_pokemon
-- avoids threading temporary combat state through every unrelated pokemon edit.
CREATE OR REPLACE FUNCTION public.set_pokemon_volatile_status(
	_write_key VARCHAR(32),
	_pokemon_id INT,
	_volatile_status VARCHAR(255)
) RETURNS INT AS $$
DECLARE
	_affected_rows INT;
BEGIN
	UPDATE private.pokemon p
	SET volatile_status = _volatile_status
	FROM private.trainers t
	WHERE p.id = _pokemon_id
		AND p.trainer_id = t.id
		AND t.write_key = _write_key;

	GET DIAGNOSTICS _affected_rows := ROW_COUNT;
	RETURN _affected_rows;
END $$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog;
