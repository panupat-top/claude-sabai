import { expect, test } from 'claude-code/testing'

import type { AgentRun } from '../types'
import { sprite, spriteSize } from '../hooks/sprites'
import { icon } from '../hooks/icons'
import { THEMES, contrast } from '../hooks/themes'
import { CALLOUT_KINDS, CARD, CHAT_INK, PILL_TINT, TEXT, bandSvg, monoWidth, USAGE_STYLES, calloutTitleSvg, fillColor, lookOf, racePart, receiptSvg, stepSvg, textClass } from '../hooks/svg'

const LIST = [
  { kind: 'context', label: 'Context', percent: 85, amount: '434.5k / 1M', level: 'warn' },
  { kind: 'session', label: '5H Limit', percent: 7, resetsInMs: 2 * 3600_000 },
  { kind: 'week', label: '7D All', percent: 3, resetsInMs: 3 * 86_400_000 },
] as const
const NONE = { left: [], right: [] }

test('the tasks row escapes its title and stays under the engine limits', () => {
  const d = bandSvg({ done: 3, total: 4, title: 'Fix <b> & "quotes"' }, NONE, [], 1600)
  expect(d?.source).toContain('Fix &lt;b&gt; &amp; &quot;quotes&quot;')
  expect(d?.source).toContain('>3/4<')
  expect(d?.source).toContain('>75%<')
  expect(d?.source.length).toBeLessThan(131_072)
  expect(d?.alt).toBe('Fix <b> & "quotes": 3/4 tasks, 75%')
  expect([d?.width, d?.height]).toEqual([1600, 20])
})

test('Clawd walks while the turn works and waits otherwise, tinted by the skin', () => {
  const mode = (src = '') => src.match(/shape-rendering="crispEdges" class="(\w+)"/)?.[1]
  expect(mode(bandSvg({ done: 0, total: 2, title: 'a' }, NONE, [], 600, { mood: 'working' })?.source)).toBe('run')
  expect(mode(bandSvg({ done: 0, total: 2, title: 'a' }, NONE, [], 600)?.source)).toBe('idle')
  const mocha = bandSvg({ done: 0, total: 2, title: 'a' }, NONE, [], 600, { mood: 'idle', skin: 'catppuccin-mocha' })?.source
  expect(mocha).toContain('fill="#fab387"')
  expect(mocha).toContain('@keyframes wink{91%,96%{fill:#fab387}}')
  expect(mocha).not.toContain('fill="#D97757"')
  expect(spriteSize('tasks')).toEqual({ width: 24, height: 16 })
})

test('cards run side by side when wide, two or one when narrow, 8px apart', () => {
  expect(bandSvg(undefined, NONE, LIST, 900)?.height).toBe(44)
  expect(bandSvg(undefined, NONE, LIST, 500)?.height).toBe(2 * 44 + 8)
  expect(bandSvg(undefined, NONE, LIST, 360)?.height).toBe(3 * 44 + 2 * 8)
  expect(bandSvg({ done: 1, total: 2, title: 'a' }, NONE, LIST, 900)?.height).toBe(20 + 8 + 44)
  const wide = bandSvg(undefined, NONE, LIST, 900)
  expect(wide?.source.match(/class="p"/g)?.length).toBe(3)
  expect(bandSvg(undefined, NONE, LIST.slice(0, 2), 900)?.source).toContain('width="446"')
  for (const id of ['context', 'session', 'week']) expect(wide?.source).toContain(`id="sabai-${id}"`)
  expect(wide?.source).toContain('7D ALL')
  expect(wide?.source.match(/shape-rendering="crispEdges"/g)?.length).toBe(1)
  expect(wide?.source).toContain('↻ 2h 0m')
  expect(wide?.source).toContain(fillColor(85, '#000'))
  expect(wide?.alt).toBe('Context 434.5k / 1M (85%); 5H Limit 7%, resets in 2h 0m; 7D All 3%, resets in 3d 0h')
})

test('nothing to draw draws nothing', () => {
  expect(bandSvg(undefined, NONE, [], 900)).toBeUndefined()
})

test('the info row comes first: marks and values, left group from the left, node at the right edge', () => {
  const info = {
    left: [
      { icon: 'folder', label: 'Directory', value: 'claude-skins' },
      { icon: 'git', label: 'Git user', value: 'Panupat <dev>' },
      { icon: 'branch', label: 'Branch', value: 'main ±2' },
    ],
    right: [{ icon: 'node', label: 'Node', value: 'v24.1.0' }],
  } as const
  const d = bandSvg({ done: 1, total: 2, title: 'a' }, info, LIST, 900)
  expect(d?.height).toBe(22 + 8 + 20 + 8 + 44)
  expect(d?.alt).toContain('Directory claude-skins, Git user Panupat <dev>, Branch main ±2, Node v24.1.0; a: 1/2 tasks, 50%; Context')
  expect(d?.source).toContain('Panupat &lt;dev&gt;')
  expect(d?.source).toContain('<g transform="translate(0,30)">')
  // The git user, last at the right, ends at the right edge.
  const user = d?.source.match(/<text class="sm" x="([\d.]+)"[^>]*>Panupat &lt;dev&gt;</)
  expect(Math.abs(Number(user?.[1]) + monoWidth('Panupat <dev>', 10.5) - 900)).toBeLessThan(1)
  // Too narrow: the user gives way first; the folder and branch stay, cut if they must.
  expect(bandSvg(undefined, info, [], 260)?.alt).not.toContain('Git user')
  expect(bandSvg(undefined, info, [], 260)?.alt).toContain('Directory claude-skins')
})

test('only Clawd and the context draw a sprite, each within the row', () => {
  for (const kind of ['tasks', 'context'] as const) {
    const { width, height } = spriteSize(kind)
    expect(width).toBeGreaterThan(0)
    expect(height).toBeLessThanOrEqual(16)
    if (kind !== 'tasks') expect(width).toBeLessThanOrEqual(18)
    expect(sprite(kind, 0, 0)).toContain('<rect')
  }
})

test('every text colour reads at 4.5:1 on its card, in light and dark', () => {
  for (const [name, [light, dark]] of Object.entries(TEXT)) {
    expect([name, contrast(light, CARD[0]) >= 4.5]).toEqual([name, true])
    expect([name, contrast(dark, CARD[1]) >= 4.5]).toEqual([name, true])
  }
  expect(contrast('#ffffff', '#b5532f')).toBeGreaterThanOrEqual(4.5)
})

test('figures take their meter colour, then the warning ones', () => {
  expect([textClass(10, 'week'), textClass(75, 'week'), textClass(95, 'week')]).toEqual(['c-week', 'c-warn', 'c-alert'])
  expect(bandSvg(undefined, NONE, LIST, 900)?.source).toContain('class="c-warn"')
})

test('a skin colours the cards and bars but draws no background or inset, as auto does', () => {
  const themed = bandSvg(undefined, NONE, LIST, 900, { mood: 'idle', skin: 'catppuccin-mocha' })
  expect(themed?.height).toBe(44)
  expect(themed?.source).toContain('.p{fill:#1e1e2e}')
  expect(themed?.source).toContain('<g fill="#b4befe">')
  expect(themed?.source).not.toContain('rx="10" fill=')
  expect(themed?.source).not.toContain('translate(10,10)')
})

test('fill colours step up at the warning thresholds', () => {
  expect(new Set([fillColor(10, '#123456'), fillColor(75, '#123456'), fillColor(95, '#123456')]).size).toBe(3)
  expect(fillColor(10, '#123456')).toBe('#123456')
})

test('bars draw as dither, pixel blocks or a solid fill', () => {
  const draw = (style: 'dither' | 'blocks' | 'solid') =>
    bandSvg({ done: 1, total: 2, title: 'a' }, NONE, LIST, 800, { mood: 'idle', skin: 'auto', style: style })?.source ?? ''
  expect(draw('dither')).toMatch(/class="d[0-3]"/)
  const blocks = draw('blocks')
  expect(blocks).not.toMatch(/class="d[0-3]"/)
  expect(blocks.match(/rx="1\.5"/g)?.length).toBeGreaterThan(20)
  const solid = draw('solid')
  expect(solid).not.toMatch(/class="d[0-3]"/)
  expect(solid).toContain('<rect fill="#D97757"')
})

const crewRun = (id: string, extra: Partial<AgentRun> = {}): AgentRun => ({
  id, agentId: id, type: 'Explore', description: `job ${id}`, model: 'claude-opus-5-5', status: 'running', startedAt: 0, contextTokens: 0, steps: 4, ...extra,
})

test('the crew row walks one Clawd per running agent, names the latest, and counts the rest', () => {
  const runs = [crewRun('a', { status: 'done', endedAt: 5000 }), crewRun('b', { tasks: [{ id: '1', subject: 'Read', activeForm: 'Reading', status: 'in_progress' }, { id: '2', subject: 'x', status: 'pending' }] })]
  const d = bandSvg(undefined, NONE, [], 800, { mood: 'idle', skin: 'auto', style: 'dither', crew: { runs, now: 37_000 } })
  expect(d?.source).toContain('>job b<')
  expect(d?.source).toContain('0/2 · Reading')
  expect(d?.source.match(/class="run"/g)?.length).toBe(1)
  expect(d?.alt).toBe('Agents: 1 running, 1 done; job b')
  const many = bandSvg(undefined, NONE, [], 800, { mood: 'idle', skin: 'auto', style: 'dither', crew: { runs: Array.from({ length: 7 }, (_, i) => crewRun(String(i))), now: 1000 } })
  expect(many?.source.match(/class="run"/g)?.length).toBe(5)
  expect(many?.source).toContain('>+2<')
  expect(many?.source.length).toBeLessThan(131_072)
  const idle = bandSvg(undefined, NONE, [], 800, { mood: 'idle', skin: 'auto', style: 'dither', crew: { runs: [crewRun('a', { status: 'done', endedAt: 1 }), crewRun('b', { status: 'done', endedAt: 2 })], now: 9000 } })
  expect(idle?.source).toContain('>All 2 done<')
  expect(idle?.source).not.toContain('class="run"')
  const mixed = bandSvg(undefined, NONE, [], 800, { mood: 'idle', skin: 'auto', style: 'dither', crew: { runs: [crewRun('a', { status: 'done', endedAt: 1 }), crewRun('b', { status: 'failed', endedAt: 2 })], now: 9000 } })
  expect(mixed?.source).toContain('>1 done · 1 failed<')
  expect(mixed?.alt).toBe('Agents: 1 done, 1 failed; 1 done · 1 failed')
  expect(mixed?.source.match(/>1<\/text>/g)?.length).toBe(2)
  expect(bandSvg(undefined, NONE, [], 800, { mood: 'idle', skin: 'auto', style: 'dither', crew: { runs: [], now: 0 } })).toBeUndefined()
})

test('a dithered band stays inside the engine limits at any width, its dots widening instead of multiplying', () => {
  const list = [{ kind: 'context', label: 'Context', percent: 60, amount: '1k / 1M' }] as const
  for (const W of [800, 2400, 4096]) {
    const d = bandSvg({ done: 3, total: 5, title: 't' }, NONE, list, W, { mood: 'working', skin: 'auto', style: 'dither' })
    expect([W, (d?.source.length ?? 0) < 70_000]).toEqual([W, true])
  }
  // Many tasks still draw at most a dozen tick marks.
  const many = bandSvg({ done: 1, total: 120, title: 't' }, NONE, [], 800, { mood: 'idle', skin: 'auto', style: 'dither' })?.source ?? ''
  expect((many.match(/width="1.5" height="6"/g) ?? []).length).toBeLessThanOrEqual(12)
})

test('a title of emoji is cut on whole characters, never mid-pair', () => {
  const d = bandSvg({ done: 0, total: 1, title: '🚀'.repeat(60) }, NONE, [], 300)?.source ?? ''
  const run = crewRun('x', { description: '🚀'.repeat(60), tasks: [{ id: '1', subject: '🚀'.repeat(60), status: 'in_progress' }] })
  const crew = bandSvg(undefined, NONE, [], 330, { mood: 'idle', skin: 'auto', style: 'dither', crew: { runs: [run], now: 1 } })?.source ?? ''
  for (const s of [d, crew]) expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s)).toBe(false)
})

test('text the band draws on the bare surface follows the OS, whatever the skin; auto defines every meter class', () => {
  for (const skin of ['auto', 'catppuccin-latte', 'nord']) {
    const d = bandSvg({ done: 1, total: 2, title: 'Polish' }, NONE, [], 600, { mood: 'idle', skin: skin })?.source ?? ''
    expect([skin, d.includes('<text class="st"'), d.includes('.st{fill:#1f1f1f}'), d.includes('prefers-color-scheme: dark){.st')]).toEqual([skin, true, true, true])
    const crew = bandSvg(undefined, NONE, [], 600, { mood: 'idle', skin: skin, style: 'dither', crew: { runs: [crewRun('a')], now: 1 } })?.source ?? ''
    expect(crew).toContain('<text class="st"')
  }
  expect(lookOf('auto').css).toContain('.c-tasks{')
})

test('on a narrow band the crew walks fewer Clawds and drops words it has no room for, never overlapping the counts', () => {
  const runs = [...Array.from({ length: 5 }, (_, i) => crewRun(String(i))), crewRun('f', { status: 'failed', endedAt: 1 })]
  const d = bandSvg(undefined, NONE, [], 330, { mood: 'idle', skin: 'auto', style: 'dither', crew: { runs, now: 1000 } })?.source ?? ''
  expect((d.match(/class="run"/g) ?? []).length).toBeLessThan(5)
  const titleX = Number(d.match(/<text class="st" x="([\d.]+)"[^>]*font-size="12.5"/)?.[1] ?? 0)
  const firstCount = Math.min(...[...d.matchAll(/<text class="st" x="([\d.]+)"[^>]*font-size="11.5"/g)].map(m => Number(m[1])))
  if (titleX) expect(titleX).toBeLessThan(firstCount - 40)
})

test('every skin’s empty bar track stands out from its card', () => {
  for (const key of Object.keys(THEMES)) {
    const card = lookOf(key).css.match(/\.p\{fill:(#[0-9a-f]{6})\}/)?.[1] ?? ''
    const track = lookOf(key).css.match(/\.k\{fill:(#[0-9a-f]{6})\}/)?.[1] ?? ''
    expect([key, contrast(track, card) >= 1.35]).toEqual([key, true])
  }
})

test('chat ink reads on a light and a dark conversation', () => {
  for (const [tone, [light, dark]] of Object.entries(CHAT_INK)) {
    expect([tone, contrast(light, '#ffffff') >= 4.5, contrast(dark, '#1a1a1a') >= 4.5]).toEqual([tone, true, true])
  }
})

test('callout inks read on light and dark, and a title is one small drawing in its kind’s colour', () => {
  for (const [kind, k] of Object.entries(CALLOUT_KINDS)) expect([kind, contrast(k.ink[0], '#ffffff') >= 4.5, contrast(k.ink[1], '#1a1a1a') >= 4.5]).toEqual([kind, true, true])
  const d = calloutTitleSvg('warning')
  expect(d.alt).toBe('Warning')
  expect(d.source).toContain('>Warning<')
  expect(d.source).toContain(`fill:${CALLOUT_KINDS.warning.ink[0]}`)
  expect(d.source).toMatch(/<g class="co an-pop"[^>]*fill="none"/)
})

test('a step is one minimal 560×24 line: a small icon, title, detail, a meter, the result in a pill, the time', () => {
  const d = stepSvg({ icon: 'flask', tone: 'ok', title: 'Run the tests', detail: '$ bun test', result: [{ text: '✓ 141 passed', tone: 'ok' }], meter: { good: 141, bad: 0 }, time: '5.1s' })
  expect([d.width, d.height]).toEqual([560, 24])
  expect(d.alt).toBe('Run the tests, $ bun test, 141 passed, 5.1s')
  expect(d.source).not.toContain('<circle class="trk"')
  expect(d.source).toMatch(/scale\(0\.5416666666666666\)"><g class="s-ok an-pop" fill="none" stroke-width="2"/)
  expect(d.source).toMatch(/font-size="12" font-weight="600">Run the tests</)
  expect(d.source).toContain('>$ bun test<')
  expect(d.source).toMatch(/<rect class="k-ok" opacity="0.1"[^>]*height="16" rx="8"/)
  expect((d.source.match(/height="8" rx="1"/g) ?? []).length).toBe(5)
})

test('a long title is cut short of the result, never under it', () => {
  const d = stepSvg({ icon: 'terminal', tone: 'bad', title: 'A'.repeat(200), detail: '$ ' + 'x'.repeat(200), result: [{ text: '✗ failed', tone: 'bad' }], time: '1m 4s' })
  expect(d.source).toContain('…')
  expect(d.source).toContain('an-shake')
  const titleChars = (d.source.match(/font-weight="600">([^<]*)</)?.[1] ?? '').length
  expect(titleChars).toBeLessThan(70)
})

test('an animated icon keeps its place: the motion sits inside the group that positions it', () => {
  const d = stepSvg({ icon: 'terminal', tone: 'ok', title: 't', detail: 'd', result: [] })
  expect(d.source).toMatch(/<g transform="translate\(1,5\.5\) scale\(0\.5416666666666666\)"><g class="s-ok an-pop"/)
})

test('motion starts and ends on the icon’s own size, so an image held on its first frame looks right', () => {
  const src = stepSvg({ icon: 'terminal', tone: 'ok', title: 't', detail: 'd', result: [] }).source
  expect(src).toContain('@keyframes an-pop{0%,100%{transform:scale(1)}')
})

test('the detail starts after the title it follows, measured by its letters', () => {
  const at = (title: string) => Number(stepSvg({ icon: 'read', tone: 'read', title, detail: 'README.md', result: [] }).source.match(/<text class="k-muted" x="([\d.]+)"/)?.[1])
  expect(at('Read README.md')).toBeGreaterThan(20 + 14 * 12 * 0.56 + 10)
  expect(at('iiiiiiiiii')).toBeLessThan(at('MMMMMMMMMM'))
})

// Review fixes (2026-10-11).
test('a very long title is cut in linear time', () => {
  const t = performance.now()
  stepSvg({ icon: 'terminal', tone: 'ok', title: 'x'.repeat(20_000), detail: 'd', result: [{ text: '✓ done', tone: 'ok' }] })
  expect(performance.now() - t).toBeLessThan(50)
})

test('Thai marks take no width and CJK takes a full em, so the detail sits right after the title', () => {
  const at = (title: string) => Number(stepSvg({ icon: 'read', tone: 'read', title, detail: 'dir/', result: [] }).source.match(/<text class="k-muted" x="([\d.]+)"/)?.[1])
  expect(at('กำลังทำงาน')).toBe(at('กำลงทำงาน'))
  expect(at('日本語のタイトル')).toBeGreaterThan(20 + 8 * 12 * 0.9)
})

test('pill text reads at 4.5:1 over its own tint on light and dark conversations', () => {
  const mix = (fg: string, bg: string, a: number) => {
    const c = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
    const [f, b] = [c(fg), c(bg)]
    return `#${f.map((v, i) => Math.round(v * a + b[i]! * (1 - a)).toString(16).padStart(2, '0')).join('')}`
  }
  for (const [tone, [light, dark]] of Object.entries(CHAT_INK)) {
    for (const bg of ['#ffffff', '#faf9f5']) expect([tone, bg, contrast(light, mix(light, bg, PILL_TINT)) >= 4.5]).toEqual([tone, bg, true])
    for (const bg of ['#1a1a1a', '#262624', '#30302e']) expect([tone, bg, contrast(dark, mix(dark, bg, PILL_TINT)) >= 4.5]).toEqual([tone, bg, true])
  }
})

test('pills line up row to row: the time column is always kept', () => {
  const end = (time?: string) => {
    const m = stepSvg({ icon: 'pen', tone: 'edit', title: 't', detail: '', result: [{ text: '+1 −1', tone: 'ok' }], ...(time ? { time } : {}) }).source.match(/<rect class="k-ok" opacity="[\d.]+" x="([\d.]+)"[^>]*width="([\d.]+)"/)
    return Number(m?.[1]) + Number(m?.[2])
  }
  expect(Math.round(end())).toBe(Math.round(end('1m 4s')))
  expect(Math.round(end('0.3s'))).toBe(Math.round(end('12s')))
})

test('an Important callout’s title is the colour of its border', () => {
  expect(CALLOUT_KINDS.important.key).toBe('claude')
  expect(CALLOUT_KINDS.important.ink[0]).not.toBe('#8250df')
})

test('Clawd sits in the tasks row when there is one, else at the left of the info row', () => {
  const info = { left: [{ icon: 'folder' as const, label: 'Folder', value: 'work' }], right: [], show: true }
  const p = { title: 'Doing a', done: 1, total: 2 }
  const withTasks = bandSvg(p, info, [], 600, { mood: 'sad', skin: 'auto', style: 'dither' })!
  expect(withTasks.source.match(/class="dizzy"/g)?.length).toBe(1)
  expect(withTasks.alt).toContain('Clawd is sad')
  const noTasks = bandSvg(undefined, info, [], 600, { mood: 'sleeping', skin: 'auto', style: 'dither' })!
  expect(noTasks.source.match(/class="sleep"/g)?.length).toBe(1)
  expect(noTasks.alt).toContain('Clawd is sleeping')
  // The folder moves right of Clawd.
  expect(noTasks.source).toMatch(/<path class="sm" transform="translate\((3[2-9]|[4-9]\d)/)
  // Idle and working say nothing extra; an info row turned off has no Clawd.
  expect(bandSvg(undefined, info, [], 600, { mood: 'idle', skin: 'auto', style: 'dither' })!.alt).not.toContain('Clawd')
  expect(bandSvg(undefined, { left: [], right: [], show: false }, [], 600, { mood: 'sad', skin: 'auto', style: 'dither' })).toBeUndefined()
  // An info row with no chips still holds Clawd.
  expect(bandSvg(undefined, { left: [], right: [], show: true }, [], 600, { mood: 'sweating', skin: 'auto', style: 'dither' })!.source).toContain('class="sweat"')
  // Celebrating hops with confetti.
  expect(bandSvg(undefined, info, [], 600, { mood: 'celebrating', skin: 'auto', style: 'dither' })!.source).toContain('class="cf"')
})

test('a receipt is one minimal line: its icon, a headline and muted parts, fixed in size', () => {
  const green = receiptSvg({ tone: 'ok', headline: 'All green', test: { passed: 9, failed: 0 }, commands: { count: 2, failed: 0 } })
  expect([green.width, green.height]).toEqual([560, 24])
  expect(green.source).toContain('class="s-ok an-pop"')
  // No card: no box, no pills, no confetti.
  expect(green.source).not.toContain('<rect')
  const failing = receiptSvg({ tone: 'bad', headline: 'Tests failing', files: { count: 3, added: 40, removed: 12 }, test: { passed: 96, failed: 2 }, commands: { count: 4, failed: 1 } })
  expect(failing.source).toContain('class="s-bad an-shake"')
  expect(failing.alt).toBe('Turn receipt: Tests failing; 3 files +40 −12; 2 of 98 failed; 4 commands · 1 failed')
  for (const words of ['3 files ', '+40', ' −12', '2 of 98 failed', '4 commands', ' · 1 failed']) expect([words, failing.source.includes(`>${words}<`)]).toEqual([words, true])
})

test('compact density draws the usage cards on one line and the band at least 35% shorter', () => {
  const info = { left: [{ icon: 'folder' as const, label: 'Directory', value: 'w' }], right: [], show: true }
  const roomy = bandSvg(undefined, info, LIST, 900, {})!
  const tight = bandSvg(undefined, info, LIST, 900, { density: 'compact' })!
  expect(tight.height).toBeLessThanOrEqual(Math.floor(roomy.height * 0.65))
  // The reset countdown still shows on a wide band.
  expect(tight.source).toContain('↻')
  expect(tight.alt).toBe(roomy.alt)
})

test('the live strip shows the turn’s time, step and tallies, and takes Clawd when there are no tasks', () => {
  const info = { left: [{ icon: 'folder' as const, label: 'Directory', value: 'w' }], right: [], show: true }
  const live = { elapsedMs: 102_000, step: { icon: 'pen' as const, title: 'Editing svg.ts' }, files: 2, commands: 5, test: { passed: 178, failed: 0 } }
  const d = bandSvg(undefined, info, [], 800, { mood: 'working', live })!
  expect(d.alt).toContain('Working 1m 42s: Editing svg.ts; 2 files, 5 commands, 178 passed')
  expect(d.source.match(/class="run"/g)?.length).toBe(1)
  // With a tasks row, Clawd stays there.
  const withTasks = bandSvg({ title: 't', done: 1, total: 2 }, info, [], 800, { mood: 'working', live })!
  expect(withTasks.source.match(/class="run"/g)?.length).toBe(1)
  expect(withTasks.alt).toContain('Working 1m 42s')
})

test('on the narrowest band the live strip keeps the step and lets the tallies go', () => {
  const info = { left: [], right: [{ icon: 'node' as const, label: 'Node', value: 'v24.21.0' }], show: true }
  const live = { elapsedMs: 31_000, step: { icon: 'terminal' as const, title: 'Wait eight seconds so the live strip can be seen' }, files: 0, commands: 2, test: { passed: 200, failed: 0 } }
  const d = bandSvg(undefined, info, [], 200, { mood: 'working', live })!
  expect(d.source).toContain('› Wait eight')
  // Wide enough, both show.
  expect(bandSvg(undefined, info, [], 600, { mood: 'working', live })!.source).toMatch(/› Wait eight[\s\S]*✓ 200/)
})

test('the comfortable band puts Clawd large in his own panel, with his mood and the turn’s time', () => {
  const info = { left: [{ icon: 'folder' as const, label: 'Directory', value: 'w' }], right: [], show: true }
  const live = { elapsedMs: 102_000, files: 0, commands: 0 }
  const d = bandSvg(undefined, info, LIST, 900, { hero: true, mood: 'working', live })!
  expect(d.source).toMatch(/scale\(3\)/)
  expect(d.source).toContain('>working<')
  expect(d.source).toContain('>1m 42s<')
  expect(d.alt.startsWith('Clawd: working, 1m 42s')).toBe(true)
  // Under 480 px, or compact, or Clawd hidden: not this layout.
  expect(bandSvg(undefined, info, LIST, 470, { hero: true })!.source).not.toMatch(/scale\(3\)/)
  expect(bandSvg(undefined, info, LIST, 900, { hero: true, density: 'compact' })!.source).not.toMatch(/scale\(3\)/)
  expect(bandSvg(undefined, info, LIST, 900, { hero: true, clawd: false })!.source).not.toMatch(/scale\(3\)/)
})

test('the race box draws a lane per member with its state, tools, glow, tiles and flag', () => {
  const race = {
    running: 3, done: 1, ok: 12, fails: 1, elapsedMs: 102_000, more: 1,
    lanes: [
      { id: 'main', who: 'Main', step: 'Editing svg.ts', timeMs: 102_000, progress: 0.5, calls: [{ kind: 'read', ok: true }, { kind: 'edit', ok: true }], doing: 'edit', state: 'running' },
      { id: 'e', who: 'Explore', type: 'Explore', many: 3, step: '3 running', timeMs: 12_000, calls: [{ kind: 'test', ok: true }], state: 'scored' },
      { id: 'b', who: 'Write race tests', type: 'general-purpose', step: 'bun test failed', timeMs: 31_000, calls: [{ kind: 'command', ok: false }], state: 'tripped' },
      { id: 'c', who: 'Plan the race', type: 'Plan', step: 'Done', timeMs: 125_000, progress: 1, calls: [], state: 'finished' },
    ],
  } as const
  const part = racePart(lookOf('auto'), race as never, 300, 0)
  expect(part.height).toBe(24 + 4 * 42 + 6)
  for (const s of ['>3 running · 1 done<', '>✓ 12<', '>✗ 1<', '>1:42<', '>+1<', '>OUCH<', '>×3<', '>Write race tests<', '>· bun test failed<', '>0:31<', 'class="glow', 'class="scroll"', 'class="flag', 'class="dizzy"', 'class="hop"'])
    expect([s, part.body.includes(s)]).toEqual([s, true])
  for (const s of ['LV ', 'COMBO', 'class="far"', 'class="dust', 'class="speed"', 'class="conf"']) expect([s, part.body.includes(s)]).toEqual([s, false])
  expect(part.body.match(/class="hop"/g)!.length).toBeGreaterThanOrEqual(3)
  expect(part.alt).toBe('Race: 3 running, 1 done, 12 ok, 1 failed, 1:42; Main running: Editing svg.ts; Explore ×3 scored: 3 running; Write race tests tripped: bun test failed; Plan the race finished: Done; 1 more')
})

test('the comfortable band’s tiers: three panels from 760 px, two below, stacked under 480', () => {
  const info = { left: [{ icon: 'folder' as const, label: 'Directory', value: 'w' }], right: [], show: true }
  const live = { elapsedMs: 102_000, step: { icon: 'pen' as const, title: 'Editing svg.ts' }, files: 1, commands: 2 }
  const race = { running: 1, done: 0, ok: 0, fails: 0, elapsedMs: 102_000, more: 0, lanes: [{ id: 'main', who: 'Main', step: 'Editing svg.ts', calls: [], doing: 'edit', state: 'running' }] }
  const crew = { runs: [{ id: 'a', agentId: 'a', type: 'Explore', description: 'Survey', model: 'm', status: 'running', startedAt: 0, contextTokens: 0, steps: 1 }], now: 1000 } as never
  const opts = { hero: true, mood: 'working' as const, live, race: race as never, crew }
  const wide = bandSvg(undefined, info, LIST, 900, opts)!
  expect(wide.alt).toContain('Race: 1 running')
  expect(wide.alt).not.toContain('Working 1m 42s:')
  expect(wide.alt).not.toContain('Agents:')
  const mid = bandSvg(undefined, info, LIST, 600, opts)!
  expect(mid.alt).not.toContain('Race:')
  expect(mid.alt).toContain('Working 1m 42s: Editing svg.ts')
  expect(mid.alt).toContain('Agents:')
  expect(bandSvg(undefined, info, LIST, 400, opts)!.source).not.toMatch(/scale\(3\)/)
  // Clawd hidden: no panel, the race stays.
  const noClawd = bandSvg(undefined, info, LIST, 900, { ...opts, clawd: false })!
  expect(noClawd.source).not.toMatch(/scale\(3\)/)
  expect(noClawd.alt).toContain('Race: 1 running')
})

test('no race element carries two class attributes, whatever its runner is doing', () => {
  for (const doing of ['read', 'edit', 'command', 'test'] as const) {
    const race = { running: 1, done: 0, ok: 0, fails: 0, elapsedMs: 1000, more: 0, lanes: [{ id: 'main', who: 'Main', step: 'n', calls: [{ kind: doing, ok: true }, { kind: doing, ok: false }], doing, state: 'running' }] }
    const body = racePart(lookOf('auto'), race as never, 300, 0).body
    const twice = body.match(/<[a-z]+\b[^>]*\bclass="[^"]*"[^>]*\bclass="[^>]*>/g)
    expect([doing, twice]).toEqual([doing, null])
  }
})

test('in the comfortable band the race box’s words take the card’s ink', () => {
  const info = { left: [{ icon: 'folder' as const, label: 'Directory', value: 'w' }], right: [], show: true }
  const race = {
    running: 1, done: 1, ok: 1, fails: 0, elapsedMs: 1000, more: 1,
    lanes: [
      { id: 'main', who: 'Main', step: 'n', calls: [{ kind: 'test', ok: true }], doing: 'test', state: 'running' },
      { id: 'c', who: 'Plan', type: 'Plan', step: 'Done', progress: 1, calls: [], state: 'finished' },
    ],
  }
  const source = bandSvg(undefined, info, LIST, 900, { hero: true, skin: 'dracula', race: race as never })!.source
  const [middle, box] = source.split('translate(600,0)')
  expect(box!.match(/class="(st|sm|f-ok)[" ]/g)).toBeNull()
  expect(middle).toContain('class="usage"')
})

test('the Clawd panel shows his headline and why, the failing count in alert ink', () => {
  const info = { left: [{ icon: 'folder' as const, label: 'Directory', value: 'w' }], right: [], show: true }
  const sad = bandSvg(undefined, info, LIST, 900, { hero: true, mood: 'sad', clawdLine: '2 failed' })!
  expect(sad.source).toContain('>tests failing<')
  expect(sad.source).toMatch(/class="c-alert"[^>]*>2 failed</)
  expect(sad.alt.startsWith('Clawd: tests failing, 2 failed')).toBe(true)
  const idle = bandSvg(undefined, info, LIST, 900, { hero: true, mood: 'idle', clawdLine: 'your turn' })!
  expect(idle.source).toContain('>ready<')
  expect(Number(idle.source.match(/height="(\d+)"/)![1])).toBeGreaterThanOrEqual(112)
})

const USAGE_LIST = [
  { kind: 'context', label: 'Context', percent: 74, amount: '743.5k / 1M', left: '256.5k left', level: 'warn' },
  { kind: 'session', label: '5H Limit', percent: 27, resetsInMs: 1_140_000 },
  { kind: 'week', label: '7D All', percent: 18, resetsInMs: 3.85e8 },
] as const
const INFO = { left: [{ icon: 'folder' as const, label: 'Directory', value: 'w' }], right: [], show: true }
const RACE4 = { running: 4, done: 0, ok: 3, fails: 0, elapsedMs: 1000, more: 0, lanes: ['main', 'a', 'b', 'c'].map(id => ({ id, who: id, step: 's', calls: [], state: 'running' })) }
// Every <text> inside the usage group, with its start and end by the mono estimate, in band x.
function usageTexts(source: string, x0: number) {
  const g = source.slice(source.indexOf('<g class="usage"'), source.indexOf('</g><!--usage-->'))
  return [...g.matchAll(/<text[^>]*? x="([\d.]+)"[^>]*? font-size="([\d.]+)"([^>]*)>([^<]*)</g)].map(m => {
    const x = x0 + Number(m[1]), w = monoWidth(m[4]!.replace(/&amp;/g, '&'), Number(m[2]))
    const anchor = m[3]!.match(/text-anchor="(middle|end)"/)?.[1]
    return anchor === 'end' ? [x - w, x] : anchor === 'middle' ? [x - w / 2, x + w / 2] : [x, x + w]
  })
}

for (const style of Object.keys(USAGE_STYLES) as (keyof typeof USAGE_STYLES)[]) {
  test(`usage style ${style}: fills the height, colours the percent by level, and keeps its words inside at 760 px with the race`, () => {
    const now = new Date('2026-10-11T13:00:00').getTime()
    const idle = bandSvg(undefined, INFO, USAGE_LIST as never, 900, { hero: true, usageStyle: style, now })!
    const working = bandSvg(undefined, INFO, USAGE_LIST as never, 900, { hero: true, usageStyle: style, now, race: RACE4 as never })!
    expect(Number(working.source.match(/height="(\d+)"/)![1])).toBeGreaterThan(Number(idle.source.match(/height="(\d+)"/)![1]))
    expect(idle.source).toMatch(/class="c-warn"[^>]*>74%</)
    const group = idle.source.slice(idle.source.indexOf('<g class="usage"'), idle.source.indexOf('</g><!--usage-->'))
    expect(group).not.toMatch(/class="(st|sm)"/)
    expect(working.alt).toMatch(/Context [^;]*74%/)
    const narrow = bandSvg(undefined, INFO, USAGE_LIST as never, 760, { hero: true, usageStyle: style, now, race: RACE4 as never })!.source
    const left = 116, right = 760 - 300 - 8
    // The percent is never cut, however narrow the cell.
    for (const pct of ['>74%<', '>27%<', '>18%<']) expect([style, pct, narrow.includes(pct)]).toEqual([style, pct, true])
    const texts = usageTexts(narrow, left)
    expect(texts.length).toBeGreaterThan(5)
    for (const [a, b] of texts) expect([style, a! >= left - 1 && b! <= right + 1]).toEqual([style, true])
  })
}

test('the usage gets its floor with Clawd hidden and no race, and no part without limits', () => {
  // Review Focus 2.
  const d = bandSvg(undefined, INFO, USAGE_LIST as never, 900, { hero: true, clawd: false, usageStyle: 'tiles' })!
  expect(Number(d.source.match(/height="(\d+)"/)![1])).toBeGreaterThanOrEqual(28 + 50)
  expect(d.source).not.toMatch(/height="(0|-)/)
  expect(bandSvg(undefined, INFO, [], 900, { hero: true, usageStyle: 'tiles' })!.source).not.toContain('class="usage"')
})

// Every usage text as a box: [x0, x1, top, baseline], in the usage group's coordinates.
function usageBoxes(source: string) {
  const g = source.slice(source.indexOf('<g class="usage"'), source.indexOf('</g><!--usage-->'))
  return [...g.matchAll(/<text[^>]*? x="([\d.]+)" y="([\d.]+)"[^>]*? font-size="([\d.]+)"([^>]*)>([^<]*)</g)].map(m => {
    const x = Number(m[1]), y = Number(m[2]), size = Number(m[3]), w = monoWidth(m[5]!.replace(/&amp;/g, '&'), size)
    const anchor = m[4]!.match(/text-anchor="(middle|end)"/)?.[1]
    const [a, b] = anchor === 'end' ? [x - w, x] : anchor === 'middle' ? [x - w / 2, x + w / 2] : [x, x + w]
    return { a, b, top: y - size * 0.72, y, text: m[5]! }
  })
}

for (const style of Object.keys(USAGE_STYLES) as (keyof typeof USAGE_STYLES)[]) {
  test(`usage style ${style} lays out in the short heights a working band gives it, words inside and apart`, () => {
    const now = new Date('2026-10-11T13:00:00').getTime()
    const race1 = { running: 1, done: 0, ok: 0, fails: 0, elapsedMs: 1000, more: 0, lanes: [{ id: 'main', who: 'Main', step: 's', calls: [], state: 'running' }] }
    const tasks = { title: 'Ship it', done: 1, total: 3 }
    // Clawd shown: about 56 px of usage in 107 px cells; Clawd hidden: about 50 px.
    for (const clawd of [true, false]) {
      const d = bandSvg(tasks, INFO, USAGE_LIST as never, 760, { hero: true, clawd, usageStyle: style, now, race: race1 as never })!
      const top = Number(d.source.match(/<g class="usage" transform="translate\(0,(\d+)\)"/)![1])
      const h = Number(d.source.match(/height="(\d+)"/)![1]) - top
      expect([style, clawd, h < 80]).toEqual([style, clawd, true])
      const boxes = usageBoxes(d.source)
      for (const t of boxes) expect([style, clawd, t.text, t.top >= 0 && t.y <= h]).toEqual([style, clawd, t.text, true])
      for (const [i, p] of boxes.entries())
        for (const q of boxes.slice(i + 1)) {
          const overlap = p.a < q.b && q.a < p.b && p.top < q.y && q.top < p.y
          expect([style, clawd, p.text, q.text, overlap]).toEqual([style, clawd, p.text, q.text, false])
        }
      for (const pct of ['>74%<', '>27%<', '>18%<']) expect([style, pct, d.source.includes(pct)]).toEqual([style, pct, true])
    }
  })
}

test('a mark can take a class in place of its own colour', () => {
  expect(icon('git', 0, 0, 12)).toContain('fill="#F05032"')
  const classed = icon('git', 0, 0, 12, 'sm')
  expect(classed).toContain('class="sm"')
  expect(classed).not.toContain('fill=')
})

const ROW = {
  left: [
    { icon: 'folder', label: 'Directory', value: 'claude-skins' },
    { icon: 'git', label: 'Git user', value: 'Panupat' },
    { icon: 'branch', label: 'Branch', value: 'sabai-2.4 ↑2 ↓1 ±3', branch: 'sabai-2.4', ahead: 2, behind: 1, changes: 3 },
  ],
  right: [{ icon: 'shield', label: 'Turned on:', value: 'guard · 7' }, { icon: 'node', label: 'Node', value: 'v24.21.0' }],
  show: true,
} as const
// The info row's texts in order, from the first drawn part of the band.
const rowTexts = (source: string) => [...source.slice(0, source.indexOf('</g><!--info-->')).matchAll(/<text class="([^"]+)"[^>]*>([^<]*)</g)].map(m => [m[1], m[2]])

test('the info row: the project, a branch tag with its sync, then guard, Node and the user in muted ink', () => {
  const d = bandSvg(undefined, ROW, [], 900, { hero: true, clawd: false })!
  expect(rowTexts(d.source)).toEqual([
    ['st', 'claude-skins'], ['s-session', 'sabai-2.4'], ['s-ok', '↑2'], ['s-context', '↓1'], ['s-warn', '±3'],
    ['sm', 'guard 7'], ['sm', 'v24'], ['sm', 'Panupat'],
  ])
  // Marks at the right take the muted ink; no chip cards.
  expect(d.source.slice(0, d.source.indexOf('</g><!--info-->'))).not.toContain('<rect class="p"')
  expect(d.alt).toContain('Directory claude-skins, Git user Panupat, Branch sabai-2.4 ↑2 ↓1 ±3, Turned on: guard · 7, Node v24.21.0')
})

test('a narrow info row drops the user, then the guard; Node stays; at 240 px the names are cut', () => {
  const at = (W: number) => rowTexts(bandSvg(undefined, ROW, [], W, { hero: true, clawd: false })!.source).map(t => t[1]!)
  expect(at(452)).toEqual(['claude-skins', 'sabai-2.4', '↑2', '↓1', '±3', 'guard 7', 'v24'])
  expect(at(390)).toEqual(['claude-skins', 'sabai-2.4', '↑2', '↓1', '±3', 'v24'])
  const tiny = at(240)
  expect(tiny.some(t => t.endsWith('…'))).toBe(true)
  expect(tiny).not.toContain('v24')
})

test('hidden or unread parts leave no gap; a plain branch chip draws its value; plain guard says guard', () => {
  const noFolder = { ...ROW, left: ROW.left.slice(1) }
  expect(rowTexts(bandSvg(undefined, noFolder, [], 900, { hero: true, clawd: false })!.source)[0]).toEqual(['s-session', 'sabai-2.4'])
  const noBranch = { ...ROW, left: ROW.left.slice(0, 2) }
  expect(rowTexts(bandSvg(undefined, noBranch, [], 900, { hero: true, clawd: false })!.source).map(t => t[0])).not.toContain('s-ok')
  const plain = { left: [{ icon: 'branch', label: 'Branch', value: 'main ±2' }], right: [{ icon: 'shield', label: 'Turned on:', value: 'guard' }], show: true } as const
  expect(rowTexts(bandSvg(undefined, plain, [], 900, { hero: true, clawd: false })!.source)).toEqual([['s-session', 'main ±2'], ['sm', 'guard']])
  // Zero counts are not drawn.
  const zero = { left: [{ icon: 'branch', label: 'Branch', value: 'main', branch: 'main', ahead: 0, behind: 0, changes: 0 }], right: [], show: true } as const
  expect(rowTexts(bandSvg(undefined, zero, [], 900, { hero: true, clawd: false })!.source)).toEqual([['s-session', 'main']])
})

test('in the stacked band Clawd still leads the info row', () => {
  const d = bandSvg(undefined, ROW, [], 400, { mood: 'idle' })!
  const row = d.source.slice(0, d.source.indexOf('</g><!--info-->'))
  expect(row).toContain('crispEdges')
  const name = row.match(/<text class="st" x="([\d.]+)"[^>]*>claude-skins</)
  expect(Number(name![1])).toBeGreaterThan(24)
})

test('no two info-row texts overlap at any width', () => {
  for (const W of [240, 320, 400, 480, 600, 760, 900, 1400]) {
    for (const hero of [true, false]) {
      const src = bandSvg(undefined, ROW, [], W, { hero, clawd: false })!.source
      const row = src.slice(0, src.indexOf('</g><!--info-->'))
      const boxes = [...row.matchAll(/<text[^>]*? x="([\d.]+)"[^>]*? font-size="([\d.]+)"([^>]*)>([^<]*)</g)].map(m => {
        const x = Number(m[1]), w = monoWidth(m[4]!, Number(m[2]))
        return m[3]!.includes('text-anchor="end"') ? [x - w, x] : [x, x + w]
      })
      for (const [i, p] of boxes.entries()) for (const q of boxes.slice(i + 1)) expect([W, hero, p[0]! < q[1]! && q[0]! < p[1]!]).toEqual([W, hero, false])
      for (const [a, b] of boxes) expect([W, hero, a! >= -1 && b! <= W + 1]).toEqual([W, hero, true])
    }
  }
})
