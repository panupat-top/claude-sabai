import { expect, test } from 'claude-code/testing'

import { TEXT, bandSvg, lookOf } from '../hooks/svg'
import { DARK_THEMES, DEFAULT_THEME, LIGHT_THEMES, contrast, themeOf } from '../hooks/themes'
import type { Colors } from '../hooks/themes'

// Every theme with its mode and the desktop's surface in that mode.
const ALL: [string, Colors, string][] = [
  ...Object.values(LIGHT_THEMES).map(c => ['light', c, '#f2f2f0'] as [string, Colors, string]),
  ...Object.values(DARK_THEMES).map(c => ['dark', c, '#222222'] as [string, Colors, string]),
]
const hex = (c: string) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))
const mix = (a: string, b: string, t: number) => '#' + hex(a).map((v, i) => Math.round(v * t + hex(b)[i]! * (1 - t)).toString(16).padStart(2, '0')).join('')

test('three themes for each mode, Mono and Ink first; a stored pair keeps only what names a theme of its mode', () => {
  expect(Object.values(LIGHT_THEMES).map(c => c.name)).toEqual(['Mono', 'Pastel', 'Matcha'])
  expect(Object.values(DARK_THEMES).map(c => c.name)).toEqual(['Ink', 'Forest', 'Synthwave'])
  expect(DEFAULT_THEME).toEqual({ light: 'mono', dark: 'ink' })
  expect(themeOf({ light: 'pastel', dark: 'synthwave' })).toEqual({ light: 'pastel', dark: 'synthwave' })
  // An older version's skin, a theme of the other mode, or an inherited name start from the default.
  expect(themeOf('raised')).toEqual(DEFAULT_THEME)
  expect(themeOf({ light: 'ink', dark: 'toString' })).toEqual(DEFAULT_THEME)
  expect(themeOf(undefined)).toEqual(DEFAULT_THEME)
})

test('every theme’s words read at 4.5:1 on its card and white at 4.5:1 on its pill; its card and track stand apart', () => {
  for (const [mode, c, surface] of ALL) {
    for (const [ink, color] of Object.entries(c.text)) expect([c.name, ink, contrast(color, c.card) >= 4.5]).toEqual([c.name, ink, true])
    expect([c.name, contrast('#ffffff', c.pill) >= 4.5]).toEqual([c.name, true])
    expect([c.name, contrast(c.track, c.card) >= 1.35]).toEqual([c.name, true])
    expect([c.name, mode, contrast(c.card, surface) >= 1.03]).toEqual([c.name, mode, true])
  }
})

test('every theme’s tile glyphs read at 5:1 on their grounds', () => {
  for (const [, c] of ALL) for (const [hue, [kb, kf]] of Object.entries(c.tiles)) expect([c.name, hue, contrast(kf, kb) >= 5]).toEqual([c.name, hue, true])
})

test('the branch tag’s words read over its wash, on a theme’s card and on the bare surface', () => {
  for (const [mode, c] of ALL) {
    expect([c.name, contrast(c.text.session, mix(c.bar.session, c.card, 0.13)) >= 4.5]).toEqual([c.name, true])
    const [surface, ink] = mode === 'light' ? ['#ffffff', TEXT.session[0]] : ['#1f1f1f', TEXT.session[1]]
    expect([c.name, contrast(ink, mix(c.bar.session, surface, 0.13)) >= 4.5]).toEqual([c.name, true])
  }
})

test('a look sets the light theme’s inks, then the dark one’s under the dark query; a drawing declares only the variables it uses', () => {
  const theme = { light: 'matcha', dark: 'forest' } as const
  const css = lookOf(theme).css
  const at = css.indexOf('@media (prefers-color-scheme: dark){')
  expect(css.slice(0, at)).toContain(`.p{fill:${LIGHT_THEMES.matcha.card}}`)
  expect(css.slice(at)).toContain(`.p{fill:${DARK_THEMES.forest.card}}`)
  expect(lookOf(theme)).toBe(lookOf(theme))
  const d = bandSvg({ done: 1, total: 2, title: 'a' }, [], 600, { theme, style: 'solid' })!.source
  expect(d).toContain('<rect fill="var(--bar-tasks)"')
  expect(d).toContain(`--bar-tasks:${LIGHT_THEMES.matcha.bar.tasks}`)
  expect(d).toContain(`--bar-tasks:${DARK_THEMES.forest.bar.tasks}`)
  expect(d).not.toContain('--bar-week')
})
