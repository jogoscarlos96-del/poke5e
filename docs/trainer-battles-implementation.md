# Trainer Battles implementation

This draft feature is intentionally isolated from normal Trainer/Pokémon records. Battle participants are represented by session snapshots so that HP, PP, statuses, scaling, and revealed information inside a Trainer Battle never mutate the source Trainer sheet.

Planned delivery order:

1. Session/domain model and Scale Stats transformation.
2. Supabase-backed host/join/watch sessions with separate player and spectator access.
3. Trainer/team selection from locally known Trainers and immutable battle snapshots.
4. Singles/Doubles turn state and switching.
5. Shared 5-foot hex arena with fixed spawn points and owner-controlled token movement.
6. Realtime synchronization and spectator projection.
7. Battle-specific Pokémon sheets and move/damage rollers.
8. Full validation, browser/database tests, and preview review.

Locked rules:

- Battle format: Singles (1 active Pokémon per side) or Doubles (2 active Pokémon per side).
- Team size: 3v3, 4v4, or 6v6.
- Battle Pokémon start at full HP and full PP regardless of source sheet resources.
- Scale Stats only affects Pokémon above level 10: battle max HP is `floor(source max HP / 2)` and move damage dice use the level-10 damage tier. Actual level, attributes, proficiency, attack bonuses, MOVE modifiers, STAB calculations, AC, save DCs, feats, abilities, and items remain unchanged.
- Source Trainer/Pokémon records are never updated by Trainer Battles.
- Arena uses a 5-foot hex grid, approximately 80 ft wide by 50 ft tall.
- Each side has fixed spawn locations approximately 15 ft from its vertical edge; Doubles has two spawn locations per side.
- A replacement Pokémon enters at its side's designated spawn (or nearest legal free hex if occupied), never at the recalled Pokémon's prior position.
- Players can see the opponent's active Pokémon identity, revealed/fainted roster entries, revealed moves and usage counts, and current non-volatile/volatile statuses. They see no opposing HP information, no health bar, no current/max PP, no unrevealed moves, and no unrevealed roster identities.
- Spectators are read-only and may see the complete battle state, including full active sheets, exact HP/PP, full rosters, statuses, and battlefield state.
