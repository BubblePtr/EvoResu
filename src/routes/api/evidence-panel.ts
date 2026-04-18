import { chat } from "@tanstack/ai"
import { openaiText } from "@tanstack/ai-openai"
import { createFileRoute } from "@tanstack/react-router"
import type { EvidencePanelModeInput } from "../../lib/ai-modes"
import { buildEvidencePanelPrompt } from "../../lib/ai-modes"
import type { EvidenceItem } from "../../lib/localStorage"

// Non-streaming endpoint for evidence panel analysis.
// Kept separate so the 30s Workers wall-clock limit is not shared with the streaming resume request.
export const Route = createFileRoute("/api/evidence-panel")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const body = (await request.json()) as EvidencePanelModeInput

				const apiKey = process.env.OPENAI_API_KEY
				if (!apiKey) {
					// Return empty panel in demo mode — client handles degradation gracefully
					return new Response(JSON.stringify([]), {
						headers: { "Content-Type": "application/json" },
					})
				}

				const systemPrompt = buildEvidencePanelPrompt(body)

				const result = await (chat({
					adapter: openaiText("gpt-4o-mini"),
					systemPrompts: [systemPrompt],
					messages: [],
					stream: false,
				}) as Promise<string>)

				let panel: EvidenceItem[] = []
				try {
					// Strip markdown code fences if the model wraps JSON in them
					const cleaned = result.replace(/^```(?:json)?\n?|\n?```$/g, "").trim()
					panel = JSON.parse(cleaned) as EvidenceItem[]
				} catch {
					// Degradation: return empty panel, client will show toast and use generic interview questions
				}

				return new Response(JSON.stringify(panel), {
					headers: { "Content-Type": "application/json" },
				})
			},
		},
	},
})
