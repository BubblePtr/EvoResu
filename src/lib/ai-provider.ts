// Unified AI provider supporting OpenAI (via @tanstack/ai) and Kimi (via direct fetch).
// Falls back to mock stream when no API key is configured.

import { chat, toServerSentEventsResponse } from "@tanstack/ai"
import { openaiText } from "@tanstack/ai-openai"

interface ChatMessage {
	role: string
	content: string
}

const KIMI_BASE_URL = "https://api.moonshot.cn/v1"
const KIMI_MODEL = "moonshot-v1-8k"

function getProvider(): "openai" | "kimi" | "mock" {
	if (process.env.MOONSHOT_API_KEY) return "kimi"
	if (process.env.OPENAI_API_KEY) return "openai"
	return "mock"
}

function buildMessages(
	systemPrompt: string,
	messages: ChatMessage[],
): Array<{ role: string; content: string }> {
	return [
		{ role: "system", content: systemPrompt },
		...messages.map((m) => ({ role: m.role, content: m.content })),
	]
}

// ─── Kimi streaming via raw fetch ───────────────────────────────────────────

async function kimiStream(
	systemPrompt: string,
	messages: ChatMessage[],
	abortController: AbortController,
): Promise<Response> {
	const apiKey = process.env.MOONSHOT_API_KEY!
	const body = {
		model: KIMI_MODEL,
		messages: buildMessages(systemPrompt, messages),
		stream: true,
	}

	const fetchRes = await fetch(`${KIMI_BASE_URL}/chat/completions`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
		signal: abortController.signal,
	})

	if (!fetchRes.ok) {
		const err = await fetchRes.text().catch(() => "Kimi request failed")
		return new Response(JSON.stringify({ error: err }), {
			status: fetchRes.status,
			headers: { "Content-Type": "application/json" },
		})
	}

	// Transform Kimi SSE chunks into the format readSSEStream expects
	const encoder = new TextEncoder()
	const stream = new ReadableStream({
		async start(controller) {
			if (!fetchRes.body) {
				controller.close()
				return
			}
			const reader = fetchRes.body.getReader()
			const decoder = new TextDecoder()
			let buffer = ""

			try {
				while (true) {
					if (abortController.signal.aborted) {
						controller.close()
						return
					}
					const { done, value } = await reader.read()
					if (done) break

					buffer += decoder.decode(value, { stream: true })
					const lines = buffer.split("\n")
					buffer = lines.pop() ?? ""

					for (const line of lines) {
						if (!line.startsWith("data: ")) continue
						const data = line.slice(6).trim()
						if (!data || data === "[DONE]") continue
						try {
							const parsed = JSON.parse(data)
							const delta = parsed.choices?.[0]?.delta?.content
							if (typeof delta === "string" && delta) {
								controller.enqueue(
									encoder.encode(`data: ${JSON.stringify({ type: "text", content: delta })}\n\n`),
								)
							}
						} catch {
							// skip malformed chunks
						}
					}
				}
				controller.close()
			} catch (error) {
				if (abortController.signal.aborted) {
					controller.close()
					return
				}
				controller.error(error)
			}
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

// ─── Kimi non-streaming via raw fetch ───────────────────────────────────────

async function kimiChat(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
	const apiKey = process.env.MOONSHOT_API_KEY!
	const body = {
		model: KIMI_MODEL,
		messages: buildMessages(systemPrompt, messages),
		stream: false,
	}

	const res = await fetch(`${KIMI_BASE_URL}/chat/completions`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	})

	if (!res.ok) {
		const err = await res.text().catch(() => "Kimi request failed")
		throw new Error(err)
	}

	const json = (await res.json()) as {
		choices: Array<{ message: { content: string } }>
	}
	return json.choices[0]?.message?.content ?? ""
}

// ─── OpenAI via @tanstack/ai ────────────────────────────────────────────────

function openaiStream(
	systemPrompt: string,
	messages: ChatMessage[],
	abortController: AbortController,
) {
	const aiStream = chat({
		adapter: openaiText("gpt-4o-mini"),
		// biome-ignore lint/suspicious/noExplicitAny: server-side JSON messages don't carry adapter-specific metadata
		messages: messages as any,
		systemPrompts: [systemPrompt],
		abortController,
	})
	return toServerSentEventsResponse(aiStream, { abortController })
}

async function openaiChat(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
	const result = await (chat({
		adapter: openaiText("gpt-4o-mini"),
		// biome-ignore lint/suspicious/noExplicitAny: server-side JSON messages don't carry adapter-specific metadata
		messages: messages as any,
		systemPrompts: [systemPrompt],
		stream: false,
	}) as Promise<string>)
	return result
}

// ─── Mock fallback ──────────────────────────────────────────────────────────

function mockStream(text: string, abortController: AbortController): Response {
	const encoder = new TextEncoder()
	const stream = new ReadableStream({
		start(controller) {
			let i = 0
			const interval = setInterval(() => {
				if (i >= text.length || abortController.signal.aborted) {
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

// ─── Public API ─────────────────────────────────────────────────────────────

export async function streamCompletion(
	systemPrompt: string,
	messages: ChatMessage[],
	abortController: AbortController,
): Promise<Response> {
	const provider = getProvider()
	switch (provider) {
		case "kimi":
			return kimiStream(systemPrompt, messages, abortController)
		case "openai":
			return openaiStream(systemPrompt, messages, abortController)
		default:
			return mockStream(
				"这是演示回复。请在 .env.local 中设置 MOONSHOT_API_KEY 或 OPENAI_API_KEY。",
				abortController,
			)
	}
}

export async function chatCompletion(
	systemPrompt: string,
	messages: ChatMessage[],
): Promise<string> {
	const provider = getProvider()
	switch (provider) {
		case "kimi":
			return kimiChat(systemPrompt, messages)
		case "openai":
			return openaiChat(systemPrompt, messages)
		default:
			return "（演示模式）请在 .env.local 中设置 MOONSHOT_API_KEY 或 OPENAI_API_KEY。"
	}
}
