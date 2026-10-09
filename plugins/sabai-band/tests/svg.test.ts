import { expect, test } from 'claude-code/testing'

import { sprite, spriteSize } from '../hooks/sprites'
import { CARD, TEXT, bandSvg, fillColor, textClass } from '../hooks/svg'

const LIST = [
  { kind: 'context', label: 'Context', percent: 85, amount: '434.5k / 1M' },
  { kind: 'session', label: '5H Limit', percent: 7, resetsInMs: 2 * 3600_000 },
  { kind: 'week', label: '7D All', percent: 3, resetsInMs: 3 * 86_400_000 },
  { kind: 'scoped', label: '7D Fable', percent: 0, resetsInMs: 3 * 86_400_000 },
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

test('Clawd walks while a task runs or the turn works, and waits otherwise', () => {
  const mode = (src = '') => src.match(/shape-rendering="crispEdges" class="(\w+)"/)?.[1]
  expect(mode(bandSvg({ done: 0, total: 2, title: 'a', isRunning: true }, NONE, [], 600)?.source)).toBe('run')
  expect(mode(bandSvg({ done: 0, total: 2, title: 'a', isRunning: false }, NONE, [], 600, true)?.source)).toBe('run')
  expect(mode(bandSvg({ done: 0, total: 2, title: 'a', isRunning: false }, NONE, [], 600)?.source)).toBe('idle')
  expect(spriteSize('tasks')).toEqual({ width: 24, height: 16 })
})

test('cards run four across when wide, two or one when narrow, 8px apart', () => {
  expect(bandSvg(undefined, NONE, LIST, 900)?.height).toBe(44)
  expect(bandSvg(undefined, NONE, LIST, 500)?.height).toBe(2 * 44 + 8)
  expect(bandSvg(undefined, NONE, LIST, 360)?.height).toBe(4 * 44 + 3 * 8)
  expect(bandSvg({ done: 1, total: 2, title: 'a' }, NONE, LIST, 900)?.height).toBe(20 + 8 + 44)
  const wide = bandSvg(undefined, NONE, LIST, 900)
  expect(wide?.source.match(/class="p"/g)?.length).toBe(4)
  expect(bandSvg(undefined, NONE, LIST.slice(0, 2), 900)?.source).toContain('width="446"')
  for (const id of ['context', 'session', 'week', 'scoped']) expect(wide?.source).toContain(`id="sabai-band-${id}"`)
  expect(wide?.source).toContain('7D FABLE')
  expect(wide?.source.match(/shape-rendering="crispEdges"/g)?.length).toBe(1)
  expect(wide?.source).toContain('↻ 2h 0m')
  expect(wide?.source).toContain(fillColor(85, '#000'))
  expect(wide?.alt).toBe('Context 434.5k / 1M (85%); 5H Limit 7%, resets in 2h 0m; 7D All 3%, resets in 3d 0h; 7D Fable 0%, resets in 3d 0h')
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

// WCAG 2 contrast ratio of two #rrggbb colours.
const contrast = (a: string, b: string) => {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!
  }
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

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

test('a skin draws its background behind the rows, inset 10px; auto draws none', () => {
  const themed = bandSvg(undefined, NONE, LIST, 900, false, 'catppuccin-mocha')
  expect(themed?.height).toBe(44 + 20)
  expect(themed?.source).toContain('<rect width="900" height="64" rx="10" fill="#1e1e2e"/><g transform="translate(10,10)">')
  expect(themed?.source).toContain('<g fill="#b4befe">')
  expect(bandSvg(undefined, NONE, LIST, 900)?.source).not.toContain('rx="10" fill=')
})

test('fill colours step up at the warning thresholds', () => {
  expect(new Set([fillColor(10, '#123456'), fillColor(75, '#123456'), fillColor(95, '#123456')]).size).toBe(3)
  expect(fillColor(10, '#123456')).toBe('#123456')
})
