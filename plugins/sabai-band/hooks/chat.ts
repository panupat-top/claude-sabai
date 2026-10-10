// What the mod adds to the conversation, as plain values: a summary line under a tool row,
// test results, callouts and the spinner's words. register.tsx draws them per surface.

export type Tone = 'text' | 'muted' | 'ok' | 'bad' | 'warn' | 'edit' | 'read'
export type Part = { text: string; tone: Tone }
export type LogoKind =
  | 'git' | 'bun' | 'npm' | 'pnpm' | 'nodejs' | 'deno' | 'python' | 'rust'
  | 'golang' | 'docker' | 'typescript' | 'playwright' | 'mocha' | 'jest' | 'bash'
export type Mark = 'pencil' | 'file-added' | 'eye' | 'terminal' | 'stop' | LogoKind
export type Status = 'ok' | 'bad' | 'stop' | 'party'
export type Line = { mark: Mark; status?: Status; parts: Part[]; bar?: Tone[] }

// A line's status as a glyph, for the terminal and for a drawing's alt text.
export const STATUS_GLYPH: Record<Status, string> = { ok: '✓', bad: '✗', stop: '⏹', party: '🎉' }

export const lineText = (line: Line | undefined) =>
  line ? [line.status && STATUS_GLYPH[line.status], line.parts.map(p => p.text).join('')].filter(Boolean).join(' ') : ''

export function seconds(ms: number): string {
  const s = ms / 1000
  if (s < 10) return `${s.toFixed(1)}s`
  if (s < 60) return `${Math.floor(s)}s`
  return `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`
}

export function bashLine(p: { isErrored: boolean; isInterrupted: boolean; durationMs?: number; mark?: Mark }): Line {
  const time = p.durationMs === undefined ? undefined : seconds(p.durationMs)
  const mark = p.mark ?? 'terminal'
  if (p.isInterrupted) return { mark, status: 'stop', parts: [{ text: 'interrupted', tone: 'muted' }] }
  if (p.isErrored) return { mark, status: 'bad', parts: [{ text: 'failed', tone: 'bad' }, ...(time ? [{ text: ` · ${time}`, tone: 'muted' as const }] : [])] }
  return { mark, status: 'ok', parts: [{ text: time ?? 'done', tone: 'muted' }] }
}

const BAR_CELLS = 10

// Cells for a split of two counts, the first in `toneA`; a side that is not zero keeps a cell.
function split(a: number, b: number, toneA: Tone, toneB: Tone): Tone[] {
  let cellsA = Math.round((BAR_CELLS * a) / (a + b))
  if (a > 0 && cellsA === 0) cellsA = 1
  if (b > 0 && cellsA === BAR_CELLS) cellsA = BAR_CELLS - 1
  return [...Array<Tone>(cellsA).fill(toneA), ...Array<Tone>(BAR_CELLS - cellsA).fill(toneB)]
}

export function editLine(patch: { lines: string[] }[]): Line | undefined {
  const lines = patch.flatMap(h => h.lines)
  const added = lines.filter(l => l.startsWith('+')).length
  const removed = lines.filter(l => l.startsWith('-')).length
  if (added + removed === 0) return undefined
  const parts: Part[] = [
    { text: `+${added}`, tone: 'ok' },
    { text: ` −${removed}`, tone: 'bad' },
  ]
  if (patch.length > 1) parts.push({ text: ` · ${patch.length} hunks`, tone: 'muted' })
  return { mark: 'pencil', parts, bar: split(added, removed, 'ok', 'bad') }
}

export function writeLine(out: { type: 'create' | 'update'; content: string; structuredPatch: { lines: string[] }[] }): Line | undefined {
  if (out.type === 'update') return editLine(out.structuredPatch)
  const count = out.content.replace(/\n$/, '').split('\n').length
  return { mark: 'file-added', parts: [{ text: 'new file', tone: 'ok' }, { text: ` · ${count} line${count === 1 ? '' : 's'}`, tone: 'muted' }] }
}

export function readLine(out: unknown): Line | undefined {
  const o = out as { type?: string; file?: { startLine?: number; numLines?: number; totalLines?: number } } | undefined
  if (o?.type !== 'text' || !o.file) return undefined
  const { startLine = 1, numLines = 0, totalLines = 0 } = o.file
  if (totalLines === 0) return undefined
  if (startLine <= 1 && numLines >= totalLines) return { mark: 'eye', parts: [{ text: `all ${totalLines} lines`, tone: 'text' }] }
  return { mark: 'eye', parts: [{ text: `lines ${startLine}–${startLine + numLines - 1}`, tone: 'text' }, { text: ` of ${totalLines}`, tone: 'muted' }] }
}

// Words that only run the real command, and the logo each real command wears.
const RUNNERS = new Set(['sudo', 'time', 'npx', 'bunx', 'exec', 'nice', 'env'])
const LOGO_OF: Record<string, LogoKind> = {
  git: 'git', bun: 'bun', npm: 'npm', pnpm: 'pnpm', node: 'nodejs', deno: 'deno',
  python: 'python', python3: 'python', pip: 'python', pip3: 'python', pytest: 'python', uv: 'python',
  cargo: 'rust', rustc: 'rust', go: 'golang', docker: 'docker', tsc: 'typescript',
  playwright: 'playwright', mocha: 'mocha', jest: 'jest',
}

// The command a Bash call runs, past `cd … &&`, env assignments and runners like sudo or npx.
export function commandOf(command: string): string {
  const first = command.split(/&&|\|\||;/).map(s => s.trim()).find(s => s && !/^cd\s/.test(s)) ?? ''
  const words = first.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? []
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w) || RUNNERS.has(w)) continue
    if (w === 'pnpm' && (words[i + 1] === 'dlx' || words[i + 1] === 'exec')) {
      i++
      continue
    }
    return w.split('/').pop()!
  }
  return ''
}

export const logoOf = (command: string): LogoKind => LOGO_OF[commandOf(command)] ?? 'bash'

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

const RUNNER_LOGO: Partial<Record<TestRunner, LogoKind>> = { bun: 'bun', jest: 'jest', pytest: 'python', cargo: 'rust', go: 'golang' }

export function testLine(r: { runner: TestRunner } & Counts, durationMs?: number): Line {
  const mark = RUNNER_LOGO[r.runner] ?? 'terminal'
  const time: Part[] = durationMs === undefined ? [] : [{ text: ` · ${seconds(durationMs)}`, tone: 'muted' }]
  if (r.failed === 0) return { mark, status: 'party', parts: [{ text: `all ${r.passed} passed`, tone: 'ok' }, ...time], bar: Array<Tone>(BAR_CELLS).fill('ok') }
  const skipped: Part[] = r.skipped ? [{ text: ` · ${r.skipped} skipped`, tone: 'muted' }] : []
  return { mark, status: 'bad', parts: [{ text: `${r.failed} of ${r.passed + r.failed} failed`, tone: 'bad' }, ...skipped, ...time], bar: split(r.passed, r.failed, 'ok', 'bad') }
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
