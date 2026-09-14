# Mega Evolution implementation

Implementation plan for Kornia's trainer Pokémon sheets.

- Mega state is a transformation overlay; HP, moves, current PP, bond, feats, and permanent attributes are never copied or reset.
- Universal mechanics: +2 AC and doubled ability-score modifiers for attack rolls, damage rolls, saving throws, and move saving throw DCs. Proficiency bonus, proficiency/expertise rank, STAB, and trainer specialization bonuses are not doubled.
- Eligibility enforced by the sheet: level 10+, final-stage Pokémon, and holding the standard `megalite-stone` item. Key Stone remains a DM-managed trainer requirement.
- A Pokémon can define multiple named Mega forms (for example X, Y, Z), each with an optional type override, ability override (standard or custom), and portrait.
- Mega form activation is persisted independently from HP and move PP so toggling the transformation cannot roll combat state backward.
- If a stored active form becomes temporarily ineligible, its effects are suspended rather than mutating the underlying Pokémon. The player can explicitly revert it, or eligibility can be restored.
