import { createFileRoute } from "@tanstack/react-router"
import type { RegenerationModeInput, ResumeModeInput } from "../../lib/ai-modes"
import { buildRegenerationPrompt, buildResumeGenerationPrompt } from "../../lib/ai-modes"
import { streamCompletion } from "../../lib/ai-provider"

// Streaming endpoint for resume_generation and regeneration modes.
// Kept separate from /api/chat so each Workers request stays within the 30s wall-clock limit.
export const Route = createFileRoute("/api/generate-resume")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const body = (await request.json()) as Record<string, unknown>
				const mode = body.mode as "resume_generation" | "regeneration"

				if (mode !== "resume_generation" && mode !== "regeneration") {
					return new Response(JSON.stringify({ error: "Invalid mode" }), {
						status: 400,
						headers: { "Content-Type": "application/json" },
					})
				}

				const abortController = new AbortController()

				const systemPrompt =
					mode === "resume_generation"
						? buildResumeGenerationPrompt(body as unknown as ResumeModeInput)
						: buildRegenerationPrompt(body as unknown as RegenerationModeInput)

				const messages = (body.messages ?? []) as Array<{ role: string; content: string }>

				return streamCompletion(systemPrompt, messages, abortController)
			},
		},
	},
})
