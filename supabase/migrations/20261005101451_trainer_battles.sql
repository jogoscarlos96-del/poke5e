CREATE TABLE private.trainer_battles (
	id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
	join_code VARCHAR(10) UNIQUE NOT NULL,
	spectator_code VARCHAR(10) UNIQUE NOT NULL,
	host_access_key VARCHAR(32) UNIQUE NOT NULL,
	guest_access_key VARCHAR(32) UNIQUE,
	settings JSONB NOT NULL CHECK (jsonb_typeof(settings) = 'object'),
	host_participant JSONB NOT NULL CHECK (jsonb_typeof(host_participant) = 'object'),
	guest_participant JSONB CHECK (guest_participant IS NULL OR jsonb_typeof(guest_participant) = 'object'),
	status TEXT NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'active', 'completed')),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX trainer_battles_join_code_idx ON private.trainer_battles(join_code);
CREATE INDEX trainer_battles_spectator_code_idx ON private.trainer_battles(spectator_code);
CREATE INDEX trainer_battles_host_access_key_idx ON private.trainer_battles(host_access_key);
CREATE INDEX trainer_battles_guest_access_key_idx ON private.trainer_battles(guest_access_key);

ALTER TABLE private.trainer_battles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.trainer_battles FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE private.trainer_battles TO service_role;

CREATE OR REPLACE FUNCTION private.trainer_battle_settings_valid(_settings JSONB)
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
	SELECT COALESCE(
		jsonb_typeof(_settings) = 'object'
		AND _settings->>'format' IN ('singles', 'doubles')
		AND _settings->>'teamSize' IN ('3', '4', '6')
		AND _settings->>'scaling' IN ('keep', 'scale'),
		FALSE
	);
$$;

CREATE OR REPLACE FUNCTION private.trainer_battle_participant_valid(_participant JSONB, _team_limit INT)
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
	SELECT COALESCE(
		jsonb_typeof(_participant) = 'object'
		AND jsonb_typeof(_participant->'trainer') = 'object'
		AND CASE
			WHEN jsonb_typeof(_participant->'pokemon') = 'array'
			THEN jsonb_array_length(_participant->'pokemon') BETWEEN 1 AND _team_limit
			ELSE FALSE
		END,
		FALSE
	);
$$;

CREATE OR REPLACE FUNCTION public.new_trainer_battle(
	_settings JSONB,
	_host_participant JSONB
) RETURNS TABLE (
	id UUID,
	join_code VARCHAR(10),
	spectator_code VARCHAR(10),
	access_key VARCHAR(32)
)
LANGUAGE PLPGSQL
VOLATILE
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'private', 'extensions'
AS $$
DECLARE
	v_id UUID;
	v_join_code VARCHAR(10);
	v_spectator_code VARCHAR(10);
	v_access_key VARCHAR(32);
	v_team_limit INT;
	v_host JSONB;
BEGIN
	IF NOT private.trainer_battle_settings_valid(_settings) THEN
		RAISE EXCEPTION 'Invalid Trainer Battle settings.';
	END IF;

	v_team_limit := (_settings->>'teamSize')::INT;
	IF NOT private.trainer_battle_participant_valid(_host_participant, v_team_limit) THEN
		RAISE EXCEPTION 'Invalid Trainer Battle participant.';
	END IF;

	v_host := jsonb_set(_host_participant, '{side}', to_jsonb('a'::TEXT), TRUE);
	v_host := jsonb_set(v_host, '{ready}', to_jsonb(FALSE), TRUE);

	LOOP
		v_join_code := 'J-' || UPPER(nanoid(8));
		EXIT WHEN NOT EXISTS (SELECT 1 FROM private.trainer_battles b WHERE b.join_code = v_join_code);
	END LOOP;

	LOOP
		v_spectator_code := 'W-' || UPPER(nanoid(8));
		EXIT WHEN NOT EXISTS (SELECT 1 FROM private.trainer_battles b WHERE b.spectator_code = v_spectator_code);
	END LOOP;

	LOOP
		v_access_key := nanoid(24);
		EXIT WHEN NOT EXISTS (
			SELECT 1 FROM private.trainer_battles b
			WHERE b.host_access_key = v_access_key OR b.guest_access_key = v_access_key
		);
	END LOOP;

	INSERT INTO private.trainer_battles AS inserted (
		join_code,
		spectator_code,
		host_access_key,
		settings,
		host_participant
	) VALUES (
		v_join_code,
		v_spectator_code,
		v_access_key,
		_settings,
		v_host
	)
	RETURNING inserted.id INTO v_id;

	RETURN QUERY SELECT v_id, v_join_code, v_spectator_code, v_access_key;
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
		'occupied', b.guest_participant IS NOT NULL,
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
		RAISE EXCEPTION 'This Trainer Battle has already started.';
	END IF;
	IF b.guest_participant IS NOT NULL THEN
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
	WHERE battle.host_access_key = _access_key OR battle.guest_access_key = _access_key;

	IF b.id IS NULL THEN
		RETURN NULL;
	END IF;

	IF b.host_access_key = _access_key THEN
		v_side := 'a';
		v_self := b.host_participant;
		v_opponent := b.guest_participant;
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
	WHERE battle.spectator_code = UPPER(BTRIM(_spectator_code));

	IF b.id IS NULL THEN
		RETURN NULL;
	END IF;

	RETURN jsonb_build_object(
		'id', b.id,
		'settings', b.settings,
		'status', b.status,
		'participants', jsonb_build_object('a', b.host_participant, 'b', b.guest_participant),
		'createdAt', b.created_at,
		'updatedAt', b.updated_at
	);
END;
$$;

REVOKE ALL ON FUNCTION public.new_trainer_battle(JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_trainer_battle_join(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_trainer_battle(TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_trainer_battle_player(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_trainer_battle_spectator(TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.new_trainer_battle(JSONB, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_trainer_battle_join(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_trainer_battle(TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_trainer_battle_player(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_trainer_battle_spectator(TEXT) TO anon, authenticated;
