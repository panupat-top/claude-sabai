// What the mod adds to the conversation, as plain values: a summary line under a tool row,
// test results, callouts and the spinner's words. register.tsx draws them per surface.

export type Tone = 'text' | 'muted' | 'ok' | 'bad' | 'warn'
export type Part = { text: string; tone: Tone }
export type LogoKind =
  | 'git' | 'bun' | 'npm' | 'pnpm' | 'nodejs' | 'deno' | 'python' | 'rust'
  | 'golang' | 'docker' | 'typescript' | 'playwright' | 'mocha' | 'jest' | 'bash'
export type Mark = 'pencil' | 'file-added' | 'eye' | 'terminal' | 'stop' | LogoKind
export type Line = { mark: Mark; parts: Part[]; bar?: Tone[] }

// A Bash call this quick that succeeded gets no line: it would only add noise.
const QUIET_MS = 1000

export function seconds(ms: number): string {
  const s = ms / 1000
  if (s < 10) return `${s.toFixed(1)}s`
  if (s < 60) return `${Math.floor(s)}s`
  return `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`
}

export function bashLine(p: { isErrored: boolean; isInterrupted: boolean; durationMs?: number; mark?: Mark }): Line | undefined {
  const time = p.durationMs === undefined ? undefined : seconds(p.durationMs)
  if (p.isInterrupted) return { mark: 'stop', parts: [{ text: 'interrupted', tone: 'muted' }] }
  const mark = p.mark ?? 'terminal'
  if (p.isErrored) return { mark, parts: [{ text: '✗ failed', tone: 'bad' }, ...(time ? [{ text: ` · ${time}`, tone: 'muted' as const }] : [])] }
  if (p.durationMs === undefined || p.durationMs < QUIET_MS) return undefined
  return { mark, parts: [{ text: '✓', tone: 'ok' }, { text: ` ${time}`, tone: 'muted' }] }
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
