// Unified AI provider supporting OpenAI, DeepSeek, and Kimi.
// Falls back to mock stream when no API key is configured.
//
// Priority: DEEPSEEK_API_KEY > MOONSHOT_API_KEY > OPENAI_API_KEY > mock

import { chat, toServerSentEventsResponse } from "@tanstack/ai"
import { openaiText } from "@tanstack/ai-openai"

interface ChatMessage {
	role: string
	content: string
}

// ─── Provider detection ─────────────────────────────────────────────────────

const PROVIDER = (() => {
	if (process.env.DEEPSEEK_API_KEY) return "deepseek" as const
	if (process.env.MOONSHOT_API_KEY) return "kimi" as const
	if (process.env.OPENAI_API_KEY) return "openai" as const
	return "mock" as const
})()

// ─── OpenAI-compatible fetch helpers (shared by DeepSeek + Kimi) ────────────

interface OpenAICompatibleConfig {
	baseUrl: string
	apiKey: string
	model: string
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

async function compatStream(
	config: OpenAICompatibleConfig,
	systemPrompt: string,
	messages: ChatMessage[],
	abortController: AbortController,
): Promise<Response> {
	const body = {
		model: config.model,
		messages: buildMessages(systemPrompt, messages),
		stream: true,
	}

	const fetchRes = await fetch(`${config.baseUrl}/chat/completions`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${config.apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
		signal: abortController.signal,
	})

	if (!fetchRes.ok) {
		const err = await fetchRes.text().catch(() => "AI request failed")
		return new Response(JSON.stringify({ error: err }), {
			status: fetchRes.status,
			headers: { "Content-Type": "application/json" },
		})
	}

	// Transform OpenAI-compatible SSE into the format readSSEStream expects
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
									encoder.encode(
										`data: ${JSON.stringify({ type: "text", content: delta })}
\n`,
									),
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

async function compatChat(
	config: OpenAICompatibleConfig,
	systemPrompt: string,
	messages: ChatMessage[],
): Promise<string> {
	const body = {
		model: config.model,
		messages: buildMessages(systemPrompt, messages),
		stream: false,
	}

	const res = await fetch(`${config.baseUrl}/chat/completions`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${config.apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	})

	if (!res.ok) {
		const err = await res.text().catch(() => "AI request failed")
		throw new Error(err)
	}

	const json = (await res.json()) as {
		choices: Array<{ message: { content: string } }>
	}
	return json.choices[0]?.message?.content ?? ""
}

// ─── DeepSeek ───────────────────────────────────────────────────────────────

const DEEPSEEK_CONFIG: OpenAICompatibleConfig = {
	baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1",
	apiKey: process.env.DEEPSEEK_API_KEY ?? "",
	model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
}

function deepseekStream(
	systemPrompt: string,
	messages: ChatMessage[],
	abortController: AbortController,
) {
	return compatStream(DEEPSEEK_CONFIG, systemPrompt, messages, abortController)
}

function deepseekChat(systemPrompt: string, messages: ChatMessage[]) {
	return compatChat(DEEPSEEK_CONFIG, systemPrompt, messages)
}

// ─── Kimi ───────────────────────────────────────────────────────────────────

const KIMI_CONFIG: OpenAICompatibleConfig = {
	baseUrl: process.env.KIMI_BASE_URL ?? "https://api.moonshot.cn/v1",
	apiKey: process.env.MOONSHOT_API_KEY ?? "",
	model: process.env.KIMI_MODEL ?? "moonshot-v1-8k",
}

function kimiStream(
	systemPrompt: string,
	messages: ChatMessage[],
	abortController: AbortController,
) {
	return compatStream(KIMI_CONFIG, systemPrompt, messages, abortController)
}

function kimiChat(systemPrompt: string, messages: ChatMessage[]) {
	return compatChat(KIMI_CONFIG, systemPrompt, messages)
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
					encoder.encode(
						`data: ${JSON.stringify({ type: "text", content: chunk })}
\n`,
					),
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
	switch (PROVIDER) {
		case "deepseek":
			return deepseekStream(systemPrompt, messages, abortController)
		case "kimi":
			return kimiStream(systemPrompt, messages, abortController)
		case "openai":
			return openaiStream(systemPrompt, messages, abortController)
		default:
			return mockStream(
				"这是演示回复。请在 .env.local 中设置 DEEPSEEK_API_KEY、MOONSHOT_API_KEY 或 OPENAI_API_KEY。",
				abortController,
			)
	}
}

export async function chatCompletion(
	systemPrompt: string,
	messages: ChatMessage[],
): Promise<string> {
	switch (PROVIDER) {
		case "deepseek":
			return deepseekChat(systemPrompt, messages)
		case "kimi":
			return kimiChat(systemPrompt, messages)
		case "openai":
			return openaiChat(systemPrompt, messages)
		default:
			return "（演示模式）请在 .env.local 中设置 DEEPSEEK_API_KEY、MOONSHOT_API_KEY 或 OPENAI_API_KEY。"
	}
}
