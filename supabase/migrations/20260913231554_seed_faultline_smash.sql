-- Kornia signature move: Hoennian Tinkaton's Faultline Smash.
--
-- The row keeps its generated UUID/write key when it already exists. Fresh
-- databases receive a generated UUID/write key from the custom_moves defaults.
-- Do not hardcode either credential in source control.

UPDATE private.custom_moves
SET move_data = $move$
{
  "name": "Faultline Smash",
  "type": "ground",
  "power": ["str"],
  "time": { "unit": "action" },
  "pp": 3,
  "duration": { "unit": "instantaneous", "concentration": false },
  "range": { "type": "melee" },
  "description": "You slam your weapon into the ground with enough force to fracture the battlefield. Make a melee attack against one creature. On a hit, the target takes {dice} {type} damage. If the target is Grounded, it must succeed on a {save} or be knocked prone. The ground within 5 feet of the target becomes difficult terrain until the start of your next turn. This move cannot be used on consecutive turns by the same creature.",
  "dice": {
    "class": "custom",
    "tiers": ["3d6", "4d6", "5d8", "6d10"],
    "modifier": "MOVE",
    "type": "damage"
  },
  "attack": { "scope": "melee" },
  "save": { "attribute": ["str"], "dc": "MOVE" }
}
$move$::jsonb,
updated_at = NOW()
WHERE move_data->>'name' = 'Faultline Smash';

INSERT INTO private.custom_moves (move_data)
SELECT $move$
{
  "name": "Faultline Smash",
  "type": "ground",
  "power": ["str"],
  "time": { "unit": "action" },
  "pp": 3,
  "duration": { "unit": "instantaneous", "concentration": false },
  "range": { "type": "melee" },
  "description": "You slam your weapon into the ground with enough force to fracture the battlefield. Make a melee attack against one creature. On a hit, the target takes {dice} {type} damage. If the target is Grounded, it must succeed on a {save} or be knocked prone. The ground within 5 feet of the target becomes difficult terrain until the start of your next turn. This move cannot be used on consecutive turns by the same creature.",
  "dice": {
    "class": "custom",
    "tiers": ["3d6", "4d6", "5d8", "6d10"],
    "modifier": "MOVE",
    "type": "damage"
  },
  "attack": { "scope": "melee" },
  "save": { "attribute": ["str"], "dc": "MOVE" }
}
$move$::jsonb
WHERE NOT EXISTS (
  SELECT 1
  FROM private.custom_moves
  WHERE move_data->>'name' = 'Faultline Smash'
);
