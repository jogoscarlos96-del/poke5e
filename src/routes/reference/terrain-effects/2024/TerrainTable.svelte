<script lang="ts">
	import { InfoTable } from "$lib/ui/elements"
	import { Url } from "$lib/site/url"
</script>

<InfoTable label="Terrain Effects">
	<thead>
		<tr>
			<th>Terrain</th>
			<th>Effect</th>
		</tr>
	</thead>
	<tbody>
		<tr>
			<td>Electric</td>
			<td><p>Creatures may double their MOVE modifier on damage rolls for electric-type moves activated inside the terrain. In addition, grounded creatures cannot be asleep.</p></td>
		</tr>
		<tr>
			<td>Grassy</td>
			<td><p>Creatures may double their MOVE modifier on damage rolls for grass-type moves activated inside the terrain. In addition, grounded creatures that end their turn within the terrain heal an amount of hit points equal to their proficiency bonus.</p></td>
		</tr>
		<tr>
			<td>Misty</td>
			<td><p>Grounded creatures in the terrain are resistant to dragon-type damage, or if they were vulnerable to dragon-type damage, they take regular damage instead. In addition, grounded creatures cannot suffer new <a href="{Url.reference.status()}">status conditions</a>.</p></td>
		</tr>
		<tr>
			<td>Psychic</td>
			<td><p>Creatures may double their MOVE modifier on damage rolls for psychic-type moves activated inside the terrain. In addition, grounded creatures in the terrain cannot use bonus actions.</p></td>
		</tr>
		<tr>
			<td>Fighting</td>
			<td><p>Creatures may double their MOVE modifier on damage rolls for fighting-type moves activated inside the terrain. In addition, grounded creatures may use Push, Trip, or Grapple as a bonus action while inside the terrain.</p></td>
		</tr>
		<tr>
			<td>Darkness</td>
			<td><p>Creatures may double their MOVE modifier on damage rolls for dark-type moves activated inside the terrain. In addition, dark-type attack moves activated by grounded creatures inside the terrain increase their critical-hit range by 1.</p></td>
		</tr>
		<tr>
			<td>Fire</td>
			<td><p>Creatures may double their MOVE modifier on damage rolls for fire-type moves activated inside the terrain. In addition, grounded creatures cannot be Frozen.</p></td>
		</tr>
		<tr>
			<td>Watery</td>
			<td><p>Creatures may double their MOVE modifier on damage rolls for water-type moves activated inside the terrain. In addition, grounded creatures may use their swimming Speed for movement while inside the terrain as though the terrain were water, even when battling on land. Grounded creatures cannot be Burned.</p></td>
		</tr>
		<tr>
			<td>Icy</td>
			<td><p>Creatures may double their MOVE modifier on damage rolls for ice-type moves activated inside the terrain. In addition, once per turn, when a grounded creature moves more than half its Speed within the terrain, it must succeed on a DC 12 DEX saving throw or fall Prone. Ice-type creatures automatically succeed on this saving throw.</p></td>
		</tr>
		<tr>
			<td>Poison</td>
			<td><p>Creatures may double their MOVE modifier on damage rolls for poison-type moves activated inside the terrain. In addition, grounded non-Poison-type creatures have disadvantage on saving throws against becoming Poisoned.</p></td>
		</tr>
		<tr>
			<td>Ground</td>
			<td><p>Creatures may double their MOVE modifier on damage rolls for ground-type moves activated inside the terrain. In addition, grounded creatures have advantage on checks and saving throws made to resist being Pushed, Tripped, or otherwise forcibly moved.</p></td>
		</tr>
		<tr>
			<td>Hive</td>
			<td><p>Creatures may double their MOVE modifier on damage rolls for bug-type moves activated inside the terrain. In addition, grounded creatures can move through spaces occupied by allies without treating those spaces as difficult terrain.</p></td>
		</tr>
		<tr>
			<td>Rocky</td>
			<td><p>Creatures may double their MOVE modifier on damage rolls for rock-type moves activated inside the terrain. In addition, grounded creatures gain +1 AC against ranged attack rolls.</p></td>
		</tr>
		<tr>
			<td>Steely</td>
			<td><p>Creatures may double their MOVE modifier on damage rolls for steel-type moves activated inside the terrain. In addition, grounded creatures gain +1 AC.</p></td>
		</tr>
		<tr>
			<td>Ghostly</td>
			<td><p>Creatures may double their MOVE modifier on damage rolls for ghost-type moves activated inside the terrain. In addition, Ghost-type creatures may move through spaces occupied by other creatures, though they cannot end their movement there.</p></td>
		</tr>
		<tr>
			<td>Draconic</td>
			<td><p>Creatures may double their MOVE modifier on damage rolls for dragon-type moves activated inside the terrain. In addition, grounded creatures have advantage on saving throws against becoming Frightened.</p></td>
		</tr>
		<tr>
			<td>Normal</td>
			<td><p>Creatures may double their MOVE modifier on damage rolls for normal-type moves activated inside the terrain. In addition, grounded creatures may take the Disengage action as a bonus action; when they Disengage, their Speed increases by 10 feet until the end of that turn.</p></td>
		</tr>
	</tbody>
</InfoTable>
