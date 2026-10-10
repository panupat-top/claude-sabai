import { expect, test } from 'claude-code/testing'

import { lookOf } from '../hooks/svg'
import { SKINS, THEMES, cardOf, contrast, pickSkin, readable } from '../hooks/themes'

test('every skin paints text that reads at 4.5:1 on its cards, and white on its pill', () => {
  for (const [key, t] of Object.entries(THEMES)) {
    const look = lookOf(key)
    const card = cardOf(t)
    // The wink keyframes paint Clawd's body, not text.
    for (const [, color] of look.css.replace(/@keyframes wink\{.*\}\}/, '').matchAll(/fill:(#[0-9a-f]{6})/g)) {
      const track = look.css.match(/\.k\{fill:(#[0-9a-f]{6})\}/)?.[1]
      if (color === track || color === card) continue
      expect([key, color, contrast(color!, card) >= 4.5]).toEqual([key, color, true])
    }
    expect([key, contrast('#ffffff', look.pill) >= 4.5]).toEqual([key, true])
  }
})

test('cards take the lighter of a theme’s base and surface', () => {
  expect(cardOf(THEMES.dracula!)).toBe('#282a36')
  expect(cardOf(THEMES['catppuccin-mocha']!)).toBe('#1e1e2e')
  expect(cardOf(THEMES.nord!)).toBe('#3b4252')
})

test('a legible colour is kept as the theme has it; an illegible one is stepped', () => {
  expect(readable('#cdd6f4', '#181825')).toBe('#cdd6f4')
  const fixed = readable('#df8e1d', '#e6e9ef')
  expect(fixed).not.toBe('#df8e1d')
  expect(contrast(fixed, '#e6e9ef')).toBeGreaterThanOrEqual(4.5)
})

test('skins are found by any spelling of their name', () => {
  expect(['TokyoNight', 'tokyo night', 'Catppuccin Mocha', 'mocha', 'frappe', 'Frappé', 'DRACULA', 'Rosé Pine', 'auto'].map(pickSkin)).toEqual([
    'tokyo-night', 'tokyo-night', 'catppuccin-mocha', 'catppuccin-mocha', 'catppuccin-frappe', 'catppuccin-frappe', 'dracula', 'rose-pine', 'auto',
  ])
  expect(pickSkin('solarized')).toBeUndefined()
  expect(pickSkin('  ')).toBeUndefined()
  expect(SKINS[0]).toBe('auto')
})
