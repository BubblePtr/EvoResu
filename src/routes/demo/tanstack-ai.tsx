import type { UIMessage } from "@tanstack/ai-react"
import { fetchServerSentEvents, useChat } from "@tanstack/ai-react"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"

export const Route = createFileRoute("/demo/tanstack-ai")({
	component: TanStackAiDemo,
})

function TanStackAiDemo() {
	const [input, setInput] = useState("")
	const { messages, sendMessage, isLoading, error, stop } = useChat({
		connection: fetchServerSentEvents("/api/chat"),
	})

	const handleSubmit = () => {
		if (!input.trim()) return
		sendMessage(input.trim())
		setInput("")
	}

	return (
		<div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 to-violet-100 p-4">
			<div className="w-full max-w-2xl h-[80vh] flex flex-col rounded-xl backdrop-blur-md bg-white/80 shadow-xl border border-white/50 overflow-hidden">
				<div className="px-6 py-4 border-b border-indigo-100 bg-white/60">
					<h1 className="text-xl font-semibold text-indigo-900">TanStack AI Demo</h1>
					<p className="text-xs text-indigo-600">
						基于 useChat + fetchServerSentEvents 的流式聊天演示
					</p>
				</div>

				<div className="flex-1 overflow-y-auto p-6 space-y-4">
					{messages.map((message: UIMessage) => (
						<div
							key={message.id}
							className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
						>
							<div
								className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
									message.role === "user"
										? "bg-indigo-600 text-white rounded-br-md"
										: "bg-white border border-indigo-100 text-indigo-900 rounded-bl-md shadow-sm"
								}`}
							>
								{message.parts.map((part) => {
									if (part.type === "text") {
										return <p key={`${message.id}-${part.type}`}>{part.content}</p>
									}
									return null
								})}
							</div>
						</div>
					))}
					{isLoading && (
						<div className="flex justify-start">
							<div className="bg-white border border-indigo-100 text-indigo-500 rounded-2xl rounded-bl-md px-4 py-2 text-sm shadow-sm">
								<span className="inline-flex gap-1">
									<span className="animate-bounce">●</span>
									<span className="animate-bounce delay-75">●</span>
									<span className="animate-bounce delay-150">●</span>
								</span>
							</div>
						</div>
					)}
					{error && (
						<div className="text-center text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg py-2">
							出错了: {error.message}
						</div>
					)}
				</div>

				<div className="p-4 border-t border-indigo-100 bg-white/60">
					<div className="flex gap-2">
						<input
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !e.shiftKey) handleSubmit()
							}}
							placeholder="输入消息..."
							className="flex-1 h-10 px-3 rounded-lg border border-indigo-200 bg-white text-indigo-900 placeholder:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
						/>
						{isLoading ? (
							<button
								type="button"
								onClick={stop}
								className="h-10 px-4 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
							>
								停止
							</button>
						) : (
							<button
								type="button"
								onClick={handleSubmit}
								className="h-10 px-4 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
							>
								发送
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
