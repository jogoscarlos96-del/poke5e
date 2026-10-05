CREATE OR REPLACE FUNCTION private.trainer_battle_mark_move_used(
	_participant JSONB,
	_pokemon_id TEXT,
	_move_snapshot_id TEXT
) RETURNS JSONB
LANGUAGE PLPGSQL
IMMUTABLE
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
DECLARE
	v_pokemon JSONB;
	v_item JSONB;
	v_move JSONB;
	v_move_item JSONB;
	v_list JSONB := '[]'::JSONB;
	v_moves JSONB;
	v_pp INT;
	v_found BOOLEAN := FALSE;
BEGIN
	FOR v_pokemon IN SELECT value FROM jsonb_array_elements(COALESCE(_participant->'pokemon', '[]'::JSONB))
	LOOP
		v_item := v_pokemon;
		IF v_item->>'id' = _pokemon_id THEN
			v_moves := '[]'::JSONB;
			FOR v_move IN SELECT value FROM jsonb_array_elements(COALESCE(v_item->'moves', '[]'::JSONB))
			LOOP
				v_move_item := v_move;
				IF v_move_item->>'id' = _move_snapshot_id THEN
					v_found := TRUE;
					v_pp := COALESCE((v_move_item #>> '{pp,current}')::INT, 0);
					IF v_pp <= 0 THEN RAISE EXCEPTION 'That move has no PP remaining.'; END IF;
					v_move_item := jsonb_set(v_move_item, '{pp,current}', to_jsonb(v_pp - 1), TRUE);
					v_move_item := jsonb_set(v_move_item, '{usageCount}', to_jsonb(COALESCE((v_move_item->>'usageCount')::INT, 0) + 1), TRUE);
					v_move_item := jsonb_set(v_move_item, '{revealed}', 'true'::JSONB, TRUE);
				END IF;
				v_moves := v_moves || jsonb_build_array(v_move_item);
			END LOOP;
			v_item := jsonb_set(v_item, '{moves}', v_moves, TRUE);
		END IF;
		v_list := v_list || jsonb_build_array(v_item);
	END LOOP;

	IF NOT v_found THEN RAISE EXCEPTION 'That move is not on this Pokémon''s battle moveset.'; END IF;
	RETURN jsonb_set(_participant, '{pokemon}', v_list, TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION private.trainer_battle_apply_hp_amount(
	_participant JSONB,
	_pokemon_id TEXT,
	_amount INT,
	_is_healing BOOLEAN
) RETURNS JSONB
LANGUAGE PLPGSQL
IMMUTABLE
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
DECLARE
	v_pokemon JSONB;
	v_item JSONB;
	v_list JSONB := '[]'::JSONB;
	v_current INT;
	v_max INT;
	v_next INT;
	v_found BOOLEAN := FALSE;
BEGIN
	FOR v_pokemon IN SELECT value FROM jsonb_array_elements(COALESCE(_participant->'pokemon', '[]'::JSONB))
	LOOP
		v_item := v_pokemon;
		IF v_item->>'id' = _pokemon_id THEN
			v_found := TRUE;
			v_current := COALESCE((v_item #>> '{hp,current}')::INT, 0);
			v_max := GREATEST(1, COALESCE((v_item #>> '{hp,max}')::INT, 1));
			IF _is_healing THEN
				v_next := LEAST(v_max, v_current + _amount);
			ELSE
				v_next := GREATEST(0, v_current - _amount);
			END IF;
			v_item := jsonb_set(v_item, '{hp,current}', to_jsonb(v_next), TRUE);
			v_item := jsonb_set(v_item, '{fainted}', to_jsonb(v_next <= 0), TRUE);
		END IF;
		v_list := v_list || jsonb_build_array(v_item);
	END LOOP;

	IF NOT v_found THEN RAISE EXCEPTION 'Battle Pokémon not found.'; END IF;
	RETURN jsonb_set(_participant, '{pokemon}', v_list, TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.use_trainer_battle_move(
	_access_key TEXT,
	_pokemon_id TEXT,
	_move_snapshot_id TEXT,
	_move_name TEXT,
	_target_pokemon_id TEXT,
	_time_unit TEXT,
	_attack_bonus INT,
	_save_dc INT,
	_save_attributes JSONB,
	_damage_dice TEXT,
	_damage_modifier INT,
	_is_healing BOOLEAN,
	_range_feet INT
) RETURNS JSONB
LANGUAGE PLPGSQL
VOLATILE
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
DECLARE
	b private.trainer_battles%ROWTYPE;
	v_side TEXT;
	v_target_side TEXT;
	v_participant JSONB;
	v_attacker JSONB;
	v_move JSONB;
	v_target JSONB;
	v_state JSONB;
	v_action JSONB;
	v_attack JSONB := NULL;
	v_save JSONB := NULL;
	v_damage JSONB := NULL;
	v_attack_roll INT;
	v_attack_total INT;
	v_hit BOOLEAN;
	v_critical BOOLEAN := FALSE;
	v_attr TEXT;
	v_best_attr TEXT := NULL;
	v_score INT;
	v_level INT;
	v_pb INT;
	v_bonus INT;
	v_best_bonus INT := -999;
	v_save_roll INT;
	v_save_total INT;
	v_save_success BOOLEAN;
	v_match TEXT[];
	v_dice_count INT;
	v_dice_sides INT;
	v_roll_count INT;
	v_die INT;
	v_damage_sum INT := 0;
	v_damage_total INT;
	v_damage_rolls JSONB := '[]'::JSONB;
	v_distance INT;
BEGIN
	SELECT battle.* INTO b
	FROM private.trainer_battles battle
	WHERE battle.status = 'active' AND (battle.host_access_key = _access_key OR battle.guest_access_key = _access_key)
	FOR UPDATE;

	IF b.id IS NULL THEN RAISE EXCEPTION 'Active Trainer Battle not found.'; END IF;
	IF COALESCE(b.battle_state->>'phase', 'turns') <> 'turns' THEN RAISE EXCEPTION 'Moves can only be used after initiative is resolved.'; END IF;

	v_side := CASE WHEN b.host_access_key = _access_key THEN 'a' ELSE 'b' END;
	IF b.battle_state->>'turnSide' <> v_side OR b.battle_state->>'turnPokemonId' <> _pokemon_id THEN
		RAISE EXCEPTION 'It is not this Pokémon''s turn.';
	END IF;

	IF _time_unit NOT IN ('action', 'bonus action', 'reaction') THEN RAISE EXCEPTION 'Unknown move action type.'; END IF;
	IF _time_unit = 'reaction' THEN RAISE EXCEPTION 'Reaction moves are not enabled in Trainer Battles yet.'; END IF;
	IF _time_unit = 'action' AND COALESCE((b.battle_state->>'actionUsed')::BOOLEAN, FALSE) THEN RAISE EXCEPTION 'This Pokémon has already used its Action this turn.'; END IF;
	IF _time_unit = 'bonus action' AND COALESCE((b.battle_state->>'bonusActionUsed')::BOOLEAN, FALSE) THEN RAISE EXCEPTION 'This Pokémon has already used its Bonus Action this turn.'; END IF;
	IF _attack_bonus IS NOT NULL AND (_attack_bonus < -30 OR _attack_bonus > 50) THEN RAISE EXCEPTION 'Attack bonus is outside the supported range.'; END IF;
	IF _save_dc IS NOT NULL AND (_save_dc < 1 OR _save_dc > 50) THEN RAISE EXCEPTION 'Save DC is outside the supported range.'; END IF;
	IF COALESCE(_damage_modifier, 0) < -100 OR COALESCE(_damage_modifier, 0) > 100 THEN RAISE EXCEPTION 'Damage modifier is outside the supported range.'; END IF;
	IF _range_feet IS NOT NULL AND (_range_feet < 0 OR _range_feet > 1000) THEN RAISE EXCEPTION 'Move range is outside the supported range.'; END IF;

	v_participant := CASE WHEN v_side = 'a' THEN b.host_participant ELSE b.guest_participant END;
	SELECT p.value INTO v_attacker
	FROM jsonb_array_elements(COALESCE(v_participant->'pokemon', '[]'::JSONB)) AS p(value)
	WHERE p.value->>'id' = _pokemon_id
		AND p.value->'activeSlot' IS NOT NULL AND p.value->'activeSlot' <> 'null'::JSONB
		AND NOT COALESCE((p.value->>'fainted')::BOOLEAN, FALSE);
	IF v_attacker IS NULL THEN RAISE EXCEPTION 'The acting Pokémon is not active on the field.'; END IF;

	SELECT m.value INTO v_move
	FROM jsonb_array_elements(COALESCE(v_attacker->'moves', '[]'::JSONB)) AS m(value)
	WHERE m.value->>'id' = _move_snapshot_id;
	IF v_move IS NULL THEN RAISE EXCEPTION 'That move is not on this Pokémon''s battle moveset.'; END IF;
	IF COALESCE((v_move #>> '{pp,current}')::INT, 0) <= 0 THEN RAISE EXCEPTION 'That move has no PP remaining.'; END IF;

	IF _target_pokemon_id IS NOT NULL AND BTRIM(_target_pokemon_id) <> '' THEN
		SELECT p.value INTO v_target
		FROM jsonb_array_elements(COALESCE(b.host_participant->'pokemon', '[]'::JSONB)) AS p(value)
		WHERE p.value->>'id' = _target_pokemon_id
			AND p.value->'activeSlot' IS NOT NULL AND p.value->'activeSlot' <> 'null'::JSONB
			AND NOT COALESCE((p.value->>'fainted')::BOOLEAN, FALSE);
		IF v_target IS NOT NULL THEN
			v_target_side := 'a';
		ELSE
			SELECT p.value INTO v_target
			FROM jsonb_array_elements(COALESCE(b.guest_participant->'pokemon', '[]'::JSONB)) AS p(value)
			WHERE p.value->>'id' = _target_pokemon_id
				AND p.value->'activeSlot' IS NOT NULL AND p.value->'activeSlot' <> 'null'::JSONB
				AND NOT COALESCE((p.value->>'fainted')::BOOLEAN, FALSE);
			IF v_target IS NOT NULL THEN v_target_side := 'b'; END IF;
		END IF;
		IF v_target IS NULL THEN RAISE EXCEPTION 'The selected target is not active on the field.'; END IF;
	END IF;

	IF (_attack_bonus IS NOT NULL OR _save_dc IS NOT NULL) AND v_target IS NULL THEN
		RAISE EXCEPTION 'This move needs an active target.';
	END IF;

	IF v_target IS NOT NULL AND _range_feet IS NOT NULL AND v_target->>'id' <> v_attacker->>'id'
		AND v_attacker->'position' IS NOT NULL AND v_attacker->'position' <> 'null'::JSONB
		AND v_target->'position' IS NOT NULL AND v_target->'position' <> 'null'::JSONB THEN
		v_distance := private.trainer_battle_hex_distance(
			(v_attacker #>> '{position,q}')::INT,
			(v_attacker #>> '{position,r}')::INT,
			(v_target #>> '{position,q}')::INT,
			(v_target #>> '{position,r}')::INT
		) * 5;
		IF v_distance > _range_feet THEN RAISE EXCEPTION 'The selected target is outside this move''s range.'; END IF;
	END IF;

	IF _attack_bonus IS NOT NULL THEN
		v_attack_roll := FLOOR(random() * 20)::INT + 1;
		v_attack_total := v_attack_roll + _attack_bonus;
		v_critical := v_attack_roll = 20;
		v_hit := v_critical OR (v_attack_roll <> 1 AND v_attack_total >= COALESCE((v_target->>'ac')::INT, 10));
		v_attack := jsonb_build_object(
			'roll', v_attack_roll,
			'bonus', _attack_bonus,
			'total', v_attack_total,
			'hit', v_hit,
			'critical', v_critical
		);
	END IF;

	IF _save_dc IS NOT NULL THEN
		IF _save_attributes IS NULL OR jsonb_typeof(_save_attributes) <> 'array' OR jsonb_array_length(_save_attributes) = 0 THEN
			RAISE EXCEPTION 'A saving-throw move must include at least one save attribute.';
		END IF;
		v_level := GREATEST(1, COALESCE((v_target #>> '{level,data}')::INT, 1));
		v_pb := 2 + FLOOR((v_level - 1) / 4.0)::INT;
		FOR v_attr IN SELECT jsonb_array_elements_text(_save_attributes)
		LOOP
			IF v_attr NOT IN ('str', 'dex', 'con', 'int', 'wis', 'cha') THEN RAISE EXCEPTION 'Unknown save attribute.'; END IF;
			v_score := COALESCE((v_target #>> ARRAY['attributes', 'data', v_attr])::INT, 10);
			v_bonus := FLOOR(v_score / 2.0)::INT - 5;
			IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(v_target->'savingThrows', '[]'::JSONB)) AS s(value) WHERE s.value = v_attr) THEN
				v_bonus := v_bonus + v_pb;
			END IF;
			IF v_bonus > v_best_bonus THEN
				v_best_bonus := v_bonus;
				v_best_attr := v_attr;
			END IF;
		END LOOP;
		v_save_roll := FLOOR(random() * 20)::INT + 1;
		v_save_total := v_save_roll + v_best_bonus;
		v_save_success := v_save_total >= _save_dc;
		v_save := jsonb_build_object(
			'attribute', v_best_attr,
			'roll', v_save_roll,
			'bonus', v_best_bonus,
			'total', v_save_total,
			'dc', _save_dc,
			'success', v_save_success
		);
	END IF;

	IF _damage_dice IS NOT NULL AND BTRIM(_damage_dice) <> '' THEN
		v_match := regexp_match(LOWER(BTRIM(_damage_dice)), '^([0-9]+)d([0-9]+)$');
		IF v_match IS NULL THEN RAISE EXCEPTION 'Trainer Battles currently support standard damage dice such as 2d6.'; END IF;
		v_dice_count := v_match[1]::INT;
		v_dice_sides := v_match[2]::INT;
		IF v_dice_count < 1 OR v_dice_count > 50 OR v_dice_sides < 2 OR v_dice_sides > 1000 THEN RAISE EXCEPTION 'Damage dice are outside the supported range.'; END IF;
		v_roll_count := v_dice_count * CASE WHEN v_critical THEN 2 ELSE 1 END;
		FOR i IN 1..v_roll_count LOOP
			v_die := FLOOR(random() * v_dice_sides)::INT + 1;
			v_damage_sum := v_damage_sum + v_die;
			v_damage_rolls := v_damage_rolls || jsonb_build_array(v_die);
		END LOOP;
		v_damage_total := GREATEST(0, v_damage_sum + COALESCE(_damage_modifier, 0));
		v_damage := jsonb_build_object(
			'dice', LOWER(BTRIM(_damage_dice)),
			'rolls', v_damage_rolls,
			'modifier', COALESCE(_damage_modifier, 0),
			'total', v_damage_total,
			'isHealing', COALESCE(_is_healing, FALSE),
			'critical', v_critical
		);
	END IF;

	v_action := jsonb_build_object(
		'id', nanoid(12),
		'round', COALESCE((b.battle_state->>'round')::INT, 1),
		'side', v_side,
		'pokemonId', _pokemon_id,
		'moveSnapshotId', _move_snapshot_id,
		'moveId', v_move->>'moveId',
		'moveName', LEFT(COALESCE(NULLIF(BTRIM(_move_name), ''), v_move->>'moveId'), 120),
		'targetPokemonId', CASE WHEN v_target IS NULL THEN NULL ELSE v_target->>'id' END,
		'targetSide', v_target_side,
		'timeUnit', _time_unit,
		'attack', v_attack,
		'save', v_save,
		'damage', v_damage,
		'appliedAmount', NULL,
		'createdAt', NOW()
	);

	v_participant := private.trainer_battle_mark_move_used(v_participant, _pokemon_id, _move_snapshot_id);
	v_state := b.battle_state;
	IF _time_unit = 'action' THEN
		v_state := jsonb_set(v_state, '{actionUsed}', 'true'::JSONB, TRUE);
	ELSIF _time_unit = 'bonus action' THEN
		v_state := jsonb_set(v_state, '{bonusActionUsed}', 'true'::JSONB, TRUE);
	END IF;
	v_state := jsonb_set(v_state, '{lastAction}', v_action, TRUE);

	UPDATE private.trainer_battles battle
	SET host_participant = CASE WHEN v_side = 'a' THEN v_participant ELSE battle.host_participant END,
		guest_participant = CASE WHEN v_side = 'b' THEN v_participant ELSE battle.guest_participant END,
		battle_state = v_state,
		updated_at = NOW()
	WHERE battle.id = b.id;

	RETURN v_action;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_trainer_battle_last_damage(
	_access_key TEXT,
	_amount INT
) RETURNS VOID
LANGUAGE PLPGSQL
VOLATILE
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
DECLARE
	b private.trainer_battles%ROWTYPE;
	v_side TEXT;
	v_action JSONB;
	v_state JSONB;
	v_target_side TEXT;
	v_target_id TEXT;
	v_amount INT;
	v_is_healing BOOLEAN;
	v_host JSONB;
	v_guest JSONB;
BEGIN
	SELECT battle.* INTO b
	FROM private.trainer_battles battle
	WHERE battle.status = 'active' AND (battle.host_access_key = _access_key OR battle.guest_access_key = _access_key)
	FOR UPDATE;
	IF b.id IS NULL THEN RAISE EXCEPTION 'Active Trainer Battle not found.'; END IF;

	v_side := CASE WHEN b.host_access_key = _access_key THEN 'a' ELSE 'b' END;
	v_action := b.battle_state->'lastAction';
	IF v_action IS NULL OR v_action = 'null'::JSONB THEN RAISE EXCEPTION 'There is no move result to apply.'; END IF;
	IF v_action->>'side' <> v_side THEN RAISE EXCEPTION 'Only the player who used the move can apply its rolled amount.'; END IF;
	IF b.battle_state->>'turnSide' <> v_side OR b.battle_state->>'turnPokemonId' <> v_action->>'pokemonId' THEN RAISE EXCEPTION 'That move result is no longer on the current turn.'; END IF;
	IF v_action->'damage' IS NULL OR v_action->'damage' = 'null'::JSONB THEN RAISE EXCEPTION 'That move did not produce a damage or healing roll.'; END IF;
	IF v_action->>'targetPokemonId' IS NULL THEN RAISE EXCEPTION 'That move result has no target to apply to.'; END IF;
	IF v_action ? 'appliedAmount' AND v_action->'appliedAmount' <> 'null'::JSONB THEN RAISE EXCEPTION 'That move result has already been applied.'; END IF;

	v_amount := COALESCE(_amount, (v_action #>> '{damage,total}')::INT, 0);
	IF v_amount < 0 OR v_amount > 9999 THEN RAISE EXCEPTION 'Applied amount must be between 0 and 9999.'; END IF;
	v_target_side := v_action->>'targetSide';
	v_target_id := v_action->>'targetPokemonId';
	v_is_healing := COALESCE((v_action #>> '{damage,isHealing}')::BOOLEAN, FALSE);
	v_host := b.host_participant;
	v_guest := b.guest_participant;

	IF v_target_side = 'a' THEN
		v_host := private.trainer_battle_apply_hp_amount(v_host, v_target_id, v_amount, v_is_healing);
	ELSIF v_target_side = 'b' THEN
		v_guest := private.trainer_battle_apply_hp_amount(v_guest, v_target_id, v_amount, v_is_healing);
	ELSE
		RAISE EXCEPTION 'Move target side could not be resolved.';
	END IF;

	v_action := jsonb_set(v_action, '{appliedAmount}', to_jsonb(v_amount), TRUE);
	v_state := jsonb_set(b.battle_state, '{lastAction}', v_action, TRUE);

	UPDATE private.trainer_battles battle
	SET host_participant = v_host,
		guest_participant = v_guest,
		battle_state = v_state,
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
	v_state := jsonb_set(v_state, '{actionUsed}', 'false'::JSONB, TRUE);
	v_state := jsonb_set(v_state, '{bonusActionUsed}', 'false'::JSONB, TRUE);

	UPDATE private.trainer_battles battle
	SET host_participant = v_host,
		guest_participant = v_guest,
		battle_state = v_state,
		updated_at = NOW()
	WHERE battle.id = b.id;
END;
$$;

REVOKE ALL ON FUNCTION public.use_trainer_battle_move(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INT, INT, JSONB, TEXT, INT, BOOLEAN, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_trainer_battle_last_damage(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.use_trainer_battle_move(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INT, INT, JSONB, TEXT, INT, BOOLEAN, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_trainer_battle_last_damage(TEXT, INT) TO anon, authenticated;
