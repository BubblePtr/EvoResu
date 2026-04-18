import { createFileRoute } from "@tanstack/react-router"
import type { InterviewModeInput, QuestionModeInput } from "../../lib/ai-modes"
import { buildInterviewPrompt, buildQuestionPrompt, ModeSchema } from "../../lib/ai-modes"
import { streamCompletion } from "../../lib/ai-provider"

// Handles streaming chat modes: question and interview.
// Non-streaming modes (resume_generation, evidence_panel, regeneration) use dedicated endpoints.
export const Route = createFileRoute("/api/chat")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const body = (await request.json()) as Record<string, unknown>

				const modeResult = ModeSchema.safeParse(body.mode ?? "question")
				if (!modeResult.success) {
					return new Response(JSON.stringify({ error: "Invalid mode" }), {
						status: 400,
						headers: { "Content-Type": "application/json" },
					})
				}
				const mode = modeResult.data

				const abortController = new AbortController()

				let systemPrompt: string
				const messages = (body.messages ?? []) as Array<{ role: string; content: string }>

				if (mode === "question") {
					const input = body as unknown as QuestionModeInput
					const result = buildQuestionPrompt(input)
					systemPrompt = result.systemPrompt
				} else if (mode === "interview") {
					systemPrompt = buildInterviewPrompt(body as unknown as InterviewModeInput)
				} else {
					return new Response(JSON.stringify({ error: "Use dedicated endpoint for this mode" }), {
						status: 400,
						headers: { "Content-Type": "application/json" },
					})
				}

				return streamCompletion(systemPrompt, messages, abortController)
			},
		},
	},
})
