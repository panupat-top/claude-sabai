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
  // A five-cell meter beside the result: added against removed lines, passed against failed tests.
  meter?: { good: number; bad: number }
  time?: string
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

// Text as a person reads it: no colour codes, no carriage-return redraws, no control characters.
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
  const input = (c.input ?? {}) as { command?: string; description?: string; file_path?: string; old_string?: string; new_string?: string; content?: string; offset?: number; limit?: number }
  const out = c.output as { stdout?: string; stderr?: string; backgroundTaskId?: string; type?: string; content?: string; structuredPatch?: Hunk2[]; file?: { startLine?: number; numLines?: number; totalLines?: number } } | undefined
  // A quick run earns a spark, a slow one a tortoise.
  const time = c.isRunning || c.durationMs === undefined ? undefined : `${c.durationMs < 1000 ? '⚡ ' : c.durationMs >= 30_000 ? '🐢 ' : ''}${seconds(c.durationMs)}`
  if (c.tool === 'Bash') {
    const command = firstLine(input.command ?? '')
    const title = sentence(input.description?.trim() || command)
    const detail = `$ ${command}`
    const said = typeof c.output === 'string' ? c.output : `${out?.stdout ?? ''}\n${out?.stderr ?? ''}`
    const tests = c.tests && !c.isRunning ? testResult(said) : undefined
    const icon: StepIcon = tests ? 'flask' : 'terminal'
    const base = { icon, title, detail, ...(time ? { time } : {}) }
    if (c.isRunning) return { ...base, tone: 'muted', result: [{ text: 'running…', tone: 'muted' }] }
    if (c.isInterrupted) return { ...base, icon: 'stop', tone: 'muted', result: [{ text: 'interrupted', tone: 'muted' }] }
    if (out?.backgroundTaskId) return { ...base, tone: 'muted', result: [{ text: 'in the background', tone: 'muted' }] }
    const meter = tests ? { good: tests.passed, bad: tests.failed } : undefined
    if (tests && tests.failed > 0)
      return { ...base, tone: 'bad', result: [{ text: `✗ ${tests.failed} of ${tests.passed + tests.failed} failed`, tone: 'bad' }], meter }
    const exit = typeof c.output === 'string' ? c.output.match(/^Exit code (\d+)/)?.[1] : undefined
    if (c.isErrored) return { ...base, tone: 'bad', result: [{ text: exit ? `✗ exit ${exit}` : '✗ failed', tone: 'bad' }] }
    if (tests) {
      const skipped: Part[] = tests.skipped ? [{ text: ` · ${tests.skipped} skipped`, tone: 'muted' }] : []
      return { ...base, tone: 'ok', result: [{ text: `✓ ${tests.passed} passed`, tone: 'ok' }, ...skipped], meter }
    }
    return { ...base, tone: 'ok', result: [{ text: '✓ done', tone: 'ok' }] }
  }
  const path = input.file_path ?? ''
  if (!path) return undefined
  const where = { detail: shortPath(path), ...(time ? { time } : {}) }
  const running: Part[] = [{ text: 'working…', tone: 'muted' }]
  const counted = (n: number) => `${n} line${n === 1 ? '' : 's'}`
  if (c.tool === 'Edit') {
    if (c.isRunning) return { icon: 'pen', tone: 'edit', title: `Editing ${basename(path)}`, ...where, result: running }
    const patch = out?.structuredPatch ?? (input.new_string !== undefined ? [{ lines: [...(input.old_string ? lines(input.old_string).map(l => `-${l}`) : []), ...lines(input.new_string).map(l => `+${l}`)] }] : undefined)
    const result = patch ? changes(patch) : []
    const all = (patch ?? []).flatMap(h => h.lines)
    const meter = { good: all.filter(l => l.startsWith('+')).length, bad: all.filter(l => l.startsWith('-')).length }
    return { icon: 'pen', tone: 'edit', title: `Edited ${basename(path)}`, ...where, result, ...(meter.good + meter.bad ? { meter } : {}) }
  }
  if (c.tool === 'Write') {
    if (c.isRunning) return { icon: 'file', tone: 'edit', title: `Writing ${basename(path)}`, ...where, result: running }
    if (out?.type === 'create')
      return { icon: 'file', tone: 'ok', title: `Created ${basename(path)}`, ...where, result: [{ text: `new · ${counted(lines(out.content ?? '').length)}`, tone: 'ok' }] }
    if (out?.structuredPatch) return { icon: 'file', tone: 'edit', title: `Wrote ${basename(path)}`, ...where, result: changes(out.structuredPatch) }
    return { icon: 'file', tone: 'edit', title: `Wrote ${basename(path)}`, ...where, result: input.content === undefined ? [] : [{ text: counted(lines(input.content).length), tone: 'edit' }] }
  }
  if (c.tool === 'Read') {
    const f = out?.type === 'text' ? out.file : undefined
    const total = f?.totalLines ?? 0
    const start = f?.startLine ?? 1
    const n = f?.numLines ?? 0
    const asked = input.limit ? `lines ${input.offset ?? 1}–${(input.offset ?? 1) + input.limit - 1}` : 'whole file'
    const range = !f || total === 0 ? asked : start <= 1 && n >= total ? `${total} lines` : `lines ${start}–${start + Math.max(n, 1) - 1} of ${total}`
    return { icon: 'read', tone: 'read', title: `Read ${basename(path)}`, ...where, result: range ? [{ text: range, tone: 'muted' }] : [] }
  }
  return undefined
}

// A step in words: for a drawing's alt text and the terminal.
export const stepText = (s: Step) => [s.title, s.result.map(p => p.text).join(''), s.time].filter(Boolean).join(' · ')
