# Agents Pane Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the sabai-band agents pane with a summary strip, characterful per-agent cards (a hat by type, an effort label, own-task progress), collapsible groups, Clear and per-agent results. Also fix the subagent task-routing bug and the pane's size blow-up.

**Architecture:**
- Pure reducers and helpers in `hooks/agents.ts` extend `AgentRun`.
- `hooks/sprites.ts` merges pixel runs and adds hats.
- `hooks/svg.ts` draws one summary SVG plus one SVG per card.
- `hooks/register.tsx` captures the new engine data and renders the pane on desktop (images plus native Buttons) and terminal (text).

**Tech Stack:** TypeScript/TSX on Claude Code's function-hooks mod API (`claude-code`, `claude-code/testing`); no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-10-agents-pane-design.md`

## Global Constraints

- Everything shown comes from the engine; a value it cannot give is hidden, never estimated or faked. No cost.
- A pane's whole drawn tree must stay under 100,000 characters; an `Svg` source ≤ 131,072 characters, width/height 1–4096.
- A desktop `Button` shows its `label` alone (no children, colours or hover), cannot hold an `Svg`, and sits on its own line under an image.
- `$` cannot cross an import: any helper taking `$` lives in `register.tsx`.
- Every text colour ≥ 4.5:1 on its card. Use the stylesheet classes `t`, `m` and `c-<kind>`, which every skin already makes legible.
- User-visible text in English; code comments in English, only for a non-obvious why.
- Commands, run from `plugins/sabai-band`:
  - `claude plugin test .` runs every test, with no per-test filter. Read the `(pass)` / `(fail)` lines.
  - `tsc -p .` type-checks.
  - `claude plugin validate .` validates.
- Commit after each task with an imperative subject and the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **A run created before this change (hot reload keeps atoms):** it has no `tasks` or `effort`. The card must draw with `steps` and no label, not crash. Task 2 tests a run without `tasks`.
- **A very long result (a multi-kB agent report):** it is cut to 600 characters with `…`, so the pane stays under the tree limit. Task 2 tests truncation; Task 6 tests 40 runs with results open.
- **A subagent and the main conversation both keep task lists at once:** neither overwrites the other. Task 4 tests both directions.
- **An agent whose `turn.complete` arrives with no `answer`:** Result shows "No report.", never an empty block. Task 2 tests `resultText`.
- **An unknown agent type or effort value (custom agents, numeric effort):** the type gets the beanie with the muted colour and the label is omitted. Task 2 tests both.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `types/index.d.ts` | modify | `AgentRun` gains `effort?`, `tasks?`, `result?`, `reason?`; `PluginState` gains `finishedOpen`, `openResults` |
| `hooks/sprites.ts` | modify | run-merged rects; `HatKind`, hats; `hop` and `dizzy` modes |
| `hooks/agents.ts` | modify | `stepped` (effort), `finished` (reason, answer), `withTasks`, `taskLine`, `effortLabel`, `typeStyle`, `summary`, `clearFinished`, `resultText` |
| `hooks/svg.ts` | modify | `summarySvg`, `agentCardSvg`, `emptyAgentsSvg`; remove `agentsSvg` / `agentCard` |
| `hooks/register.tsx` | modify | task routing by `agentId`; effort, answer and reason capture; two atoms; pane render; handlers |
| `tests/sprites.test.ts` | create | merged sprite pixels, hats |
| `tests/agents.test.ts` | modify | reducers and helpers, card and summary drawings |
| `tests/band.test.tsx` | modify | routing, results, Hide/Show, Clear, empty state, size |
| `README.md`, `docs/PLAN.md` | modify | describe the new pane |

---

### Task 1: Run-merged sprites with hats, hop and dizzy

**Files:**
- Modify: `plugins/sabai-band/hooks/sprites.ts`
- Create: `plugins/sabai-band/tests/sprites.test.ts`

**Interfaces:**
- Produces:
  - `export type HatKind = 'explorer' | 'hardhat' | 'cap' | 'grad' | 'beanie'`
  - `export const HAT_H = 4`
  - `sprite(kind: SpriteKind, x: number, y: number, mode?: '' | 'run' | 'idle' | 'hop' | 'dizzy', tint?: string, hat?: { kind: HatKind; color?: string }): string`

  The hat is drawn above the sprite, at y = -HAT_H, in the sprite's own pixels. With no `color` it takes `class="m"`. The output keeps the exact prefix `<g transform="translate(X,Y)" shape-rendering="crispEdges" class="MODE">`, since the existing band tests match it.

- [ ] **Step 1: Write the failing test** — `tests/sprites.test.ts`

```ts
import { expect, test } from 'claude-code/testing'

import { HAT_H, sprite } from '../hooks/sprites'

// Every drawn pixel of a sprite, keyed "x,y", valued by its fill.
const pixels = (svg: string) => {
  const out = new Map<string, string>()
  for (const m of svg.matchAll(/<rect x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)" (?:fill="([^"]+)"|class="([^"]+)")\/>/g)) {
    const [x, y, w, h] = [m[1], m[2], m[3], m[4]].map(Number) as [number, number, number, number]
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) out.set(`${x + i},${y + j}`, m[5] ?? m[6]!)
  }
  return out
}

test('Clawd draws the same 256 pixels from merged runs, far smaller than one rect each', () => {
  const svg = sprite('tasks', 0, 0, 'idle', '#ff0000')
  const px = pixels(svg)
  expect(px.size).toBe(256)
  expect(['6,2', '7,2', '16,2', '17,3'].map(k => px.get(k))).toEqual(['#1F1E1D', '#1F1E1D', '#1F1E1D', '#1F1E1D'])
  expect(px.get('0,4')).toBe('#ff0000')
  expect(svg.length).toBeLessThan(4000)
  expect(svg).toContain('shape-rendering="crispEdges" class="idle"')
})

test('each hat sits above Clawd in its colour, or muted without one', () => {
  for (const kind of ['explorer', 'hardhat', 'cap', 'grad', 'beanie'] as const) {
    const hat = [...pixels(sprite('tasks', 0, 0, 'run', undefined, { kind, color: '#00ff00' }))].filter(([k]) => Number(k.split(',')[1]) < 0)
    expect(hat.length).toBeGreaterThan(8)
    expect(hat.every(([k, v]) => v === '#00ff00' && Number(k.split(',')[1]) >= -HAT_H)).toBe(true)
  }
  expect(sprite('tasks', 0, 0, '', undefined, { kind: 'beanie' })).toContain('class="m"')
})

test('a failed Clawd shuts its eyes: the lower eye row takes the body colour', () => {
  const px = pixels(sprite('tasks', 0, 0, 'dizzy', '#ff0000'))
  expect([px.get('6,2'), px.get('6,3')]).toEqual(['#1F1E1D', '#ff0000'])
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `claude plugin test .`
Expected: the three new tests FAIL. The first fails because the svg is longer than 4000 characters; the others fail on the extra `hat` argument and the `dizzy` mode.

- [ ] **Step 3: Implement** in `hooks/sprites.ts`. Replace `sprite()` and append to `SPRITE_CSS`:

```ts
export type HatKind = 'explorer' | 'hardhat' | 'cap' | 'grad' | 'beanie'
export const HAT_H = 4

// Hats for the agents pane, 24 wide like Clawd and HAT_H rows tall, drawn just above him.
const HATS: Record<HatKind, string[]> = {
  explorer: ['........................', '......hhhhhhhhhhhh......', '......hhhhhhhhhhhh......', '..hhhhhhhhhhhhhhhhhhhh..'],
  hardhat: ['........................', '.......hhhhhhhhhh.......', '......hhhhhhhhhhhh......', '....hhhhhhhhhhhhhhhh....'],
  cap: ['........................', '......hhhhhhhhhh........', '......hhhhhhhhhh........', '......hhhhhhhhhhhhhhhh..'],
  grad: ['..hhhhhhhhhhhhhhhhhhhh..', '.......hhhhhhhhhh..h....', '.......hhhhhhhhhh..h....', '........................'],
  beanie: ['...........hh...........', '.........hhhhhh.........', '.......hhhhhhhhhh.......', '......hhhhhhhhhhhh......'],
}

// Rows of colour keys as rects, a run of one key in a row merged into one rect, grouped by class
// so one animation moves a part together. `paint` gives a key's fill, or a class when it has none.
function draw(rows: string[], px: number, y0: number, paint: (ch: string) => { fill?: string; cls?: string; group?: string } | undefined) {
  const groups = new Map<string, string[]>()
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; ) {
      const ch = row[c]!
      let end = c + 1
      while (end < row.length && row[end] === ch) end++
      const p = paint(ch)
      if (p) {
        const look = p.fill ? `fill="${p.fill}"` : `class="${p.cls}"`
        const rect = `<rect x="${c * px}" y="${(y0 + r) * px}" width="${(end - c) * px}" height="${px}" ${look}/>`
        groups.set(p.group ?? '', [...(groups.get(p.group ?? '') ?? []), rect])
      }
      c = end
    }
  })
  return [...groups].map(([g, rects]) => (g ? `<g class="${g}">${rects.join('')}</g>` : rects.join(''))).join('')
}

// `mode`: `run` walks, `idle` blinks, `hop` jumps twice (a finished agent), `dizzy` shuts the
// eyes (a failed one). `tint` repaints Clawd's body; `hat` sits on top and moves with the body.
export function sprite(kind: SpriteKind, x: number, y: number, mode = '', tint?: string, hat?: { kind: HatKind; color?: string }): string {
  const { rows, classes = {}, px = PX } = SPRITES[kind]
  const colors = tint && kind === 'tasks' ? { ...SPRITES[kind].colors, o: tint, l: tint, n: tint } : SPRITES[kind].colors
  // Shut eyes: the lower of the two eye rows is painted as body.
  const body = mode === 'dizzy' && kind === 'tasks' ? rows.map((r, i) => (i === 3 ? r.replace(/k/g, 'o') : r)) : rows
  const art =
    (hat ? draw(HATS[hat.kind], px, -HAT_H, ch => (ch === 'h' ? { fill: hat.color, cls: 'm', group: 'bd' } : undefined)) : '') +
    draw(body, px, 0, ch => (colors[ch] ? { fill: colors[ch], group: classes[ch] } : undefined))
  return `<g transform="translate(${x},${y})" shape-rendering="crispEdges"${mode ? ` class="${mode}"` : ''}>${art}</g>`
}
```

Append to `SPRITE_CSS`:

```ts
  '.hop g{animation:hop .45s ease-out 2}@keyframes hop{50%{transform:translateY(-3px)}}'
```

Delete the old per-pixel loop that `draw` replaces.

- [ ] **Step 4: Run all tests and type-check**

Run: `claude plugin test . && tsc -p .`
Expected: every test passes, including the existing band tests that match `shape-rendering="crispEdges" class="run"` and `class="idle"`. `tsc` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add plugins/sabai-band/hooks/sprites.ts plugins/sabai-band/tests/sprites.test.ts
git commit -m "Merge sprite pixel runs and add hats, hop and dizzy modes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Agent model: fields, reducers and helpers

**Files:**
- Modify: `plugins/sabai-band/types/index.d.ts` (`AgentRun`)
- Modify: `plugins/sabai-band/hooks/agents.ts`
- Modify: `plugins/sabai-band/tests/agents.test.ts`

**Interfaces:**
- Consumes: `HatKind` from Task 1; `Task`; `Progress` from `hooks/model.ts`.
- Produces:
  - `AgentRun` gains `effort?: string; tasks?: Task[]; result?: string; reason?: 'answer' | 'aborted' | 'refusal' | 'error'`.
  - `stepped(list, agentId, model, u, effort?: string | number): AgentRun[]`
  - `finished(list, agentId, reason: 'answer' | 'aborted' | 'refusal' | 'error', at: number, answer?: string): AgentRun[]` replaces the boolean signature.
  - `withTasks(list, agentId, fn: (tasks: Task[]) => Task[]): AgentRun[]`
  - `taskLine(tasks: Task[] | undefined): Progress | undefined`. It includes the all-done case, titled `Done`.
  - `effortLabel(effort?: string): string | undefined`
  - `typeStyle(type: string): { hat: HatKind; accent?: 'tasks' | 'context' | 'session' | 'week' }`
  - `summary(list, now): { running: number; done: number; context: number; ms: number }`
  - `clearFinished(list): AgentRun[]`
  - `resultText(a: AgentRun): string`
  - `RESULT_MAX = 600`

- [ ] **Step 1: Write the failing tests.** In `tests/agents.test.ts`:
  - change the import line to:

    ```ts
    import { RESULT_MAX, clearFinished, clock, effortLabel, elapsed, finished, groups, modelName, resultText, spawned, stepped, summary, taskLine, typeStyle, withTasks } from '../hooks/agents'
    ```

  - change every `finished(list, 'x', true, T)` to `finished(list, 'x', 'answer', T)`, and every `finished(..., false, ...)` to `finished(..., 'error', ...)`;
  - append:

```ts
test('effort and type give a label, a hat and a colour; unknown ones fall back', () => {
  expect(['low', 'medium', 'high', 'xhigh', 'max', '7', undefined].map(effortLabel)).toEqual(['quick', 'steady', 'careful', 'deep', 'deep', undefined, undefined])
  expect(typeStyle('Explore')).toEqual({ hat: 'explorer', accent: 'context' })
  expect(typeStyle('Plan')).toEqual({ hat: 'hardhat', accent: 'session' })
  expect(typeStyle('general-purpose')).toEqual({ hat: 'cap', accent: 'tasks' })
  expect(typeStyle('claude-code-guide')).toEqual({ hat: 'grad', accent: 'week' })
  expect(typeStyle('my-reviewer')).toEqual({ hat: 'beanie' })
})

test('a step records effort; an agent keeps its own task list and line', () => {
  let list = stepped([run('a')], 'a', 'claude-opus-5-5', USAGE, 'high')
  expect(list[0]?.effort).toBe('high')
  list = stepped(list, 'a', '', USAGE)
  expect(list[0]?.effort).toBe('high')
  list = withTasks(list, 'a', () => [
    { id: '1', subject: 'Draft', status: 'completed' },
    { id: '2', subject: 'Hero copy', activeForm: 'Writing hero copy', status: 'in_progress' },
    { id: '3', subject: 'Polish', status: 'pending' },
  ])
  expect(taskLine(list[0]?.tasks)).toEqual({ done: 1, total: 3, title: 'Writing hero copy' })
  expect(taskLine([{ id: '1', subject: 'x', status: 'completed' }])).toEqual({ done: 1, total: 1, title: 'Done' })
  expect(taskLine(undefined)).toBeUndefined()
})

test('a finished run keeps its reason and a cut answer; Result text never comes out empty', () => {
  const long = 'x'.repeat(5000)
  const [done] = finished([run('a')], 'a', 'answer', 9000, long)
  expect([done?.status, done?.reason, done?.result?.length]).toEqual(['done', 'answer', RESULT_MAX])
  expect(done?.result?.endsWith('…')).toBe(true)
  expect(finished([run('b')], 'b', 'refusal', 9000)[0]?.status).toBe('failed')
  expect(resultText(run('c', { status: 'done', reason: 'answer' }))).toBe('No report.')
  expect(resultText(run('d', { status: 'failed', reason: 'aborted' }))).toBe('Stopped before it finished.')
  expect(resultText(run('e', { status: 'failed', reason: 'refusal' }))).toBe('Declined the task.')
  expect(resultText(run('f', { status: 'failed', reason: 'error' }))).toBe('Ended with an error.')
  expect(resultText(run('g', { status: 'done', reason: 'answer', result: 'Found 3.' }))).toBe('Found 3.')
})

test('the summary counts agents, sums context and spans the wall time; Clear keeps running ones', () => {
  const list = [
    run('a', { status: 'done', startedAt: 1000, endedAt: 9000, contextTokens: 40_000 }),
    run('b', { startedAt: 3000, contextTokens: 2_000 }),
  ]
  expect(summary(list, 21_000)).toEqual({ running: 1, done: 1, context: 42_000, ms: 20_000 })
  expect(summary([list[0]!], 21_000).ms).toBe(8000)
  expect(summary([], 21_000)).toEqual({ running: 0, done: 0, context: 0, ms: 0 })
  expect(clearFinished(list).map(a => a.id)).toEqual(['b'])
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `claude plugin test .`
Expected: the four new tests fail on missing exports (or `tsc` reports them).

- [ ] **Step 3: Implement.** In `types/index.d.ts`, replace `AgentRun`:

```ts
// One subagent as the agents pane shows it. `tasks`, `effort`, `result` and `reason` are absent
// on runs from before they were recorded, and while the engine has not said.
export type AgentRun = {
  id: string
  agentId?: string
  type: string
  description: string
  model: string
  status: 'running' | 'done' | 'failed'
  startedAt: number
  endedAt?: number
  contextTokens: number
  steps: number
  effort?: string
  tasks?: Task[]
  result?: string
  reason?: 'answer' | 'aborted' | 'refusal' | 'error'
}
```

In `hooks/agents.ts`:
- change the imports to

  ```ts
  import type { AgentRun, Task } from '../types'
  import type { Progress } from './model'
  import type { HatKind } from './sprites'
  ```

- replace `stepped` and `finished`;
- add the helpers:

```ts
export const stepped = (list: AgentRun[], agentId: string, model: string, u: Usage, effort?: string | number): AgentRun[] =>
  list.map(a =>
    a.agentId !== agentId
      ? a
      : {
          ...a,
          model: model || a.model,
          steps: a.steps + 1,
          contextTokens: u.input_tokens + u.output_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens,
          effort: effort === undefined ? a.effort : String(effort),
        },
  )

export const RESULT_MAX = 600

export const finished = (list: AgentRun[], agentId: string, reason: NonNullable<AgentRun['reason']>, at: number, answer?: string): AgentRun[] =>
  list.map(a =>
    a.agentId !== agentId
      ? a
      : {
          ...a,
          status: reason === 'answer' ? 'done' : 'failed',
          reason,
          endedAt: at,
          result: answer && answer.length > RESULT_MAX ? `${answer.slice(0, RESULT_MAX - 1)}…` : answer || undefined,
        },
  )

export const withTasks = (list: AgentRun[], agentId: string, fn: (tasks: Task[]) => Task[]): AgentRun[] =>
  list.map(a => (a.agentId !== agentId ? a : { ...a, tasks: fn(a.tasks ?? []) }))

// An agent's own progress, the finished case included (unlike the band's row, which leaves).
export function taskLine(tasks: Task[] | undefined): Progress | undefined {
  if (!tasks?.length) return undefined
  const done = tasks.filter(t => t.status === 'completed').length
  const running = tasks.find(t => t.status === 'in_progress')
  const next = tasks.find(t => t.status === 'pending')
  return { done, total: tasks.length, title: running ? (running.activeForm ?? running.subject) : (next?.subject ?? 'Done') }
}

const EFFORT: Record<string, string> = { low: 'quick', medium: 'steady', high: 'careful', xhigh: 'deep', max: 'deep' }
export const effortLabel = (effort?: string): string | undefined => (effort ? EFFORT[effort] : undefined)

const TYPES: Record<string, { hat: HatKind; accent: 'tasks' | 'context' | 'session' | 'week' }> = {
  Explore: { hat: 'explorer', accent: 'context' },
  Plan: { hat: 'hardhat', accent: 'session' },
  'general-purpose': { hat: 'cap', accent: 'tasks' },
  'claude-code-guide': { hat: 'grad', accent: 'week' },
}
export const typeStyle = (type: string): { hat: HatKind; accent?: 'tasks' | 'context' | 'session' | 'week' } => TYPES[type] ?? { hat: 'beanie' }

export function summary(list: AgentRun[], now: number): { running: number; done: number; context: number; ms: number } {
  if (list.length === 0) return { running: 0, done: 0, context: 0, ms: 0 }
  const running = list.filter(a => a.status === 'running').length
  const start = Math.min(...list.map(a => a.startedAt))
  const end = running > 0 ? now : Math.max(...list.map(a => a.endedAt ?? a.startedAt))
  return { running, done: list.length - running, context: list.reduce((n, a) => n + a.contextTokens, 0), ms: Math.max(0, end - start) }
}

export const clearFinished = (list: AgentRun[]): AgentRun[] => list.filter(a => a.status === 'running')

const FAILURE: Record<string, string> = { aborted: 'Stopped before it finished.', refusal: 'Declined the task.', error: 'Ended with an error.' }
export const resultText = (a: AgentRun): string => a.result ?? (a.status === 'failed' ? (FAILURE[a.reason ?? 'error'] ?? 'Ended with an error.') : 'No report.')
```

In `hooks/register.tsx`, update the one `finished` call (inside `turn.complete`) so it type-checks; Task 4 extends it:

```ts
await update($, agents, list => finished(list, agentId, e.reason, at, e.answer))
```

- [ ] **Step 4: Run all tests and type-check**

Run: `claude plugin test . && tsc -p .`
Expected: everything passes.

- [ ] **Step 5: Commit**

```bash
git add plugins/sabai-band/types/index.d.ts plugins/sabai-band/hooks/agents.ts plugins/sabai-band/hooks/register.tsx plugins/sabai-band/tests/agents.test.ts
git commit -m "Record effort, own tasks, results and reasons on agent runs" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Card, summary and empty drawings

**Files:**
- Modify: `plugins/sabai-band/hooks/svg.ts`, replacing `agentCard` / `agentsSvg` and the `HEAD_H` constant with the drawings below
- Modify: `plugins/sabai-band/tests/agents.test.ts`, replacing the old `agentsSvg` tests

**Interfaces:**
- Consumes:
  - Task 1: `sprite(..., hat)`, `HAT_H`
  - Task 2: `typeStyle`, `effortLabel`, `taskLine`, `summary`
  - existing in svg.ts: `lookOf`, `pixelBar`, `svg`, `drawing`, `xml`, `fit`, `fitMono`, `monoWidth`, `SANS`, `MONO`, `PAD`, `GAP`, `BarStyle`
  - `tokens` and `clock` imports, already present
- Produces:
  - `agentCardSvg(a: AgentRun, W: number, now: number, skin?: string, style?: BarStyle): Drawing`. Height `AGENT_H = 64`. The alt is `"<description>: <type>, <model>, <status>, <clock>"`, the format the old drawing used.
  - `summarySvg(list: AgentRun[], W: number, now: number, skin?: string): Drawing`. Height 44.
  - `emptyAgentsSvg(W: number, skin?: string): Drawing`

- [ ] **Step 1: Write the failing tests.**
  - In `tests/agents.test.ts`, change the svg import to:

    ```ts
    import { agentCardSvg, emptyAgentsSvg, summarySvg } from '../hooks/svg'
    ```

  - delete the tests that call `agentsSvg`;
  - append:

```ts
test('a card shows hat, task, clock, effort · type · model, own progress and context', () => {
  const a = run('a', {
    type: 'Plan', effort: 'medium', contextTokens: 39_000, steps: 9,
    tasks: [{ id: '1', subject: 'a', status: 'completed' }, { id: '2', subject: 'Draw', activeForm: 'Drawing', status: 'in_progress' }],
  })
  const d = agentCardSvg(a, 420, 19_000, 'dracula', 'blocks')
  expect(d.height).toBe(64)
  expect(d.source).toContain('>task a<')
  expect(d.source).toContain('>steady<')
  expect(d.source).toContain('Plan · sonnet 5.5')
  expect(d.source).toContain('1/2 · Drawing')
  expect(d.source).toContain('39k ctx')
  expect(d.source).toContain('class="run"')
  expect(d.source).toContain('fill="#bd93f9"')
  expect(d.alt).toBe('task a: Plan, sonnet 5.5, running, 18s')
})

test('without tasks a card counts steps; it hops just after finishing, shuts its eyes on failure', () => {
  const plain = agentCardSvg(run('b', { steps: 14 }), 420, 5000)
  expect(plain.source).toContain('>14 steps<')
  expect(plain.source).not.toContain('steady')
  expect(agentCardSvg(run('c', { status: 'done', endedAt: 4000 }), 420, 5000).source).toContain('class="hop"')
  expect(agentCardSvg(run('c', { status: 'done', endedAt: 4000 }), 420, 60_000).source).toContain('class="idle"')
  expect(agentCardSvg(run('d', { status: 'failed', endedAt: 4000 }), 420, 5000).source).toContain('class="dizzy"')
})

test('the summary reads agents, context and time; the empty drawing invites a first agent', () => {
  const s = summarySvg([run('a', { status: 'done', endedAt: 9000, contextTokens: 40_000 }), run('b', { contextTokens: 2000 })], 420, 21_000)
  expect(s.source).toContain('>1 running · 1 done<')
  expect(s.source).toContain('>42k<')
  expect(s.source).toContain('>20s<')
  expect(emptyAgentsSvg(420).source).toContain('No subagents yet')
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `claude plugin test .`
Expected: the three new tests fail on missing exports.

- [ ] **Step 3: Implement** in `hooks/svg.ts`:
  - add `import { effortLabel, summary, taskLine, typeStyle } from './agents'` beside the existing agents import;
  - add `HAT_H` to the sprites import;
  - remove `HEAD_H`, `agentCard` and `agentsSvg`;
  - add:

```ts
const AGENT_H = 64
const HOP_MS = 3000

// One subagent, a drawing of its own so a Result button can sit under it: Clawd in his type's
// hat, the task and clock, effort · type · model, own progress or steps with the context, and a
// bar in the type's colour (an indeterminate sweep while running with no list).
export function agentCardSvg(a: AgentRun, W: number, now: number, skin = 'auto', style: BarStyle = 'dither'): Drawing {
  const look = lookOf(skin)
  const { hat, accent } = typeStyle(a.type)
  const color = accent ? look.bar(accent, 0) : look.bar('session', 0)
  const textCls = accent ? `c-${accent}` : 'm'
  const right = W - PAD
  const clawd = spriteSize('tasks')
  const textX = PAD + clawd.width + 12
  const mode = a.status === 'running' ? 'run' : a.status === 'failed' ? 'dizzy' : a.endedAt !== undefined && now - a.endedAt < HOP_MS ? 'hop' : 'idle'
  const line = taskLine(a.tasks)
  const effort = effortLabel(a.effort)
  const effortW = effort ? monoWidth(effort, 10) + 12 : 0
  const meta = `${a.type} · ${modelName(a.model)}`
  const mark =
    a.status === 'running'
      ? `<circle class="live" cx="${right - 4}" cy="14" r="3.5" fill="${color}"/>`
      : `<text class="${a.status === 'failed' ? 'c-alert' : 'c-context'}" x="${right}" y="18" text-anchor="end" font-family="${MONO}" font-size="12" font-weight="700">${a.status === 'failed' ? '✗' : '✓'}</text>`
  const markW = 16
  const progressText = line ? `${line.done}/${line.total} · ${line.title}` : `${a.steps} ${a.steps === 1 ? 'step' : 'steps'}`
  const ctx = `${tokens(a.contextTokens)} ctx`
  const barY = 52
  const barW = right - textX
  const bar = line
    ? pixelBar(`sabai-band-agent-${a.id}`, textX, barY, barW, 5, line.done / line.total, color, 0, style)
    : a.status === 'running'
      ? `<defs><clipPath id="sabai-band-sw-${a.id}"><rect x="${textX}" y="${barY}" width="${barW}" height="5" rx="2.5"/></clipPath></defs>` +
        `<rect class="k" x="${textX}" y="${barY}" width="${barW}" height="5" rx="2.5"/>` +
        `<g clip-path="url(#sabai-band-sw-${a.id})"><rect class="sweep" x="${textX - barW * 0.3}" y="${barY}" width="${barW * 0.3}" height="5" fill="${color}"/></g>` +
        `<style>.sweep{animation:sw 1.6s linear infinite}@keyframes sw{to{transform:translateX(${Math.round(barW * 1.3)}px)}}</style>`
      : pixelBar(`sabai-band-agent-${a.id}`, textX, barY, barW, 5, 1, color, 0, style)
  const body =
    `<rect class="p" width="${W}" height="${AGENT_H}" rx="8"/>` +
    sprite('tasks', PAD, 14 + HAT_H, mode, look.clawd, { kind: hat, color: accent ? color : undefined }) +
    `<text class="t" x="${textX}" y="18" font-family="${SANS}" font-size="12.5" font-weight="600">${xml(fit(a.description || a.type, 12.5, Math.max(40, right - textX - 60)))}</text>` +
    `<text class="m" x="${right - markW - 4}" y="18" text-anchor="end" font-family="${MONO}" font-size="11.5" font-weight="500">${clock(elapsed(a, now))}</text>` +
    mark +
    (effort
      ? `<rect x="${textX}" y="24" width="${effortW}" height="14" rx="4" fill="${color}" fill-opacity=".16"/><text class="${textCls}" x="${textX + 6}" y="34" font-family="${MONO}" font-size="10" font-weight="600">${effort}</text>`
      : '') +
    `<text class="m" x="${textX + effortW + (effort ? 6 : 0)}" y="34" font-family="${MONO}" font-size="11">${xml(fitMono(meta, 11, Math.max(40, right - textX - effortW - 6)))}</text>` +
    `<text class="m" x="${textX}" y="47" font-family="${MONO}" font-size="11">${xml(fitMono(progressText, 11, Math.max(40, barW - monoWidth(ctx, 11) - 10)))}</text>` +
    `<text class="m" x="${right}" y="47" text-anchor="end" font-family="${MONO}" font-size="11">${ctx}</text>` +
    bar
  return drawing(look, W, AGENT_H, body, `${a.description || a.type}: ${a.type}, ${modelName(a.model)}, ${a.status}, ${clock(elapsed(a, now))}`)
}

// Three cards: how many agents run and finished, their context together, and the wall time.
export function summarySvg(list: AgentRun[], W: number, now: number, skin = 'auto'): Drawing {
  const look = lookOf(skin)
  const s = summary(list, now)
  const cells = [
    ['AGENTS', s.running > 0 ? `${s.running} running · ${s.done} done` : `${s.done} done`],
    ['CONTEXT', tokens(s.context)],
    ['TIME', clock(s.ms)],
  ] as const
  const cw = (W - GAP * 2) / 3
  const body = cells
    .map(([label, value], i) => {
      const x = i * (cw + GAP)
      return (
        `<rect class="p" x="${x}" y="0" width="${cw}" height="44" rx="8"/>` +
        `<text class="m" x="${x + PAD}" y="16" font-family="${MONO}" font-size="10" font-weight="600" letter-spacing=".08em">${label}</text>` +
        `<text class="t" x="${x + PAD}" y="35" font-family="${SANS}" font-size="14" font-weight="600">${xml(fit(value, 14, cw - PAD * 2))}</text>`
      )
    })
    .join('')
  return drawing(look, W, 44, body, `Agents ${cells[0][1]}; context ${cells[1][1]}; time ${cells[2][1]}`)
}

export function emptyAgentsSvg(W: number, skin = 'auto'): Drawing {
  const look = lookOf(skin)
  const clawd = spriteSize('tasks')
  const body =
    `<rect class="p" width="${W}" height="56" rx="8"/>` +
    sprite('tasks', PAD, 20, 'idle', look.clawd) +
    `<text class="t" x="${PAD + clawd.width + 12}" y="24" font-family="${SANS}" font-size="12.5" font-weight="600">No subagents yet</text>` +
    `<text class="m" x="${PAD + clawd.width + 12}" y="41" font-family="${SANS}" font-size="11.5">${xml(fit('They show here when Claude hands work off — try “explore hooks/ and tests/ in parallel”.', 11.5, W - PAD * 2 - clawd.width - 12))}</text>`
  return drawing(look, W, 56, body, 'No subagents yet. They show here when Claude hands work off.')
}
```

  Make sure `modelName` and `elapsed` stay imported from `./agents` (they already are).

- [ ] **Step 4: Run all tests and type-check**

Run: `claude plugin test . && tsc -p .`
Expected: `tsc` reports `agentsSvg` missing in `register.tsx` and in the band tests. Task 5 replaces that render. For now, keep register compiling by mapping the old call onto the new functions in place:

```ts
// temporary until Task 5: first card only
const first = [...running, ...done][0]
const pane = first ? agentCardSvg(first, Math.max(240, Math.min(4096, Math.round((e.props.bodyColumns || 40) * 8.25))), at, skinName) : emptyAgentsSvg(240, skinName)
```

  Change the band test `a subagent shows running ... then done` to assert the new alt, `'api routes: Explore, sonnet 5.5, done, 1m 4s'`, and drop the `>DONE · 1<` assertion. Then rerun.
Expected: everything passes and `tsc` is clean.

- [ ] **Step 5: Commit**

```bash
git add plugins/sabai-band/hooks/svg.ts plugins/sabai-band/hooks/register.tsx plugins/sabai-band/tests/agents.test.ts plugins/sabai-band/tests/band.test.tsx
git commit -m "Draw agent cards, a summary and an empty state as separate drawings" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Route subagent tasks and capture effort and results

**Files:**
- Modify: `plugins/sabai-band/hooks/register.tsx` (the `tool.call` hooks for TaskCreate / TaskUpdate / TodoWrite; `turn.step`; `turn.complete`; `agent.spawn`)
- Modify: `plugins/sabai-band/tests/band.test.tsx`

**Interfaces:**
- Consumes: Task 2 `withTasks`, `stepped(..., effort)`, `finished(..., reason, at, answer)`.
- Produces: `async function updateTasks($: EngineInterface, agentId: string | undefined, fn: (list: Task[]) => Task[])` in register.tsx.

- [ ] **Step 1: Write the failing tests.** Append to `tests/band.test.tsx`:

```ts
test('a subagent’s own task list goes to its card, never the band; the band keeps the main list', async ($, on) => {
  engine(on)
  panes(on)
  await start($)
  await spawn($, 'scan')
  await $.tool.call({ tool: 'TaskCreate', subject: 'main work', description: '' })
  await $.tool.call({ tool: 'TaskUpdate', taskId: String('main work'.length), status: 'in_progress' })
  await $.tool.call({
    tool: 'TodoWrite',
    agentId: 'agent-scan',
    todos: [
      { content: 'read', status: 'completed', activeForm: 'Reading' },
      { content: 'sum up', status: 'in_progress', activeForm: 'Summing up' },
    ],
  })
  const band = await shown($, 'desktop')
  expect(band.words).toContain('main work')
  expect(band.words).not.toContain('Summing up')
  const ui = await mountPane($, 'desktop')
  const cards = (await ui.findAll({ type: 'Svg' })) as unknown as { props: { source: string } }[]
  expect(cards.some(c => c.props.source.includes('1/2 · Summing up'))).toBe(true)
})

test('a subagent’s answer and failure reason are kept for its Result', async ($, on) => {
  engine(on)
  panes(on)
  await start($)
  await spawn($, 'ok')
  await spawn($, 'bad')
  await $.turn.complete({ turnId: 't1', agentId: 'agent-ok', answer: 'Found 3 launches.', durationMs: 10, isAborted: false, reason: 'answer' })
  await $.turn.complete({ turnId: 't2', agentId: 'agent-bad', answer: '', durationMs: 10, isAborted: true, reason: 'aborted' })
  const ui = await mountPane($, 'desktop')
  await ui.press({ key: 'toggle-finished' })
  await ui.press({ key: 'result-agent-ok' })
  await ui.press({ key: 'result-agent-bad' })
  expect(await ui.find({ type: 'Text', text: 'Found 3 launches.' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Stopped before it finished.' })).toBeDefined()
})
```

  The second test depends on the pane buttons from Task 5. Write it here, expect it to keep failing, and run it again at the end of Task 5.

- [ ] **Step 2: Run them and confirm they fail**

Run: `claude plugin test .`
Expected: the first test fails, because `Summing up` shows in the band and no card has `1/2`. The second fails, because there is no `toggle-finished` button.

- [ ] **Step 3: Implement** in `register.tsx`:
  - import `withTasks` from `./agents`;
  - add `Task` to the `../types` import;
  - add the helper next to `readRepo`:

```ts
// A subagent's task calls build its own list on its card; the main conversation's drive the band.
async function updateTasks($: EngineInterface, agentId: string | undefined, fn: (list: Task[]) => Task[]) {
  if (agentId === undefined) await update($, tasks, fn)
  else await update($, agents, list => withTasks(list, agentId, fn))
}
```

  Replace the three hook bodies' `update($, tasks, ...)` calls:

```ts
if (id !== undefined) await updateTasks($, e.agentId, list => created(list, id, e.subject, e.activeForm))
// TaskUpdate
if ((called.result as BuiltinToolResults['TaskUpdate'] | undefined)?.success) await updateTasks($, e.agentId, list => updated(list, e))
// TodoWrite
if (!called.isError && !called.deny) await updateTasks($, e.agentId, () => fromTodos(e.todos))
```

  In `turn.step`, pass the effort:

```ts
if (agentId && used) await update($, agents, list => stepped(list, agentId, used.model || e.model, used, e.effort))
```

  In `agent.spawn`, add `tasks: []` to the new run. In `turn.complete`, the Task 2 call `finished(list, agentId, e.reason, at, e.answer)` stays.

- [ ] **Step 4: Run tests and type-check**

Run: `claude plugin test . && tsc -p .`
Expected: the routing test passes; only the Result test still fails, and Task 5 fixes it. Every other test passes.

- [ ] **Step 5: Commit**

```bash
git add plugins/sabai-band/hooks/register.tsx plugins/sabai-band/tests/band.test.tsx
git commit -m "Route subagent task calls to their cards and record effort and results" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The pane: groups, Hide/Show, Clear, Result, terminal, size

**Files:**
- Modify: `plugins/sabai-band/types/index.d.ts` (`PluginState`)
- Modify: `plugins/sabai-band/hooks/register.tsx` (atoms; the `Pane` render for `PANE`; `classic.SessionStart` also resets `openResults`)
- Modify: `plugins/sabai-band/tests/band.test.tsx`

**Interfaces:**
- Consumes:
  - Task 2: `groups`, `clearFinished`, `resultText`, `effortLabel`, `taskLine`
  - Task 3: `summarySvg`, `agentCardSvg`, `emptyAgentsSvg`
  - the existing `bar` atom
- Produces: Button keys `toggle-finished`, `clear-finished` and `result-<run id>`; atoms `finishedOpen` and `openResults`.

- [ ] **Step 1: Write the failing tests.** Append to `tests/band.test.tsx`, and replace the old test `an empty panel says there is nothing yet`:

```ts
test('an empty panel invites a first agent on both surfaces', async ($, on) => {
  engine(on)
  panes(on)
  await start($)
  for (const surface of SURFACES) {
    const ui = await mountPane($, surface)
    const words = [...(await ui.findAll({ type: 'Svg' })).map(s => String(s.props.alt)), ...(await ui.findAll({ type: 'Text' })).map(t => t.text)].join(' | ')
    await ui.unmount()
    expect(words).toMatch(/No subagents yet/)
  }
})

test('finished agents start folded; Show, Hide and Clear work and running ones stay', async ($, on) => {
  engine(on)
  panes(on)
  await start($)
  await spawn($, 'live')
  await spawn($, 'old')
  await $.turn.complete({ turnId: 't', agentId: 'agent-old', answer: 'ok', durationMs: 10, isAborted: false, reason: 'answer' })
  const ui = await mountPane($, 'desktop')
  const alts = async () => (await ui.findAll({ type: 'Svg' })).map(s => String(s.props.alt))
  expect((await alts()).some(a => a.startsWith('old:'))).toBe(false)
  expect((await ui.find({ key: 'toggle-finished' }))?.props.label).toBe('▸ Show')
  await ui.press({ key: 'toggle-finished' })
  expect((await alts()).some(a => a.startsWith('old:'))).toBe(true)
  expect((await ui.find({ key: 'toggle-finished' }))?.props.label).toBe('▾ Hide')
  await ui.press({ key: 'clear-finished' })
  expect((await alts()).some(a => a.startsWith('old:'))).toBe(false)
  expect((await alts()).some(a => a.startsWith('live:'))).toBe(true)
  expect(await ui.find({ key: 'clear-finished' })).toBeUndefined()
})

test('the terminal lists the same groups as text with buttons', async ($, on) => {
  engine(on)
  panes(on)
  await start($)
  await spawn($, 'live')
  await spawn($, 'old')
  await $.turn.complete({ turnId: 't', agentId: 'agent-old', answer: 'ok', durationMs: 10, isAborted: false, reason: 'answer' })
  const ui = await mountPane($, 'terminal')
  await ui.press({ key: 'toggle-finished' })
  const text = (await ui.findAll({ type: 'Text' })).map(t => t.text).join(' | ')
  expect(text).toMatch(/RUNNING · 1/)
  expect(text).toMatch(/FINISHED · 1/)
  expect(text).toMatch(/live/)
  expect(text).toMatch(/Explore · sonnet 5\.5/)
  expect(await ui.findAll({ type: 'Svg' })).toHaveLength(0)
})

test('forty agents with results open stay under the engine’s tree limit', async ($, on) => {
  engine(on)
  panes(on)
  await start($)
  for (let i = 0; i < 40; i++) {
    await spawn($, `job ${i}`)
    if (i >= 2) await $.turn.complete({ turnId: `t${i}`, agentId: `agent-job ${i}`, answer: 'r'.repeat(5000), durationMs: 10, isAborted: false, reason: 'answer' })
  }
  const ui = await mountPane($, 'desktop')
  await ui.press({ key: 'toggle-finished' })
  for (const b of await ui.findAll({ type: 'Button' })) if (String(b.props.key).startsWith('result-')) await ui.press({ key: String(b.props.key) })
  expect(await ui.find({ type: 'Text', text: '+ 30 more' })).toBeDefined()
  expect(JSON.stringify(await ui.drawn()).length).toBeLessThan(100_000)
})
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `claude plugin test .`
Expected: these four fail, and so does the Task 4 Result test, because the buttons and groups don't exist yet.

- [ ] **Step 3: Implement.**
  - In `types/index.d.ts`, add `finishedOpen: boolean` and `openResults: string[]` to `PluginState['sabai-band']`.
  - In `register.tsx`, add the atoms after `bar`:

```ts
const finishedOpen = atom({ plugin: 'sabai-band', key: 'finishedOpen' } as const, false)
const openResults = atom({ plugin: 'sabai-band', key: 'openResults' } as const, [] as string[])
// The pane draws the newest finished runs; the rest are counted.
const FINISHED_SHOWN = 8
```

  Also:
  - change the imports to `import { clearFinished, clock, effortLabel, elapsed, finished, groups, modelName, resultText, spawned, stepped, taskLine, withTasks } from './agents'` and `import { BAR_STYLES, agentCardSvg, bandSvg, barPreview, emptyAgentsSvg, lookOf, skinPreview, summarySvg } from './svg'`;
  - in `classic.SessionStart`, add `await update($, openResults, () => [])`.

  Replace the whole `on('ui.render', { component: 'Pane', requestId: PANE }, ...)` hook (including the temporary first-card code from Task 3):

```tsx
  // The agents pane: a summary, running agents, then finished ones (folded at first) with Clear
  // and a Result under each. The desktop draws each card as an image with its Button beneath;
  // the terminal draws the same as text rows.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const list = await read($, agents)
    const at = await read($, now)
    const skinName = await read($, skin)
    const style = await read($, bar)
    const isOpen = await read($, finishedOpen)
    const opened = await read($, openResults)
    const { running, finished: done } = groups(list)
    const ui = $.ui.resolve(e)
    const { Box, Button, Text } = ui
    const Svg = e.surface !== 'terminal' && 'Svg' in ui ? ui.Svg : undefined
    const W = Math.max(240, Math.min(4096, Math.round((e.props.bodyColumns || 40) * 8.25)))
    const look = lookOf(skinName)

    if (list.length === 0) {
      const empty = emptyAgentsSvg(W, skinName)
      return Svg ? (
        <Svg source={empty.source} alt={empty.alt} />
      ) : (
        <Box flexDirection="column">
          <Text bold>No subagents yet</Text>
          <Text dimColor>They show here when Claude hands work off — try “explore hooks/ and tests/ in parallel”.</Text>
        </Box>
      )
    }

    const card = (a: AgentRun) => {
      if (Svg) {
        const d = agentCardSvg(a, W, at, skinName, style)
        return <Svg key={`card-${a.id}`} source={d.source} alt={d.alt} />
      }
      const line = taskLine(a.tasks)
      const effort = effortLabel(a.effort)
      return (
        <Box key={`card-${a.id}`} flexDirection="column">
          <Text wrap="truncate-end" dimColor={a.status !== 'running'}>
            <Text color={look.clawd}>{a.status === 'running' ? '● ' : a.status === 'done' ? '✓ ' : '✗ '}</Text>
            <Text bold>{a.description || a.type}</Text>
            <Text dimColor>{`  ${clock(elapsed(a, at))}`}</Text>
          </Text>
          <Text dimColor wrap="truncate-end">{`  ${effort ? `${effort} · ` : ''}${a.type} · ${modelName(a.model)}`}</Text>
          <Text dimColor wrap="truncate-end">{`  ${line ? `${line.done}/${line.total} · ${line.title}` : `${a.steps} ${a.steps === 1 ? 'step' : 'steps'}`} · ${tokens(a.contextTokens)} ctx`}</Text>
        </Box>
      )
    }
    const sum = Svg && summarySvg(list, W, at, skinName)
    const shown = done.slice(0, FINISHED_SHOWN)
    const toggleResult = (id: string) => update($, openResults, ids => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]))

    return (
      <Box flexDirection="column" rowGap={1}>
        {Svg && sum && <Svg source={sum.source} alt={sum.alt} />}
        {running.length > 0 && (
          <Box flexDirection="column" rowGap={Svg ? 0 : 1}>
            <Text dimColor bold>{`RUNNING · ${running.length}`}</Text>
            {running.map(card)}
          </Box>
        )}
        {done.length > 0 && (
          <Box flexDirection="column" rowGap={Svg ? 0 : 1}>
            <Box flexDirection="row" alignItems="center" columnGap={1}>
              <Box flexGrow={1}>
                <Text dimColor bold>{`FINISHED · ${done.length}`}</Text>
              </Box>
              <Button
                key="clear-finished"
                label="Clear"
                onPress={async () => {
                  await update($, agents, clearFinished)
                  await update($, openResults, () => [])
                }}
              />
              <Button key="toggle-finished" label={isOpen ? '▾ Hide' : '▸ Show'} onPress={() => update($, finishedOpen, v => !v)} />
            </Box>
            {isOpen &&
              shown.map(a => (
                <Box key={`row-${a.id}`} flexDirection="column">
                  {card(a)}
                  <Button key={`result-${a.id}`} label={opened.includes(a.id) ? '▾ Result' : 'Result ›'} onPress={() => toggleResult(a.id)} />
                  {opened.includes(a.id) && <Text wrap="wrap">{resultText(a)}</Text>}
                </Box>
              ))}
            {isOpen && done.length > shown.length && <Text dimColor>{`+ ${done.length - shown.length} more`}</Text>}
          </Box>
        )}
      </Box>
    )
  })
```

  `tokens` is already imported from `./model`; `AgentRun` is already imported from `../types`.

- [ ] **Step 4: Run all tests, type-check and validate**

Run: `claude plugin test . && tsc -p . && claude plugin validate .`
Expected: everything passes, including the Task 4 Result test; validation passes.

- [ ] **Step 5: Commit**

```bash
git add plugins/sabai-band/types/index.d.ts plugins/sabai-band/hooks/register.tsx plugins/sabai-band/tests/band.test.tsx
git commit -m "Rebuild the agents pane with a summary, folding groups, Clear and results" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Docs and a visual check

**Files:**
- Modify: `README.md` (the "agents panel" paragraph)
- Modify: `docs/PLAN.md` (the Agents panel line)

- [ ] **Step 1: Update the README paragraph** under **The agents panel** to:

```markdown
**The agents panel** (`/sabai-agents`, or `✻` under the band)

A summary of how many subagents run and finished, their context and the wall time, then a card per agent:
- Clawd in a hat for its type (Explore, Plan, general-purpose, guide, others), walking while it works, hopping when it finishes and dazed if it fails;
- the task, an effort label (quick, steady, careful, deep), its type and model;
- its own step progress (`3/5 · current step`) or its step count, context and time.

Finished agents fold away. Show them to read each one's **Result** (its report, or why it stopped), and **Clear** them when you are done.
```

- [ ] **Step 2: Update `docs/PLAN.md`.** Replace the `- **Agents panel (C2):** …` line with:

```markdown
- **Agents panel (C2, รอบ 2):** การ์ดสรุป (Agents · Context · Time) · การ์ด agent: Clawd ใส่หมวกตามชนิด (Explore/Plan/general/guide/อื่นๆ) สีตาม skin, ป้าย effort (quick/steady/careful/deep), ความคืบหน้าของ task ของ agent เอง (`3/5 · ชื่อขั้น`) หรือจำนวน step, ctx, เวลา · เดินเมื่อทำงาน กระโดดเมื่อเสร็จ หลับตาเมื่อล้มเหลว · กลุ่ม Finished พับไว้ (Show/Hide), Clear, Result ต่อ agent (สรุปผลหรือเหตุผลที่ล้มเหลว) · task ของ subagent แยกจาก band · sprite รวม pixel run (Clawd ~3k) และแสดง Finished 8 ตัวล่าสุด ให้ pane ไม่เกิน 100k
```

- [ ] **Step 3: Visual check.**
  - Run: `claude plugin test . && claude plugin validate .`
  - Then, in the live session (the mod hot-reloads), open the pane with `✻`. Ask Claude to "use Explore agents to survey hooks/ and tests/ in parallel".
  - Confirm on the desktop:
    - the summary, the running cards with hats walking and the bar moving;
    - after they finish: a hop, a folded Finished group, Show, Result text and Clear.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/PLAN.md
git commit -m "Describe the redesigned agents panel" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Notes for the implementer

- **`turn.step` cannot be driven from the test kit** ("no implementation for turn.step"). Effort capture is therefore covered by the `stepped` unit test (Task 2) and the card drawing (Task 3), not by an integration test.
- **Atoms survive a hot reload; module variables do not.** That is why every reader of the new `AgentRun` fields tolerates their absence.
- **Keep clip-path ids unique per drawing** (`sabai-band-agent-<id>`, `sabai-band-sw-<id>`). Each SVG is drawn isolated, but the band and the agent cards share the `sabai-band-` prefix by convention.
