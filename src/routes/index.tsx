import { createFileRoute } from "@tanstack/react-router"
import { useCallback, useEffect, useRef, useState } from "react"
import type { EvidenceItem, Message, SessionState, Stage } from "../lib/localStorage"
import {
	clearSession,
	loadResumes,
	loadSession,
	saveFinalResume,
	saveResumeDraft,
	saveSession,
} from "../lib/localStorage"
import { readSSEStream } from "../lib/sse"

export const Route = createFileRoute("/")({ component: EvoResu })

// Minimum questions before "generate resume" button appears
const MIN_QUESTIONS = 8
// Maximum questions before auto-showing generate button
const MAX_QUESTIONS = 12
// Total mock interview rounds
const INTERVIEW_ROUNDS = 5
// JD input character limit (see engineering review: ~750 tokens)
const JD_MAX_CHARS = 3000

function defaultState(): SessionState {
	return {
		version: 1,
		jd: "",
		stage: "IDLE",
		messages: [],
		evidencePanel: [],
		interviewMessages: [],
		rating: null,
		feedback: "",
	}
}

function EvoResu() {
	const [state, setState] = useState<SessionState>(() => loadSession() ?? defaultState())
	const [resumeDraft, setResumeDraft] = useState(() => loadResumes().resumeDraft)
	const [finalResume, setFinalResume] = useState(() => loadResumes().finalResume)
	const [input, setInput] = useState("")
	const [isLoading, setIsLoading] = useState(false)
	const [streamingText, setStreamingText] = useState("")
	const [toast, setToast] = useState<string | null>(null)
	const messagesEndRef = useRef<HTMLDivElement>(null)

	// Persist state on every change
	useEffect(() => {
		saveSession(state)
	}, [state])

	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional — scroll when message count or stream text changes
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
	}, [state.messages.length, state.interviewMessages.length, streamingText.length])

	const showToast = useCallback((msg: string) => {
		setToast(msg)
		setTimeout(() => setToast(null), 4000)
	}, [])

	const updateStage = (stage: Stage) => setState((s) => ({ ...s, stage }))

	// ─── JD Input ────────────────────────────────────────────────────────────

	const handleStartInterview = () => {
		if (!state.jd.trim()) return
		updateStage("QUESTIONS")
		sendQuestion(state.jd, [])
	}

	// ─── Q&A streaming ───────────────────────────────────────────────────────

	const sendQuestion = useCallback(
		async (jd: string, messages: Message[]) => {
			setIsLoading(true)
			setStreamingText("")
			let accumulated = ""
			try {
				const res = await fetch("/api/chat", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "question",
						jd,
						messages,
						questionIndex: messages.filter((m) => m.role === "assistant").length,
					}),
				})
				await readSSEStream(res, (content) => {
					accumulated += content
					setStreamingText(accumulated)
				})
				const aiMsg: Message = { role: "assistant", content: accumulated }
				setState((s) => ({ ...s, messages: [...s.messages, aiMsg] }))
			} catch {
				showToast("AI 问题加载失败，请重试")
			} finally {
				setIsLoading(false)
				setStreamingText("")
			}
		},
		[showToast],
	)

	const handleSendAnswer = async () => {
		const trimmed = input.trim()
		if (!trimmed || isLoading) return
		const userMsg: Message = { role: "user", content: trimmed }
		const newMessages = [...state.messages, userMsg]
		setState((s) => ({ ...s, messages: newMessages }))
		setInput("")

		const aiCount = newMessages.filter((m) => m.role === "assistant").length
		if (aiCount >= MAX_QUESTIONS) {
			// Auto-trigger resume generation after max questions
			await generateResume(state.jd, newMessages)
		} else {
			await sendQuestion(state.jd, newMessages)
		}
	}

	// ─── Resume generation ───────────────────────────────────────────────────

	const fetchEvidencePanel = useCallback(
		async (jd: string, draft: string) => {
			try {
				const res = await fetch("/api/evidence-panel", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ jd, resumeDraft: draft }),
				})
				const panel = (await res.json()) as EvidenceItem[]
				setState((s) => ({ ...s, evidencePanel: Array.isArray(panel) ? panel : [] }))
			} catch {
				setState((s) => ({ ...s, evidencePanel: [] }))
				showToast("证据面板临时不可用，已自动跳过")
			}
		},
		[showToast],
	)

	const generateResume = useCallback(
		async (jd: string, messages: Message[]) => {
			setState((s) => ({ ...s, stage: "RESUME_DRAFT" }))
			setIsLoading(true)
			setStreamingText("")
			let accumulated = ""
			try {
				const res = await fetch("/api/generate-resume", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ mode: "resume_generation", jd, messages }),
				})
				await readSSEStream(res, (content) => {
					accumulated += content
					setStreamingText(accumulated)
				})
				setResumeDraft(accumulated)
				saveResumeDraft(accumulated)
				setState((s) => ({ ...s, stage: "RESUME_DRAFT" }))
				setStreamingText("")

				// Second request: evidence panel (independent endpoint, separate Workers request)
				fetchEvidencePanel(jd, accumulated)
			} catch {
				showToast("简历生成失败，请重试")
				setState((s) => ({ ...s, stage: "QUESTIONS" }))
			} finally {
				setIsLoading(false)
				setStreamingText("")
			}
		},
		[showToast, fetchEvidencePanel],
	)

	const startInterview = () => {
		setState((s) => ({ ...s, stage: "INTERVIEW" }))
		sendInterviewQuestion(state.jd, resumeDraft, state.evidencePanel, [])
	}

	const sendInterviewQuestion = useCallback(
		async (
			jd: string,
			draft: string,
			evidencePanel: EvidenceItem[],
			interviewMessages: Message[],
		) => {
			setIsLoading(true)
			setStreamingText("")
			let accumulated = ""
			try {
				const res = await fetch("/api/chat", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "interview",
						jd,
						resumeDraft: draft,
						evidencePanel,
						interviewMessages,
						questionIndex: interviewMessages.filter((m) => m.role === "assistant").length,
					}),
				})
				await readSSEStream(res, (content) => {
					accumulated += content
					setStreamingText(accumulated)
				})
				const aiMsg: Message = { role: "assistant", content: accumulated }
				setState((s) => ({ ...s, interviewMessages: [...s.interviewMessages, aiMsg] }))
			} catch {
				showToast("面试问题加载失败，请重试")
			} finally {
				setIsLoading(false)
				setStreamingText("")
			}
		},
		[showToast],
	)

	const handleSendInterviewAnswer = async () => {
		const trimmed = input.trim()
		if (!trimmed || isLoading) return
		const userMsg: Message = { role: "user", content: trimmed }
		const newInterviewMessages = [...state.interviewMessages, userMsg]
		setState((s) => ({ ...s, interviewMessages: newInterviewMessages }))
		setInput("")

		const aiCount = newInterviewMessages.filter((m) => m.role === "assistant").length
		if (aiCount >= INTERVIEW_ROUNDS) {
			await regenerateResume(state.jd, resumeDraft, newInterviewMessages)
		} else {
			await sendInterviewQuestion(state.jd, resumeDraft, state.evidencePanel, newInterviewMessages)
		}
	}

	// ─── Regeneration ────────────────────────────────────────────────────────

	const regenerateResume = useCallback(
		async (jd: string, draft: string, interviewMessages: Message[]) => {
			setState((s) => ({ ...s, stage: "FINAL_RESUME" }))
			setIsLoading(true)
			setStreamingText("")
			let accumulated = ""
			try {
				const res = await fetch("/api/generate-resume", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ mode: "regeneration", jd, resumeDraft: draft, interviewMessages }),
				})
				await readSSEStream(res, (content) => {
					accumulated += content
					setStreamingText(accumulated)
				})
				setFinalResume(accumulated)
				saveFinalResume(accumulated)
				setState((s) => ({ ...s, stage: "FINAL_RESUME" }))
			} catch {
				showToast("简历重新生成失败，请重试")
				setState((s) => ({ ...s, stage: "INTERVIEW" }))
			} finally {
				setIsLoading(false)
				setStreamingText("")
			}
		},
		[showToast],
	)

	// ─── Rating ──────────────────────────────────────────────────────────────

	const handleRate = (rating: number) => {
		setState((s) => ({ ...s, rating, stage: "RATING" }))
	}

	const handleReset = () => {
		clearSession()
		setResumeDraft("")
		setFinalResume("")
		setState(defaultState())
	}

	const aiMessageCount = state.messages.filter((m) => m.role === "assistant").length
	const canGenerateEarly = aiMessageCount >= MIN_QUESTIONS

	// ─── Render ──────────────────────────────────────────────────────────────

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-950">
			{/* Toast */}
			{toast && (
				<div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-yellow-100 px-4 py-2 text-sm text-yellow-900 shadow-md dark:bg-yellow-900 dark:text-yellow-100">
					{toast}
				</div>
			)}

			<div className="mx-auto max-w-3xl px-4 py-10">
				{/* Header */}
				<div className="mb-8 text-center">
					<h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
						EvoResu
					</h1>
					<p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
						AI 自我发现引擎 · 让面试官帮你写简历
					</p>
				</div>

				{/* ── Stage: IDLE ─────────────────────────────────────────── */}
				{state.stage === "IDLE" && (
					<div className="rounded-2xl bg-white p-8 shadow-sm dark:bg-gray-900">
						<h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
							粘贴目标职位描述
						</h2>
						<textarea
							className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
							rows={10}
							maxLength={JD_MAX_CHARS}
							placeholder="将职位描述粘贴到这里..."
							value={state.jd}
							onChange={(e) => setState((s) => ({ ...s, jd: e.target.value }))}
						/>
						<div className="mt-1 text-right text-xs text-gray-400">
							{state.jd.length} / {JD_MAX_CHARS}
						</div>
						<button
							type="button"
							disabled={!state.jd.trim()}
							onClick={() => updateStage("JD_INPUT")}
							className="mt-4 w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
						>
							开始
						</button>
					</div>
				)}

				{/* ── Stage: JD_INPUT ─────────────────────────────────────── */}
				{state.stage === "JD_INPUT" && (
					<div className="rounded-2xl bg-white p-8 shadow-sm dark:bg-gray-900">
						<h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
							准备好了吗？
						</h2>
						<p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
							接下来 AI 会问你 8-12
							个关于你经历的问题。根据你的回答，生成一份简历草稿和证据面板，然后通过 5
							轮模拟面试帮你打磨每一条声明。
						</p>
						<div className="flex gap-3">
							<button
								type="button"
								onClick={() => updateStage("IDLE")}
								className="flex-1 rounded-xl border border-gray-200 py-3 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
							>
								修改职位描述
							</button>
							<button
								type="button"
								onClick={handleStartInterview}
								className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
							>
								开始提问
							</button>
						</div>
					</div>
				)}

				{/* ── Stage: QUESTIONS ─────────────────────────────────────── */}
				{state.stage === "QUESTIONS" && (
					<div className="flex flex-col gap-4">
						<ChatMessages messages={state.messages} streamingText={streamingText} />
						<div ref={messagesEndRef} />
						{canGenerateEarly && !isLoading && (
							<button
								type="button"
								onClick={() => generateResume(state.jd, state.messages)}
								className="rounded-xl border border-indigo-200 bg-indigo-50 py-2 text-sm text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
							>
								已完成回答，生成简历草稿
							</button>
						)}
						<ChatInput
							value={input}
							onChange={setInput}
							onSubmit={handleSendAnswer}
							isLoading={isLoading}
							placeholder="输入你的回答..."
						/>
					</div>
				)}

				{/* ── Stage: RESUME_DRAFT ──────────────────────────────────── */}
				{state.stage === "RESUME_DRAFT" && (
					<div className="flex flex-col gap-6">
						<ResumePanel
							title="简历草稿"
							markdown={resumeDraft || streamingText}
							isStreaming={isLoading}
						/>
						{state.evidencePanel.length > 0 && <EvidencePanel items={state.evidencePanel} />}
						{!isLoading && (
							<button
								type="button"
								onClick={startInterview}
								className="rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
							>
								进入模拟面试（5 轮针对性追问）
							</button>
						)}
					</div>
				)}

				{/* ── Stage: INTERVIEW ─────────────────────────────────────── */}
				{state.stage === "INTERVIEW" && (
					<div className="flex flex-col gap-4">
						<div className="rounded-xl bg-indigo-50 px-4 py-2 text-sm text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
							模拟面试：第{" "}
							{state.interviewMessages.filter((m) => m.role === "assistant").length + 1} /{" "}
							{INTERVIEW_ROUNDS} 轮
						</div>
						<ChatMessages messages={state.interviewMessages} streamingText={streamingText} />
						<div ref={messagesEndRef} />
						<ChatInput
							value={input}
							onChange={setInput}
							onSubmit={handleSendInterviewAnswer}
							isLoading={isLoading}
							placeholder="回答面试问题..."
						/>
					</div>
				)}

				{/* ── Stage: FINAL_RESUME ──────────────────────────────────── */}
				{state.stage === "FINAL_RESUME" && (
					<div className="flex flex-col gap-6">
						<ResumePanel
							title="最终简历"
							markdown={finalResume || streamingText}
							isStreaming={isLoading}
						/>
						{!isLoading && finalResume && resumeDraft && (
							<ResumeDiffPanel before={resumeDraft} after={finalResume} />
						)}
						{!isLoading && (
							<div className="flex flex-col gap-3">
								<p className="text-center text-sm text-gray-500 dark:text-gray-400">
									对这份简历打分（1-10）
								</p>
								<div className="flex justify-center gap-2">
									{Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
										<button
											key={n}
											type="button"
											onClick={() => handleRate(n)}
											className={`h-9 w-9 rounded-lg text-sm font-semibold transition-colors ${
												state.rating === n
													? "bg-indigo-600 text-white"
													: "bg-white text-gray-700 hover:bg-indigo-50 dark:bg-gray-800 dark:text-gray-200"
											}`}
										>
											{n}
										</button>
									))}
								</div>
								<button
									type="button"
									onClick={() => window.print()}
									className="rounded-xl border border-gray-200 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
								>
									打印 / 保存 PDF
								</button>
							</div>
						)}
					</div>
				)}

				{/* ── Stage: RATING ────────────────────────────────────────── */}
				{state.stage === "RATING" && (
					<div className="rounded-2xl bg-white p-8 shadow-sm dark:bg-gray-900">
						<div className="mb-6 text-center">
							<p className="text-4xl font-bold text-indigo-600">{state.rating}</p>
							<p className="mt-1 text-sm text-gray-500">/ 10</p>
						</div>
						<textarea
							className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
							rows={4}
							placeholder="有什么想说的？（可选）"
							value={state.feedback}
							onChange={(e) => setState((s) => ({ ...s, feedback: e.target.value }))}
						/>
						<div className="mt-4 flex gap-3">
							<button
								type="button"
								onClick={() => window.print()}
								className="flex-1 rounded-xl border border-gray-200 py-3 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
							>
								打印简历
							</button>
							<button
								type="button"
								onClick={handleReset}
								className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
							>
								重新开始
							</button>
						</div>
					</div>
				)}

				{/* Reset link (always visible except IDLE) */}
				{state.stage !== "IDLE" && (
					<button
						type="button"
						onClick={handleReset}
						className="mt-6 block w-full text-center text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
					>
						重置会话
					</button>
				)}
			</div>

			{/* Print styles */}
			<style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .prose { max-width: 100%; }
        }
      `}</style>
		</div>
	)
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ChatMessages({ messages, streamingText }: { messages: Message[]; streamingText: string }) {
	return (
		<div className="flex flex-col gap-3">
			{messages.map((m, i) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: messages don't have stable IDs
					key={i}
					className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
				>
					<div
						className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
							m.role === "user"
								? "bg-indigo-600 text-white rounded-br-md"
								: "bg-white text-gray-900 rounded-bl-md shadow-sm dark:bg-gray-800 dark:text-white"
						}`}
					>
						{m.content}
					</div>
				</div>
			))}
			{streamingText && (
				<div className="flex justify-start">
					<div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white px-4 py-3 text-sm whitespace-pre-wrap text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white">
						{streamingText}
						<span className="animate-pulse">▍</span>
					</div>
				</div>
			)}
		</div>
	)
}

function ChatInput({
	value,
	onChange,
	onSubmit,
	isLoading,
	placeholder,
}: {
	value: string
	onChange: (v: string) => void
	onSubmit: () => void
	isLoading: boolean
	placeholder: string
}) {
	return (
		<div className="flex gap-2">
			<textarea
				className="flex-1 rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
				rows={3}
				placeholder={placeholder}
				value={value}
				disabled={isLoading}
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && !e.shiftKey) {
						e.preventDefault()
						onSubmit()
					}
				}}
			/>
			<button
				type="button"
				disabled={isLoading || !value.trim()}
				onClick={onSubmit}
				className="self-end rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
			>
				{isLoading ? "..." : "发送"}
			</button>
		</div>
	)
}

function ResumePanel({
	title,
	markdown,
	isStreaming,
}: {
	title: string
	markdown: string
	isStreaming: boolean
}) {
	return (
		<div className="rounded-2xl bg-white shadow-sm dark:bg-gray-900 print:shadow-none">
			<div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800 no-print">
				<h2 className="font-semibold text-gray-900 dark:text-white">{title}</h2>
				{isStreaming && <span className="text-xs text-indigo-500 animate-pulse">生成中...</span>}
			</div>
			<div className="prose prose-sm dark:prose-invert max-w-none p-6">
				<pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-800 dark:text-gray-200">
					{markdown}
				</pre>
			</div>
		</div>
	)
}

function EvidencePanel({ items }: { items: EvidenceItem[] }) {
	const weak = items.filter((i) => i.strength === "weak")
	if (weak.length === 0) return null

	return (
		<div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-6 dark:border-yellow-800 dark:bg-yellow-950">
			<h3 className="mb-3 font-semibold text-yellow-900 dark:text-yellow-100">
				缺失证据（{weak.length} 条需要补充）
			</h3>
			<ul className="flex flex-col gap-3">
				{weak.map((item, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: evidence items don't have stable IDs
					<li key={i} className="text-sm">
						<p className="font-medium text-yellow-900 dark:text-yellow-100">{item.claim}</p>
						<p className="mt-0.5 text-yellow-700 dark:text-yellow-300">→ {item.missing_info}</p>
					</li>
				))}
			</ul>
		</div>
	)
}

// Dynamic import ensures diff-match-patch never enters the Workers bundle at build time
function ResumeDiffPanel({ before, after }: { before: string; after: string }) {
	const [segments, setSegments] = useState<
		Array<{ type: "equal" | "insert" | "delete"; text: string }>
	>([])

	useEffect(() => {
		import("../lib/diff").then(({ computeResumeDiff }) => {
			setSegments(computeResumeDiff(before, after))
		})
	}, [before, after])

	if (segments.length === 0) return null

	return (
		<div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900 no-print">
			<h3 className="mb-3 font-semibold text-gray-900 dark:text-white">变化对比</h3>
			<pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
				{segments.map((seg, i) => (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: diff segments don't have stable IDs
						key={i}
						className={
							seg.type === "insert"
								? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
								: seg.type === "delete"
									? "bg-red-100 text-red-800 line-through dark:bg-red-900 dark:text-red-200"
									: "text-gray-700 dark:text-gray-300"
						}
					>
						{seg.text}
					</span>
				))}
			</pre>
		</div>
	)
}
