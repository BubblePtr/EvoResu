// Session state schema versioned to detect breaking changes and clear stale data.
// resumeDraft is stored under a separate key so quota-triggered truncation never
// clobbers the most valuable output the user has already seen.

const SCHEMA_VERSION = 1
const KEY_SESSION = "evoresu_session"
const KEY_RESUME_DRAFT = "evoresu_resume_draft"
const KEY_FINAL_RESUME = "evoresu_final_resume"

export type Stage =
	| "IDLE"
	| "JD_INPUT"
	| "QUESTIONS"
	| "RESUME_DRAFT"
	| "INTERVIEW"
	| "FINAL_RESUME"
	| "RATING"

export interface Message {
	role: "user" | "assistant"
	content: string
}

export interface EvidenceItem {
	claim: string
	strength: "weak" | "strong"
	missing_info: string
}

export interface SessionState {
	version: number
	jd: string
	stage: Stage
	messages: Message[]
	evidencePanel: EvidenceItem[]
	interviewMessages: Message[]
	rating: number | null
	feedback: string
}

// Separated from SessionState so quota truncation can never touch these fields.
interface ResumeStore {
	resumeDraft: string
	finalResume: string
}

const defaultSession = (): SessionState => ({
	version: SCHEMA_VERSION,
	jd: "",
	stage: "IDLE",
	messages: [],
	evidencePanel: [],
	interviewMessages: [],
	rating: null,
	feedback: "",
})

function safeSetItem(key: string, value: string): boolean {
	try {
		localStorage.setItem(key, value)
		return true
	} catch {
		return false
	}
}

export function loadSession(): SessionState | null {
	try {
		const raw = localStorage.getItem(KEY_SESSION)
		if (!raw) return null
		const parsed = JSON.parse(raw) as SessionState
		if (parsed.version !== SCHEMA_VERSION) {
			clearSession()
			return null
		}
		return parsed
	} catch {
		return null
	}
}

export function loadResumes(): ResumeStore {
	try {
		const draft = localStorage.getItem(KEY_RESUME_DRAFT) ?? ""
		const final = localStorage.getItem(KEY_FINAL_RESUME) ?? ""
		return { resumeDraft: draft, finalResume: final }
	} catch {
		return { resumeDraft: "", finalResume: "" }
	}
}

export function saveSession(state: SessionState): void {
	const payload = JSON.stringify(state)
	if (safeSetItem(KEY_SESSION, payload)) return

	// Quota exceeded: truncate interviewMessages first (least critical)
	const trimmed1: SessionState = { ...state, interviewMessages: [] }
	if (safeSetItem(KEY_SESSION, JSON.stringify(trimmed1))) return

	// Still over quota: drop first half of Q&A messages
	const half = Math.floor(state.messages.length / 2)
	const trimmed2: SessionState = {
		...state,
		interviewMessages: [],
		messages: state.messages.slice(half),
	}
	if (safeSetItem(KEY_SESSION, JSON.stringify(trimmed2))) return

	// Last resort: save only stage so user doesn't lose position
	const minimal: SessionState = {
		...defaultSession(),
		stage: state.stage,
	}
	safeSetItem(KEY_SESSION, JSON.stringify(minimal))
}

export function saveResumeDraft(draft: string): void {
	safeSetItem(KEY_RESUME_DRAFT, draft)
}

export function saveFinalResume(final: string): void {
	safeSetItem(KEY_FINAL_RESUME, final)
}

export function clearSession(): void {
	try {
		localStorage.removeItem(KEY_SESSION)
		localStorage.removeItem(KEY_RESUME_DRAFT)
		localStorage.removeItem(KEY_FINAL_RESUME)
	} catch {}
}
