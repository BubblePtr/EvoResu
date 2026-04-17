import { chat, toServerSentEventsResponse } from "@tanstack/ai"
import { openaiText } from "@tanstack/ai-openai"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/api/chat")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const abortController = new AbortController()
				const body = (await request.json()) as {
					messages: Array<{ role: string; content: string }>
				}
				const { messages } = body

				const apiKey = process.env.OPENAI_API_KEY

				if (!apiKey) {
					// 模拟流式响应，用于无 API Key 时的演示
					const encoder = new TextEncoder()
					const stream = new ReadableStream({
						start(controller) {
							const text =
								"这是 TanStack AI 的演示回复。请在 .env.local 中设置 OPENAI_API_KEY 以使用真实的 OpenAI 模型。"
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

				const aiStream = chat({
					adapter: openaiText("gpt-4o-mini", { apiKey }),
					messages,
					systemPrompts: ["你是一个有帮助的助手。"],
					abortController,
				})

				return toServerSentEventsResponse(aiStream, { abortController })
			},
		},
	},
})
