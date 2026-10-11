// What the mod adds to the conversation, as plain values: a summary line under a tool row,
// test results, callouts, the spinner's words and a turn's receipt. register.tsx draws them per surface.

import type { TurnLog } from '../types'

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
    const n = (w: string) => Number(lastMatch(t, new RegExp(`^[ \\t]*(\\d+) ${w}$`, 'gm'))?.[1] ?? 0)
    return { passed: n('pass'), failed: n('fail'), skipped: n('skip') }
  }],
  ['vitest', t => {
    const m = lastMatch(t, /^[ \t]*Tests[ \t]{2,}(.+?)[ \t]\((\d+)\)[ \t]*$/gm)
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
    // Top-level tests only: a subtest's line is indented under its parent's.
    const pass = (t.match(/^--- PASS:/gm) ?? []).length
    const fail = (t.match(/^--- FAIL:/gm) ?? []).length
    const skip = (t.match(/^--- SKIP:/gm) ?? []).length
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
  // The open fence's character and length: it closes on a bare run of the same, at least as long.
  let fence: { ch: string; n: number } | undefined
  const flush = () => {
    if (text.length) out.push({ kind: 'md', text: text.join('\n') })
    text = []
  }
  const lines = md.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const f = line.match(/^\s*(```+|~~~+)(.*)$/)
    if (f) {
      const run = f[1]!
      if (!fence) fence = { ch: run[0]!, n: run.length }
      else if (run[0] === fence.ch && run.length >= fence.n && !f[2]!.trim()) fence = undefined
    }
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
  thinking: ['กำลังคิด', 'ขอคิดแป๊บนึงนะ', 'กำลังเรียบเรียง', 'กำลังวางแผน'],
  requesting: ['กำลังส่งคำขอ', 'รอคำตอบสักครู่'],
  'tool-input': ['กำลังเตรียมคำสั่ง'],
  'tool-use': ['กำลังลงมือทำ', 'กำลังจัดการให้', 'กำลังทำงาน'],
  responding: ['กำลังเขียนคำตอบ', 'กำลังสรุปให้', 'กำลังพิมพ์คำตอบ'],
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

const lines = (text: string) => {
  const t = clean(text).replace(/\s+$/, '')
  return t ? t.split('\n') : []
}

const parts = (path: string) => path.split(/[\\/]/).filter(Boolean)
const basename = (path: string) => parts(path).pop() ?? path
// A file's folder for a detail line: its last two parts, cut from the left.
const folderOf = (path: string) => {
  const dirs = parts(path).slice(0, -1)
  if (!dirs.length) return ''
  return dirs.length > 2 ? `…/${dirs.slice(-2).join('/')}/` : `${dirs.join('/')}/`
}
const firstLine = (text: string) => clean(text).split('\n').map(l => l.trim()).find(Boolean) ?? ''
const sentence = (text: string) => (text ? text[0]!.toUpperCase() + text.slice(1) : text)
// A command's own words, past the `cd … &&` that only moves to where it runs.
const bare = (command: string) => command.replace(/^(?:cd\s+(?:"[^"]*"|'[^']*'|\S+)\s*&&\s*)+/, '')
// The first line of an error worth reading: past "Exit code n" and the tool's error tags.
const errorLine = (text: string) =>
  firstLine(text.replace(/<\/?tool_use_error>/g, '').split('\n').filter(l => !/^Exit code \d+$/.test(l.trim())).join('\n'))
// Commands that run tests: only their output is read for counts.
// Whether a command runs tests.
export const isTestCommand = (command: string) => TEST_COMMAND.test(command)
const TEST_COMMAND = /(?:^|[\s;&|(])(?:(?:bun|npm|pnpm|yarn)\s+(?:run\s+)?test\b|bunx?\s+test\b|(?:npx\s+|bunx\s+)?(?:jest|vitest)\b|(?:python3?\s+-m\s+)?pytest\b|cargo\s+(?:nextest\s+)?test\b|go\s+test\b|claude\s+plugin\s+test\b)/

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

// The lines an edit changed, from what was asked of it: lines both sides share at the start
// and end are context, not change.
function asked(oldText: string, newText: string): Hunk2 {
  const a = lines(oldText)
  const b = lines(newText)
  let head = 0
  while (head < a.length && head < b.length && a[head] === b[head]) head++
  let tail = 0
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++
  return { lines: [...a.slice(head, a.length - tail).map(l => `-${l}`), ...b.slice(head, b.length - tail).map(l => `+${l}`)] }
}

// The step a tool row shows, or nothing for a tool it does not know.
export function stepOf(c: Call): Step | undefined {
  const input = (c.input ?? {}) as { command?: string; description?: string; file_path?: string; old_string?: string; new_string?: string; replace_all?: boolean; content?: string; offset?: number; limit?: number }
  const out = c.output as { stdout?: string; stderr?: string; backgroundTaskId?: string; type?: string; content?: string; structuredPatch?: Hunk2[]; file?: { startLine?: number; numLines?: number; totalLines?: number } } | undefined
  // A slow run earns a tortoise.
  const time = c.isRunning || c.durationMs === undefined ? undefined : `${c.durationMs >= 30_000 ? '🐢 ' : ''}${seconds(c.durationMs)}`
  const timed = time ? { time } : {}
  const error = c.isErrored && typeof c.output === 'string' ? errorLine(c.output) : ''
  const running: Part[] = [{ text: 'running…', tone: 'muted' }]
  if (c.tool === 'Bash') {
    const command = bare(firstLine(input.command ?? ''))
    const description = firstLine(input.description ?? '')
    const title = description ? sentence(description) : command
    const detail = description ? `$ ${command}` : ''
    const said = typeof c.output === 'string' ? c.output : `${out?.stdout ?? ''}\n${out?.stderr ?? ''}`
    const tests = c.tests && !c.isRunning && TEST_COMMAND.test(input.command ?? '') ? testResult(said) : undefined
    const icon: StepIcon = tests ? 'flask' : 'terminal'
    const base = { icon, title, detail, ...timed }
    if (c.isRunning) return { ...base, tone: 'muted', result: running }
    if (c.isInterrupted) return { ...base, icon: 'stop', tone: 'muted', result: [{ text: 'interrupted', tone: 'muted' }] }
    if (out?.backgroundTaskId) return { ...base, tone: 'muted', result: [{ text: 'in the background', tone: 'muted' }] }
    const meter = tests ? { good: tests.passed, bad: tests.failed } : undefined
    if (tests && tests.failed > 0)
      return { ...base, tone: 'bad', result: [{ text: `✗ ${tests.failed} of ${tests.passed + tests.failed} failed`, tone: 'bad' }], meter }
    const exit = typeof c.output === 'string' ? c.output.match(/^Exit code (\d+)/)?.[1] : undefined
    if (c.isErrored) return { ...base, ...(error ? { detail: error } : {}), tone: 'bad', result: [{ text: exit ? `✗ exit ${exit}` : '✗ failed', tone: 'bad' }] }
    if (tests) {
      const skipped: Part[] = tests.skipped ? [{ text: ` · ${tests.skipped} skipped`, tone: 'muted' }] : []
      return { ...base, tone: 'ok', result: [{ text: `✓ ${tests.passed} passed`, tone: 'ok' }, ...skipped], meter }
    }
    return { ...base, tone: 'ok', result: [{ text: '✓ done', tone: 'ok' }] }
  }
  const path = clean(input.file_path ?? '')
  if (!path) return undefined
  const name = basename(path)
  const where = { detail: folderOf(path), ...timed }
  const verb = { Edit: ['Editing', 'Edit', 'Edited'], Write: ['Writing', 'Write', 'Wrote'], Read: ['Reading', 'Read', 'Read'] }[c.tool as 'Edit' | 'Write' | 'Read']
  if (!verb) return undefined
  const icon: StepIcon = c.tool === 'Edit' ? 'pen' : c.tool === 'Write' ? 'file' : 'read'
  const tone: Tone = c.tool === 'Read' ? 'read' : 'edit'
  if (c.isRunning) return { icon, tone, title: `${verb[0]} ${name}`, ...where, result: running }
  if (c.isInterrupted) return { icon: 'stop', tone: 'muted', title: `${verb[1]} ${name}`, ...where, result: [{ text: 'interrupted', tone: 'muted' }] }
  if (c.isErrored) return { icon, tone: 'bad', title: `${verb[1]} ${name}`, ...where, ...(error ? { detail: error } : {}), result: [{ text: '✗ failed', tone: 'bad' }] }
  const counted = (n: number) => `${n} line${n === 1 ? '' : 's'}`
  if (c.tool === 'Edit') {
    const patch = out?.structuredPatch ?? (input.new_string !== undefined ? [asked(input.old_string ?? '', input.new_string)] : undefined)
    const result = patch ? changes(patch) : []
    const every = input.replace_all && !out?.structuredPatch
    const all = (patch ?? []).flatMap(h => h.lines)
    const meter = { good: all.filter(l => l.startsWith('+')).length, bad: all.filter(l => l.startsWith('-')).length }
    return {
      icon, tone, title: `Edited ${name}`, ...where,
      result: every ? [...result, { text: ' · every match', tone: 'muted' }] : result,
      ...(!every && meter.good + meter.bad ? { meter } : {}),
    }
  }
  if (c.tool === 'Write') {
    if (out?.type === 'create') return { icon, tone: 'ok', title: `Created ${name}`, ...where, result: [{ text: counted(lines(out.content ?? '').length), tone: 'ok' }] }
    if (out?.structuredPatch) return { icon, tone, title: `Wrote ${name}`, ...where, result: changes(out.structuredPatch) }
    return { icon, tone, title: `Wrote ${name}`, ...where, result: input.content === undefined ? [] : [{ text: counted(lines(input.content).length), tone }] }
  }
  const f = out?.type === 'text' ? out.file : undefined
  const total = f?.totalLines ?? 0
  const start = f?.startLine ?? 1
  const n = f?.numLines ?? 0
  const from = Math.max(1, input.offset ?? 1)
  const askedFor = input.limit ? `lines ${from}–${from + input.limit - 1}` : input.offset ? `from line ${from}` : 'whole file'
  const range = out?.type && out.type !== 'text' ? out.type : !f || total === 0 ? askedFor : start <= 1 && n >= total ? counted(total) : `lines ${start}–${start + Math.max(n, 1) - 1} of ${total}`
  return { icon, tone, title: `Read ${name}`, ...where, result: [{ text: range, tone: 'muted' }] }
}

// A step in words, without its marks: a drawing's alt text, for a reader that cannot see it.
export function stepText(s: Step): string {
  const said = s.result.map(p => p.text).join('')
  const words = said.startsWith('✓ ') ? said.slice(2) : said.startsWith('✗ ') ? (/fail/.test(said) ? said.slice(2) : `failed, ${said.slice(2)}`) : said
  return [s.title, s.detail, words, s.time?.replace(/^\p{Extended_Pictographic}\s*/u, '')].filter(Boolean).join(', ')
}

// A command that only reads: each part of a chain is a reader, and nothing is written to a file.
const READERS = /^(?:cat|head|tail|less|more|grep|rg|ls|find|wc|tree|pwd|which|file|stat|du|df|git\s+(?:status|log|diff|show|branch|blame|rev-parse|remote))\b/
export function isReadOnly(command: string): boolean {
  if (/[^>]>[^&]|>>|\btee\b|\s-i\b/.test(command)) return false
  return bare(command).split(/&&|\|\||;|\|/).map(p => p.trim()).filter(Boolean).every(p => READERS.test(p))
}

export const EMPTY_LOG: TurnLog = { files: {}, commands: 0, failed: 0 }

export type Logged =
  | { tool: 'Edit'; path: string; oldText: string; newText: string; times?: number }
  | { tool: 'Write'; path: string; content: string }
  | { tool: 'Bash'; command: string; output: string; isError: boolean; at: number; readOnly?: boolean }

// One finished call of the main turn folded into its log: a file's added and removed lines, a
// command and whether it failed, and the counts of the last command that ran tests.
export function logged(log: TurnLog, c: Logged): TurnLog {
  if (c.tool === 'Bash') {
    const tests = TEST_COMMAND.test(c.command) ? testResult(c.output) : undefined
    const read = c.readOnly && !c.isError
    return {
      ...log,
      commands: log.commands + (read ? 0 : 1),
      reads: (log.reads ?? 0) + (read ? 1 : 0),
      failed: log.failed + (c.isError ? 1 : 0),
      ...(tests ? { test: { passed: tests.passed, failed: tests.failed, at: c.at } } : {}),
    }
  }
  const was = log.files[c.path] ?? { added: 0, removed: 0 }
  const change = c.tool === 'Edit' ? asked(c.oldText, c.newText).lines : lines(c.content).map(l => `+${l}`)
  const times = c.tool === 'Edit' ? (c.times ?? 1) : 1
  const added = change.filter(l => l.startsWith('+')).length * times
  const removed = change.filter(l => l.startsWith('-')).length * times
  return { ...log, files: { ...log.files, [c.path]: { added: was.added + added, removed: was.removed + removed } } }
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export type Receipt = {
  tone: Tone
  headline: string
  files?: { count: number; added: number; removed: number }
  test?: { passed: number; failed: number }
  commands?: { count: number; failed: number }
}

// What a turn did, for its receipt, with a headline and tone for how it went; nothing for a turn
// that changed, tested and ran nothing.
export function receiptOf(log: TurnLog): Receipt | undefined {
  const all = Object.values(log.files)
  const files = all.length ? { count: all.length, added: all.reduce((n, f) => n + f.added, 0), removed: all.reduce((n, f) => n + f.removed, 0) } : undefined
  const test = log.test ? { passed: log.test.passed, failed: log.test.failed } : undefined
  // Reads count only beside real work: a turn of `cat` and `grep` alone did nothing to receipt.
  const reads = files || test ? (log.reads ?? 0) : 0
  const commands = log.commands + reads ? { count: log.commands + reads, failed: log.failed } : undefined
  if (!files && !test && !commands) return undefined
  const [tone, headline]: [Tone, string] =
    test && test.failed > 0 ? ['bad', 'Tests failing']
    : log.failed > 0 ? ['warn', `${plural(log.failed, 'command')} failed`]
    : test ? ['ok', 'All green']
    : ['edit', 'Done']
  return { tone, headline, ...(files ? { files } : {}), ...(test ? { test } : {}), ...(commands ? { commands } : {}) }
}

// The turn's receipt in one line, or nothing for a turn that changed, tested and ran nothing.
export function receiptText(log: TurnLog): string | undefined {
  const r = receiptOf(log)
  if (!r) return undefined
  const parts: string[] = []
  if (r.files) parts.push(`✎ ${plural(r.files.count, 'file')} +${r.files.added} −${r.files.removed}`)
  if (r.test) parts.push(r.test.failed ? `✗ ${r.test.failed} of ${r.test.passed + r.test.failed} failed` : `✓ ${r.test.passed} passed`)
  if (r.commands) parts.push(`› ${plural(r.commands.count, 'command')}${r.commands.failed ? `, ${r.commands.failed} failed` : ''}`)
  return parts.join(' · ')
}
