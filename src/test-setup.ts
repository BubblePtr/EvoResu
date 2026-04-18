import { vi } from "vitest"

// Provides a real in-memory localStorage implementation for vitest,
// because jsdom's Storage methods are non-configurable getters that vi.spyOn cannot intercept.
function makeStorage() {
	const store = new Map<string, string>()
	return {
		get length() {
			return store.size
		},
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => {
			store.set(key, value)
		},
		removeItem: (key: string) => {
			store.delete(key)
		},
		clear: () => store.clear(),
		key: (index: number) => [...store.keys()][index] ?? null,
	}
}

const storage = makeStorage()
vi.stubGlobal("localStorage", storage)
vi.stubGlobal("sessionStorage", makeStorage())
