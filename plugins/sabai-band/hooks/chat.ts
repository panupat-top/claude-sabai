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
