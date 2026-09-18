CREATE OR REPLACE FUNCTION public.update_one_move(
	_write_key VARCHAR(32),
	_id BIGINT,
	_move_id VARCHAR(255),
	_pp_cur INT,
	_pp_max INT,
	_notes TEXT
) RETURNS INT
LANGUAGE PLPGSQL
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
	affected_rows INT;
BEGIN
	UPDATE private.moves AS m SET
		move_id = _move_id,
		pp_cur = _pp_cur,
		pp_max = _pp_max,
		notes = _notes
	FROM
		private.pokemon AS p
		INNER JOIN private.trainers AS t
			ON t.id = p.trainer_id
	WHERE
		m.id = _id
		AND m.pokemon_id = p.id
		AND t.write_key = _write_key;

	GET DIAGNOSTICS affected_rows := ROW_COUNT;
	RETURN affected_rows;
END
$$;

REVOKE ALL ON FUNCTION public.update_one_move(VARCHAR, BIGINT, VARCHAR, INT, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_one_move(VARCHAR, BIGINT, VARCHAR, INT, INT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.update_one_move(VARCHAR, BIGINT, VARCHAR, INT, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_one_move(VARCHAR, BIGINT, VARCHAR, INT, INT, TEXT) TO service_role;
