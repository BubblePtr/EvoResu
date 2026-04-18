// @client-only — this file must NOT be imported by any server function or route loader.
// diff-match-patch calls document/window and will crash in Cloudflare Workers.

import DiffMatchPatch from "diff-match-patch"

export interface DiffSegment {
	type: "equal" | "insert" | "delete"
	text: string
}

// Returns character-level diff segments between two markdown strings.
// insert = added in finalResume (green), delete = removed (red), equal = unchanged.
export function computeResumeDiff(before: string, after: string): DiffSegment[] {
	const dmp = new DiffMatchPatch()
	const diffs = dmp.diff_main(before, after)
	dmp.diff_cleanupSemantic(diffs)

	return diffs.map(([op, text]) => {
		if (op === DiffMatchPatch.DIFF_INSERT) return { type: "insert", text }
		if (op === DiffMatchPatch.DIFF_DELETE) return { type: "delete", text }
		return { type: "equal", text }
	})
}
