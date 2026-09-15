import { TrainerLocalStorage } from "./data/TrainerLocalStorage"
import { trainers } from "./trainers"

type TrainerReader = Pick<typeof trainers, "get">

export async function preloadKnownTrainers(
	store: TrainerReader = trainers,
	readKeys: string[] = TrainerLocalStorage.getReadKeys(),
): Promise<void> {
	await Promise.allSettled(readKeys.map((readKey) => store.get(readKey)))
}
