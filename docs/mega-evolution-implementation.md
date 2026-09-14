# Mega Evolution implementation

Implementation plan for Kornia's trainer Pokémon sheets.

- Mega state is a transformation overlay; HP, moves, and current PP are never copied or reset.
- Universal mechanics: +2 AC and doubled ability-score modifiers for attack rolls, damage rolls, saving throws, and saving throw DCs.
- Eligibility enforced by the sheet: level 10+ and holding the standard `megalite-stone` item. Key Stone remains a DM-managed trainer requirement.
- A Pokémon can define multiple named Mega forms (for example X, Y, Z), each with an optional type override, ability override, and portrait.
- Mega form activation is persisted independently from HP and move PP so toggling the transformation cannot roll combat state backward.
