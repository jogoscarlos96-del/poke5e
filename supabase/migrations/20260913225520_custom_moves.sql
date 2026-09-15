-- Kornia: reusable, shared custom move definitions.
--
-- Trainer moves and Fakemon move pools already store string move IDs, so they do
-- not need schema changes. Custom moves use IDs in the form `custom:<uuid>` in
-- the client and resolve their definitions through this table.

CREATE TABLE private.custom_moves (
	id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
	write_key VARCHAR(32) DEFAULT nanoid(16) NOT NULL,
	move_data JSONB NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION list_custom_moves()
RETURNS TABLE (
	id UUID,
	move_data JSONB,
	created_at TIMESTAMPTZ,
	updated_at TIMESTAMPTZ
) AS $$
BEGIN
	RETURN QUERY
	SELECT
		custom_moves.id,
		custom_moves.move_data,
		custom_moves.created_at,
		custom_moves.updated_at
	FROM private.custom_moves
	ORDER BY custom_moves.created_at, custom_moves.id;
END $$ LANGUAGE PLPGSQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_custom_move(_id UUID)
RETURNS TABLE (
	id UUID,
	move_data JSONB,
	created_at TIMESTAMPTZ,
	updated_at TIMESTAMPTZ
) AS $$
BEGIN
	RETURN QUERY
	SELECT
		custom_moves.id,
		custom_moves.move_data,
		custom_moves.created_at,
		custom_moves.updated_at
	FROM private.custom_moves
	WHERE custom_moves.id = _id;
END $$ LANGUAGE PLPGSQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION new_custom_move(
	_move_data JSONB,
	OUT ret_id UUID,
	OUT ret_write_key VARCHAR(32)
) AS $$
BEGIN
	INSERT INTO private.custom_moves (move_data)
	VALUES (_move_data)
	RETURNING id, write_key INTO ret_id, ret_write_key;
END $$ LANGUAGE PLPGSQL VOLATILE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_custom_move(
	_id UUID,
	_write_key VARCHAR(32),
	_move_data JSONB
) RETURNS INT AS $$
DECLARE affected_rows INT;
BEGIN
	UPDATE private.custom_moves SET
		move_data = _move_data,
		updated_at = NOW()
	WHERE id = _id AND write_key = _write_key;

	GET DIAGNOSTICS affected_rows := ROW_COUNT;
	RETURN affected_rows;
END $$ LANGUAGE PLPGSQL VOLATILE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION remove_custom_move(
	_id UUID,
	_write_key VARCHAR(32)
) RETURNS INT AS $$
DECLARE affected_rows INT;
BEGIN
	DELETE FROM private.custom_moves
	WHERE id = _id AND write_key = _write_key;

	GET DIAGNOSTICS affected_rows := ROW_COUNT;
	RETURN affected_rows;
END $$ LANGUAGE PLPGSQL VOLATILE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION verify_custom_move_write_key(
	_id UUID,
	_write_key VARCHAR(32)
) RETURNS INT AS $$
DECLARE matched_rows INT;
BEGIN
	SELECT COUNT(*)::INT INTO matched_rows
	FROM private.custom_moves
	WHERE id = _id AND write_key = _write_key;

	RETURN matched_rows;
END $$ LANGUAGE PLPGSQL STABLE SECURITY DEFINER;
