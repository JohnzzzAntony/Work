import ZAI from 'z-ai-web-dev-sdk'
import type { EmailAnalyzeRequest, EmailAnalyzeResponse, Priority, ReplyTone } from './types'

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null

async function getZai() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create()
  }
  return zaiInstance
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Online Payments': [
    'payment',
    'transaction',
    'refund',
    'charge',
    'gateway',
    'stripe',
    'paypal',
    'checkout',
    'card',
    'invoice',
    'dispute',
    'failed payment',
    'retry',
    'authorization',
    '3ds',
  ],
  'Website Core': [
    'website',
    'site',
    'homepage',
    'ssl',
    'certificate',
    'uptime',
    'down',
    'server',
    '503',
    '500 error',
    'maintenance',
    'domain',
    'dns',
    'cdn',
    'page load',
    'bug',
    'broken',
  ],
  'Web Development': [
    'feature',
    'develop',
    'build',
    'implement',
    'api',
    'integration',
    'frontend',
    'backend',
    'code',
    'deploy',
    'release',
    'update',
    'new page',
    'redesign',
    'cms',
  ],
  'Store Support': [
    'store',
    'product',
    'inventory',
    'stock',
    'order',
    'fulfillment',
    'shipping',
    'warehouse',
    'sku',
    'pricing',
    'listing',
    'sync',
  ],
}

function detectCategory(text: string): string {
  const lower = text.toLowerCase()
  let best = 'Website Core'
  let bestScore = 0
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0
    for (const kw of keywords) {
      if (lower.includes(kw)) score += 1
    }
    if (score > bestScore) {
      bestScore = score
      best = cat
    }
  }
  return best
}

function detectPriority(text: string): Priority {
  const lower = text.toLowerCase()
  if (
    lower.includes('urgent') ||
    lower.includes('asap') ||
    lower.includes('emergency') ||
    lower.includes('immediately') ||
    lower.includes('critical') ||
    lower.includes('down') ||
    lower.includes('outage')
  ) {
    return 'urgent'
  }
  if (
    lower.includes('important') ||
    lower.includes('high priority') ||
    lower.includes('尽快') ||
    lower.includes('serious') ||
    lower.includes('failed') ||
    lower.includes('broken') ||
    lower.includes('cannot') ||
    lower.includes("can't") ||
    lower.includes('not working')
  ) {
    return 'high'
  }
  if (lower.includes('whenever') || lower.includes('no rush') || lower.includes('low priority')) {
    return 'low'
  }
  return 'medium'
}

function dueDateFromPriority(priority: Priority, urgentHours = 4, highDays = 1, mediumDays = 3, lowDays = 7): string {
  const now = new Date()
  switch (priority) {
    case 'urgent':
      now.setHours(now.getHours() + urgentHours)
      break
    case 'high':
      now.setDate(now.getDate() + highDays)
      break
    case 'medium':
      now.setDate(now.getDate() + mediumDays)
      break
    case 'low':
      now.setDate(now.getDate() + lowDays)
      break
  }
  return now.toISOString()
}

const TONE_INSTRUCTIONS: Record<ReplyTone, string> = {
  formal:
    'Write in a formal, professional business tone. Use complete sentences and courteous language.',
  friendly:
    'Write in a warm, friendly, approachable tone. Use contractions and a slightly conversational style while staying professional.',
  apologetic:
    'Write in a sincerely apologetic tone for any delay or inconvenience caused. Acknowledge frustration and reassure the sender.',
  concise:
    'Write a very concise, direct reply. Keep it under 4 short sentences. No fluff.',
}

/**
 * Analyze a pasted email and return a suggested task + a draft professional reply.
 * Falls back to a deterministic local extractor if the LLM call fails.
 */
export async function analyzeEmail(req: EmailAnalyzeRequest): Promise<EmailAnalyzeResponse> {
  const emailText = (req.emailText || '').trim()
  const sender = (req.sender || '').trim()
  const tone = req.tone || 'formal'
  const companyName = req.companyName || 'WorkFlow Hub'

  // Extract a fallback title from the first non-empty, non-header line
  const lines = emailText.split('\n').map((l) => l.trim()).filter(Boolean)
  const subjectLine = lines.find((l) => /^subject\s*:/i.test(l))
  let fallbackTitle = subjectLine
    ? subjectLine.replace(/^subject\s*:/i, '').trim()
    : lines[0]?.slice(0, 80) || 'New work item from email'
  if (fallbackTitle.length > 100) fallbackTitle = fallbackTitle.slice(0, 97) + '...'

  const detectedCategory = detectCategory(emailText)
  const detectedPriority = detectPriority(emailText)
  const fallbackDue = dueDateFromPriority(detectedPriority)

  // Build the LLM prompt
  const systemPrompt = `You are an operations assistant for ${companyName}, a small team that handles work across four categories: Website Core, Online Payments, Web Development, and Store Support.
Given an incoming email, you will:
1. Suggest a concise task title (max 80 chars).
2. Pick the single best matching category from: Website Core, Online Payments, Web Development, Store Support.
3. Suggest a priority: low, medium, high, or urgent.
4. Write a 2-3 sentence summary of what the email is asking for.
5. Write a professional reply to the sender.

You MUST respond with valid JSON only, no markdown fences, with this exact shape:
{"title": string, "category": string, "priority": "low"|"medium"|"high"|"urgent", "summary": string, "reply": string}

Reply tone: ${tone}. ${TONE_INSTRUCTIONS[tone]}
The reply must: acknowledge the request, set a realistic expectation about next steps, and avoid inventing specific commitments beyond what's in the email. Sign off as "The ${companyName} Team". Do not include a subject line in the reply.`

  const userPrompt = `Sender: ${sender || 'unknown'}
Email content:
"""
${emailText.slice(0, 6000)}
"""

Return JSON only.`

  let title = fallbackTitle
  let category = detectedCategory
  let priority = detectedPriority
  let summary =
    lines
      .slice(0, 3)
      .join(' ')
      .slice(0, 200) || 'Email received — see full content for details.'
  let replyDraft = ''

  try {
    const zai = await getZai()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'disabled' },
    })
    const raw = completion.choices[0]?.message?.content || ''
    // Strip any markdown fences if present
    const cleaned = raw
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/i, '')
      .trim()
    const parsed = JSON.parse(cleaned)
    if (parsed.title && typeof parsed.title === 'string') title = String(parsed.title).slice(0, 120)
    if (parsed.category && typeof parsed.category === 'string') {
      // Normalize to one of our four categories
      const c = String(parsed.category).toLowerCase()
      if (c.includes('payment')) category = 'Online Payments'
      else if (c.includes('web dev') || c.includes('development')) category = 'Web Development'
      else if (c.includes('store')) category = 'Store Support'
      else category = 'Website Core'
    }
    if (parsed.priority && typeof parsed.priority === 'string') {
      const p = String(parsed.priority).toLowerCase()
      if (p === 'low' || p === 'medium' || p === 'high' || p === 'urgent') priority = p
    }
    if (parsed.summary && typeof parsed.summary === 'string') summary = String(parsed.summary).slice(0, 400)
    if (parsed.reply && typeof parsed.reply === 'string') replyDraft = String(parsed.reply)
  } catch (err) {
    console.error('[analyzeEmail] LLM failed, using fallback:', err)
    // Fallback reply draft
    replyDraft = buildFallbackReply(sender, companyName, tone, category)
  }

  if (!replyDraft) {
    replyDraft = buildFallbackReply(sender, companyName, tone, category)
  }

  // Recompute due date from the (possibly LLM-overridden) priority
  const dueDate = dueDateFromPriority(priority)

  return {
    title,
    category,
    priority,
    summary,
    dueDate,
    replyDraft,
    detectedSender: sender || undefined,
  }
}

function buildFallbackReply(sender: string, companyName: string, tone: ReplyTone, category: string): string {
  const greeting = sender
    ? `Hello ${sender.split('@')[0].split(' ').map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ')},`
    : 'Hello,'
  const body =
    tone === 'apologetic'
      ? `Thank you for reaching out, and our sincere apologies for any inconvenience this may have caused. We have logged your request under our ${category} workflow and a member of our team will be looking into it shortly. We will follow up with an update as soon as we have more information.`
      : tone === 'concise'
        ? `Thanks for your message — we've logged this under ${category} and someone from our team will follow up shortly.`
        : tone === 'friendly'
          ? `Thanks so much for reaching out! We've received your message and logged it under our ${category} workflow. One of our team members will take a look and get back to you with an update soon.`
          : `Thank you for contacting ${companyName}. We have received your message and logged it under our ${category} workflow. A member of our team will review your request and follow up with you shortly.`
  return `${greeting}

${body}

Best regards,
The ${companyName} Team`
}

/**
 * Regenerate only the reply draft (after the admin edits task fields or changes tone).
 */
export async function regenerateReply(
  emailText: string,
  sender: string,
  tone: ReplyTone,
  category: string,
  assigneeName: string | null,
  companyName: string
): Promise<string> {
  const systemPrompt = `You are a professional support/operations assistant for ${companyName}.
Write a concise, professional reply to the email below.
- Acknowledge the request.
- Confirm what will happen next and give a realistic timeframe.
- Use tone: ${tone}. ${TONE_INSTRUCTIONS[tone]}
- ${assigneeName ? `Mention that ${assigneeName} from our team will be handling it.` : 'Mention that our team will be handling it.'}
- Do not invent specific commitments beyond what's in the email.
- Sign off as "The ${companyName} Team".
- Do not include a subject line.
Return only the reply text, no JSON, no markdown fences.`

  const userPrompt = `Sender: ${sender || 'unknown'}
Category: ${category}
Email content:
"""
${emailText.slice(0, 6000)}
"""`

  try {
    const zai = await getZai()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'disabled' },
    })
    const text = completion.choices[0]?.message?.content || ''
    if (text.trim()) return text.trim()
  } catch (err) {
    console.error('[regenerateReply] LLM failed, using fallback:', err)
  }
  return buildFallbackReply(sender, companyName, tone, category)
}

// ─── Multi-task summary analysis ───
// Parses a pasted email digest / summary that may contain MULTIPLE distinct
// actionable tasks. Returns a structured list the admin can review before
// bulk-creating. Each task includes a suggested category and priority; the
// backend resolves the category id and the best-matching assignee separately.

export type LlmParsedTask = {
  title: string
  category: string
  priority: Priority
  description: string
  dueDateHint: string | null
}

/**
 * Ask the LLM to extract multiple distinct tasks from a pasted email summary.
 */
export async function analyzeEmailSummary(
  text: string,
  companyName = 'WorkFlow Hub'
): Promise<LlmParsedTask[]> {
  const trimmed = (text || '').trim()
  if (!trimmed) return []

  const systemPrompt = `You are an operations assistant for ${companyName}, a team that handles work across four categories:
- Website Core (maintenance, uptime, bugs, SSL, domain, security, server issues)
- Online Payments (gateway issues, payment terminals, Tabby, refunds, reconciliation, disputes)
- Web Development (new features, enhancements, plugins, SEO, banners, marketplace onboarding, vendor data sharing)
- Store Support (inventory, BOM, POS machines, stock corrections, warehouse, store operations)

The user will paste a summary or digest of emails that may contain MULTIPLE distinct actionable tasks. Your job is to identify each distinct task and return them as a JSON array.

For each task, provide:
- "title": a concise actionable title (max 90 characters). Do NOT number it.
- "category": exactly one of "Website Core", "Online Payments", "Web Development", "Store Support".
- "priority": one of "low", "medium", "high", "urgent" based on urgency language and impact.
- "description": a detailed description that includes ALL sub-tasks and context. Use newlines (\\n) and bullet points (•) for sub-tasks. Include the source email reference if present.
- "dueDateHint": if a specific deadline/expiry date is mentioned, provide it as "YYYY-MM-DD". Otherwise null.

Rules:
- Split compound items into separate tasks only when they are genuinely independent work items.
- If a section is just a summary/heading with no actionable task, skip it.
- Preserve all the detail from the original text in the description field.
- Return ONLY a JSON object: {"tasks": [...]} — no markdown fences, no explanation.`

  const userPrompt = `Here is the email summary/digest to parse:

"""
${trimmed.slice(0, 10000)}
"""

Return JSON only: {"tasks": [...]}`

  try {
    const zai = await getZai()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'disabled' },
    })
    const raw = completion.choices[0]?.message?.content || ''
    const cleaned = raw
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/i, '')
      .trim()
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed.tasks)) {
      return parsed.tasks
        .filter((t: unknown): t is Record<string, unknown> => typeof t === 'object' && t !== null)
        .map((t) => ({
          title: String(t.title ?? 'Untitled task').slice(0, 200),
          category: String(t.category ?? 'Website Core'),
          priority: (['low', 'medium', 'high', 'urgent'].includes(String(t.priority))
            ? String(t.priority)
            : 'medium') as Priority,
          description: String(t.description ?? ''),
          dueDateHint:
            typeof t.dueDateHint === 'string' && t.dueDateHint.length > 0
              ? t.dueDateHint
              : null,
        }))
    }
  } catch (err) {
    console.error('[analyzeEmailSummary] LLM failed, using fallback parser:', err)
  }

  // Fallback: naive parser — split on numbered headings like "1.", "2.", etc.
  return fallbackSummaryParser(trimmed)
}

/**
 * Naive fallback: splits the text on lines starting with a number + dot,
 * extracting a title from the first line and the rest as the description.
 */
function fallbackSummaryParser(text: string): LlmParsedTask[] {
  const lines = text.split('\n')
  const tasks: LlmParsedTask[] = []
  let current: LlmParsedTask | null = null
  let buffer: string[] = []

  const flush = () => {
    if (current && buffer.length > 0) {
      current.description = buffer.join('\n').trim()
      tasks.push(current)
    }
    current = null
    buffer = []
  }

  for (const line of lines) {
    const match = line.match(/^\s*(\d+)\.\s+(.+)/)
    if (match) {
      flush()
      current = {
        title: match[2].slice(0, 90),
        category: detectCategory(line + ' ' + buffer.join(' ')),
        priority: detectPriority(line + ' ' + buffer.join(' ')),
        description: '',
        dueDateHint: null,
      }
    } else if (current) {
      buffer.push(line)
    }
  }
  flush()
  return tasks.slice(0, 20)
}

