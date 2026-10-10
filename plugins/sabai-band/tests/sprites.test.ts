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
