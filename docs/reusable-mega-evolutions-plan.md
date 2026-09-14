# Reusable Mega Evolutions

## Goal

Move Mega Evolution definitions out of individual trainer Pokémon and into reusable shared definitions. A Mega form is created once, linked to a base species, and then offered to every eligible trainer Pokémon of that species.

The existing temporary-overlay mechanics remain unchanged: Mega Evolution never replaces or resets HP, moves, PP, bond, feats, held items, or permanent attributes.

## Reusable Mega definition

Each shared Mega definition stores:

- a stable UUID
- the linked base species identifier (official species or Fakémon identifier)
- display name
- optional type override
- optional ability override (reference ability or custom ability)
- optional portrait image
- optional sprite image
- timestamps and an edit/write key

Portrait and sprite are two independent uploads. Each upload is limited to 524,288 bytes (512 KiB), matching the existing Poke5e image-upload limit. The portrait is used for the large Pokémon-sheet artwork; the sprite is used for compact/sprite representations. Both fall back to the base Pokémon media when absent, suspended, or reverted.

## Shared data and access

Reusable Mega definitions follow the same accountless, key-gated pattern as Custom Moves:

- definitions are readable/listable for the campaign app
- creation returns a write key
- edit/remove/media operations require the definition write key
- write keys are stored only in browser local storage
- the private table is not directly exposed to anonymous/authenticated clients

## Trainer Pokémon state

A trainer Pokémon stores only its selected reusable Mega definition ID. The definition itself is not copied into the Pokémon row.

The selected ID doubles as the player's Mega on/off state:

- null: Mega off
- UUID: Mega selected/on

Eligibility still determines whether the selected overlay is effective. Losing eligibility suspends effects without deleting the selection; restoring eligibility reapplies it.

## Trainer sheet UX

The Mega controls are intentionally contextual:

- no linked Mega definitions: show no Mega controls
- no Megalite Stone: show no Mega controls
- holding a Megalite Stone and linked definitions exist: show a compact `Mega Evolution` control
- one linked definition: `Mega: No / Yes` with the single form
- multiple linked definitions: enabling Mega reveals a form selector
- while selected/effective, show the active Mega name and Revert action

Level 10+ and final-stage checks still control whether effects can become effective. A helpful disabled-state explanation may be shown once the contextual Mega controls are visible.

## Global Mega Evolutions tab

Add a top-level `Mega Evolutions` section similar to Fakémon / Custom Moves. It supports:

- list/search reusable Mega definitions
- create
- view
- edit when the browser has the write key
- remove
- transfer/edit-access link
- base-species selection
- type and ability overrides
- separate portrait and sprite uploads

## Legacy migration

Existing per-Pokémon Mega form JSON is preserved during migration:

1. Legacy forms are promoted into reusable definitions linked to each Pokémon's species.
2. Forms with the same species and case-insensitive name are collapsed to one representative, preferring the most complete stored form.
3. Existing active selections are remapped to the promoted reusable definition when possible.
4. `private.pokemon_mega` remains the per-Pokémon state table but stores only a selected Mega definition UUID.
5. No trainer Pokémon or combat resources are deleted or rewritten.

## Media storage

Reuse the existing `user-assets` Edge Function and presigned upload system rather than opening direct storage writes. Add a `mega-media` handler with independent `portrait` and `sprite` fields. The existing 524,288-byte server validation and image MIME validation remain in force.

## Validation

Automated coverage should include:

- definition CRUD and edit-key authorization
- lookup by species
- legacy migration/remapping
- invalid selected Mega normalization
- definition deletion safely clearing Pokémon selections
- portrait/sprite filename authorization
- 512 KiB upload validation through the existing asset handler
- existing Mega eligibility/effective AC/type/ability/modifier tests

Hosted smoke testing should cover:

- create one Mega definition and reuse it across two Pokémon of the same species
- multiple definitions for one species and per-Pokémon selection
- contextual UI hidden without a Megalite Stone
- separate portrait and sprite upload/apply/revert
- activation, suspension, restore, refresh persistence, and revert
- preservation of HP, moves, PP, bond, feats, held items, and permanent attributes
