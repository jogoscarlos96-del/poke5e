CREATE OR REPLACE FUNCTION public.leave_trainer_battle(_access_key TEXT)
RETURNS TEXT
LANGUAGE PLPGSQL
VOLATILE
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
DECLARE
	b private.trainer_battles%ROWTYPE;
BEGIN
	SELECT battle.* INTO b
	FROM private.trainer_battles battle
	WHERE battle.host_access_key = _access_key OR battle.guest_access_key = _access_key
	FOR UPDATE;

	IF b.id IS NULL THEN
		RETURN NULL;
	END IF;

	IF b.host_access_key = _access_key THEN
		UPDATE private.trainer_battles battle
		SET status = 'completed',
			guest_access_key = NULL,
			updated_at = NOW()
		WHERE battle.id = b.id;
		RETURN 'host_ended';
	END IF;

	IF b.status = 'lobby' THEN
		UPDATE private.trainer_battles battle
		SET guest_access_key = NULL,
			guest_participant = NULL,
			updated_at = NOW()
		WHERE battle.id = b.id;
	ELSE
		UPDATE private.trainer_battles battle
		SET guest_access_key = NULL,
			updated_at = NOW()
		WHERE battle.id = b.id;
	END IF;

	RETURN 'guest_left';
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
		'status', b.status,
		'createdAt', b.created_at,
		'updatedAt', b.updated_at
	);
END;
$$;

CREATE OR REPLACE FUNCTION public.join_trainer_battle(
	_join_code TEXT,
	_participant JSONB
) RETURNS TABLE (
	id UUID,
	access_key VARCHAR(32)
)
LANGUAGE PLPGSQL
VOLATILE
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
DECLARE
	b private.trainer_battles%ROWTYPE;
	v_access_key VARCHAR(32);
	v_team_limit INT;
	v_guest JSONB;
BEGIN
	SELECT battle.* INTO b
	FROM private.trainer_battles battle
	WHERE battle.join_code = UPPER(BTRIM(_join_code))
	FOR UPDATE;

	IF b.id IS NULL THEN
		RAISE EXCEPTION 'Trainer Battle not found.';
	END IF;
	IF b.status <> 'lobby' THEN
		RAISE EXCEPTION 'This Trainer Battle is no longer accepting players.';
	END IF;
	IF b.guest_access_key IS NOT NULL THEN
		RAISE EXCEPTION 'This Trainer Battle already has a second player.';
	END IF;

	v_team_limit := (b.settings->>'teamSize')::INT;
	IF NOT private.trainer_battle_participant_valid(_participant, v_team_limit) THEN
		RAISE EXCEPTION 'Invalid Trainer Battle participant.';
	END IF;

	v_guest := jsonb_set(_participant, '{side}', to_jsonb('b'::TEXT), TRUE);
	v_guest := jsonb_set(v_guest, '{ready}', to_jsonb(FALSE), TRUE);

	LOOP
		v_access_key := nanoid(24);
		EXIT WHEN NOT EXISTS (
			SELECT 1 FROM private.trainer_battles existing
			WHERE existing.host_access_key = v_access_key OR existing.guest_access_key = v_access_key
		);
	END LOOP;

	UPDATE private.trainer_battles battle
	SET guest_participant = v_guest,
		guest_access_key = v_access_key,
		updated_at = NOW()
	WHERE battle.id = b.id;

	RETURN QUERY SELECT b.id, v_access_key;
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
BEGIN
	SELECT battle.* INTO b
	FROM private.trainer_battles battle
	WHERE battle.status <> 'completed'
		AND (battle.host_access_key = _access_key OR battle.guest_access_key = _access_key);

	IF b.id IS NULL THEN
		RETURN NULL;
	END IF;

	IF b.host_access_key = _access_key THEN
		v_side := 'a';
		v_self := b.host_participant;
		v_opponent := CASE WHEN b.guest_access_key IS NULL THEN NULL ELSE b.guest_participant END;
	ELSE
		v_side := 'b';
		v_self := b.guest_participant;
		v_opponent := b.host_participant;
	END IF;

	IF v_opponent IS NOT NULL THEN
		v_opponent_lobby := jsonb_build_object(
			'trainerName', v_opponent #>> '{trainer,name}',
			'ready', COALESCE((v_opponent->>'ready')::BOOLEAN, FALSE),
			'teamCount', jsonb_array_length(COALESCE(v_opponent->'pokemon', '[]'::JSONB))
		);
	END IF;

	RETURN jsonb_build_object(
		'id', b.id,
		'settings', b.settings,
		'status', b.status,
		'viewerSide', v_side,
		'self', v_self,
		'opponent', v_opponent_lobby,
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

	IF b.id IS NULL THEN
		RETURN NULL;
	END IF;

	RETURN jsonb_build_object(
		'id', b.id,
		'settings', b.settings,
		'status', b.status,
		'participants', jsonb_build_object(
			'a', b.host_participant,
			'b', CASE WHEN b.guest_access_key IS NULL AND b.status = 'lobby' THEN NULL ELSE b.guest_participant END
		),
		'createdAt', b.created_at,
		'updatedAt', b.updated_at
	);
END;
$$;

REVOKE ALL ON FUNCTION public.leave_trainer_battle(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_trainer_battle(TEXT) TO anon, authenticated;
