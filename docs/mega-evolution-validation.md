# Mega Evolution validation checklist

## Functional rules

- Mega form configuration persists separately from the base Pokémon record.
- Activating or reverting Mega Evolution does not change HP, moves, PP, bond, feats, or held-item state.
- Eligibility requires level 10+, final-stage evolution status, and a held Megalite Stone.
- Active Mega forms apply +2 AC, form type/ability/portrait overrides, and doubled ability-score modifiers for move attack rolls, move damage, move save DCs, and saving throws.
- If eligibility is lost after activation, the stored form remains selected but its effects are not applied until eligibility is restored or the form is reverted.

## Automated validation

- GitHub Actions `Kornia Frontend Check` passed on the Mega branch head.
- GitHub Actions `Unit Tests` passed, including `pnpm test`, local Supabase startup, and `pnpm test:db`.
- Unit coverage includes Mega eligibility plus effective AC/type/modifier behavior.
- Database coverage includes read/write-key enforcement, persistence, invalid active-form normalization, and cascade deletion.

## Hosted infrastructure validation

- The `add_mega_evolution` migration was applied successfully to the Kornia Supabase project.
- `private.pokemon_mega`, `get_pokemon_mega`, and `update_pokemon_mega` are present in the hosted database.
- An invalid read key returns no Mega state, and an invalid write key returns `0` without changing data.
- The security advisor reports the same intentional accountless, key-gated `SECURITY DEFINER` pattern already used by the rest of Poke5e. Direct table access remains revoked for anonymous/authenticated clients.
- The performance advisor reports no Mega-specific findings; `pokemon_mega.pokemon_id` is the table primary key and covers its Pokémon foreign-key lookup.
- The `kornia-poke5e` Vercel preview reported Ready for the Mega branch. The separate duplicate `poke5e` Vercel project failed only because its Hobby deployment quota was exhausted, not because of a build failure.

## Remaining manual QA before merge

- Open the hosted Kornia preview and edit a final-stage level 10+ Pokémon holding a Megalite Stone.
- Configure at least one Mega form and verify it survives a reload.
- Activate and revert the form and visually verify AC, type, ability, portrait, move calculations, and saving throws.
- Remove one eligibility condition while the form is selected and verify the overlay is suspended without deleting the selected form.
- Confirm HP, known moves, PP, bond, feats, and held items do not change through activation/reversion.
