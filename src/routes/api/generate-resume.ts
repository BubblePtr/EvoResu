import { chat, toServerSentEventsResponse } from "@tanstack/ai"
import { openaiText } from "@tanstack/ai-openai"
import { createFileRoute } from "@tanstack/react-router"
import type { RegenerationModeInput, ResumeModeInput } from "../../lib/ai-modes"
import { buildRegenerationPrompt, buildResumeGenerationPrompt } from "../../lib/ai-modes"

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

				const apiKey = process.env.OPENAI_API_KEY
				if (!apiKey) {
					return mockStream("（演示模式）这是生成的简历草稿。请配置 OPENAI_API_KEY。")
				}

				const abortController = new AbortController()

				const systemPrompt =
					mode === "resume_generation"
						? buildResumeGenerationPrompt(body as unknown as ResumeModeInput)
						: buildRegenerationPrompt(body as unknown as RegenerationModeInput)

				const messages = (body.messages ?? []) as Array<{ role: string; content: string }>

				const aiStream = chat({
					adapter: openaiText("gpt-4o-mini"),
					// biome-ignore lint/suspicious/noExplicitAny: server-side JSON messages don't carry adapter-specific metadata
					messages: messages as any,
					systemPrompts: [systemPrompt],
					abortController,
				})

				return toServerSentEventsResponse(aiStream, { abortController })
			},
		},
	},
})

function mockStream(text: string): Response {
	const encoder = new TextEncoder()
	const stream = new ReadableStream({
		start(controller) {
			let i = 0
			const interval = setInterval(() => {
				if (i >= text.length) {
					controller.close()
					clearInterval(interval)
					return
				}
				const chunk = text.slice(i, i + 2)
				controller.enqueue(
					encoder.encode(`data: ${JSON.stringify({ type: "text", content: chunk })}\n\n`),
				)
				i += 2
			}, 40)
		},
	})
	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		},
	})
}
