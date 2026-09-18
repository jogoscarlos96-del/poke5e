import { writable } from "svelte/store"
import { ErrorsDb } from "./ErrorsDb"
import { ErrorMessages } from "./ErrorMessages"

export type ErrorMessage = {
	hasError: boolean,
	message: string,
	referenceId?: string,
}
const { subscribe, set, update } = writable<ErrorMessage>({
	hasError: false,
	message: "",
})

export const error = {
	subscribe,
	show: (action: string, error: Error) => {
		// Show the useful application error immediately. Reporting the error is a
		// secondary best-effort operation and must not delay or hide the message.
		const message = ErrorMessages.simple(error)
		set({
			hasError: true,
			message: `${action}: ${message || "Unknown error"}`,
		})

		void ErrorsDb.report(action, error).then((id) => {
			if (id == null) return
			update((prev) => ({
				...prev,
				referenceId: id,
			}))
		})
	},
	hide: () => update((prev) => ({
		...prev,
		hasError: false,
	})),
}
