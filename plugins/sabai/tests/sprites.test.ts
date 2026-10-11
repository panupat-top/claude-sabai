import { expect, test } from 'claude-code/testing'

import { HAT_H, PROP_W, SPRITE_CSS, sprite } from '../hooks/sprites'

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
  for (const kind of ['explorer', 'hardhat', 'cap', 'grad', 'beret', 'bandana', 'headset', 'tophat', 'beanie'] as const) {
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

test('with a prop, each type holds its own tool to Clawd’s right, animated only while it runs', () => {
  for (const kind of ['explorer', 'hardhat', 'cap', 'grad', 'beret', 'bandana', 'headset', 'tophat', 'beanie'] as const) {
    const svg = sprite('tasks', 0, 0, 'run', undefined, { kind, color: '#00ff00', prop: true })
    const held = [...pixels(svg)].filter(([k]) => Number(k.split(',')[0]) >= 24)
    expect([kind, held.length > 4]).toEqual([kind, true])
    expect(Number(Math.max(...held.map(([k]) => Number(k.split(',')[0]))))).toBeLessThan(24 + PROP_W)
    expect(svg).toMatch(/<g class="pr-\w+">/)
  }
  expect([...pixels(sprite('tasks', 0, 0, 'run', undefined, { kind: 'cap' }))].some(([k]) => Number(k.split(',')[0]) >= 24)).toBe(false)
  for (const motion of ['scan', 'scrib', 'twist', 'flip', 'steam']) expect(SPRITE_CSS).toContain(`.run g.pr-${motion}`)
})

test('a finished Clawd waves his report; a failed one wears a bandage', () => {
  const svg = sprite('tasks', 0, 0, 'idle', undefined, { kind: 'cap', prop: 'scroll' })
  expect(svg).toContain('<g class="pr-wave">')
  expect(SPRITE_CSS).toContain('g.pr-wave{')
  expect(pixels(sprite('tasks', 0, 0, 'dizzy', '#ff0000')).get('11,5')).toBe('#f8f6f1')
})

test('Clawd startles with a mark, sweats a drop and sleeps with shut eyes and a z', () => {
  const startle = sprite('tasks', 0, 0, 'startle', '#ff0000')
  expect(startle).toContain('class="startle"')
  expect(startle).toContain('class="bang"')
  expect(sprite('tasks', 0, 0, 'sweat', '#ff0000')).toContain('class="drop"')
  const sleep = sprite('tasks', 0, 0, 'sleep', '#ff0000')
  expect(sleep).toContain('class="zz')
  // Shut eyes, as a failed Clawd's, but no bandage.
  const px = pixels(sleep)
  expect([px.get('6,2'), px.get('6,3')]).toEqual(['#1F1E1D', '#ff0000'])
  expect(px.get('11,5')).toBe('#ff0000')
  // Each mark's animation is in the stylesheet.
  for (const cls of ['startle', 'bang', 'drop', 'zz']) expect([cls, SPRITE_CSS.includes(`.${cls}`)]).toEqual([cls, true])
})

test('each accessory draws on Clawd: hats above him, held things to his right, a shirt across him', () => {
  for (const a of ['newyear', 'xmas', 'nightcap'] as const) {
    const px = pixels(sprite('tasks', 0, 0, 'idle', '#ff0000', undefined, a))
    expect([a, [...px.keys()].some(k => Number(k.split(',')[1]) < 0)]).toEqual([a, true])
  }
  for (const a of ['halloween', 'coffee'] as const) {
    const px = pixels(sprite('tasks', 0, 0, 'idle', '#ff0000', undefined, a))
    expect([a, [...px.keys()].some(k => Number(k.split(',')[0]) >= 24)]).toEqual([a, true])
  }
  const shirt = pixels(sprite('tasks', 0, 0, 'idle', '#ff0000', undefined, 'songkran'))
  expect(shirt.get('10,9')).toBe('#f5c542')
})

test('a runner holds the tool of its call in flight, in place of its type’s prop', () => {
  for (const tool of ['read', 'edit', 'command', 'test'] as const) {
    const px = pixels(sprite('tasks', 0, 0, 'run', '#ff0000', { kind: 'explorer', color: '#00ff00', prop: true }, undefined, tool))
    expect([tool, [...px.keys()].some(k => Number(k.split(',')[0]) >= 24)]).toEqual([tool, true])
  }
  // The explorer's magnifier (#8e929a glass, #a0703f handle) is gone when a tool is held.
  expect(sprite('tasks', 0, 0, 'run', '#ff0000', { kind: 'explorer', prop: true }, undefined, 'edit')).not.toContain('#a0703f')
})

test('trick modes move the eyes, open the mouth or raise a claw; look modes keep the base mode', () => {
  // draw() merges a run of one colour into one rect: each eye row is a 2-wide rect.
  const eyes = (s: string) => [...s.matchAll(/<rect x="(\d+)" y="2" width="2" height="1" fill="#1F1E1D"/g)].map(m => Number(m[1]))
  const plain = sprite('tasks', 0, 0, 'idle')
  expect(eyes(plain)).toHaveLength(2)
  expect(eyes(sprite('tasks', 0, 0, 'run look-right'))).toEqual(eyes(plain).map(x => x + 1))
  expect(sprite('tasks', 0, 0, 'run look-right')).toContain('class="run look-right"')
  expect(sprite('tasks', 0, 0, 'idle look-up')).toMatch(/y="1" width="2" height="1" fill="#1F1E1D"/)
  // Looking up moves the 2×2 eyes a row: their lower row stays where the upper one was.
  expect(eyes(sprite('tasks', 0, 0, 'idle look-up'))).toEqual(eyes(plain))
  // The yawn's mark is a small z, its diagonal two pixels, not an I.
  expect(sprite('tasks', 0, 0, 'yawn')).toContain('<rect x="25" y="2" width="1" height="1" class="sm"/>')
  expect(sprite('tasks', 0, 0, 'yawn')).toMatch(/x="11" y="5" width="2" height="1" fill="#1F1E1D"/)
  expect(sprite('tasks', 0, 0, 'wave')).toContain('class="wv-up"')
  // Held still, the wave shows its raised claw alone, not both frames at once.
  expect(sprite('tasks', 0, 0, 'wave')).toContain('(prefers-reduced-motion: reduce){.wave .wv-down{opacity:0}}')
  expect(sprite('tasks', 0, 0, 'out')).not.toMatch(/y="3" width="2" height="1" fill="#1F1E1D"/)
})
