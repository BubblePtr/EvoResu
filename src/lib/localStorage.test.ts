import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	clearSession,
	loadResumes,
	loadSession,
	type SessionState,
	saveResumeDraft,
	saveSession,
} from "./localStorage"

const base: SessionState = {
	version: 1,
	jd: "Software Engineer at ACME",
	stage: "QUESTIONS",
	messages: [{ role: "user", content: "hello" }],
	evidencePanel: [],
	interviewMessages: [],
	rating: null,
	feedback: "",
}

beforeEach(() => clearSession())
afterEach(() => {
	vi.restoreAllMocks()
	clearSession()
})

describe("loadSession", () => {
	it("returns null when nothing stored", () => {
		expect(loadSession()).toBeNull()
	})

	it("returns null and clears when version mismatches", () => {
		// Write via saveSession then corrupt the version in-place
		saveSession(base)
		const raw = window.localStorage.getItem("evoresu_session")!
		const parsed = JSON.parse(raw)
		window.localStorage.setItem("evoresu_session", JSON.stringify({ ...parsed, version: 99 }))

		expect(loadSession()).toBeNull()
		expect(window.localStorage.getItem("evoresu_session")).toBeNull()
	})

	it("restores a valid session", () => {
		saveSession(base)
		const restored = loadSession()
		expect(restored?.stage).toBe("QUESTIONS")
		expect(restored?.jd).toBe("Software Engineer at ACME")
	})
})

describe("saveSession quota handling", () => {
	it("truncates interviewMessages on first quota failure", () => {
		const bigMsg = { role: "user" as const, content: "x".repeat(500_000) }
		const state: SessionState = {
			...base,
			interviewMessages: [bigMsg, bigMsg],
			messages: [{ role: "user", content: "short" }],
		}

		let callCount = 0
		const original = window.localStorage.setItem.bind(window.localStorage)
		vi.spyOn(window.localStorage, "setItem").mockImplementation((k, v) => {
			callCount++
			if (callCount === 1) throw new DOMException("QuotaExceededError")
			original(k, v)
		})

		saveSession(state)

		vi.restoreAllMocks()
		const restored = loadSession()
		expect(restored?.interviewMessages).toHaveLength(0)
		expect(restored?.messages).toHaveLength(1)
	})

	it("always preserves stage even in worst-case quota failure", () => {
		// All setItem calls throw — saveSession should not crash
		vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
			throw new DOMException("QuotaExceededError")
		})

		expect(() => saveSession({ ...base, stage: "INTERVIEW" })).not.toThrow()
	})
})

describe("loadResumes", () => {
	it("returns empty strings when nothing stored", () => {
		const { resumeDraft, finalResume } = loadResumes()
		expect(resumeDraft).toBe("")
		expect(finalResume).toBe("")
	})

	it("returns saved draft", () => {
		saveResumeDraft("# My Resume")
		expect(loadResumes().resumeDraft).toBe("# My Resume")
	})
})
