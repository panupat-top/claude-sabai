import { expect, test } from 'claude-code/testing'

import { TEXT, lookOf } from '../hooks/svg'
import { SKINS, SKIN_NAMES, contrast } from '../hooks/themes'

// A look's stylesheet in light and dark: its card and every other fill, the track and Clawd's wink aside.
function modes(skin: string) {
  const css = lookOf(skin).css.replace(/@keyframes wink\{.*\}\}/, '')
  const at = css.indexOf('@media (prefers-color-scheme: dark){')
  return [css.slice(0, at), css.slice(at)].map(part => {
    const card = part.match(/\.p\{fill:(#[0-9a-f]{6})\}/)![1]!
    const track = part.match(/\.k\{fill:(#[0-9a-f]{6})\}/)![1]!
    const inks = [...part.matchAll(/fill:(#[0-9a-f]{6})/g)].map(m => m[1]!).filter(c => c !== card && c !== track)
    return { card, inks }
  })
}

test('every look paints text that reads at 4.5:1 on its cards, light and dark, and white on its pill', () => {
  for (const skin of SKINS) {
    for (const [i, { card, inks }] of modes(skin).entries())
      for (const ink of inks) expect([skin, i ? 'dark' : 'light', ink, contrast(ink, card) >= 4.5]).toEqual([skin, i ? 'dark' : 'light', ink, true])
    expect([skin, contrast('#ffffff', lookOf(skin).pill) >= 4.5]).toEqual([skin, true])
  }
})

test('two looks, raised first: raised cards stand off the desktop’s surface, flat ones sit close to it', () => {
  expect([...SKINS]).toEqual(['raised', 'auto'])
  expect(SKINS.map(k => SKIN_NAMES[k])).toEqual(['Raised', 'Flat'])
  const surface = ['#f2f2f0', '#222222']
  const lift = (skin: string) => modes(skin).map(({ card }, i) => contrast(card, surface[i]!))
  for (const [i, raised] of lift('raised').entries()) expect(raised).toBeGreaterThan(lift('auto')[i]!)
  // Anything else, such as a skin an older version saved, draws flat.
  expect(lookOf('dracula')).toBe(lookOf('auto'))
})

test('the branch tag’s words read over its wash on light and dark surfaces, for every look', () => {
  const hex = (c: string) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))
  const mix = (a: string, b: string, t: number) => '#' + hex(a).map((v, i) => Math.round(v * t + hex(b)[i]! * (1 - t)).toString(16).padStart(2, '0')).join('')
  for (const skin of SKINS)
    for (const [i, surface] of (['#ffffff', '#1f1f1f'] as const).entries()) {
      const wash = mix(lookOf(skin).bar('session'), surface, 0.13)
      expect([skin, surface, contrast(TEXT.session[i]!, wash) >= 4.5]).toEqual([skin, surface, true])
    }
})
