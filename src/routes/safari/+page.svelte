<script lang="ts">
	import { onMount } from "svelte"
	import { Title, Page } from "$lib/ui/layout"
	import { Button, Loader } from "$lib/ui/elements"
	import { GreatballIcon } from "$lib/ui/icons"
	import { trainers } from "$lib/trainers/trainers"
	import type { Trainer } from "$lib/trainers/types"
	import type { Skill } from "$lib/dnd/skills"
	import { SkillRanks } from "$lib/dnd/skills"
	import { rollDice } from "$lib/site/dice/DiceRoller"
	import { CatchDc } from "$lib/poke5e/catching"
	import { Level } from "$lib/dnd/level"
	import { SpeciesRating } from "$lib/poke5e/sr"
	import { currentEdition } from "$lib/site/edition"
	import type { PokemonSpecies } from "$lib/poke5e/species"
	import {
		SafariData,
		SafariGauge,
		SafariSessionLocalStorage,
		applyGaugeDelta,
		captureEffectForGauge,
		isBored,
		nextNoChangeCount,
		repeatedInteractionValue,
		stealthCaptureEffect,
		stealthTier,
		type SafariBiomeDefinition,
		type SafariEncounterState,
		type SafariGaugeValue,
		type SafariPark,
		type SafariSessionEndReason,
		type SafariSessionState,
	} from "$lib/safari"
	import { loadSafariSpecies, resolveSafariSpecies } from "$lib/safari/SpeciesResolver"

	let loading = true
	let error: string | undefined
	let notice: string | undefined
	let captureError: string | undefined

	let cachedTrainers: Trainer[] = []
	let parks: SafariPark[] = []
	let allSpecies: PokemonSpecies[] = []
	let speciesById = new Map<string, PokemonSpecies>()

	let selectedTrainerReadKey = ""
	let startingBalls: number | undefined
	let selectedParkId = ""
	let selectedBiomeId = ""
	let session: SafariSessionState | undefined
	let existingSession: SafariSessionState | undefined
	let choosingBiome = false

	let interactionName = ""
	let interactionDelta: number | undefined = undefined
	let spendPokeblock = false
	let eligibleGroups: ReturnType<typeof groupSpeciesBySr> = []
	let previewGroups: ReturnType<typeof groupSpeciesBySr> = []
	let captureStatus: ReturnType<typeof buildCaptureDetails> | undefined
	let selectedSkill: Skill = "animal handling"

	$: selectedTrainer = cachedTrainers.find((trainer) => trainer.readKey === selectedTrainerReadKey)
	$: selectedPark = parks.find((park) => park.id === selectedParkId)
	$: selectedBiome = selectedPark?.biomes.find((biome) => biome.id === selectedBiomeId)
	$: if (selectedTrainerReadKey) existingSession = SafariSessionLocalStorage.get(selectedTrainerReadKey)

	$: activeTrainer = session ? cachedTrainers.find((trainer) => trainer.readKey === session?.trainerReadKey) : selectedTrainer
	$: currentPark = session ? parks.find((park) => park.id === session?.parkId) : undefined
	$: currentBiome = currentPark?.biomes.find((biome) => biome.id === session?.biomeId)
	$: encounterSpecies = session?.encounter ? speciesById.get(session.encounter.speciesId) : undefined
	$: maxSr = activeTrainer ? SpeciesRating.maxAllowed(activeTrainer.level).data : 0
	$: eligibleSpecies = currentBiome
		? currentBiome.speciesIds
			.map((id) => speciesById.get(id))
			.filter((species): species is PokemonSpecies => species != null && species.sr.data <= maxSr)
		: []
	$: eligibleGroups = groupSpeciesBySr(eligibleSpecies)
	$: previewGroups = !selectedBiome || !selectedTrainer
		? []
		: groupSpeciesBySr(selectedBiome.speciesIds
			.map((id) => speciesById.get(id))
			.filter((entry): entry is PokemonSpecies => entry != null && entry.sr.data <= SpeciesRating.maxAllowed(selectedTrainer.level).data))
	$: captureStatus = session?.encounter && encounterSpecies
		? buildCaptureDetails(encounterSpecies, session.encounter.gauge, session.encounter.stealth?.tier, $currentEdition)
		: undefined

	onMount(() => {
		void load()
	})

	const load = async () => {
		loading = true
		error = undefined
		try {
			const [trainerStore, loadedParks, loadedSpecies] = await Promise.all([
				trainers.all(),
				SafariData.listParks(),
				loadSafariSpecies(),
			])

			let unsubscribe: (() => void) | undefined
			unsubscribe = trainerStore.subscribe((value) => {
				cachedTrainers = value
				unsubscribe?.()
			})

			parks = loadedParks
			allSpecies = loadedSpecies
			const ids = parks.flatMap((park) => park.biomes.flatMap((biome) => biome.speciesIds))
			speciesById = await resolveSafariSpecies(ids, allSpecies)
		} catch (e) {
			error = e instanceof Error ? e.message : String(e)
		} finally {
			loading = false
		}
	}

	const persist = (next: SafariSessionState) => {
		session = next
		SafariSessionLocalStorage.set(next)
		if (next.trainerReadKey === selectedTrainerReadKey) existingSession = next
	}

	const skillModifier = (trainer: Trainer, skill: Skill): number => {
		const info = SkillRanks.list.find((entry) => entry.name === skill)
		if (!info) return 0
		const score = trainer.attributes.data[info.attribute]
		const abilityModifier = Math.floor(score / 2) - 5
		const rank = trainer.proficiencies.data[skill] ?? 0
		return abilityModifier + rank * trainer.level.proficiencyBonus
	}

	const startSession = () => {
		if (!selectedTrainer || !selectedPark || !selectedBiome || !startingBalls || startingBalls < 1) return
		const next: SafariSessionState = {
			id: crypto.randomUUID(),
			trainerReadKey: selectedTrainer.readKey,
			trainerName: selectedTrainer.name,
			trainerLevel: selectedTrainer.level.data,
			parkId: selectedPark.id,
			parkName: selectedPark.name,
			biomeId: selectedBiome.id,
			safariBallsStart: Math.floor(startingBalls),
			safariBallsRemaining: Math.floor(startingBalls),
			pokeblocksRemaining: 15,
			captures: [],
			biomeChangeUsed: false,
			ended: false,
		}
		persist(next)
		notice = undefined
	}

	const resumeSession = () => {
		if (!existingSession) return
		session = existingSession
		notice = "Safari session resumed."
	}

	const finishSession = (reason: SafariSessionEndReason) => {
		if (!session) return
		persist({
			...session,
			ended: true,
			endReason: reason,
			encounter: undefined,
			pendingStealth: undefined,
		})
	}

	const endReasonText = (reason?: SafariSessionEndReason) => {
		if (reason === "out-of-balls") return "No Safari Balls remain."
		if (reason === "three-captures") return "Three Pokémon were captured."
		return "The exploration was ended."
	}

	const returnToSetup = () => {
		session = undefined
		startingBalls = undefined
		selectedParkId = ""
		selectedBiomeId = ""
		notice = undefined
	}

	const changeBiome = (biome: SafariBiomeDefinition) => {
		if (!session || session.biomeChangeUsed || biome.id === session.biomeId) return
		persist({ ...session, biomeId: biome.id, biomeChangeUsed: true })
		choosingBiome = false
		notice = `Moved to ${biome.name}. The session's one biome change has been used.`
	}

	const attemptStealth = () => {
		if (!session || !activeTrainer) return
		const modifier = skillModifier(activeTrainer, "stealth")
		const result = rollDice({ count: 1, sides: 20, modifier, mode: "normal" })
		const naturalRoll = result.keptRolls[0]
		const stealth = {
			naturalRoll,
			total: result.total,
			tier: stealthTier(naturalRoll, result.total),
		}
		persist({ ...session, pendingStealth: stealth })
		notice = `Stealth check: ${naturalRoll} ${modifier >= 0 ? "+" : "−"} ${Math.abs(modifier)} = ${result.total}.`
	}

	const startEncounter = (species: PokemonSpecies) => {
		if (!session) return
		const encounter: SafariEncounterState = {
			speciesId: species.id.data,
			gauge: 0,
			repetitions: {},
			noChangeCount: 0,
			stealth: session.pendingStealth,
			stealthCaptureFailed: false,
		}
		persist({ ...session, pendingStealth: undefined, encounter })
		interactionName = ""
		interactionDelta = undefined
		spendPokeblock = false
		selectedSkill = "animal handling"
		notice = undefined
		captureError = undefined
	}

	const endEncounter = (message: string) => {
		if (!session) return
		persist({ ...session, encounter: undefined })
		notice = message
		captureError = undefined
	}

	const setGauge = (value: SafariGaugeValue) => {
		if (!session?.encounter) return
		if (value === -2) {
			endEncounter("The Pokémon fled when the Safari Gauge reached -2.")
			return
		}
		persist({
			...session,
			encounter: {
				...session.encounter,
				gauge: value,
				noChangeCount: value === session.encounter.gauge ? session.encounter.noChangeCount : 0,
			},
		})
	}

	const applyInteraction = () => {
		if (!session?.encounter || !interactionName.trim() || interactionDelta == null || !Number.isFinite(interactionDelta)) return
		if (spendPokeblock && session.pokeblocksRemaining <= 0) return

		const encounter = session.encounter
		const key = interactionName.trim().toLocaleLowerCase()
		const repeatIndex = encounter.repetitions[key] ?? 0
		const baseDelta = Math.trunc(interactionDelta)
		const appliedDelta = repeatedInteractionValue(baseDelta, repeatIndex)
		const nextGauge = applyGaugeDelta(encounter.gauge, appliedDelta)
		const noChangeCount = nextNoChangeCount(encounter.gauge, nextGauge, encounter.noChangeCount)
		const nextEncounter: SafariEncounterState = {
			...encounter,
			gauge: nextGauge,
			noChangeCount,
			repetitions: { ...encounter.repetitions, [key]: repeatIndex + 1 },
			lastInteraction: {
				name: interactionName.trim(),
				baseDelta,
				appliedDelta,
			},
		}
		const nextSession = {
			...session,
			pokeblocksRemaining: session.pokeblocksRemaining - (spendPokeblock ? 1 : 0),
			encounter: nextEncounter,
		}
		persist(nextSession)
		interactionDelta = undefined
		spendPokeblock = false

		if (nextGauge === -2) {
			endEncounter("The Pokémon fled when the Safari Gauge reached -2.")
		} else if (isBored(noChangeCount)) {
			endEncounter("The Pokémon became bored after two consecutive interactions left the Gauge unchanged and fled.")
		}
	}

	const rollSkill = () => {
		if (!session?.encounter || !activeTrainer) return
		const modifier = skillModifier(activeTrainer, selectedSkill)
		const result = rollDice({ count: 1, sides: 20, modifier, mode: "normal" })
		persist({
			...session,
			encounter: {
				...session.encounter,
				lastSkillRoll: {
					skill: selectedSkill,
					naturalRoll: result.keptRolls[0],
					total: result.total,
				},
			},
		})
	}

	function buildCaptureDetails(
		species: PokemonSpecies,
		gaugeValue: SafariGaugeValue,
		stealthTierValue: SafariEncounterState["stealth"] extends infer T ? T extends { tier: infer U } ? U : never : never,
		version: Parameters<typeof CatchDc.calculate>[0]["version"],
	) {
		const gauge = captureEffectForGauge(gaugeValue)
		const stealth = stealthCaptureEffect(stealthTierValue)
		const base = CatchDc.calculate({
			level: new Level(species.minLevel),
			sr: species.sr,
			hp: { current: species.hp, max: species.hp },
			version,
		})
		return {
			base,
			gauge,
			stealth,
			dc: Math.max(1, base + gauge.dcModifier + stealth.dcModifier),
			advantage: gauge.advantage || stealth.advantage,
		}
	}

	const attemptCapture = async () => {
		if (!session?.encounter || !activeTrainer || !encounterSpecies || session.safariBallsRemaining <= 0) return

		captureError = undefined
		const encounter = session.encounter
		const details = buildCaptureDetails(encounterSpecies, encounter.gauge, encounter.stealth?.tier, $currentEdition)
		const handlingModifier = skillModifier(activeTrainer, "animal handling")
		const ballsRemaining = session.safariBallsRemaining - 1

		let success = details.stealth.automaticSuccess
		let captureRoll: SafariEncounterState["lastCaptureRoll"] | undefined

		if (!success) {
			const result = rollDice({
				count: 1,
				sides: 20,
				modifier: handlingModifier,
				mode: details.advantage ? "advantage" : "normal",
			})
			success = result.total >= details.dc
			captureRoll = {
				rolls: result.rolls,
				kept: result.keptRolls[0],
				total: result.total,
				dc: details.dc,
				success,
			}
		}

		if (success) {
			try {
				const code = await SafariData.createCaptureClaim({
					trainerReadKey: session.trainerReadKey,
					sessionId: session.id,
					species: encounterSpecies,
				})
				const captures = [...session.captures, {
					speciesId: encounterSpecies.id.data,
					name: encounterSpecies.name,
					code,
				}]
				const capturedSession: SafariSessionState = {
					...session,
					safariBallsRemaining: ballsRemaining,
					captures,
					encounter: undefined,
				}
				persist(capturedSession)
				notice = `${encounterSpecies.name} was caught! Safari Capture Code: ${code}`

				if (captures.length >= 3) finishSession("three-captures")
				else if (ballsRemaining <= 0) finishSession("out-of-balls")
			} catch (e) {
				captureError = e instanceof Error ? e.message : String(e)
				persist({
					...session,
					safariBallsRemaining: ballsRemaining,
					encounter: { ...encounter, lastCaptureRoll: captureRoll },
				})
				if (ballsRemaining <= 0) finishSession("out-of-balls")
			}
			return
		}

		const nextGauge = applyGaugeDelta(encounter.gauge, -details.stealth.gaugeCost)
		const stealthWasActive = encounter.stealth?.tier === "basic" || encounter.stealth?.tier === "expert"
		const failedEncounter: SafariEncounterState = {
			...encounter,
			gauge: nextGauge,
			lastCaptureRoll: captureRoll,
			stealthCaptureFailed: stealthWasActive,
		}
		persist({ ...session, safariBallsRemaining: ballsRemaining, encounter: failedEncounter })

		if (ballsRemaining <= 0) finishSession("out-of-balls")
		else if (nextGauge === -2) endEncounter("The failed capture reduced the Safari Gauge to -2 and the Pokémon fled.")
	}

	const approachNormally = () => {
		if (!session?.encounter) return
		persist({
			...session,
			encounter: {
				...session.encounter,
				stealth: undefined,
				stealthCaptureFailed: false,
			},
		})
	}

	const copyCode = async (code: string) => {
		await navigator.clipboard.writeText(code)
		notice = `${code} copied.`
	}

	function groupSpeciesBySr(speciesList: PokemonSpecies[]) {
		const groups = new Map<number, PokemonSpecies[]>()
		for (const species of speciesList) {
			const group = groups.get(species.sr.data) ?? []
			group.push(species)
			groups.set(species.sr.data, group)
		}
		return [...groups.entries()]
			.sort(([a], [b]) => a - b)
			.map(([sr, species]) => ({
				sr,
				label: species[0]?.sr.toString() ?? String(sr),
				species: [...species].sort((a, b) => a.name.localeCompare(b.name)),
			}))
	}

	const stealthDescription = () => {
		const tier = session?.pendingStealth?.tier
		if (tier === "natural20") return "Natural 20 — next capture is automatically successful."
		if (tier === "expert") return "Stealth 16+ — Advantage, DC -10, capture costs 0 Gauge."
		if (tier === "basic") return "Stealth 10–15 — Advantage, DC -5, capture costs 1 Gauge."
		if (tier === "failed") return "Stealth failed — no special capture benefit."
		return "No Stealth check prepared."
	}
</script>

<Title value="Safari Zone" />
<Page theme="forest">
	<GreatballIcon slot="icon" />

	<main class="safari-page">
		{#if error}<p class="error">{error}</p>{/if}
		{#if notice}<p class="notice">{notice}</p>{/if}

		{#if loading}
			<Loader />
		{:else if session?.ended}
			<section class="panel summary">
				<h1>Safari Exploration Complete</h1>
				<p>{endReasonText(session.endReason)}</p>
				<div class="resource-grid">
					<div><strong>{session.safariBallsRemaining}</strong><span>Safari Balls left</span></div>
					<div><strong>{session.pokeblocksRemaining}</strong><span>Pokéblocks left</span></div>
					<div><strong>{session.captures.length}/3</strong><span>Captured</span></div>
				</div>
				<h2>Captured Pokémon</h2>
				{#if session.captures.length === 0}
					<p>No Pokémon were captured this session.</p>
				{:else}
					<div class="capture-list">
						{#each session.captures as capture}
							<div class="capture-card">
								<div><strong>{capture.name}</strong><code>{capture.code}</code></div>
								<Button variant="subtle" on:click={() => copyCode(capture.code)}>Copy Code</Button>
							</div>
						{/each}
					</div>
				{/if}
				<p class="muted">Starting a new Safari session will replace this session summary in the Safari UI. Unredeemed codes remain valid until used.</p>
				<Button variant="solid" on:click={returnToSetup}>Start Another Safari</Button>
			</section>
		{:else if session?.encounter && encounterSpecies}
			<section class="encounter">
				<div class="encounter-heading">
					<div>
						<p class="eyebrow">{currentPark?.name} · {currentBiome?.name}</p>
						<h1>{encounterSpecies.name}</h1>
						<p>SR {encounterSpecies.sr.toString()} · Minimum Level {encounterSpecies.minLevel}</p>
					</div>
					{#if encounterSpecies.media.data.values.normalPortrait?.href}
						<img src={encounterSpecies.media.data.values.normalPortrait.href} alt={encounterSpecies.name} />
					{/if}
				</div>

				<div class="resource-grid">
					<div><strong>{session.safariBallsRemaining}</strong><span>Safari Balls</span></div>
					<div><strong>{session.pokeblocksRemaining}</strong><span>Pokéblocks</span></div>
					<div><strong>{session.captures.length}/3</strong><span>Captured</span></div>
				</div>

				<SafariGauge value={session.encounter.gauge} on:change={(event) => setGauge(event.detail.value)} />

				{#if session?.encounter && captureStatus}
					<div class="capture-status panel">
					<h2>Capture Status</h2>
					<div class="status-grid">
						<div><span>Base DC</span><strong>{captureStatus.base}</strong></div>
						<div><span>Gauge</span><strong>{captureStatus.gauge.dcModifier === 0 ? "Normal" : `DC ${captureStatus.gauge.dcModifier}${captureStatus.gauge.advantage ? " + Advantage" : ""}`}</strong></div>
						<div><span>Stealth</span><strong>{captureStatus.stealth.automaticSuccess ? "Automatic success" : captureStatus.stealth.dcModifier === 0 ? "Normal" : `DC ${captureStatus.stealth.dcModifier}${captureStatus.stealth.advantage ? " + Advantage" : ""}`}</strong></div>
						<div><span>Final DC</span><strong>{captureStatus.dc}</strong></div>
						<div><span>Roll Mode</span><strong>{captureStatus.advantage ? "Advantage" : "Normal"}</strong></div>
						<div><span>Gauge cost on failure</span><strong>{captureStatus.stealth.gaugeCost}</strong></div>
					</div>
					<p>Animal Handling modifier: <strong>{activeTrainer ? skillModifier(activeTrainer, "animal handling") >= 0 ? "+" : "" : ""}{activeTrainer ? skillModifier(activeTrainer, "animal handling") : 0}</strong></p>
					{#if session.encounter.lastCaptureRoll}
						<p class="roll-result">
							Last capture roll:
							<strong>{session.encounter.lastCaptureRoll.rolls.join(" / ")} → {session.encounter.lastCaptureRoll.total}</strong>
							vs DC {session.encounter.lastCaptureRoll.dc}
							— {session.encounter.lastCaptureRoll.success ? "Success" : "Failed"}
						</p>
					{/if}
					{#if captureError}<p class="error">{captureError}</p>{/if}
					{#if session.encounter.stealthCaptureFailed}
						<div class="decision">
							<p>The Stealth capture failed. Approach normally to continue the encounter, or leave.</p>
							<Button on:click={approachNormally}>Approach Normally</Button>
							<Button variant="subtle" on:click={() => endEncounter("You left the encounter.")}>Run</Button>
						</div>
					{:else}
						<Button variant="success" disabled={session.safariBallsRemaining <= 0} on:click={attemptCapture}>Throw Safari Ball</Button>
					{/if}
					</div>
				{/if}

				<div class="encounter-grid">
					<section class="panel">
						<h2>Skill Check</h2>
						<p>Use whichever skill the DM calls for, then apply the resulting Gauge change below.</p>
						<div class="inline-fields">
							<select bind:value={selectedSkill}>
								{#each SkillRanks.list as skill}
									<option value={skill.name}>{skill.name}</option>
								{/each}
							</select>
							<Button variant="subtle" on:click={rollSkill}>Roll</Button>
						</div>
						{#if session.encounter.lastSkillRoll}
							<p>
								<strong>{session.encounter.lastSkillRoll.skill}</strong>:
								natural {session.encounter.lastSkillRoll.naturalRoll},
								total <strong>{session.encounter.lastSkillRoll.total}</strong>
							</p>
						{/if}
					</section>

					<section class="panel">
						<h2>Interaction</h2>
						<p class="interaction-help">The site does not judge whether the interaction succeeded. After the DM rules the result, enter the base Gauge change here. A deliberate 0 means no Gauge change and counts toward boredom.</p>
						<label>
							<span>Interaction</span>
							<input bind:value={interactionName} placeholder="Offer food, speak softly, imitate..." />
						</label>
						<label>
							<span>DM-assigned base Gauge change</span>
							<input type="number" bind:value={interactionDelta} placeholder="Required" />
						</label>
						<label class="checkbox">
							<input type="checkbox" bind:checked={spendPokeblock} disabled={session.pokeblocksRemaining <= 0} />
							Spend 1 Pokéblock when resolved
						</label>
						<Button variant="subtle" disabled={!interactionName.trim() || interactionDelta == null || !Number.isFinite(interactionDelta) || (spendPokeblock && session.pokeblocksRemaining <= 0)} on:click={applyInteraction}>Resolve Interaction</Button>
						{#if session.encounter.lastInteraction}
							<p>
								{session.encounter.lastInteraction.name}: base {session.encounter.lastInteraction.baseDelta >= 0 ? "+" : ""}{session.encounter.lastInteraction.baseDelta},
								applied <strong>{session.encounter.lastInteraction.appliedDelta >= 0 ? "+" : ""}{session.encounter.lastInteraction.appliedDelta}</strong>.
							</p>
						{/if}
					</section>
				</div>

				<div class="encounter-actions">
					<Button variant="subtle" on:click={() => endEncounter("You left the encounter.")}>Leave Encounter</Button>
				</div>
			</section>
		{:else if session}
			<section class="exploration">
				<div class="exploration-heading">
					<div>
						<p class="eyebrow">{session.trainerName} · Trainer Level {session.trainerLevel}</p>
						<h1>{currentPark?.name}</h1>
						<h2>{currentBiome?.name}</h2>
					</div>
					<Button variant="danger" on:click={() => finishSession("voluntary")}>End Safari</Button>
				</div>

				<div class="resource-grid">
					<div><strong>{session.safariBallsRemaining}</strong><span>Safari Balls</span></div>
					<div><strong>{session.pokeblocksRemaining}</strong><span>Pokéblocks</span></div>
					<div><strong>{session.captures.length}/3</strong><span>Captured</span></div>
					<div><strong>{session.biomeChangeUsed ? "Used" : "1 available"}</strong><span>Biome change</span></div>
				</div>

				<div class="exploration-controls">
					<div class="panel">
						<h3>Biome</h3>
						<p>{currentBiome?.description || "Explore this biome and select the species the DM announces."}</p>
						{#if !session.biomeChangeUsed && (currentPark?.biomes.length ?? 0) > 1}
							<Button variant="subtle" on:click={() => choosingBiome = !choosingBiome}>Change Biome</Button>
							{#if choosingBiome}
								<div class="biome-options">
									{#each currentPark?.biomes ?? [] as biome}
										{#if biome.id !== session.biomeId}
											<Button variant="subtle" on:click={() => changeBiome(biome)}>{biome.name}</Button>
										{/if}
									{/each}
								</div>
							{/if}
						{:else}
							<p class="muted">Biome change unavailable.</p>
						{/if}
					</div>

					<div class="panel">
						<h3>Stealth</h3>
						<p>{stealthDescription()}</p>
						{#if session.pendingStealth}
							<p>Natural {session.pendingStealth.naturalRoll}, total <strong>{session.pendingStealth.total}</strong>.</p>
						{/if}
						<Button variant="subtle" on:click={attemptStealth}>Attempt Stealth</Button>
					</div>
				</div>

				<div class="tables-heading">
					<div>
						<h2>Pokémon Tables</h2>
						<p>Visible up to your Trainer's maximum SR of <strong>{maxSr}</strong>. The DM tells you which species to select.</p>
					</div>
				</div>

				{#if eligibleGroups.length === 0}
					<div class="panel"><p>No eligible species are configured in this biome.</p></div>
				{:else}
					<div class="sr-tables">
						{#each eligibleGroups as group}
							<section class="panel sr-table">
								<h3>SR {group.label}</h3>
								<div class="species-grid">
									{#each group.species as species}
										<button type="button" class="species-card" on:click={() => startEncounter(species)}>
											{#if species.media.data.values.normalPortrait?.href}
												<img src={species.media.data.values.normalPortrait.href} alt="" />
											{/if}
											<span>{species.name}</span>
										</button>
									{/each}
								</div>
							</section>
						{/each}
					</div>
				{/if}

				{#if session.captures.length > 0}
					<section class="panel">
						<h2>Captured Pokémon</h2>
						<div class="capture-list">
							{#each session.captures as capture}
								<div class="capture-card">
									<div><strong>{capture.name}</strong><code>{capture.code}</code></div>
									<Button variant="subtle" on:click={() => copyCode(capture.code)}>Copy Code</Button>
								</div>
							{/each}
						</div>
					</section>
				{/if}
			</section>
		{:else}
			<section class="setup panel">
				<h1>Safari Zone</h1>
				<p>Choose the trainer exploring the Safari. Their level controls which SR tables they can see.</p>

				<label>
					<span>Trainer</span>
					<select bind:value={selectedTrainerReadKey}>
						<option value="">Choose a cached trainer…</option>
						{#each cachedTrainers as trainer}
							<option value={trainer.readKey}>{trainer.name} — Level {trainer.level.data}</option>
						{/each}
					</select>
				</label>

				{#if selectedTrainer}
					{#if existingSession && !existingSession.ended}
						<div class="resume">
							<p><strong>Active local Safari found:</strong> {existingSession.parkName}, {existingSession.captures.length}/3 captures, {existingSession.safariBallsRemaining} balls.</p>
							<Button variant="subtle" on:click={resumeSession}>Resume Safari</Button>
						</div>
					{/if}

					<label>
						<span>Starting Safari Balls</span>
						<input type="number" min="1" step="1" bind:value={startingBalls} placeholder="Choose an amount" />
					</label>
				{/if}

				{#if selectedTrainer && startingBalls && startingBalls >= 1}
					<label>
						<span>Safari Park</span>
						<select bind:value={selectedParkId}>
							<option value="">Choose a Park…</option>
							{#each parks as park}
								<option value={park.id}>{park.name}</option>
							{/each}
						</select>
					</label>
				{/if}

				{#if selectedPark}
					<label>
						<span>Starting Biome</span>
						<select bind:value={selectedBiomeId}>
							<option value="">Choose a biome…</option>
							{#each selectedPark.biomes as biome}
								<option value={biome.id}>{biome.name}</option>
							{/each}
						</select>
					</label>

					{#if selectedBiome}
						<div class="preview">
							<h2>{selectedBiome.name}</h2>
							<p>{selectedBiome.description}</p>
							<p>Your Trainer can access species up to SR <strong>{selectedTrainer ? SpeciesRating.maxAllowed(selectedTrainer.level).toString() : ""}</strong>. Preview the eligible tables before beginning the run.</p>
							{#if previewGroups.length === 0}
								<p class="muted">No eligible species are configured in this biome.</p>
							{:else}
								<div class="preview-tables">
									{#each previewGroups as group}
										<div class="preview-table">
											<strong>SR {group.label}</strong>
											<span>{group.species.map((species) => species.name).join(", ")}</span>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				{/if}

				<Button variant="success" disabled={!selectedTrainer || !selectedPark || !selectedBiome || !startingBalls || startingBalls < 1} on:click={startSession}>
					Begin Safari
				</Button>

				{#if cachedTrainers.length === 0}
					<p class="muted">No cached trainers were found. Open a trainer first, then return to the Safari Zone.</p>
				{/if}
				{#if parks.length === 0}
					<p class="muted">No active Safari Parks are currently published.</p>
				{/if}
			</section>
		{/if}
	</main>
</Page>

<style>
	.safari-page { height: 100%; overflow: auto; padding: 1rem; box-sizing: border-box; }
	.panel { background: var(--skin-content); color: var(--skin-content-text); border-radius: 0.85rem; padding: 1rem; box-shadow: var(--elev-cumulus); }
	.setup { max-width: 48rem; margin-inline: auto; display: grid; gap: 1rem; }
	label { display: grid; gap: 0.3rem; }
	label > span { font-weight: bold; }
	input, select { width: 100%; box-sizing: border-box; }
	.notice, .error { max-width: 64rem; margin: 0 auto 1rem; padding: 0.65rem 0.9rem; border-radius: 0.65rem; background: var(--skin-content); font-weight: bold; }
	.error { color: var(--skin-danger-text, currentColor); }
	.muted { opacity: 0.72; }
	.eyebrow { margin: 0; opacity: 0.7; font-weight: bold; }
	.resource-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.65rem; margin-block: 1rem; }
	.resource-grid > div { display: grid; place-items: center; text-align: center; padding: 0.7rem; background: var(--skin-content); border-radius: 0.7rem; }
	.resource-grid strong { font-size: 1.35rem; }
	.resource-grid span { font-size: var(--font-sz-venus); opacity: 0.75; }
	.exploration, .encounter, .summary { max-width: 72rem; margin-inline: auto; }
	.exploration-heading, .encounter-heading, .tables-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
	.exploration-heading h1, .exploration-heading h2, .encounter-heading h1 { margin-block: 0.15rem; }
	.exploration-controls, .encounter-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; margin-block: 1rem; }
	.biome-options { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.65rem; }
	.sr-tables { display: grid; gap: 1rem; margin-block: 1rem; }
	.sr-table h3 { margin-top: 0; }
	.species-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr)); gap: 0.65rem; }
	.species-card { display: grid; place-items: center; gap: 0.4rem; min-height: 8.5rem; padding: 0.65rem; border: 0.14rem solid transparent; border-radius: 0.75rem; background: var(--skin-input-bg); color: inherit; cursor: pointer; font: inherit; font-weight: bold; }
	.species-card:hover, .species-card:focus-visible { border-color: currentColor; }
	.species-card img { width: 6rem; height: 6rem; object-fit: contain; }
	.encounter-heading img { width: min(15rem, 35vw); max-height: 13rem; object-fit: contain; }
	.capture-status { margin-block: 1rem; }
	.status-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem; }
	.status-grid > div { display: grid; gap: 0.1rem; padding: 0.55rem; background: var(--skin-input-bg); border-radius: 0.55rem; }
	.status-grid span { font-size: var(--font-sz-venus); opacity: 0.7; }
	.inline-fields, .decision { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
	.encounter-grid label { margin-block: 0.5rem; }
	.checkbox { display: flex; align-items: center; gap: 0.4rem; }
	.checkbox input { width: auto; }
	.roll-result { padding: 0.65rem; background: var(--skin-input-bg); border-radius: 0.55rem; }
	.interaction-help { margin-top: 0; font-size: var(--font-sz-venus); }
	.encounter-actions { display: flex; justify-content: flex-end; margin-top: 1rem; }
	.capture-list { display: grid; gap: 0.55rem; }
	.capture-card { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; padding: 0.65rem; background: var(--skin-input-bg); border-radius: 0.65rem; }
	.capture-card > div { display: grid; gap: 0.2rem; }
	code { overflow-wrap: anywhere; }
	.resume, .preview { padding: 0.75rem; background: var(--skin-input-bg); border-radius: 0.65rem; }
	.preview-tables { display: grid; gap: 0.45rem; margin-top: 0.75rem; }
	.preview-table { display: grid; grid-template-columns: 4rem 1fr; gap: 0.6rem; align-items: start; padding-top: 0.4rem; border-top: 1px solid color-mix(in srgb, currentColor 16%, transparent); }
	@media (max-width: 44rem) {
		.resource-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
		.exploration-controls, .encounter-grid, .status-grid { grid-template-columns: 1fr; }
		.exploration-heading, .encounter-heading { flex-direction: column; }
		.encounter-heading img { width: min(14rem, 80vw); align-self: center; }
		.capture-card { align-items: stretch; flex-direction: column; }
	}
</style>
