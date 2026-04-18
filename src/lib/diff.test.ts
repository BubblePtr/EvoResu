import { describe, expect, it } from "vitest"
import { computeResumeDiff } from "./diff"

describe("computeResumeDiff", () => {
	it("returns equal segment when texts are identical", () => {
		const diffs = computeResumeDiff("hello", "hello")
		expect(diffs.every((d) => d.type === "equal")).toBe(true)
		expect(diffs.map((d) => d.text).join("")).toBe("hello")
	})

	it("marks inserted text", () => {
		const diffs = computeResumeDiff("hello", "hello world")
		const inserted = diffs.filter((d) => d.type === "insert")
		expect(inserted.map((d) => d.text).join("")).toBe(" world")
	})

	it("marks deleted text", () => {
		const diffs = computeResumeDiff("hello world", "hello")
		const deleted = diffs.filter((d) => d.type === "delete")
		expect(deleted.map((d) => d.text).join("")).toBe(" world")
	})

	it("empty before = all insert", () => {
		const diffs = computeResumeDiff("", "new content")
		const inserted = diffs.filter((d) => d.type === "insert")
		expect(inserted.map((d) => d.text).join("")).toBe("new content")
		expect(diffs.filter((d) => d.type === "delete")).toHaveLength(0)
	})

	it("empty after = all delete", () => {
		const diffs = computeResumeDiff("old content", "")
		const deleted = diffs.filter((d) => d.type === "delete")
		expect(deleted.map((d) => d.text).join("")).toBe("old content")
	})
})
