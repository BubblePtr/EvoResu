// Reads a Server-Sent Events stream from a fetch Response.
// Each SSE event matching { type: "text", content: string } fires onChunk.
export async function readSSEStream(
	response: Response,
	onChunk: (content: string) => void,
): Promise<void> {
	if (!response.body) return
	const reader = response.body.getReader()
	const decoder = new TextDecoder()
	let buffer = ""

	while (true) {
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
				const parsed = JSON.parse(data) as { type?: string; content?: string }
				if (parsed.type === "text" && typeof parsed.content === "string") {
					onChunk(parsed.content)
				}
			} catch {
				// Malformed SSE chunk — skip silently
			}
		}
	}
}
