import { z } from "zod"
import type { EvidenceItem, Message } from "./localStorage"

export const ModeSchema = z.enum([
	"question",
	"resume_generation",
	"evidence_panel",
	"interview",
	"regeneration",
])

export type Mode = z.infer<typeof ModeSchema>

// JD hard limit: ~750 tokens. Prevents context blowout in later interview rounds.
const JD_CHAR_LIMIT = 3000

function truncateJd(jd: string): { jd: string; truncated: boolean } {
	if (jd.length <= JD_CHAR_LIMIT) return { jd, truncated: false }
	return { jd: jd.slice(0, JD_CHAR_LIMIT), truncated: true }
}

export interface QuestionModeInput {
	jd: string
	messages: Message[]
	questionIndex: number
}

export interface QuestionModeOutput {
	systemPrompt: string
	jdTruncated: boolean
}

export function buildQuestionPrompt(input: QuestionModeInput): QuestionModeOutput {
	const { jd: trimmedJd, truncated } = truncateJd(input.jd)

	const systemPrompt = `你是一位经验丰富的职业顾问，正在帮助用户为以下职位准备简历素材。

职位描述：
${trimmedJd}
${truncated ? "\n（职位描述已截断，仅保留前 3000 字符）" : ""}

通过自适应提问，从以下维度挖掘用户的真实经历和成果：
- 影响力与可量化成果（优先问这个）
- 协作与跨团队合作
- 工具与技术能力
- 领导力与决策
- 模糊性处理与问题解决
- 失败与成长

规则：
1. 每次只问一个具体问题，不要问复合问题
2. 根据用户回答动态调整下一个问题的方向
3. 当前是第 ${input.questionIndex + 1} 个问题，总共 8-12 个
4. 问题要具体，避免"你做过什么"这类泛化提问
5. 用中文回答`

	return { systemPrompt, jdTruncated: truncated }
}

export interface ResumeModeInput {
	jd: string
	messages: Message[]
}

export function buildResumeGenerationPrompt(input: ResumeModeInput): string {
	const { jd: trimmedJd } = truncateJd(input.jd)

	return `你是一位专业简历写手。根据以下对话中用户提供的经历，为他们撰写一份完整的简历草稿。

职位描述：
${trimmedJd}

要求：
1. 输出格式为 Markdown，包含：个人摘要、工作经历、技能
2. 每条工作经历下用 bullet points 描述成果，优先使用量化数据
3. 语言简洁有力，避免模板化措辞
4. 直接输出简历内容，不要加任何解释性文字`
}

export interface EvidencePanelModeInput {
	jd: string
	resumeDraft: string
}

export function buildEvidencePanelPrompt(input: EvidencePanelModeInput): string {
	return `分析以下简历草稿，找出声明不足或缺少量化证据的内容。

简历草稿：
${input.resumeDraft}

返回一个 JSON 数组，格式如下（只返回 JSON，不要有任何其他文字）：
[
  {
    "claim": "简历中的原始声明",
    "strength": "weak" | "strong",
    "missing_info": "如果是 weak，说明缺少什么具体信息"
  }
]

只列出 weak 条目和最多 3 条 strong 条目作为参考。`
}

export interface InterviewModeInput {
	jd: string
	resumeDraft: string
	evidencePanel: EvidenceItem[]
	interviewMessages: Message[]
	questionIndex: number
}

export function buildInterviewPrompt(input: InterviewModeInput): string {
	const { jd: trimmedJd } = truncateJd(input.jd)

	// Take top 5 weak evidence items as the interview focus
	const weakItems = input.evidencePanel.filter((e) => e.strength === "weak").slice(0, 5)

	const focusSection =
		weakItems.length > 0
			? `本次面试聚焦以下薄弱点：\n${weakItems.map((e, i) => `${i + 1}. ${e.claim}——缺少：${e.missing_info}`).join("\n")}`
			: "本次面试覆盖以下通用维度：影响力、协作、工具能力、领导力、可量化成果"

	return `你是一位严格但公正的技术面试官，正在对以下职位的候选人进行模拟面试。

职位描述：
${trimmedJd}

${focusSection}

规则：
1. 只问一个问题，针对上述薄弱点之一
2. 追问要具体，逼出数字和细节："你说提升了效率，具体提升了多少？用了多久？"
3. 这是第 ${input.questionIndex + 1} 个追问，共 5 个
4. 用中文提问`
}

export interface RegenerationModeInput {
	jd: string
	resumeDraft: string
	interviewMessages: Message[]
}

export function buildRegenerationPrompt(input: RegenerationModeInput): string {
	const { jd: trimmedJd } = truncateJd(input.jd)

	return `你是一位专业简历写手。根据模拟面试中用户补充的细节，对简历草稿进行修订和升级。

职位描述：
${trimmedJd}

原始简历草稿：
${input.resumeDraft}

要求：
1. 将面试中挖掘出的新细节、数字、具体成果融入简历
2. 保持原有结构，只升级薄弱的 bullet points
3. 输出完整的修订后简历（Markdown 格式）
4. 直接输出简历内容，不要加任何解释性文字`
}
