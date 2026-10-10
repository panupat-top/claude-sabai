// What the mod adds to the conversation, as plain values: a summary line under a tool row,
// test results, callouts and the spinner's words. register.tsx draws them per surface.

export type Tone = 'text' | 'muted' | 'ok' | 'bad' | 'warn' | 'edit' | 'read'
export type Part = { text: string; tone: Tone }

// One tool call as a step: what it was about, what it did, and how it ended.
export type StepIcon = 'terminal' | 'flask' | 'pen' | 'file' | 'read' | 'stop'
export type Step = {
  icon: StepIcon
  tone: Tone
  title: string
  detail: string
  result: Part[]
  time?: string
  // Its output would only repeat the result (a passing test run) or does not exist yet.
  quiet?: boolean
}

export function seconds(ms: number): string {
  const s = ms / 1000
  if (s < 10) return `${s.toFixed(1)}s`
  if (s < 60) return `${Math.floor(s)}s`
  return `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`
}

export type TestRunner = 'bun' | 'jest' | 'vitest' | 'pytest' | 'cargo' | 'go'
type Counts = { passed: number; failed: number; skipped: number }

const lastMatch = (text: string, re: RegExp) => [...text.matchAll(re)].at(-1)
const count = (words: string, word: string) => Number(words.match(new RegExp(`(\\d+) ${word}`))?.[1] ?? 0)

// Each runner's closing summary, by its exact shape: a passing mention elsewhere is not a summary.
const PARSERS: [TestRunner, (t: string) => Counts | undefined][] = [
  ['bun', t => {
    if (!/^Ran \d+ tests? across/m.test(t)) return undefined
    const n = (w: string) => Number(lastMatch(t, new RegExp(`^\\s*(\\d+) ${w}$`, 'gm'))?.[1] ?? 0)
    return { passed: n('pass'), failed: n('fail'), skipped: n('skip') }
  }],
  ['vitest', t => {
    const m = lastMatch(t, /^\s*Tests\s{2,}(.+?)\s\((\d+)\)\s*$/gm)
    return m ? { passed: count(m[1]!, 'passed'), failed: count(m[1]!, 'failed'), skipped: count(m[1]!, 'skipped') } : undefined
  }],
  ['jest', t => {
    const m = lastMatch(t, /^Tests:\s+(.+?),?\s+(\d+) total$/gm)
    return m ? { passed: count(m[1]!, 'passed'), failed: count(m[1]!, 'failed'), skipped: count(m[1]!, 'skipped') } : undefined
  }],
  ['pytest', t => {
    const m = lastMatch(t, /^=+ (.+?) in [\d.]+s(?: \([^)]*\))? =+$/gm)
    return m ? { passed: count(m[1]!, 'passed'), failed: count(m[1]!, 'failed') + count(m[1]!, 'errors?'), skipped: count(m[1]!, 'skipped') } : undefined
  }],
  ['cargo', t => {
    const all = [...t.matchAll(/^test result: (?:ok|FAILED)\. (\d+) passed; (\d+) failed; (\d+) ignored/gm)]
    if (!all.length) return undefined
    return all.reduce((a, m) => ({ passed: a.passed + Number(m[1]), failed: a.failed + Number(m[2]), skipped: a.skipped + Number(m[3]) }), { passed: 0, failed: 0, skipped: 0 })
  }],
  ['go', t => {
    const pass = (t.match(/^\s*--- PASS:/gm) ?? []).length
    const fail = (t.match(/^\s*--- FAIL:/gm) ?? []).length
    const skip = (t.match(/^\s*--- SKIP:/gm) ?? []).length
    if (pass + fail + skip) return { passed: pass, failed: fail, skipped: skip }
    const ok = (t.match(/^ok\s+\S+\s+[\d.]+s/gm) ?? []).length
    const bad = (t.match(/^FAIL\s+\S+\s+[\d.]+s/gm) ?? []).length
    return ok + bad ? { passed: ok, failed: bad, skipped: 0 } : undefined
  }],
]

export function testResult(text: string): ({ runner: TestRunner } & Counts) | undefined {
  for (const [runner, parse] of PARSERS) {
    const c = parse(text)
    if (c && c.passed + c.failed + c.skipped > 0) return { runner, ...c }
  }
  return undefined
}

export type CalloutKind = 'note' | 'tip' | 'important' | 'warning' | 'caution'
export type Segment = { kind: 'md'; text: string } | { kind: 'callout'; type: CalloutKind; body: string }

const MARKER = /^>\s*\[!(note|tip|important|warning|caution)\]\s*(.*)$/i

// A reply cut into its Markdown and its GitHub alerts, in order; a fenced block is never cut.
export function splitCallouts(md: string): Segment[] {
  const out: Segment[] = []
  let text: string[] = []
  let fence: string | undefined
  const flush = () => {
    if (text.length) out.push({ kind: 'md', text: text.join('\n') })
    text = []
  }
  const lines = md.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const f = line.match(/^\s*(```+|~~~+)/)?.[1]
    if (f) fence = fence === undefined ? f[0] : f[0] === fence ? undefined : fence
    const m = fence === undefined && !f ? line.match(MARKER) : null
    if (!m) {
      text.push(line)
      continue
    }
    flush()
    const body = m[2] ? [m[2]] : []
    while (i + 1 < lines.length && /^>/.test(lines[i + 1]!) && !MARKER.test(lines[i + 1]!)) body.push(lines[++i]!.replace(/^>\s?/, ''))
    out.push({ kind: 'callout', type: m[1]!.toLowerCase() as CalloutKind, body: body.join('\n') })
    // The blank line that closes a callout belongs to it, not to the text after.
    if (lines[i + 1] === '') i++
  }
  flush()
  return out
}

export const CALLOUT_HINT =
  'When an aside deserves a box (a caveat, a tip, a warning), write it as a GitHub alert: `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]` or `> [!CAUTION]`. Use them sparingly.'

export type SpinnerMode = 'requesting' | 'responding' | 'thinking' | 'tool-input' | 'tool-use'

// Plain Thai, read at a glance; the engine adds its own ellipsis after the word.
export const SPINNER_WORDS: Record<SpinnerMode, readonly string[]> = {
  thinking: ['กำลังคิด', 'ขอคิดแป๊บนึงนะ', 'กำลังเรียบเรียงความคิด', 'กำลังหาทางที่ดีที่สุด'],
  requesting: ['กำลังส่งคำขอ', 'รอคำตอบสักครู่'],
  'tool-input': ['กำลังเตรียมคำสั่ง'],
  'tool-use': ['กำลังลงมือทำ', 'กำลังจัดการให้', 'กำลังตรวจดูให้'],
  responding: ['กำลังเขียนคำตอบ', 'กำลังสรุปให้', 'ใกล้เสร็จแล้ว'],
}

export function seedOf(id: string): number {
  let h = 0
  for (const c of id) h = (h * 31 + c.codePointAt(0)!) >>> 0
  return h
}

export function spinnerWord(mode: SpinnerMode, seed: number): string {
  const words = SPINNER_WORDS[mode]
  return words[seed % words.length]!
}

// The desktop says `Working` while its row names no step; a word naming a step is kept.
export const isGenericWord = (word: string) => word.trim() === '' || word.trim() === 'Working'

// What a tool row holds, drawn under it so it need not be opened: a command's last lines, an
// edit's diff, a new file's first lines.
export type Output = { source: string; format?: 'diff'; path?: string; more: number }
const OUTPUT_LINES = 6
const DIFF_LINES = 12

// Text a Code element can draw: no colour codes, no carriage-return redraws, no control characters.
export function clean(text: string): string {
  return text
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\x1b\][^\x07]*(\x07|\x1b\\)/g, '')
    .split('\n')
    .map(l => l.replace(/\r$/, '').split('\r').pop()!)
    .join('\n')
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '')
}

const lines = (text: string) => clean(text).replace(/\s+$/, '').split('\n')

function tail(text: string): Output | undefined {
  const all = lines(text)
  if (!all.join('').trim()) return undefined
  return { source: all.slice(-OUTPUT_LINES).join('\n'), more: Math.max(0, all.length - OUTPUT_LINES) }
}

type Hunk = { oldStart: number; newStart: number; lines: string[] }

// Unified hunks up to DIFF_LINES lines, whole hunks first; a hunk cut short is re-counted so it parses.
function diff(patch: Hunk[], path?: string): Output | undefined {
  const total = patch.reduce((n, h) => n + h.lines.length, 0)
  if (!total) return undefined
  const out: string[] = []
  let used = 0
  for (const h of patch) {
    if (used >= DIFF_LINES) break
    const body = h.lines.slice(0, DIFF_LINES - used)
    const oldN = body.filter(l => !l.startsWith('+')).length
    const newN = body.filter(l => !l.startsWith('-')).length
    out.push(`@@ -${h.oldStart},${oldN} +${h.newStart},${newN} @@`, ...body)
    used += body.length
  }
  return { source: out.join('\n'), format: 'diff', ...(path ? { path } : {}), more: total - used }
}

export function outputOf(tool: string, output: unknown): Output | undefined {
  if (tool === 'Bash') {
    if (typeof output === 'string') return tail(output)
    const o = output as { stdout?: string; stderr?: string } | undefined
    return tail([o?.stdout ?? '', o?.stderr ?? ''].filter(t => t.trim()).join('\n'))
  }
  const o = output as { filePath?: string; type?: string; content?: string; structuredPatch?: Hunk[] } | undefined
  if (tool === 'Write' && o?.type === 'create' && o.content !== undefined) {
    const all = lines(o.content)
    return { source: all.slice(0, OUTPUT_LINES).join('\n'), ...(o.filePath ? { path: o.filePath } : {}), more: Math.max(0, all.length - OUTPUT_LINES) }
  }
  if ((tool === 'Edit' || tool === 'Write') && o?.structuredPatch) return diff(o.structuredPatch, o.filePath)
  return undefined
}

const basename = (path: string) => path.split('/').filter(Boolean).pop() ?? path
// A path short enough for a detail line: its last three parts.
const shortPath = (path: string) => {
  const parts = path.split('/').filter(Boolean)
  return parts.length > 3 ? `…/${parts.slice(-3).join('/')}` : path
}
const firstLine = (text: string) => text.split('\n')[0]!.trim()
const sentence = (text: string) => (text ? text[0]!.toUpperCase() + text.slice(1) : text)

type Call = { tool: string; input: unknown; output?: unknown; isRunning: boolean; isErrored: boolean; isInterrupted: boolean; durationMs?: number; tests?: boolean }
type Hunk2 = { lines: string[] }

function changes(patch: Hunk2[]): Part[] {
  const all = patch.flatMap(h => h.lines)
  const added = all.filter(l => l.startsWith('+')).length
  const removed = all.filter(l => l.startsWith('-')).length
  if (added + removed === 0) return [{ text: 'no change', tone: 'muted' }]
  return [
    { text: `+${added}`, tone: 'ok' },
    { text: ` −${removed}`, tone: 'bad' },
  ]
}

// The step a tool row shows, or nothing for a tool it does not know.
export function stepOf(c: Call): Step | undefined {
  const input = (c.input ?? {}) as { command?: string; description?: string; file_path?: string }
  const out = c.output as { stdout?: string; stderr?: string; backgroundTaskId?: string; type?: string; content?: string; structuredPatch?: Hunk2[]; file?: { startLine?: number; numLines?: number; totalLines?: number } } | undefined
  const time = c.isRunning || c.durationMs === undefined ? undefined : seconds(c.durationMs)
  if (c.tool === 'Bash') {
    const command = firstLine(input.command ?? '')
    const title = sentence(input.description?.trim() || command)
    const detail = `$ ${command}`
    const said = typeof c.output === 'string' ? c.output : `${out?.stdout ?? ''}\n${out?.stderr ?? ''}`
    const tests = c.tests && !c.isRunning ? testResult(said) : undefined
    const icon: StepIcon = tests ? 'flask' : 'terminal'
    const base = { icon, title, detail, ...(time ? { time } : {}) }
    if (c.isRunning) return { ...base, tone: 'muted', result: [{ text: 'running…', tone: 'muted' }], quiet: true }
    if (c.isInterrupted) return { ...base, icon: 'stop', tone: 'muted', result: [{ text: 'interrupted', tone: 'muted' }] }
    if (out?.backgroundTaskId) return { ...base, tone: 'muted', result: [{ text: 'in the background', tone: 'muted' }], quiet: true }
    if (tests && tests.failed > 0)
      return { ...base, tone: 'bad', result: [{ text: `✗ ${tests.failed} of ${tests.passed + tests.failed} failed`, tone: 'bad' }] }
    if (c.isErrored) return { ...base, tone: 'bad', result: [{ text: '✗ failed', tone: 'bad' }] }
    if (tests) {
      const skipped: Part[] = tests.skipped ? [{ text: ` · ${tests.skipped} skipped`, tone: 'muted' }] : []
      return { ...base, tone: 'ok', result: [{ text: `✓ ${tests.passed} passed`, tone: 'ok' }, ...skipped], quiet: true }
    }
    return { ...base, tone: 'ok', result: [{ text: '✓ done', tone: 'ok' }] }
  }
  const path = input.file_path ?? ''
  if (!path) return undefined
  const where = { detail: shortPath(path), ...(time ? { time } : {}) }
  const running: Part[] = [{ text: 'working…', tone: 'muted' }]
  if (c.tool === 'Edit')
    return { icon: 'pen', tone: 'edit', title: `Edited ${basename(path)}`, ...where, result: c.isRunning || !out?.structuredPatch ? running : changes(out.structuredPatch), ...(c.isRunning ? { quiet: true } : {}) }
  if (c.tool === 'Write') {
    if (out?.type === 'create') {
      const n = lines(out.content ?? '').length
      return { icon: 'file', tone: 'ok', title: `Created ${basename(path)}`, ...where, result: [{ text: `new · ${n} line${n === 1 ? '' : 's'}`, tone: 'ok' }] }
    }
    return { icon: 'file', tone: 'edit', title: `Wrote ${basename(path)}`, ...where, result: out?.structuredPatch ? changes(out.structuredPatch) : running, ...(c.isRunning ? { quiet: true } : {}) }
  }
  if (c.tool === 'Read') {
    const f = out?.type === 'text' ? out.file : undefined
    const total = f?.totalLines ?? 0
    const start = f?.startLine ?? 1
    const n = f?.numLines ?? 0
    const range = !f || total === 0 ? '' : start <= 1 && n >= total ? `${total} lines` : `lines ${start}–${start + Math.max(n, 1) - 1} of ${total}`
    return { icon: 'read', tone: 'read', title: `Read ${basename(path)}`, ...where, result: range ? [{ text: range, tone: 'muted' }] : [], quiet: true }
  }
  return undefined
}

// A step in words: for a drawing's alt text and the terminal.
export const stepText = (s: Step) => [s.title, s.result.map(p => p.text).join(''), s.time].filter(Boolean).join(' · ')
