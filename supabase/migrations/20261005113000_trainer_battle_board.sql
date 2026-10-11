ALTER TABLE private.trainer_battles
	ADD COLUMN IF NOT EXISTS battle_state JSONB;

CREATE OR REPLACE FUNCTION private.trainer_battle_movement_max(_pokemon JSONB)
RETURNS INT
LANGUAGE SQL
IMMUTABLE
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
	SELECT GREATEST(
		COALESCE((_pokemon->>'movementMaxFeet')::INT, 0),
		COALESCE((_pokemon #>> '{speeds,data,walking}')::INT, 0),
		COALESCE((_pokemon #>> '{speeds,data,climbing}')::INT, 0),
		COALESCE((_pokemon #>> '{speeds,data,swimming}')::INT, 0),
		COALESCE((_pokemon #>> '{speeds,data,flying}')::INT, 0),
		COALESCE((_pokemon #>> '{speeds,data,hover}')::INT, 0),
		COALESCE((_pokemon #>> '{speeds,data,burrowing}')::INT, 0)
	);
$$;

CREATE OR REPLACE FUNCTION private.trainer_battle_hex_distance(_q1 INT, _r1 INT, _q2 INT, _r2 INT)
RETURNS INT
LANGUAGE SQL
IMMUTABLE
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
	WITH cube AS (
		SELECT
			_q1 AS x1,
			_r1 - ((_q1 - MOD(_q1, 2)) / 2) AS z1,
			_q2 AS x2,
			_r2 - ((_q2 - MOD(_q2, 2)) / 2) AS z2
	), expanded AS (
		SELECT x1, z1, -x1-z1 AS y1, x2, z2, -x2-z2 AS y2 FROM cube
	)
	SELECT GREATEST(ABS(x1-x2), ABS(y1-y2), ABS(z1-z2)) FROM expanded;
$$;

CREATE OR REPLACE FUNCTION private.trainer_battle_clear_active(_participant JSONB)
RETURNS JSONB
LANGUAGE PLPGSQL
IMMUTABLE
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
DECLARE
	v_pokemon JSONB;
	v_item JSONB;
	v_list JSONB := '[]'::JSONB;
BEGIN
	FOR v_pokemon IN SELECT value FROM jsonb_array_elements(COALESCE(_participant->'pokemon', '[]'::JSONB))
	LOOP
		v_item := jsonb_set(v_pokemon, '{activeSlot}', 'null'::JSONB, TRUE);
		v_item := jsonb_set(v_item, '{position}', 'null'::JSONB, TRUE);
		v_item := jsonb_set(v_item, '{revealed}', to_jsonb(FALSE), TRUE);
		v_item := jsonb_set(v_item, '{movementMaxFeet}', to_jsonb(private.trainer_battle_movement_max(v_item)), TRUE);
		v_item := jsonb_set(v_item, '{movementRemainingFeet}', to_jsonb(private.trainer_battle_movement_max(v_item)), TRUE);
		v_list := v_list || jsonb_build_array(v_item);
	END LOOP;

	RETURN jsonb_set(jsonb_set(_participant, '{pokemon}', v_list, TRUE), '{ready}', to_jsonb(FALSE), TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION private.trainer_battle_set_active(
	_participant JSONB,
	_pokemon_ids JSONB,
	_format TEXT,
	_side TEXT
) RETURNS JSONB
LANGUAGE PLPGSQL
IMMUTABLE
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
DECLARE
	v_required INT := CASE WHEN _format = 'doubles' THEN 2 ELSE 1 END;
	v_unique INT;
	v_existing INT;
	v_pokemon JSONB;
	v_item JSONB;
	v_list JSONB := '[]'::JSONB;
	v_slot INT;
	v_q INT;
	v_r INT;
	v_move INT;
BEGIN
	IF jsonb_typeof(_pokemon_ids) <> 'array' OR jsonb_array_length(_pokemon_ids) <> v_required THEN
		RAISE EXCEPTION 'Choose exactly % active Pokémon.', v_required;
	END IF;

	SELECT COUNT(DISTINCT value) INTO v_unique FROM jsonb_array_elements_text(_pokemon_ids);
	IF v_unique <> v_required THEN
		RAISE EXCEPTION 'Active Pokémon selection contains duplicates.';
	END IF;

	SELECT COUNT(*) INTO v_existing
	FROM jsonb_array_elements(COALESCE(_participant->'pokemon', '[]'::JSONB)) p
	WHERE p->>'id' IN (SELECT value FROM jsonb_array_elements_text(_pokemon_ids));
	IF v_existing <> v_required THEN
		RAISE EXCEPTION 'One or more selected Pokémon are not part of this battle team.';
	END IF;

	FOR v_pokemon IN SELECT value FROM jsonb_array_elements(COALESCE(_participant->'pokemon', '[]'::JSONB))
	LOOP
		SELECT ordinality::INT INTO v_slot
		FROM jsonb_array_elements_text(_pokemon_ids) WITH ORDINALITY selected(value, ordinality)
		WHERE selected.value = v_pokemon->>'id';

		v_item := v_pokemon;
		v_move := private.trainer_battle_movement_max(v_item);
		v_item := jsonb_set(v_item, '{movementMaxFeet}', to_jsonb(v_move), TRUE);
		v_item := jsonb_set(v_item, '{movementRemainingFeet}', to_jsonb(v_move), TRUE);
		v_item := jsonb_set(v_item, '{revealed}', to_jsonb(FALSE), TRUE);

		IF v_slot IS NOT NULL THEN
			v_q := CASE WHEN _side = 'a' THEN 2 ELSE 13 END;
			v_r := CASE
				WHEN v_required = 1 THEN 4
				WHEN v_slot = 1 THEN 3
				ELSE 6
			END;
			v_item := jsonb_set(v_item, '{activeSlot}', to_jsonb(v_slot - 1), TRUE);
			v_item := jsonb_set(v_item, '{position}', jsonb_build_object('q', v_q, 'r', v_r), TRUE);
		ELSE
			v_item := jsonb_set(v_item, '{activeSlot}', 'null'::JSONB, TRUE);
			v_item := jsonb_set(v_item, '{position}', 'null'::JSONB, TRUE);
		END IF;

		v_list := v_list || jsonb_build_array(v_item);
		v_slot := NULL;
	END LOOP;

	RETURN jsonb_set(jsonb_set(_participant, '{pokemon}', v_list, TRUE), '{ready}', to_jsonb(TRUE), TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION private.trainer_battle_reveal_active(_participant JSONB)
RETURNS JSONB
LANGUAGE PLPGSQL
IMMUTABLE
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
DECLARE
	v_pokemon JSONB;
	v_item JSONB;
	v_list JSONB := '[]'::JSONB;
BEGIN
	FOR v_pokemon IN SELECT value FROM jsonb_array_elements(COALESCE(_participant->'pokemon', '[]'::JSONB))
	LOOP
		v_item := v_pokemon;
		IF v_item->'activeSlot' IS NOT NULL AND v_item->'activeSlot' <> 'null'::JSONB THEN
			v_item := jsonb_set(v_item, '{revealed}', to_jsonb(TRUE), TRUE);
			v_item := jsonb_set(v_item, '{movementRemainingFeet}', to_jsonb(private.trainer_battle_movement_max(v_item)), TRUE);
		END IF;
		v_list := v_list || jsonb_build_array(v_item);
	END LOOP;
	RETURN jsonb_set(_participant, '{pokemon}', v_list, TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION private.trainer_battle_set_position(
	_participant JSONB,
	_pokemon_id TEXT,
	_q INT,
	_r INT,
	_remaining INT
) RETURNS JSONB
LANGUAGE PLPGSQL
IMMUTABLE
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
DECLARE
	v_pokemon JSONB;
	v_item JSONB;
	v_list JSONB := '[]'::JSONB;
BEGIN
	FOR v_pokemon IN SELECT value FROM jsonb_array_elements(COALESCE(_participant->'pokemon', '[]'::JSONB))
	LOOP
		v_item := v_pokemon;
		IF v_item->>'id' = _pokemon_id THEN
			v_item := jsonb_set(v_item, '{position}', jsonb_build_object('q', _q, 'r', _r), TRUE);
			v_item := jsonb_set(v_item, '{movementRemainingFeet}', to_jsonb(_remaining), TRUE);
		END IF;
		v_list := v_list || jsonb_build_array(v_item);
	END LOOP;
	RETURN jsonb_set(_participant, '{pokemon}', v_list, TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION private.trainer_battle_reset_movement(_participant JSONB, _pokemon_id TEXT)
RETURNS JSONB
LANGUAGE PLPGSQL
IMMUTABLE
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
DECLARE
	v_pokemon JSONB;
	v_item JSONB;
	v_list JSONB := '[]'::JSONB;
BEGIN
	FOR v_pokemon IN SELECT value FROM jsonb_array_elements(COALESCE(_participant->'pokemon', '[]'::JSONB))
	LOOP
		v_item := v_pokemon;
		IF v_item->>'id' = _pokemon_id THEN
			v_item := jsonb_set(v_item, '{movementRemainingFeet}', to_jsonb(private.trainer_battle_movement_max(v_item)), TRUE);
		END IF;
		v_list := v_list || jsonb_build_array(v_item);
	END LOOP;
	RETURN jsonb_set(_participant, '{pokemon}', v_list, TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION private.trainer_battle_public_projection(_participant JSONB)
RETURNS JSONB
LANGUAGE PLPGSQL
STABLE
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
DECLARE
	v_pokemon JSONB;
	v_move JSONB;
	v_moves JSONB;
	v_public JSONB := '[]'::JSONB;
	v_unrevealed INT := 0;
BEGIN
	IF _participant IS NULL THEN
		RETURN NULL;
	END IF;

	FOR v_pokemon IN SELECT value FROM jsonb_array_elements(COALESCE(_participant->'pokemon', '[]'::JSONB))
	LOOP
		IF COALESCE((v_pokemon->>'revealed')::BOOLEAN, FALSE) OR COALESCE((v_pokemon->>'fainted')::BOOLEAN, FALSE) THEN
			v_moves := '[]'::JSONB;
			FOR v_move IN SELECT value FROM jsonb_array_elements(COALESCE(v_pokemon->'moves', '[]'::JSONB))
			LOOP
				IF COALESCE((v_move->>'revealed')::BOOLEAN, FALSE) OR COALESCE((v_move->>'usageCount')::INT, 0) > 0 THEN
					v_moves := v_moves || jsonb_build_array(jsonb_build_object(
						'moveId', v_move->>'moveId',
						'usageCount', COALESCE((v_move->>'usageCount')::INT, 0)
					));
				END IF;
			END LOOP;

			v_public := v_public || jsonb_build_array(jsonb_build_object(
				'id', v_pokemon->>'id',
				'nickname', COALESCE(v_pokemon->>'nickname', ''),
				'pokemonId', v_pokemon->'pokemonId',
				'avatar', v_pokemon->'avatar',
				'revealed', COALESCE((v_pokemon->>'revealed')::BOOLEAN, FALSE),
				'fainted', COALESCE((v_pokemon->>'fainted')::BOOLEAN, FALSE),
				'activeSlot', v_pokemon->'activeSlot',
				'position', v_pokemon->'position',
				'status', v_pokemon->'status',
				'volatileStatuses', COALESCE(v_pokemon->'volatileStatuses', '[]'::JSONB),
				'moves', v_moves
			));
		ELSE
			v_unrevealed := v_unrevealed + 1;
		END IF;
	END LOOP;

	RETURN jsonb_build_object('pokemon', v_public, 'unrevealedCount', v_unrevealed);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_trainer_battle_join(_join_code TEXT)
RETURNS JSONB
LANGUAGE PLPGSQL
STABLE
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
DECLARE
	b private.trainer_battles%ROWTYPE;
BEGIN
	SELECT battle.* INTO b
	FROM private.trainer_battles battle
	WHERE battle.join_code = UPPER(BTRIM(_join_code));

	IF b.id IS NULL THEN
		RETURN NULL;
	END IF;

	RETURN jsonb_build_object(
		'id', b.id,
		'settings', b.settings,
		'hostTrainerName', b.host_participant #>> '{trainer,name}',
		'occupied', b.guest_access_key IS NOT NULL,
		'resumeAvailable', b.status = 'active' AND b.guest_participant IS NOT NULL AND b.guest_access_key IS NULL,
		'status', b.status,
		'createdAt', b.created_at,
		'updatedAt', b.updated_at
	);
END;
$$;

CREATE OR REPLACE FUNCTION public.resume_trainer_battle(_join_code TEXT)
RETURNS TABLE (id UUID, access_key VARCHAR(32))
LANGUAGE PLPGSQL
VOLATILE
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
DECLARE
	b private.trainer_battles%ROWTYPE;
	v_access_key VARCHAR(32);
BEGIN
	SELECT battle.* INTO b
	FROM private.trainer_battles battle
	WHERE battle.join_code = UPPER(BTRIM(_join_code))
	FOR UPDATE;

	IF b.id IS NULL THEN RAISE EXCEPTION 'Trainer Battle not found.'; END IF;
	IF b.status <> 'active' THEN RAISE EXCEPTION 'This Trainer Battle is not in progress.'; END IF;
	IF b.guest_participant IS NULL THEN RAISE EXCEPTION 'Player 2 has no battle slot to resume.'; END IF;
	IF b.guest_access_key IS NOT NULL THEN RAISE EXCEPTION 'Player 2 is already connected to this battle.'; END IF;

	LOOP
		v_access_key := nanoid(24);
		EXIT WHEN NOT EXISTS (
			SELECT 1 FROM private.trainer_battles existing
			WHERE existing.host_access_key = v_access_key OR existing.guest_access_key = v_access_key
		);
	END LOOP;

	UPDATE private.trainer_battles battle
	SET guest_access_key = v_access_key, updated_at = NOW()
	WHERE battle.id = b.id;

	RETURN QUERY SELECT b.id, v_access_key;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_trainer_battle_ready(_access_key TEXT, _pokemon_ids JSONB)
RETURNS VOID
LANGUAGE PLPGSQL
VOLATILE
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
DECLARE
	b private.trainer_battles%ROWTYPE;
	v_side TEXT;
	v_participant JSONB;
BEGIN
	SELECT battle.* INTO b
	FROM private.trainer_battles battle
	WHERE battle.host_access_key = _access_key OR battle.guest_access_key = _access_key
	FOR UPDATE;

	IF b.id IS NULL THEN RAISE EXCEPTION 'Trainer Battle not found.'; END IF;
	IF b.status <> 'lobby' THEN RAISE EXCEPTION 'Active Pokémon can only be selected in the lobby.'; END IF;

	IF b.host_access_key = _access_key THEN
		v_side := 'a'; v_participant := b.host_participant;
	ELSE
		v_side := 'b'; v_participant := b.guest_participant;
	END IF;
	IF v_participant IS NULL THEN RAISE EXCEPTION 'Battle participant not found.'; END IF;

	v_participant := private.trainer_battle_set_active(v_participant, _pokemon_ids, b.settings->>'format', v_side);

	UPDATE private.trainer_battles battle
	SET host_participant = CASE WHEN v_side = 'a' THEN v_participant ELSE battle.host_participant END,
		guest_participant = CASE WHEN v_side = 'b' THEN v_participant ELSE battle.guest_participant END,
		updated_at = NOW()
	WHERE battle.id = b.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_trainer_battle_ready(_access_key TEXT)
RETURNS VOID
LANGUAGE PLPGSQL
VOLATILE
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
DECLARE
	b private.trainer_battles%ROWTYPE;
	v_side TEXT;
	v_participant JSONB;
BEGIN
	SELECT battle.* INTO b
	FROM private.trainer_battles battle
	WHERE battle.host_access_key = _access_key OR battle.guest_access_key = _access_key
	FOR UPDATE;

	IF b.id IS NULL THEN RAISE EXCEPTION 'Trainer Battle not found.'; END IF;
	IF b.status <> 'lobby' THEN RAISE EXCEPTION 'The battle has already started.'; END IF;

	IF b.host_access_key = _access_key THEN
		v_side := 'a'; v_participant := b.host_participant;
	ELSE
		v_side := 'b'; v_participant := b.guest_participant;
	END IF;
	v_participant := private.trainer_battle_clear_active(v_participant);

	UPDATE private.trainer_battles battle
	SET host_participant = CASE WHEN v_side = 'a' THEN v_participant ELSE battle.host_participant END,
		guest_participant = CASE WHEN v_side = 'b' THEN v_participant ELSE battle.guest_participant END,
		updated_at = NOW()
	WHERE battle.id = b.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_trainer_battle(_access_key TEXT)
RETURNS VOID
LANGUAGE PLPGSQL
VOLATILE
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
DECLARE
	b private.trainer_battles%ROWTYPE;
	v_host JSONB;
	v_guest JSONB;
	v_order JSONB;
	v_first JSONB;
BEGIN
	SELECT battle.* INTO b
	FROM private.trainer_battles battle
	WHERE battle.host_access_key = _access_key
	FOR UPDATE;

	IF b.id IS NULL THEN RAISE EXCEPTION 'Only the host can start this Trainer Battle.'; END IF;
	IF b.status <> 'lobby' THEN RAISE EXCEPTION 'This Trainer Battle has already started.'; END IF;
	IF b.guest_participant IS NULL OR b.guest_access_key IS NULL THEN RAISE EXCEPTION 'Player 2 must be connected before the battle starts.'; END IF;
	IF NOT COALESCE((b.host_participant->>'ready')::BOOLEAN, FALSE) OR NOT COALESCE((b.guest_participant->>'ready')::BOOLEAN, FALSE) THEN
		RAISE EXCEPTION 'Both players must choose their active Pokémon and be ready.';
	END IF;

	v_host := private.trainer_battle_reveal_active(b.host_participant);
	v_guest := private.trainer_battle_reveal_active(b.guest_participant);

	WITH active AS (
		SELECT 'a'::TEXT AS side, p AS pokemon
		FROM jsonb_array_elements(v_host->'pokemon') p
		WHERE p->'activeSlot' IS NOT NULL AND p->'activeSlot' <> 'null'::JSONB
		UNION ALL
		SELECT 'b'::TEXT AS side, p AS pokemon
		FROM jsonb_array_elements(v_guest->'pokemon') p
		WHERE p->'activeSlot' IS NOT NULL AND p->'activeSlot' <> 'null'::JSONB
	), rolled AS (
		SELECT side, pokemon,
			(FLOOR(random() * 20)::INT + 1) AS roll,
			(FLOOR(COALESCE((pokemon #>> '{attributes,data,dex}')::NUMERIC, 10) / 2)::INT - 5) AS modifier
		FROM active
	), ordered AS (
		SELECT side, pokemon, roll, modifier, roll + modifier AS initiative
		FROM rolled
	)
	SELECT jsonb_agg(jsonb_build_object(
		'pokemonId', pokemon->>'id',
		'side', side,
		'initiative', initiative,
		'roll', roll,
		'modifier', modifier
	) ORDER BY initiative DESC, modifier DESC, roll DESC, pokemon->>'id')
	INTO v_order
	FROM ordered;

	IF v_order IS NULL OR jsonb_array_length(v_order) = 0 THEN RAISE EXCEPTION 'No active Pokémon were selected.'; END IF;
	v_first := v_order->0;

	UPDATE private.trainer_battles battle
	SET host_participant = v_host,
		guest_participant = v_guest,
		status = 'active',
		battle_state = jsonb_build_object(
			'round', 1,
			'turnIndex', 0,
			'turnOrder', v_order,
			'turnPokemonId', v_first->>'pokemonId',
			'turnSide', v_first->>'side'
		),
		updated_at = NOW()
	WHERE battle.id = b.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_trainer_battle_pokemon(
	_access_key TEXT,
	_pokemon_id TEXT,
	_q INT,
	_r INT
) RETURNS VOID
LANGUAGE PLPGSQL
VOLATILE
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
DECLARE
	b private.trainer_battles%ROWTYPE;
	v_side TEXT;
	v_participant JSONB;
	v_pokemon JSONB;
	v_from_q INT;
	v_from_r INT;
	v_remaining INT;
	v_cost INT;
BEGIN
	SELECT battle.* INTO b
	FROM private.trainer_battles battle
	WHERE battle.status = 'active' AND (battle.host_access_key = _access_key OR battle.guest_access_key = _access_key)
	FOR UPDATE;

	IF b.id IS NULL THEN RAISE EXCEPTION 'Active Trainer Battle not found.'; END IF;
	v_side := CASE WHEN b.host_access_key = _access_key THEN 'a' ELSE 'b' END;
	IF b.battle_state->>'turnSide' <> v_side OR b.battle_state->>'turnPokemonId' <> _pokemon_id THEN
		RAISE EXCEPTION 'It is not this Pokémon''s turn.';
	END IF;
	IF _q < 0 OR _q >= 16 OR _r < 0 OR _r >= 10 THEN RAISE EXCEPTION 'That hex is outside the arena.'; END IF;

	v_participant := CASE WHEN v_side = 'a' THEN b.host_participant ELSE b.guest_participant END;
	SELECT value INTO v_pokemon
	FROM jsonb_array_elements(COALESCE(v_participant->'pokemon', '[]'::JSONB))
	WHERE value->>'id' = _pokemon_id;
	IF v_pokemon IS NULL OR v_pokemon->'position' IS NULL OR v_pokemon->'position' = 'null'::JSONB THEN RAISE EXCEPTION 'Pokémon is not active on the field.'; END IF;

	IF EXISTS (
		SELECT 1
		FROM (
			SELECT value AS p FROM jsonb_array_elements(COALESCE(b.host_participant->'pokemon', '[]'::JSONB))
			UNION ALL
			SELECT value AS p FROM jsonb_array_elements(COALESCE(b.guest_participant->'pokemon', '[]'::JSONB))
		) units
		WHERE units.p->>'id' <> _pokemon_id
			AND units.p->'position' IS NOT NULL AND units.p->'position' <> 'null'::JSONB
			AND NOT COALESCE((units.p->>'fainted')::BOOLEAN, FALSE)
			AND (units.p #>> '{position,q}')::INT = _q
			AND (units.p #>> '{position,r}')::INT = _r
	) THEN RAISE EXCEPTION 'That hex is occupied.'; END IF;

	v_from_q := (v_pokemon #>> '{position,q}')::INT;
	v_from_r := (v_pokemon #>> '{position,r}')::INT;
	v_remaining := COALESCE((v_pokemon->>'movementRemainingFeet')::INT, private.trainer_battle_movement_max(v_pokemon));
	v_cost := private.trainer_battle_hex_distance(v_from_q, v_from_r, _q, _r) * 5;
	IF v_cost > v_remaining THEN RAISE EXCEPTION 'That movement is beyond the Pokémon''s remaining Speed.'; END IF;

	v_participant := private.trainer_battle_set_position(v_participant, _pokemon_id, _q, _r, v_remaining - v_cost);
	UPDATE private.trainer_battles battle
	SET host_participant = CASE WHEN v_side = 'a' THEN v_participant ELSE battle.host_participant END,
		guest_participant = CASE WHEN v_side = 'b' THEN v_participant ELSE battle.guest_participant END,
		updated_at = NOW()
	WHERE battle.id = b.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.end_trainer_battle_turn(_access_key TEXT)
RETURNS VOID
LANGUAGE PLPGSQL
VOLATILE
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
DECLARE
	b private.trainer_battles%ROWTYPE;
	v_side TEXT;
	v_order JSONB;
	v_length INT;
	v_index INT;
	v_next_index INT;
	v_round INT;
	v_next JSONB;
	v_host JSONB;
	v_guest JSONB;
BEGIN
	SELECT battle.* INTO b
	FROM private.trainer_battles battle
	WHERE battle.status = 'active' AND (battle.host_access_key = _access_key OR battle.guest_access_key = _access_key)
	FOR UPDATE;
	IF b.id IS NULL THEN RAISE EXCEPTION 'Active Trainer Battle not found.'; END IF;

	v_side := CASE WHEN b.host_access_key = _access_key THEN 'a' ELSE 'b' END;
	IF b.battle_state->>'turnSide' <> v_side THEN RAISE EXCEPTION 'It is not your turn.'; END IF;

	v_order := b.battle_state->'turnOrder';
	v_length := jsonb_array_length(v_order);
	v_index := COALESCE((b.battle_state->>'turnIndex')::INT, 0);
	v_next_index := MOD(v_index + 1, v_length);
	v_round := COALESCE((b.battle_state->>'round')::INT, 1) + CASE WHEN v_next_index = 0 THEN 1 ELSE 0 END;
	v_next := v_order->v_next_index;
	v_host := b.host_participant;
	v_guest := b.guest_participant;

	IF v_next->>'side' = 'a' THEN
		v_host := private.trainer_battle_reset_movement(v_host, v_next->>'pokemonId');
	ELSE
		v_guest := private.trainer_battle_reset_movement(v_guest, v_next->>'pokemonId');
	END IF;

	UPDATE private.trainer_battles battle
	SET host_participant = v_host,
		guest_participant = v_guest,
		battle_state = jsonb_build_object(
			'round', v_round,
			'turnIndex', v_next_index,
			'turnOrder', v_order,
			'turnPokemonId', v_next->>'pokemonId',
			'turnSide', v_next->>'side'
		),
		updated_at = NOW()
	WHERE battle.id = b.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_trainer_battle_player(_access_key TEXT)
RETURNS JSONB
LANGUAGE PLPGSQL
STABLE
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
DECLARE
	b private.trainer_battles%ROWTYPE;
	v_side TEXT;
	v_self JSONB;
	v_opponent JSONB;
	v_opponent_lobby JSONB;
	v_connected BOOLEAN;
BEGIN
	SELECT battle.* INTO b
	FROM private.trainer_battles battle
	WHERE battle.status <> 'completed'
		AND (battle.host_access_key = _access_key OR battle.guest_access_key = _access_key);

	IF b.id IS NULL THEN RETURN NULL; END IF;

	IF b.host_access_key = _access_key THEN
		v_side := 'a';
		v_self := b.host_participant;
		v_opponent := CASE WHEN b.status = 'lobby' AND b.guest_access_key IS NULL THEN NULL ELSE b.guest_participant END;
		v_connected := b.guest_access_key IS NOT NULL;
	ELSE
		v_side := 'b';
		v_self := b.guest_participant;
		v_opponent := b.host_participant;
		v_connected := TRUE;
	END IF;

	IF v_opponent IS NOT NULL THEN
		v_opponent_lobby := jsonb_build_object(
			'trainerName', v_opponent #>> '{trainer,name}',
			'ready', COALESCE((v_opponent->>'ready')::BOOLEAN, FALSE),
			'teamCount', jsonb_array_length(COALESCE(v_opponent->'pokemon', '[]'::JSONB)),
			'connected', v_connected
		);
	END IF;

	RETURN jsonb_build_object(
		'id', b.id,
		'settings', b.settings,
		'status', b.status,
		'viewerSide', v_side,
		'self', v_self,
		'opponent', v_opponent_lobby,
		'opponentBattle', CASE WHEN b.status = 'active' THEN private.trainer_battle_public_projection(v_opponent) ELSE NULL END,
		'battleState', b.battle_state,
		'joinCode', CASE WHEN v_side = 'a' THEN b.join_code ELSE NULL END,
		'spectatorCode', CASE WHEN v_side = 'a' THEN b.spectator_code ELSE NULL END,
		'createdAt', b.created_at,
		'updatedAt', b.updated_at
	);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_trainer_battle_spectator(_spectator_code TEXT)
RETURNS JSONB
LANGUAGE PLPGSQL
STABLE
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
DECLARE
	b private.trainer_battles%ROWTYPE;
BEGIN
	SELECT battle.* INTO b
	FROM private.trainer_battles battle
	WHERE battle.spectator_code = UPPER(BTRIM(_spectator_code))
		AND battle.status <> 'completed';
	IF b.id IS NULL THEN RETURN NULL; END IF;

	RETURN jsonb_build_object(
		'id', b.id,
		'settings', b.settings,
		'status', b.status,
		'participants', jsonb_build_object(
			'a', b.host_participant,
			'b', CASE WHEN b.guest_access_key IS NULL AND b.status = 'lobby' THEN NULL ELSE b.guest_participant END
		),
		'battleState', b.battle_state,
		'createdAt', b.created_at,
		'updatedAt', b.updated_at
	);
END;
$$;

REVOKE ALL ON FUNCTION public.resume_trainer_battle(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_trainer_battle_ready(TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_trainer_battle_ready(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_trainer_battle(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.move_trainer_battle_pokemon(TEXT, TEXT, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.end_trainer_battle_turn(TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.resume_trainer_battle(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_trainer_battle_ready(TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_trainer_battle_ready(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_trainer_battle(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.move_trainer_battle_pokemon(TEXT, TEXT, INT, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.end_trainer_battle_turn(TEXT) TO anon, authenticated;
