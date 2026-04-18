import { describe, expect, it } from "vitest"
import {
	buildEvidencePanelPrompt,
	buildInterviewPrompt,
	buildQuestionPrompt,
	buildResumeGenerationPrompt,
	ModeSchema,
} from "./ai-modes"

describe("ModeSchema", () => {
	it("accepts valid modes", () => {
		for (const m of [
			"question",
			"resume_generation",
			"evidence_panel",
			"interview",
			"regeneration",
		]) {
			expect(ModeSchema.safeParse(m).success).toBe(true)
		}
	})

	it("rejects unknown modes", () => {
		expect(ModeSchema.safeParse("hack").success).toBe(false)
		expect(ModeSchema.safeParse("").success).toBe(false)
	})
})

describe("buildQuestionPrompt", () => {
	it("injects JD into system prompt", () => {
		const { systemPrompt } = buildQuestionPrompt({
			jd: "Senior Engineer at ACME",
			messages: [],
			questionIndex: 0,
		})
		expect(systemPrompt).toContain("Senior Engineer at ACME")
	})

	it("truncates JD over 3000 chars and flags it", () => {
		const longJd = "x".repeat(4000)
		const { systemPrompt, jdTruncated } = buildQuestionPrompt({
			jd: longJd,
			messages: [],
			questionIndex: 0,
		})
		expect(jdTruncated).toBe(true)
		expect(systemPrompt).toContain("已截断")
		expect(systemPrompt.length).toBeLessThan(longJd.length + 500)
	})

	it("includes question index", () => {
		const { systemPrompt } = buildQuestionPrompt({
			jd: "JD",
			messages: [],
			questionIndex: 4,
		})
		expect(systemPrompt).toContain("第 5 个问题")
	})
})

describe("buildInterviewPrompt", () => {
	it("uses weak evidence items as focus", () => {
		const prompt = buildInterviewPrompt({
			jd: "JD",
			resumeDraft: "",
			evidencePanel: [
				{ claim: "提升了效率", strength: "weak", missing_info: "需要数字" },
				{ claim: "领导了团队", strength: "strong", missing_info: "" },
			],
			interviewMessages: [],
			questionIndex: 0,
		})
		expect(prompt).toContain("提升了效率")
		expect(prompt).not.toContain("领导了团队")
	})

	it("falls back to generic dimensions when no weak items", () => {
		const prompt = buildInterviewPrompt({
			jd: "JD",
			resumeDraft: "",
			evidencePanel: [],
			interviewMessages: [],
			questionIndex: 0,
		})
		expect(prompt).toContain("通用维度")
	})

	it("takes at most 5 weak items", () => {
		const weakItems = Array.from({ length: 8 }, (_, i) => ({
			claim: `claim-${i}`,
			strength: "weak" as const,
			missing_info: "info",
		}))
		const prompt = buildInterviewPrompt({
			jd: "JD",
			resumeDraft: "",
			evidencePanel: weakItems,
			interviewMessages: [],
			questionIndex: 0,
		})
		// claims 5-7 should not appear
		expect(prompt).not.toContain("claim-5")
		expect(prompt).not.toContain("claim-7")
	})
})

describe("buildEvidencePanelPrompt", () => {
	it("includes resume draft in prompt", () => {
		const prompt = buildEvidencePanelPrompt({
			jd: "JD",
			resumeDraft: "## Experience\n- Built things",
		})
		expect(prompt).toContain("Built things")
		expect(prompt).toContain("JSON")
	})
})

describe("buildResumeGenerationPrompt", () => {
	it("asks for markdown output", () => {
		const prompt = buildResumeGenerationPrompt({ jd: "JD", messages: [] })
		expect(prompt).toContain("Markdown")
	})
})
