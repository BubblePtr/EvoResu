import { createFileRoute } from "@tanstack/react-router"
import { buildEvidencePanelPrompt } from "../../lib/ai-modes"
import { chatCompletion } from "../../lib/ai-provider"
import type { EvidenceItem } from "../../lib/localStorage"

// Non-streaming endpoint for evidence panel analysis.
// Kept separate so the 30s Workers wall-clock limit is not shared with the streaming resume request.
export const Route = createFileRoute("/api/evidence-panel")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const body = (await request.json()) as { jd: string; resumeDraft: string }

				try {
					const systemPrompt = buildEvidencePanelPrompt(body)
					const result = await chatCompletion(systemPrompt, [])

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
				} catch {
					return new Response(JSON.stringify([]), {
						headers: { "Content-Type": "application/json" },
					})
				}
			},
		},
	},
})
