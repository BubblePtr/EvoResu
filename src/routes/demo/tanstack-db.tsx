import { createCollection, localOnlyCollectionOptions, useLiveQuery } from "@tanstack/react-db"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"

const notesCollection = createCollection(
	localOnlyCollectionOptions({
		getKey: (item) => item.id,
	}),
)

export const Route = createFileRoute("/demo/tanstack-db")({
	component: TanStackDbDemo,
})

function TanStackDbDemo() {
	const [input, setInput] = useState("")
	const { data: notes = [] } = useLiveQuery(notesCollection)

	const addNote = () => {
		if (!input.trim()) return
		notesCollection.insert({
			id: crypto.randomUUID(),
			text: input.trim(),
			createdAt: Date.now(),
		})
		setInput("")
	}

	const deleteNote = (id: string) => {
		notesCollection.delete(id)
	}

	return (
		<div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 p-4">
			<div className="w-full max-w-2xl p-8 rounded-xl backdrop-blur-md bg-white/80 shadow-xl border border-white/50">
				<h1 className="text-2xl font-semibold mb-2 text-emerald-900">TanStack DB Demo</h1>
				<p className="text-sm text-emerald-700 mb-6">
					本地优先的响应式客户端数据库（local-only 模式演示）
				</p>

				<div className="flex gap-2 mb-6">
					<input
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") addNote()
						}}
						placeholder="输入一条笔记..."
						className="flex-1 h-10 px-3 rounded-lg border border-emerald-200 bg-white text-emerald-900 placeholder:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400"
					/>
					<button
						type="button"
						onClick={addNote}
						className="h-10 px-4 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
					>
						添加
					</button>
				</div>

				<ul className="space-y-3">
					{notes.map((note) => (
						<li
							key={note.id}
							className="flex items-center justify-between p-4 rounded-lg bg-white border border-emerald-100 shadow-sm"
						>
							<span className="text-emerald-900">{note.text}</span>
							<button
								type="button"
								onClick={() => deleteNote(note.id)}
								className="text-xs px-3 py-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
							>
								删除
							</button>
						</li>
					))}
					{notes.length === 0 && (
						<li className="text-center py-8 text-emerald-400 text-sm">暂无笔记，添加一条吧</li>
					)}
				</ul>
			</div>
		</div>
	)
}
