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

	IF b.id IS NULL THEN RETURN NULL; END IF;

	RETURN jsonb_build_object(
		'id', b.id,
		'settings', b.settings,
		'hostTrainerName', b.host_participant #>> '{trainer,name}',
		'occupied', b.guest_access_key IS NOT NULL,
		'resumeAvailable', b.status = 'active' AND b.guest_participant IS NOT NULL,
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

	UPDATE private.trainer_battles battle
	SET host_participant = v_host,
		guest_participant = v_guest,
		status = 'active',
		battle_state = jsonb_build_object(
			'phase', 'initiative',
			'round', 1,
			'turnIndex', 0,
			'turnOrder', '[]'::JSONB,
			'initiativeRolls', '[]'::JSONB,
			'turnPokemonId', NULL,
			'turnSide', NULL
		),
		updated_at = NOW()
	WHERE battle.id = b.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.roll_trainer_battle_initiative(
	_access_key TEXT,
	_pokemon_id TEXT,
	_use_alert BOOLEAN DEFAULT FALSE,
	_other_modifier INT DEFAULT 0
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
	v_rolls JSONB;
	v_order JSONB;
	v_entry JSONB;
	v_first JSONB;
	v_expected INT;
	v_roll INT;
	v_dex_modifier INT;
	v_alert_modifier INT := 0;
	v_other_modifier INT := COALESCE(_other_modifier, 0);
	v_modifier INT;
	v_initiative INT;
	v_alert_available BOOLEAN;
	v_state JSONB;
BEGIN
	SELECT battle.* INTO b
	FROM private.trainer_battles battle
	WHERE battle.status = 'active' AND (battle.host_access_key = _access_key OR battle.guest_access_key = _access_key)
	FOR UPDATE;

	IF b.id IS NULL THEN RAISE EXCEPTION 'Active Trainer Battle not found.'; END IF;
	IF COALESCE(b.battle_state->>'phase', 'turns') <> 'initiative' THEN RAISE EXCEPTION 'Initiative has already been resolved.'; END IF;
	IF v_other_modifier < -30 OR v_other_modifier > 30 THEN RAISE EXCEPTION 'Other initiative modifier must be between -30 and +30.'; END IF;

	v_side := CASE WHEN b.host_access_key = _access_key THEN 'a' ELSE 'b' END;
	v_participant := CASE WHEN v_side = 'a' THEN b.host_participant ELSE b.guest_participant END;

	SELECT p.value INTO v_pokemon
	FROM jsonb_array_elements(COALESCE(v_participant->'pokemon', '[]'::JSONB)) AS p(value)
	WHERE p.value->>'id' = _pokemon_id
		AND p.value->'activeSlot' IS NOT NULL
		AND p.value->'activeSlot' <> 'null'::JSONB
		AND NOT COALESCE((p.value->>'fainted')::BOOLEAN, FALSE);

	IF v_pokemon IS NULL THEN RAISE EXCEPTION 'That Pokémon is not one of your active Pokémon.'; END IF;

	v_rolls := COALESCE(b.battle_state->'initiativeRolls', '[]'::JSONB);
	IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_rolls) AS r(value) WHERE r.value->>'pokemonId' = _pokemon_id) THEN
		RAISE EXCEPTION 'This Pokémon has already rolled initiative.';
	END IF;

	SELECT EXISTS (
		SELECT 1
		FROM jsonb_array_elements(COALESCE(v_pokemon->'feats', '[]'::JSONB)) AS f(value)
		WHERE LOWER(BTRIM(COALESCE(f.value->>'name', ''))) = 'alert'
	) INTO v_alert_available;

	IF COALESCE(_use_alert, FALSE) AND NOT v_alert_available THEN
		RAISE EXCEPTION 'This Pokémon does not have the Alert feat.';
	END IF;

	v_dex_modifier := FLOOR(COALESCE((v_pokemon #>> '{attributes,data,dex}')::NUMERIC, 10) / 2)::INT - 5;
	v_alert_modifier := CASE WHEN COALESCE(_use_alert, FALSE) THEN 5 ELSE 0 END;
	v_roll := FLOOR(random() * 20)::INT + 1;
	v_modifier := v_dex_modifier + v_alert_modifier + v_other_modifier;
	v_initiative := v_roll + v_modifier;

	v_entry := jsonb_build_object(
		'pokemonId', _pokemon_id,
		'side', v_side,
		'initiative', v_initiative,
		'roll', v_roll,
		'dexModifier', v_dex_modifier,
		'alertModifier', v_alert_modifier,
		'otherModifier', v_other_modifier,
		'modifier', v_modifier
	);
	v_rolls := v_rolls || jsonb_build_array(v_entry);

	SELECT COUNT(*) INTO v_expected
	FROM (
		SELECT p.value FROM jsonb_array_elements(COALESCE(b.host_participant->'pokemon', '[]'::JSONB)) AS p(value)
		WHERE p.value->'activeSlot' IS NOT NULL AND p.value->'activeSlot' <> 'null'::JSONB AND NOT COALESCE((p.value->>'fainted')::BOOLEAN, FALSE)
		UNION ALL
		SELECT p.value FROM jsonb_array_elements(COALESCE(b.guest_participant->'pokemon', '[]'::JSONB)) AS p(value)
		WHERE p.value->'activeSlot' IS NOT NULL AND p.value->'activeSlot' <> 'null'::JSONB AND NOT COALESCE((p.value->>'fainted')::BOOLEAN, FALSE)
	) active;

	IF jsonb_array_length(v_rolls) = v_expected THEN
		SELECT jsonb_agg(r.value ORDER BY
			(r.value->>'initiative')::INT DESC,
			(r.value->>'dexModifier')::INT DESC,
			(r.value->>'roll')::INT DESC,
			r.value->>'pokemonId')
		INTO v_order
		FROM jsonb_array_elements(v_rolls) AS r(value);
		v_first := v_order->0;
		v_state := jsonb_build_object(
			'phase', 'turns',
			'round', 1,
			'turnIndex', 0,
			'turnOrder', v_order,
			'initiativeRolls', v_rolls,
			'turnPokemonId', v_first->>'pokemonId',
			'turnSide', v_first->>'side'
		);
	ELSE
		v_state := jsonb_set(b.battle_state, '{initiativeRolls}', v_rolls, TRUE);
	END IF;

	UPDATE private.trainer_battles battle
	SET battle_state = v_state, updated_at = NOW()
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
	IF COALESCE(b.battle_state->>'phase', 'turns') <> 'turns' THEN RAISE EXCEPTION 'Movement begins after initiative is resolved.'; END IF;
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
	v_state JSONB;
BEGIN
	SELECT battle.* INTO b
	FROM private.trainer_battles battle
	WHERE battle.status = 'active' AND (battle.host_access_key = _access_key OR battle.guest_access_key = _access_key)
	FOR UPDATE;
	IF b.id IS NULL THEN RAISE EXCEPTION 'Active Trainer Battle not found.'; END IF;
	IF COALESCE(b.battle_state->>'phase', 'turns') <> 'turns' THEN RAISE EXCEPTION 'Turns begin after initiative is resolved.'; END IF;

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

	v_state := b.battle_state;
	v_state := jsonb_set(v_state, '{round}', to_jsonb(v_round), TRUE);
	v_state := jsonb_set(v_state, '{turnIndex}', to_jsonb(v_next_index), TRUE);
	v_state := jsonb_set(v_state, '{turnPokemonId}', to_jsonb(v_next->>'pokemonId'), TRUE);
	v_state := jsonb_set(v_state, '{turnSide}', to_jsonb(v_next->>'side'), TRUE);

	UPDATE private.trainer_battles battle
	SET host_participant = v_host,
		guest_participant = v_guest,
		battle_state = v_state,
		updated_at = NOW()
	WHERE battle.id = b.id;
END;
$$;

REVOKE ALL ON FUNCTION public.roll_trainer_battle_initiative(TEXT, TEXT, BOOLEAN, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.roll_trainer_battle_initiative(TEXT, TEXT, BOOLEAN, INT) TO anon, authenticated;
