import { expect, test } from 'claude-code/testing'

import type { AgentRun } from '../types'
import { sprite, spriteSize } from '../hooks/sprites'
import { THEMES, contrast } from '../hooks/themes'
import { CALLOUT_KINDS, CARD, CHAT_INK, PILL_TINT, TEXT, bandSvg, calloutTitleSvg, fillColor, lookOf, stepSvg, textClass } from '../hooks/svg'

const LIST = [
  { kind: 'context', label: 'Context', percent: 85, amount: '434.5k / 1M' },
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
  expect(mode(bandSvg({ done: 0, total: 2, title: 'a' }, NONE, [], 600, 'working')?.source)).toBe('run')
  expect(mode(bandSvg({ done: 0, total: 2, title: 'a' }, NONE, [], 600)?.source)).toBe('idle')
  const mocha = bandSvg({ done: 0, total: 2, title: 'a' }, NONE, [], 600, 'idle', 'catppuccin-mocha')?.source
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
  expect(d?.height).toBe(20 + 8 + 20 + 8 + 44)
  expect(d?.alt).toContain('Directory claude-skins, Git user Panupat <dev>, Branch main ±2, Node v24.1.0; a: 1/2 tasks, 50%; Context')
  expect(d?.source).toContain('Panupat &lt;dev&gt;')
  expect(d?.source).toContain('fill="#F05032"')
  expect(d?.source).toContain('<g transform="translate(0,28)">')
  // The node chip ends at the right edge.
  const node = d?.source.match(/<rect class="p" x="([\d.]+)" y="0" width="(\d+)" height="20" rx="6"\/><path fill="#5FA04E"/)
  expect(Number(node?.[1]) + Number(node?.[2])).toBe(900)
  // Too narrow: left chips give way, node stays.
  expect(bandSvg(undefined, info, [], 260)?.alt).toBe('Directory claude-skins, Node v24.1.0')
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
  const themed = bandSvg(undefined, NONE, LIST, 900, 'idle', 'catppuccin-mocha')
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
    bandSvg({ done: 1, total: 2, title: 'a' }, NONE, LIST, 800, 'idle', 'auto', style)?.source ?? ''
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
  const d = bandSvg(undefined, NONE, [], 800, 'idle', 'auto', 'dither', { runs, now: 37_000 })
  expect(d?.source).toContain('>job b<')
  expect(d?.source).toContain('0/2 · Reading')
  expect(d?.source.match(/class="run"/g)?.length).toBe(1)
  expect(d?.alt).toBe('Agents: 1 running, 1 done; job b')
  const many = bandSvg(undefined, NONE, [], 800, 'idle', 'auto', 'dither', { runs: Array.from({ length: 7 }, (_, i) => crewRun(String(i))), now: 1000 })
  expect(many?.source.match(/class="run"/g)?.length).toBe(5)
  expect(many?.source).toContain('>+2<')
  expect(many?.source.length).toBeLessThan(131_072)
  const idle = bandSvg(undefined, NONE, [], 800, 'idle', 'auto', 'dither', { runs: [crewRun('a', { status: 'done', endedAt: 1 }), crewRun('b', { status: 'done', endedAt: 2 })], now: 9000 })
  expect(idle?.source).toContain('>All 2 done<')
  expect(idle?.source).not.toContain('class="run"')
  const mixed = bandSvg(undefined, NONE, [], 800, 'idle', 'auto', 'dither', { runs: [crewRun('a', { status: 'done', endedAt: 1 }), crewRun('b', { status: 'failed', endedAt: 2 })], now: 9000 })
  expect(mixed?.source).toContain('>1 done · 1 failed<')
  expect(mixed?.alt).toBe('Agents: 1 done, 1 failed; 1 done · 1 failed')
  expect(mixed?.source.match(/>1<\/text>/g)?.length).toBe(2)
  expect(bandSvg(undefined, NONE, [], 800, 'idle', 'auto', 'dither', { runs: [], now: 0 })).toBeUndefined()
})

test('a dithered band stays inside the engine limits at any width, its dots widening instead of multiplying', () => {
  const list = [{ kind: 'context', label: 'Context', percent: 60, amount: '1k / 1M' }] as const
  for (const W of [800, 2400, 4096]) {
    const d = bandSvg({ done: 3, total: 5, title: 't' }, NONE, list, W, 'working', 'auto', 'dither')
    expect([W, (d?.source.length ?? 0) < 70_000]).toEqual([W, true])
  }
  // Many tasks still draw at most a dozen tick marks.
  const many = bandSvg({ done: 1, total: 120, title: 't' }, NONE, [], 800, 'idle', 'auto', 'dither')?.source ?? ''
  expect((many.match(/width="1.5" height="6"/g) ?? []).length).toBeLessThanOrEqual(12)
})

test('a title of emoji is cut on whole characters, never mid-pair', () => {
  const d = bandSvg({ done: 0, total: 1, title: '🚀'.repeat(60) }, NONE, [], 300)?.source ?? ''
  const run = crewRun('x', { description: '🚀'.repeat(60), tasks: [{ id: '1', subject: '🚀'.repeat(60), status: 'in_progress' }] })
  const crew = bandSvg(undefined, NONE, [], 330, 'idle', 'auto', 'dither', { runs: [run], now: 1 })?.source ?? ''
  for (const s of [d, crew]) expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s)).toBe(false)
})

test('text the band draws on the bare surface follows the OS, whatever the skin; auto defines every meter class', () => {
  for (const skin of ['auto', 'catppuccin-latte', 'nord']) {
    const d = bandSvg({ done: 1, total: 2, title: 'Polish' }, NONE, [], 600, 'idle', skin)?.source ?? ''
    expect([skin, d.includes('<text class="st"'), d.includes('.st{fill:#1f1f1f}'), d.includes('prefers-color-scheme: dark){.st')]).toEqual([skin, true, true, true])
    const crew = bandSvg(undefined, NONE, [], 600, 'idle', skin, 'dither', { runs: [crewRun('a')], now: 1 })?.source ?? ''
    expect(crew).toContain('<text class="st"')
  }
  expect(lookOf('auto').css).toContain('.c-tasks{')
})

test('on a narrow band the crew walks fewer Clawds and drops words it has no room for, never overlapping the counts', () => {
  const runs = [...Array.from({ length: 5 }, (_, i) => crewRun(String(i))), crewRun('f', { status: 'failed', endedAt: 1 })]
  const d = bandSvg(undefined, NONE, [], 330, 'idle', 'auto', 'dither', { runs, now: 1000 })?.source ?? ''
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
  const withTasks = bandSvg(p, info, [], 600, 'sad', 'auto', 'dither')!
  expect(withTasks.source.match(/class="dizzy"/g)?.length).toBe(1)
  expect(withTasks.alt).toContain('Clawd is sad')
  const noTasks = bandSvg(undefined, info, [], 600, 'sleeping', 'auto', 'dither')!
  expect(noTasks.source.match(/class="sleep"/g)?.length).toBe(1)
  expect(noTasks.alt).toContain('Clawd is sleeping')
  // The folder chip moves right of Clawd.
  expect(noTasks.source).toMatch(/<rect class="p" x="(3[2-9]|[4-9]\d)/)
  // Idle and working say nothing extra; an info row turned off has no Clawd.
  expect(bandSvg(undefined, info, [], 600, 'idle', 'auto', 'dither')!.alt).not.toContain('Clawd')
  expect(bandSvg(undefined, { left: [], right: [], show: false }, [], 600, 'sad', 'auto', 'dither')).toBeUndefined()
  // An info row with no chips still holds Clawd.
  expect(bandSvg(undefined, { left: [], right: [], show: true }, [], 600, 'sweating', 'auto', 'dither')!.source).toContain('class="sweat"')
  // Celebrating hops with confetti.
  expect(bandSvg(undefined, info, [], 600, 'celebrating', 'auto', 'dither')!.source).toContain('class="cf"')
})
