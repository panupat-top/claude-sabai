import type { ActKind, AgentRun, BarStyle, CallKind, UsageStyle } from '../types'
import { FULL_AT, isMain, agentMood, clock, quietFor, contextPercent, effortLabel, elapsed, filesOf, modelName, progressOf, summary, laneLine, toolsOf, typeEmoji, typeStyle, usesOf } from './agents'
import type { AgentMood } from './agents'
import type { Lane, Race, Uses } from './agents'
import type { Accessory, Chip, Meter, Mood, Progress, Trick } from './model'
import { countdown, hhmm, paceOf, resetClock, tokens, value } from './model'
import type { CalloutKind, Receipt, Step, StepIcon, Tone } from './chat'
import { basename, plural, stepText } from './chat'
import { icon } from './icons'
import type { IconKind } from './icons'
import { STROKES } from './strokes'
import type { StrokeKind } from './strokes'
import { ICON_COLORS, HAT_H, PROP_W, SPRITE_CSS, sprite, spriteSize } from './sprites'
import type { MeterKind } from './model'
import { SKIN_NAMES } from './themes'

// Desktop drawings in savvy-progress's pixel style (MIT). Each group is one SVG, so its own
// spacing holds; in a row Box the desktop sets one beside Buttons or other drawings. Light and
// dark follow the OS.

export type Drawing = { source: string; width: number; height: number; alt: string }

const WARN = '#f08a3c'
const ALERT = '#e5484d'
const SANS = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',sans-serif"
const MONO = 'ui-monospace,SFMono-Regular,Menlo,monospace'
// Text colours as [light, dark], each at least 4.5:1 on its card (checked by the tests). The
// bars keep the brighter ICON_COLORS; text needs the darker shade on a light card.
export const CARD = ['#f4f4f2', '#262626'] as const
export const TEXT = {
  t: ['#1f1f1f', '#ececec'],
  tasks: ['#a8490a', '#ff9d57'],
  m: ['#5f5f5c', '#a3a39f'],
  context: ['#13766b', '#3ccbbb'],
  session: ['#5450cf', '#aba8ff'],
  week: ['#8a5700', '#f0b44a'],
  warn: ['#a8490a', '#ff9d57'],
  alert: ['#c0262c', '#ff7377'],
  ok: ['#1a7f37', '#56d364'],
} as const
// The conversation's own ink as [light, dark]: the transcript sits on the person's theme, not on
// a skin's card. Checked at 4.5:1 on light and dark conversations, and over a pill's tint.
export const CHAT_INK: Record<Tone, readonly [string, string]> = {
  text: TEXT.t,
  muted: ['#5f5f5c', '#b4b4af'],
  ok: ['#116329', '#56d364'],
  bad: ['#a40e26', '#ff8a80'],
  warn: ['#7d4e00', '#e3b341'],
  edit: ['#231f80', '#d6d3ff'],
  read: ['#0a6158', '#3ccbbb'],
}
// How strongly a result pill is tinted with its ink: the ink must still read on the tint.
export const PILL_TINT = 0.1
const css = (i: 0 | 1, text: Readonly<Record<string, readonly [string, string]>> = TEXT) => Object.entries(text).map(([k, v]) => `.${k.length > 1 ? `c-${k}` : k}{fill:${v[i]}}`).join('')
// White on this clay reads at 4.5:1; the brand clay itself is kept for the bar.
const PILL = '#b5532f'
// The status tiles' motion, each loop within a second and starting on a visible frame: a call in
// flight pulses, thought's dots hop, a wait's hourglass turns, a quiet moon fades, a full gauge
// rocks. A wrapping group carries it, as a CSS transform would replace the icon's own placement.
const TILE_MOTION =
  '.st-pulse{transform-box:fill-box;transform-origin:center;animation:stp .8s ease-in-out infinite alternate}@keyframes stp{to{transform:scale(.8);opacity:.7}}' +
  '.st-b1,.st-b2,.st-b3{animation:stb .9s ease-in-out infinite}.st-b2{animation-delay:-.6s}.st-b3{animation-delay:-.3s}@keyframes stb{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}' +
  '.st-flip{transform-box:fill-box;transform-origin:center;animation:stf 1s ease-in-out infinite alternate}@keyframes stf{0%,30%{transform:rotate(0)}70%,100%{transform:rotate(180deg)}}' +
  '.st-fade{animation:stfd 1s ease-in-out infinite alternate}@keyframes stfd{to{opacity:.4}}' +
  '.st-wob{transform-box:fill-box;transform-origin:center;animation:stw .5s ease-in-out infinite alternate}@keyframes stw{from{transform:rotate(-8deg)}to{transform:rotate(8deg)}}'
export const MOTION =
  // Each loop within a second: the band redraws every second while work runs, restarting them.
  '.d0,.d1,.d2,.d3{animation:tw 1s ease-in-out infinite}.d1{animation-duration:.8s;animation-delay:-.3s}' +
  '.d2{animation-duration:.9s;animation-delay:-.6s}.d3{animation-duration:.7s;animation-delay:-.2s}' +
  '@keyframes tw{0%,100%{opacity:1}50%{opacity:.3}}' +
  '.ripple{transform-box:fill-box;transform-origin:center;animation:rp 1s ease-out infinite}@keyframes rp{0%{transform:scale(.6);opacity:.9}100%{transform:scale(2.2);opacity:0}}' +
  '.cf{animation:cf 1s ease-out infinite}@keyframes cf{50%{transform:translateY(-3px)}}' +
  TILE_MOTION +
  SPRITE_CSS +
  '@media (prefers-reduced-motion: reduce){*{animation:none!important}}'

const xml = (s: string): string =>
  s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)

// The characters a reader sees: a joined emoji (a family, a flag) is one, so a cut never splits it.
const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : undefined
const graphemes = (s: string): string[] => (segmenter ? [...segmenter.segment(s)].map(g => g.segment) : [...s])
// A wide character's advance in em, in any face: an emoji drawn as one, or a CJK character.
const wideEm = (g: string): number | undefined =>
  /\p{Emoji_Presentation}|\uFE0F/u.test(g) ? 1.2 : /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(g) ? 1 : undefined
// Rough advance of system UI text in em: enough to size a slot, not to typeset.
const charEm = (ch: string): number => wideEm(ch) ?? (/[\s.,:;'|!il1()[\]]/.test(ch) ? 0.3 : /[A-Z@%mw]/.test(ch) ? 0.72 : 0.56)
const textWidth = (s: string, size: number): number => graphemes(s).reduce((w, g) => w + charEm(g) * size, 0)

// Cut to `maxW` with `…`, keeping at least `min` characters; a string no longer than `min` stays whole.
function fit(s: string, size: number, maxW: number, min = 0): string {
  const chars = graphemes(s)
  if (chars.length <= min || textWidth(s, size) <= maxW) return s
  let n = 0
  while (n < chars.length && textWidth(chars.slice(0, n + 1).join('') + '…', size) <= maxW) n++
  return chars.slice(0, Math.max(min, n)).join('').trimEnd() + '…'
}

// Deterministic noise, so the dither does not shimmer between redraws.
const noise = (x: number, y: number): number => {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return s - Math.floor(s)
}

// How a skin paints the band: its stylesheet, a bar's colour, the pill behind white figures,
// and Clawd's tint. No skin paints a background: the band sits on the surface's own, as `auto` does.
export type Look = { css: string; bar: (kind: MeterKind | 'tasks', lvl?: 'warn' | 'alert') => string; pill: string; clawd: string }

const wink = (body: string) => `@keyframes wink{91%,96%{fill:${body}}}`

// A look in light and dark: its words, the bar track and the card, each [light, dark].
const twoModes = (text: Readonly<Record<string, readonly [string, string]>>, card: readonly [string, string], track: readonly [string, string]): Look => ({
  css: `${css(0, text)}.k{fill:${track[0]}}.k-stroke{stroke:${track[0]}}.p{fill:${card[0]}}@media (prefers-color-scheme: dark){${css(1, text)}.k{fill:${track[1]}}.k-stroke{stroke:${track[1]}}.p{fill:${card[1]}}}${wink(ICON_COLORS.tasks)}`,
  bar: (kind, lvl) => (lvl === 'alert' ? ALERT : lvl === 'warn' ? WARN : ICON_COLORS[kind]),
  pill: PILL,
  clawd: ICON_COLORS.tasks,
})

// Raised: white cards in light and cards lighter than the desktop's #222 in dark, lifted off the
// band; its words are set for those cards. Each at least 4.5:1 on its card (checked by the tests).
export const RAISED_CARD = ['#ffffff', '#2d2d2b'] as const
export const RAISED_TEXT = {
  t: ['#1a1a19', '#ececea'],
  tasks: ['#b04f2c', '#ee9b78'],
  m: ['#66665f', '#a6a6a0'],
  context: ['#12736a', '#4cc4b3'],
  session: ['#4f47c4', '#aca8ff'],
  week: ['#845700', '#eab65c'],
  warn: ['#ad4810', '#ffa166'],
  alert: ['#bf2b2b', '#ff7d74'],
  ok: ['#18793a', '#5fd16d'],
} as const
// Flat (`auto`, the first look): cards a shade off the surface.
const FLAT = twoModes(TEXT, CARD, ['#e8e8e5', '#2a2a2a'])
// Its empty bar track stands 1.35:1 off the card in both modes.
const RAISED = twoModes(RAISED_TEXT, RAISED_CARD, ['#dadad5', '#474744'])

// The two looks, both following the app between light and dark; anything else is flat.
export const lookOf = (skin: string): Look => (skin === 'raised' ? RAISED : FLAT)

const CELL = 3
const DOT_COLS = 200
// Blocks stop multiplying past this and grow wider instead, for the same reason as DOT_COLS.
const MAX_BLOCKS = 80
const MAX_TICKS = 12

export const BAR_STYLES: Record<BarStyle, string> = { dither: 'Dither', blocks: 'Pixel blocks', solid: 'Solid' }

// A rounded track and its fill, drawn in `style`: dither (sparse at the start, dense toward the
// head), square segments as tall as the bar, or one solid run. `id` must be unique in the page.
function pixelBar(id: string, x: number, y: number, w: number, h: number, ratio: number, color: string, ticks = 0, style: BarStyle = 'dither'): string {
  const fillW = Math.round(w * Math.max(0, Math.min(1, ratio)))
  if (style === 'blocks') {
    const count = Math.min(MAX_BLOCKS, Math.max(1, Math.floor((w + 2) / (h + 2))))
    const seg = (w - 2 * (count - 1)) / count
    const filled = Math.round(count * Math.max(0, Math.min(1, ratio)))
    const cells = Array.from({ length: count }, (_, i) => {
      const paint = i < filled ? `fill="${color}"` : 'class="k"'
      return `<rect ${paint} x="${(i * (seg + 2)).toFixed(1)}" width="${seg.toFixed(1)}" height="${h}" rx="1.5"/>`
    })
    return `<g transform="translate(${x},${y})">${cells.join('')}</g>`
  }
  // At most DOT_COLS columns of dots, each wider on a wider bar: a very wide band would
  // otherwise outgrow the engine's limit on a drawing.
  const cellX = Math.max(CELL, w / DOT_COLS)
  const cols = style === 'dither' ? Math.floor(fillW / cellX) : 0
  // One path per twinkle class, each dot a subpath: a rect per dot made a near-full wide band pass
  // the tree limit.
  const dots: string[][] = [[], [], [], []]
  const dotW = +(cellX - 1).toFixed(1)
  for (let c = 0; c < cols; c++) {
    const density = 0.55 + 0.45 * Math.pow(c / Math.max(1, cols), 1.2)
    for (let r = 0; r < Math.floor(h / CELL); r++) {
      if (noise(c, r) < density) dots[Math.floor(noise(r, c) * 4)]!.push(`M${+(c * cellX + 1).toFixed(1)} ${r * CELL + 1}h${dotW}v2h-${dotW}z`)
    }
  }
  const marks: string[] = []
  const steps = Math.min(ticks, MAX_TICKS)
  for (let i = 1; i < steps; i++) {
    const tx = Math.round((w * i) / steps)
    if (tx > fillW + 4) marks.push(`<rect class="m" x="${tx}" y="${h / 2 - 3}" width="1.5" height="6" rx="0.75"/>`)
  }
  const fill = style === 'solid' ? `<rect fill="${color}" width="${fillW}" height="${h}"/>` : `<g fill="${color}">${dots.map((d, i) => (d.length ? `<path class="d${i}" d="${d.join('')}"/>` : '')).join('')}</g>`
  return (
    `<g transform="translate(${x},${y})"><defs><clipPath id="${id}"><rect width="${w}" height="${h}" rx="${h / 2}"/></clipPath></defs>` +
    `<rect class="k" width="${w}" height="${h}" rx="${h / 2}"/>` +
    `<g clip-path="url(#${id})">${fill}${marks.join('')}</g></g>`
  )
}

// Text drawn straight on the surface, with no card behind it, takes the OS's light or dark ink
// whatever the skin: a skin's ink is only checked against its own card.
const surfaceCss = (i: 0 | 1) => Object.entries(TEXT).map(([k, v]) => `.s${k.length > 1 ? `-${k}` : k}{fill:${v[i]}}`).join('')
const SURFACE_INK = `${surfaceCss(0)}@media (prefers-color-scheme: dark){${surfaceCss(1)}}`

// Only the named classes' rules from a skin's stylesheet, its dark ones included: a small drawing
// redrawn every second (a toolbar icon, the info card) need not carry the whole of it.
const DARK = '@media (prefers-color-scheme: dark){'
function leanCss(look: Look, names: readonly string[]): string {
  const rules = (css: string) => names.map(n => css.match(new RegExp(`\\.${n}\\{[^}]*\\}`))?.[0] ?? '').join('')
  const at = look.css.indexOf(DARK)
  return at < 0 ? rules(look.css) : `${rules(look.css.slice(0, at))}${DARK}${rules(look.css.slice(at + DARK.length))}}`
}

// The pastel palette of statuses and call kinds: each hue's tile ground (kb), the glyph on it (kf)
// and its lines and bars (kl), each [light, dark]. Drawings paint it as `var(--kb-ok)` and so on,
// so they follow the OS's light/dark switch; each carries only the variables it uses (paletteCss).
// A glyph reads at 5:1 or more on its ground in both modes (checked by the tests).
export const PALETTE = {
  read: { kb: ['#8fd8cb', '#1f5b53'], kf: ['#083f39', '#a3f0e4'], kl: ['#8fd8cb', '#5cc2b2'] },
  edit: { kb: ['#b6b2f9', '#3b3780'], kf: ['#231f80', '#d6d3ff'], kl: ['#b6b2f9', '#9a95f2'] },
  command: { kb: ['#cfcec7', '#4a4a46'], kf: ['#2e2e2a', '#ecebe5'], kl: ['#cfcec7', '#8d8c86'] },
  ok: { kb: ['#9cdcab', '#255c33'], kf: ['#0f4a22', '#a8f0b6'], kl: ['#9cdcab', '#6cc985'] },
  web: { kb: ['#efc77c', '#66501a'], kf: ['#4d3300', '#fbe0a0'], kl: ['#efc77c', '#d9ad55'] },
  skill: { kb: ['#f2b49a', '#6b3420'], kf: ['#6e2a12', '#ffc9b0'], kl: ['#f2b49a', '#e8936f'] },
  fail: { kb: ['#f3a2a2', '#6e2a2d'], kf: ['#701016', '#ffbdbd'], kl: ['#f3a2a2', '#e58585'] },
  stop: { kb: ['#d6d5cf', '#4a4a46'], kf: ['#3a3a36', '#e2e1db'], kl: ['#d6d5cf', '#7a7a75'] },
  warn: { kb: ['#f5cf98', '#6b4a18'], kf: ['#5e3800', '#ffd9a0'], kl: ['#f5cf98', '#e0a85c'] },
} as const
export type Hue = keyof typeof PALETTE
const kb = (h: Hue) => `var(--kb-${h})`
const kf = (h: Hue) => `var(--kf-${h})`
const kl = (h: Hue) => `var(--kl-${h})`
function paletteCss(body: string): string {
  const used = [...new Set([...body.matchAll(/var\(--(k[bfl])-(\w+)\)/g)].map(m => [m[1], m[2]] as [keyof (typeof PALETTE)[Hue], Hue]))].filter(([, h]) => h in PALETTE)
  const names = [...new Map(used.map(u => [u.join('-'), u])).values()]
  if (!names.length) return ''
  const decl = (i: 0 | 1) => names.map(([t, h]) => `--${t}-${h}:${PALETTE[h][t][i]}`).join(';')
  return `svg{${decl(0)}}${DARK}svg{${decl(1)}}}`
}
// Each call kind's Lucide icon, once per drawing in its defs, placed by every tile that shows it.
const CALL_ICON: Record<ActKind, StrokeKind> = { read: 'book-open', search: 'search', edit: 'square-pen', command: 'terminal', test: 'flask-conical', web: 'globe', mcp: 'plug', skill: 'lightbulb', other: 'terminal' }
function iconDefs(body: string): string {
  const ids = [...new Set([...body.matchAll(/href="#sabai-(ic|du)-([\w-]+)"/g)].map(m => `${m[1]}-${m[2]}`))]
  // `ic` is an outline (no fill); `du` a duotone's shape, filled by each placement.
  const def = (id: string) => `<g id="sabai-${id}"${id.startsWith('ic-') ? ' fill="none" stroke-width="2.4"' : ' stroke-width="2.2"'} stroke-linecap="round" stroke-linejoin="round">${STROKES[id.slice(3) as StrokeKind]}</g>`
  return ids.length ? `<defs>${ids.map(def).join('')}</defs>` : ''
}

// `still` leaves the motion stylesheet out: a drawing with nothing moving need not carry it.
const svg = (look: Look, w: number, h: number, body: string, still = false) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><style>${look.css}${SURFACE_INK}${still ? '' : MOTION}${paletteCss(body)}</style>${iconDefs(body)}${body}</svg>`

const ROW_H = 20
const GAP = 8
const PAD = 10
const CARD_H = 44

type Part = { body: string; height: number; alt: string }


// Each mood's sprite mode, and the words a reader is told for it (idle and working say nothing).
const MOOD_MODE: Record<Mood, string> = { startled: 'startle', sad: 'dizzy', celebrating: 'hop', sweating: 'sweat', working: 'run', sleeping: 'sleep', idle: 'idle' }
const moodSaid = (mood: Mood) => (mood === 'idle' || mood === 'working' ? '' : `; Clawd is ${mood}`)

// Confetti beside Clawd's head in the band, clear of his face and of the project name or title.
const BAND_CONFETTI = [
  [25, 1, 'context'],
  [29, 5, 'session'],
  [26, 9, 'week'],
  [30, 12, 'tasks'],
] as const

// Clawd in his mood, in the skin's colour, with confetti while he celebrates.
function clawdAt(look: Look, x: number, y: number, mood: Mood, accessory?: Accessory, trick?: Trick): string {
  // A wave or a yawn is the whole pose; a look keeps the mood's motion and moves the eyes.
  const base = MOOD_MODE[mood]
  const mode = trick === 'wave' || trick === 'yawn' ? trick : trick ? `${base} ${trick}` : base
  const confetti =
    mood === 'celebrating'
      ? BAND_CONFETTI.map(([cx, cy, kind], i) => `<rect class="cf" style="animation-delay:-${i * 0.25}s" x="${x + cx}" y="${y + cy}" width="2" height="2" fill="${look.bar(kind)}"/>`).join('')
      : ''
  return sprite('tasks', x, y, mode, look.clawd, undefined, accessory) + confetti
}

// A hat rises above Clawd, so his row or panel leaves room for it.
const hatted = (a?: Accessory) => a === 'newyear' || a === 'xmas' || a === 'nightcap'

// The tasks row: Clawd, the title, the pixel bar with its n/total pill, the percent.
// Clawd shows the session's mood: walking while the turn works, blinking while it waits.
function progressPart(look: Look, p: Progress, W: number, mood: Mood, top: number, style: BarStyle, withClawd = true, accessory?: Accessory, trick?: Trick): Part {
  const ratio = p.done / p.total
  const percent = `${Math.round(ratio * 100)}%`
  const clawd = spriteSize('tasks')
  const titleX = withClawd ? clawd.width + 10 : 0
  const title = fit(p.title, 13, Math.max(60, W * 0.35))
  const barX = Math.round(titleX + textWidth(title, 13) + 14)
  const barH = 14
  const barW = Math.max(60, W - barX - 44)
  const pill = `${p.done}/${p.total}`
  const pillW = Math.round(16 + pill.length * 7)
  const fillW = Math.round(barW * ratio)
  const pillX = barX + Math.max(0, Math.min(barW - pillW, fillW - pillW))
  const y0 = (ROW_H - barH) / 2
  const body =
    (withClawd ? clawdAt(look, 0, (ROW_H - clawd.height) / 2, mood, accessory, trick) : '') +
    `<text class="st" x="${titleX}" y="${ROW_H / 2 + 4.5}" font-family="${SANS}" font-size="13" font-weight="500">${xml(title)}</text>` +
    pixelBar('sabai-tasks', barX, y0, barW, barH, ratio, look.bar('tasks'), p.total, style) +
    `<rect x="${pillX}" y="${y0}" width="${pillW}" height="${barH}" rx="${barH / 2}" fill="${look.pill}"/>` +
    `<text x="${pillX + pillW / 2}" y="${y0 + barH / 2 + 3.8}" text-anchor="middle" font-family="${MONO}" font-size="10" font-weight="700" fill="#ffffff">${pill}</text>` +
    `<text class="sm" x="${W}" y="${ROW_H / 2 + 4}" text-anchor="end" font-family="${MONO}" font-size="11.5" font-weight="600">${percent}</text>`
  return { body: `<g transform="translate(0,${top})">${body}</g>`, height: ROW_H, alt: `${p.title}: ${pill} tasks, ${percent}${withClawd ? moodSaid(mood) : ''}` }
}

// Usage as cards of two lines: icon, label and detail (tokens or reset countdown) on the
// first, the pixel bar and its percent on the second. Four across, two or one when narrow.
function cardsPart(look: Look, list: readonly Meter[], W: number, y0: number, style: BarStyle): Part {
  const cols = Math.min(list.length, W >= 720 ? 4 : W >= 400 ? 2 : 1)
  const rows = Math.ceil(list.length / cols)
  const cardW = Math.floor((W - GAP * (cols - 1)) / cols)
  const cards = list.map((m, i) => {
    const x = (i % cols) * (cardW + GAP)
    const y = y0 + Math.floor(i / cols) * (CARD_H + GAP)
    const right = x + cardW - PAD
    const top = y + 14
    const bottom = y + 31
    const labelX = m.kind === 'context' ? x + PAD + 26 : x + PAD
    const color = look.bar(m.kind, m.level)
    const detail = m.amount
      ? `<text class="t" x="${right}" y="${top + 4}" text-anchor="end" font-family="${MONO}" font-size="11.5" font-weight="600">${m.amount}</text>`
      : m.resetsInMs === undefined
        ? ''
        : `<text class="m" x="${right}" y="${top + 4}" text-anchor="end" font-family="${MONO}" font-size="11.5" font-weight="500">↻ ${countdown(m.resetsInMs)}</text>`
    return (
      `<rect class="p" x="${x}" y="${y}" width="${cardW}" height="${CARD_H}" rx="8"/>` +
      (m.kind === 'context' ? sprite('context', x + PAD + 1, top - spriteSize('context').height / 2) : '') +
      `<text class="m" x="${labelX}" y="${top + 3.5}" font-family="${MONO}" font-size="10" font-weight="600" letter-spacing=".08em">${xml(usageLabel(m, right - labelX - (mainOf(m) ? monoWidth(mainOf(m), 11.5) + 8 : 0), 10))}</text>` +
      detail +
      pixelBar(`sabai-${m.kind}`, x + PAD, bottom - 4.5, cardW - PAD * 2 - 44, 9, m.percent / 100, color, 0, style) +
      `<text class="${pctClass(m)}" x="${right}" y="${bottom + 4}" text-anchor="end" font-family="${MONO}" font-size="11.5" font-weight="700">${pctText(m)}</text>`
    )
  })
  const alt = list
    .map(m => `${m.label} ${value(m)}${m.resetsInMs === undefined ? '' : `, resets in ${countdown(m.resetsInMs)}`}`)
    .join('; ')
  return { body: cards.join(''), height: rows * CARD_H + (rows - 1) * GAP, alt }
}

// Measured by what a reader sees: a joined emoji is one character, and it or a CJK one is wide.
export const monoWidth = (s: string, size: number) => graphemes(s).reduce((w, g) => w + (wideEm(g) ?? 0.6) * size, 0)
// A monospace line cut to `maxW`, with room to spare for the advance of the system's mono face.
// Cut on whole characters, never inside a surrogate pair or a joined emoji, which would leave the
// SVG malformed or a glyph broken.
const fitMono = (s: string, size: number, maxW: number, min = 1) => {
  const adv = (g: string) => ((wideEm(g) ?? 0.6) / 0.6) * 0.64 * size
  const chars = graphemes(s)
  if (chars.length <= min || chars.reduce((w, g) => w + adv(g), 0) <= maxW) return s
  let w = adv('…')
  let n = 0
  while (n < chars.length && w + adv(chars[n]!) <= maxW) w += adv(chars[n++]!)
  return `${chars.slice(0, Math.max(min, n)).join('')}…`
}

const INFO_H = 22
const SKELETON_W = 180
// The info row: the project, its branch as a tinted tag with the sync counts, then the git user
// and Node as small marks in the muted ink. Room runs out from the right: the user goes first,
// then Node; then the branch and folder names are cut. Its words take the surface's inks, which
// infoSvg turns into its card's.
function infoPart(info: { left: readonly Chip[]; right: readonly Chip[]; pending?: boolean }, W: number, y: number, look: Look, clawd?: { look: Look; mood: Mood; accessory?: Accessory; trick?: Trick }): Part {
  const all = [...info.left, ...info.right]
  const by = (k: IconKind) => all.find(c => c.icon === k)
  const folder = by('folder')
  const branch = by('branch')
  const user = by('git')
  const node = by('node')
  const mid = y + INFO_H / 2
  const lead = clawd ? clawdAt(clawd.look, 0, y + (INFO_H - spriteSize('tasks').height) / 2, clawd.mood, clawd.accessory, clawd.trick) : ''
  const x0 = clawd ? spriteSize('tasks').width + GAP : 0
  // The right side in its order, each with how long it stays when room is short.
  const items = [
    user && { k: 'git' as const, v: user.value, keep: 1 },
    node && { k: 'node' as const, v: node.value.replace(/^v?/, 'v'), keep: 2 },
  ].filter(Boolean) as { k: IconKind; v: string; keep: number }[]
  const itemW = (i: { v: string }) => 12 + (i.v ? 5 + monoWidth(i.v, 10.5) : 0)
  const rightW = (list: typeof items) => list.reduce((n, i) => n + itemW(i), 0) + 16 * Math.max(0, list.length - 1)
  const counts =
    branch && branch.branch !== undefined
      ? ([[branch.ahead, '↑', 's-ok'], [branch.behind, '↓', 's-context'], [branch.changes, '±', 's-warn']] as const)
          .filter(([n]) => n !== undefined && n > 0)
          .map(([n, mark, cls]) => ({ s: `${mark}${n}`, cls }))
      : []
  let syncs = counts
  const syncsW = () => syncs.reduce((n, c) => n + monoWidth(c.s, 10.5) + 7, 0)
  // A very long branch (a dependabot or feature path) is cut to 23 characters and `…` before it can
  // push Node off an otherwise roomy row.
  const fullName = graphemes(branch ? (branch.branch ?? branch.value) : '')
  const name = fullName.length > 24 ? `${fullName.slice(0, 23).join('')}…` : fullName.join('')
  const tagW = (s: string) => 8 + 12 + 5 + monoWidth(s, 11) + 8
  const folderW = (s: string) => 19 + textWidth(s, 14.5) + 12
  let hasFolder = Boolean(folder)
  const leftW = (f: string, b: string) => x0 + (info.pending ? SKELETON_W : 0) + (hasFolder ? folderW(f) : 0) + (branch ? tagW(b) + 10 : 0) + syncsW()
  let shown = items
  while (shown.length && leftW(folder?.value ?? '', name) + 12 > W - rightW(shown)) {
    const least = Math.min(...shown.map(i => i.keep))
    shown = shown.filter(i => i.keep !== least)
  }
  let b = name
  let f = folder?.value ?? ''
  // Still too wide with nothing at the right, the branch kept longest: the sync counts go, the
  // folder is cut (to three characters), then left out, and last the branch is cut (to six).
  const over = () => !shown.length && leftW(f, b) > W
  if (over()) syncs = []
  if (over() && hasFolder) f = fit(f, 14.5, textWidth(f, 14.5) - (leftW(f, b) - W), 3)
  if (over() && branch) hasFolder = false
  if (over()) b = fitMono(b, 11, monoWidth(b, 11) - (leftW(f, b) - W), 6)
  let x = x0
  let body = lead
  // Until the branch is read, two still bars where the folder and branch will be.
  if (info.pending) {
    body += `<g class="sm" opacity=".22"><rect x="${x}" y="${mid - 6}" width="96" height="12" rx="6"/><rect x="${x + 106}" y="${mid - 6}" width="64" height="12" rx="6"/></g>`
    x += SKELETON_W
  }
  if (folder && hasFolder) {
    body += icon('folder', x, mid - 6.5, 13, 'sm') + `<text class="st" x="${x + 19}" y="${mid + 5}" font-family="${SANS}" font-size="14.5" font-weight="700">${xml(f)}</text>`
    x += folderW(f)
  }
  if (branch) {
    const tw = tagW(b)
    body +=
      `<rect x="${+x.toFixed(1)}" y="${mid - 10}" width="${+tw.toFixed(1)}" height="20" rx="10" fill="${look.bar('session')}" opacity=".13"/>` +
      icon('branch', +(x + 8).toFixed(1), mid - 6, 12, 's-session') +
      `<text class="s-session" x="${+(x + 25).toFixed(1)}" y="${mid + 4}" font-family="${MONO}" font-size="11" font-weight="600">${xml(b)}</text>`
    x += tw + 10
    for (const c of syncs) {
      body += `<text class="${c.cls}" x="${+x.toFixed(1)}" y="${mid + 4}" font-family="${MONO}" font-size="10.5" font-weight="600">${c.s}</text>`
      x += monoWidth(c.s, 10.5) + 7
    }
  }
  let rx = x + 8
  for (const i of shown) {
    body += icon(i.k, +rx.toFixed(1), mid - 6, 12, 'sm') + (i.v ? `<text class="sm" x="${+(rx + 17).toFixed(1)}" y="${mid + 4}" font-family="${MONO}" font-size="10.5">${xml(i.v)}</text>` : '')
    rx += itemW(i) + 16
  }
  const drawn = all.filter(c => (c.icon === 'folder' && hasFolder) || c.icon === 'branch' || shown.some(i => i.k === c.icon))
  const alt = [...(info.pending ? ['Reading the project'] : []), ...drawn.map(c => `${c.label} ${c.value}`)].join(', ') + (clawd ? moodSaid(clawd.mood) : '')
  return { body: `<g class="info">${body}</g><!--info-->`, height: INFO_H, alt: alt.replace(/^; /, '') }
}

const CREW_H = 22
const CREW_MAX = 5
const CREW_SCALE = 0.8

// The agents at work: a small Clawd per running agent (the newest CREW_MAX) in its hat with its
// tool, the newest one's task and progress, then the running and finished counts and the time.
// When none runs, the latest finished ones stand by and the text sums them up.
function crewPart(look: Look, runs: readonly AgentRun[], now: number, W: number, top: number): Part {
  const newest = [...runs].reverse()
  const running = newest.filter(a => a.status === 'running')
  const ended = newest.filter(a => a.status !== 'running')
  const stopped = ended.filter(a => a.reason === 'aborted').length
  const failed = ended.filter(a => a.status === 'failed').length - stopped
  const done = ended.length - failed - stopped
  const step = (spriteSize('tasks').width + PROP_W) * CREW_SCALE + 3
  // As many Clawds as leave room for the words and counts on a narrow band.
  const room = Math.max(1, Math.min(CREW_MAX, Math.floor((W - 200) / step)))
  const shown = (running.length ? running : ended).slice(0, room)
  const avatars = shown
    .map((a, i) => {
      const { hat, hatColor } = hatOf(look, a.type)
      const mode = a.status === 'running' ? 'run' : 'idle'
      return (
        `<g transform="translate(${i * step},${top + 2}) scale(${CREW_SCALE})"${a.status === 'running' ? '' : ' opacity=".6"'}>` +
        sprite('tasks', 0, HAT_H, mode, look.clawd, { kind: hat, color: hatColor, prop: true }) +
        '</g>'
      )
    })
    .join('')
  const more = running.length - shown.length
  let x = shown.length * step + 4
  const moreText = more > 0 ? `<text class="sm" x="${x}" y="${top + 15}" font-family="${MONO}" font-size="11" font-weight="600">+${more}</text>` : ''
  if (more > 0) x += monoWidth(`+${more}`, 11) + 8
  const lead = running[0]
  const line = lead && progressOf(lead)
  const title = lead ? lead.description || lead.type : failed || stopped ? [`${done} done`, failed && `${failed} failed`, stopped && `${stopped} stopped`].filter(Boolean).join(' · ') : `All ${ended.length} done`
  const detail = lead ? (line ? `${line.done}/${line.total} · ${line.title}` : lead.requests === undefined ? '' : plural(lead.requests, 'request')) : ''
  // The right side, laid out from the edge: time, then failed, done and running counts.
  const s = summary([...runs], now)
  const time = clock(s.ms)
  let rx = W - monoWidth(time, 11)
  const right: string[] = [`<text class="sm" x="${W}" y="${top + 15}" text-anchor="end" font-family="${MONO}" font-size="11">${time}</text>`]
  const count = (n: number, status: Mark) => {
    rx -= monoWidth(String(n), 11.5) + 18
    right.push(statusMark(look, status, rx + 4, top + 11))
    right.push(`<text class="st" x="${rx + 12}" y="${top + 15}" font-family="${MONO}" font-size="11.5" font-weight="700">${n}</text>`)
  }
  if (stopped) count(stopped, 'stopped')
  if (failed) count(failed, 'failed')
  if (done) count(done, 'done')
  if (running.length) count(running.length, 'running')
  const textW = rx - x - 12
  // Too little room for the words: leave them out rather than draw them over the counts.
  const hasWords = textW >= 60
  const titleText = hasWords ? fit(title, 12.5, textW * 0.6) : ''
  const titleW = textWidth(titleText, 12.5)
  const body =
    avatars +
    moreText +
    (hasWords ? `<text class="st" x="${x}" y="${top + 15}" font-family="${SANS}" font-size="12.5" font-weight="600">${xml(titleText)}</text>` : '') +
    (hasWords && detail ? `<text class="sm" x="${x + titleW + 10}" y="${top + 15}" font-family="${MONO}" font-size="11">${xml(fitMono(detail, 11, Math.max(20, textW - titleW - 10)))}</text>` : '') +
    right.join('')
  const counts = [running.length ? `${running.length} running` : '', done ? `${done} done` : '', failed ? `${failed} failed` : '', stopped ? `${stopped} stopped` : ''].filter(Boolean).join(', ')
  return { body, height: CREW_H, alt: `Subagents: ${counts}; ${lead ? lead.description || lead.type : title}` }
}

// The race's motion, carried only by the race box: a just-finished agent's row flashes.
const RACE_MOTION = '.flash{animation:rfx 1s ease-in-out infinite}@keyframes rfx{50%{opacity:.03}}'
const RACE_W = 300
const RACE_HEAD = 24
const RACE_ROW = 22
const RACE_SCALE = 0.62
const RACE_BODY = '#b9b9b4'
// Confetti round a just-finished Clawd: offsets from his middle and their colours.
const RACE_CONFETTI = [[-5, -3, 'context'], [3, -7, 'session'], [10, -2, 'week'], [16, -6, 'tasks'], [-2, -8, 'week']] as const

// The race: a header (how many agents run and are done, the turn's failed calls, its time), then a
// row per member, Main first: a stripe in its mood's colour, its Clawd in its type's hat (Main in
// the captain's cap) holding its call, its name and step, then its failed calls, a plan's
// done/total and bar, and its time. A quiet agent dozes; one just finished hops among confetti on
// a flashing row, then folds to a check; one just failed falls on a red-flashing row, then folds to
// a cross. Past the rows, how many more the Agents pane holds.
export function racePart(look: Look, race: Race, W: number, top: number): Part {
  const time = race.elapsedMs === undefined ? '' : clock(race.elapsedMs)
  // Worded as the Agents pane's Now box counts its crew.
  const lead = race.agents ? `${race.agents} running` : ''
  // The agents that ended, each way apart: a failed or stopped agent is not done.
  const ended = [race.done && `${race.done} done`, race.failed && `${race.failed} failed`, race.stopped && `${race.stopped} stopped`].filter(Boolean).join(' · ')
  // Measured a size up for the bold lead; SVG drops the space before its dot.
  const tallyX = 12 + (lead ? textWidth(lead, 11.5) + 4 : 0)
  const room = W - 12 - (time ? monoWidth(time, 10.5) + 10 : 0) - (race.fails ? monoWidth(`✗ ${race.fails}`, 10.5) + 10 : 0) - tallyX
  const tally = ended ? fit(`${lead ? '· ' : ''}${ended}`, 10.5, room) : ''
  const ty0 = top + 16
  let head =
    (lead ? `<text class="t" x="12" y="${ty0}" font-family="${SANS}" font-size="11" font-weight="700">${lead}</text>` : '') +
    (tally ? `<text class="m" x="${+tallyX.toFixed(1)}" y="${ty0}" font-family="${SANS}" font-size="10.5">${xml(tally)}</text>` : '') +
    (time ? `<text class="m" x="${W - 12}" y="${ty0}" text-anchor="end" font-family="${MONO}" font-size="10.5">${time}</text>` : '')
  if (race.fails) head += `<text class="c-alert" x="${+(W - 12 - (time ? monoWidth(time, 10.5) + 10 : 0)).toFixed(1)}" y="${ty0}" text-anchor="end" font-family="${MONO}" font-size="10.5" font-weight="700">✗ ${race.fails}</text>`
  const x = 14
  const nameX = x + 24
  // What each row says after its name, in its ink.
  const said = (l: Lane): [string, string] =>
    l.quietMs !== undefined ? ['c-warn', `Quiet ${Math.floor(l.quietMs / 1000)}s`] :
    l.state === 'failed' || l.state === 'tripped' ? ['c-alert', l.line] :
    l.state === 'stopped' ? ['m', l.line] :
    l.state === 'done' ? ['c-ok', l.fresh ? 'Done 🎉' : 'Done'] : ['m', l.line]
  const rows = race.lanes.map((l, i) => {
    const y = top + RACE_HEAD + i * RACE_ROW
    const mid = y + RACE_ROW / 2
    const ty = mid + 3.5
    const main = l.id === 'main'
    const color = main || !l.mood ? kl('skill') : l.state === 'tripped' ? kl('fail') : moodColor(l.mood)
    const stripe = `<rect x="4" y="${y + 3}" width="3" height="${RACE_ROW - 6}" rx="1.5" fill="${color}"${l.state === 'waiting' ? ' opacity=".35"' : ''}/>`
    // The right side from the edge: the time, the failed calls, a plan's done/total and bar.
    let edge = W - 12
    let right = ''
    const lt = l.timeMs === undefined ? '' : clock(l.timeMs)
    if (lt) {
      right += `<text class="m" x="${edge}" y="${ty}" text-anchor="end" font-family="${MONO}" font-size="9.5">${lt}</text>`
      edge -= monoWidth(lt, 9.5) + 6
    }
    if (l.fails) {
      right += `<text class="c-alert" x="${+edge.toFixed(1)}" y="${ty}" text-anchor="end" font-family="${MONO}" font-size="9.5" font-weight="700">✗${l.fails}</text>`
      edge -= monoWidth(`✗${l.fails}`, 9.5) + 6
    }
    if (l.steps) {
      const frac = `${l.steps.done}/${l.steps.total}`
      const bx = edge - 30
      right +=
        `<rect class="k" x="${+bx.toFixed(1)}" y="${mid - 2}" width="30" height="4" rx="2"/>` +
        `<rect x="${+bx.toFixed(1)}" y="${mid - 2}" width="${+((30 * l.steps.done) / l.steps.total).toFixed(1)}" height="4" rx="2" fill="${kl('skill')}"/>` +
        `<text class="m" x="${+(bx - 4).toFixed(1)}" y="${ty}" text-anchor="end" font-family="${MONO}" font-size="9">${frac}</text>`
      edge = bx - 4 - monoWidth(frac, 9) - 6
    }
    if (l.uses) {
      for (const [kind, n] of [['skill', l.uses.skills], ['mcp', l.uses.mcp]] as const) {
        if (!n) continue
        edge -= 12 + 2 + monoWidth(String(n), 9.5)
        right += useIcon(kind, +edge.toFixed(1), mid - 6, 12) + `<text class="m" x="${+(edge + 14).toFixed(1)}" y="${ty}" font-family="${MONO}" font-size="9.5">${n}</text>`
        edge -= 6
      }
    }
    const mode = l.quietMs !== undefined ? 'sleep' : l.state === 'running' ? 'run' : l.state === 'tripped' ? 'dizzy' : l.state === 'scored' || (l.fresh && l.state === 'done') ? 'hop' : l.state === 'failed' && l.fresh ? 'out' : 'idle'
    const style = l.type ? hatOf(look, l.type) : undefined
    // Main wears the captain's cap; a finished agent holds its report.
    const hat = main ? { kind: 'captain' as const, prop: true } : style ? { kind: style.hat, color: style.hatColor, prop: l.state === 'done' ? ('scroll' as const) : true } : undefined
    const tool = l.state === 'running' && l.quietMs === undefined ? l.doing : undefined
    // An ended member keeps its Clawd, dimmed once settled; its line's tile says how it ended.
    const settled = l.state === 'stopped' || ((l.state === 'done' || l.state === 'failed') && !l.fresh)
    const figure =
      `<g transform="translate(${x},${y + 2}) scale(${RACE_SCALE})"${settled ? ' opacity=".6"' : ''}>${asPaths(sprite('tasks', 0, HAT_H, mode, l.state === 'failed' ? RACE_BODY : look.clawd, hat, undefined, tool))}</g>`
    const failed = l.state === 'failed'
    const party = l.fresh
      ? `<rect class="flash" x="2" y="${y + 1}" width="${W - 4}" height="${RACE_ROW - 2}" rx="6" fill="${kl(failed ? 'fail' : 'ok')}" opacity=".35"/>`
      : ''
    const confetti = l.fresh && !failed
      ? RACE_CONFETTI.map(([dx, dy, k], j) => `<rect class="cf" style="animation-delay:-${j * 0.2}s" x="${x + 8 + dx}" y="${y + 10 + dy}" width="2" height="2" fill="${look.bar(k)}"/>`).join('')
      : ''
    // Measured a size up for the bold name, so the ×N badge and the line keep clear of it.
    const name = fit(l.who, 11.5, 130)
    const nameW = textWidth(name, 11.5)
    // A failed agent's name keeps its ink, as a done one's does; its step says it failed.
    const nameClass = l.state === 'tripped' ? 'c-alert' : 't'
    const badge = l.many
      ? `<rect class="k" x="${+(nameX + nameW + 4).toFixed(1)}" y="${mid - 5.5}" width="20" height="11" rx="5.5"/><text class="t" x="${+(nameX + nameW + 14).toFixed(1)}" y="${mid + 3}" text-anchor="middle" font-family="${MONO}" font-size="8.5" font-weight="700">×${l.many}</text>`
      : ''
    const stepX = nameX + nameW + (l.many ? 30 : 6)
    const [ink, words] = said(l)
    // Its state's icon, then its words.
    const step = edge - stepX - 24 >= 20
      ? statusTile(laneTile(l), +stepX.toFixed(1), mid - 7, 14) + `<text class="${ink}" x="${+(stepX + 18).toFixed(1)}" y="${ty}" font-family="${SANS}" font-size="10">${xml(fit(words, 10, edge - stepX - 24))}</text>`
      : ''
    return party + stripe + figure + confetti + `<text class="${nameClass}" x="${nameX}" y="${ty}" font-family="${SANS}" font-size="10.5" font-weight="700">${xml(name)}</text>` + badge + step + right
  })
  let height = RACE_HEAD + race.lanes.length * RACE_ROW
  const more = race.more ? `<text class="m" x="${x}" y="${top + height + 10}" font-family="${SANS}" font-size="10">+${race.more} more · open Subagents for all</text>` : ''
  if (race.more) height += 16
  const alt = [
    `Race: ${[lead, ...ended.split(' · '), race.fails ? `${race.fails} failed ${race.fails === 1 ? 'call' : 'calls'}` : '', time].filter(Boolean).join(', ')}`,
    ...race.lanes.map(l => `${l.who}${l.many ? ` ×${l.many}` : ''} ${l.state === 'tripped' || l.state === 'scored' ? 'running' : l.state}: ${said(l)[1]}${l.steps ? ` (${l.steps.done}/${l.steps.total})` : ''}${l.fails ? `, ${l.fails} failed` : ''}${l.uses ? `, ${[l.uses.skills && plural(l.uses.skills, 'skill'), l.uses.mcp && plural(l.uses.mcp, 'MCP server')].filter(Boolean).join(' and ')}` : ''}`),
    ...(race.more ? [`${race.more} more in the Subagents pane`] : []),
  ].join('; ')
  return { body: `<style>${RACE_MOTION}</style>` + head + rows.join('') + more, height: height + 6, alt }
}

export const HERO_MIN_W = 480
export const RACE_MIN_W = 760
const HERO_PANEL_W = 108
// What Clawd's panel says under him for each mood.
const MOOD_WORDS: Record<Mood, string> = { idle: 'Ready', working: 'Working', startled: 'Blocked', sad: 'Tests failing', celebrating: 'All green', sweating: 'Context full', sleeping: 'Napping' }

export const USAGE_STYLES: Record<UsageStyle, string> = { tiles: 'Tiles', rings: 'Rings', columns: 'Columns', rows: 'Rows' }
const USAGE_MIN_H = 50
// Under this a cell has no room for a label line, a large percent and the details stacked: the
// percent shares the label's line and only the amount stays under the bar.
const USAGE_SHORT_H = 80
// A cell's words: the amount or countdown, then the second detail (what is left, or the reset's
// clock time), each only when the meter has it.
const mainOf = (m: Meter) => m.amount ?? (m.resetsInMs === undefined ? '' : `↻ ${countdown(m.resetsInMs)}`)
const subOf = (m: Meter, now: number | undefined) => m.left ?? (now === undefined ? undefined : resetClock(m.resetsInMs, now)) ?? ''
// A skeleton meter has no reading: a dash in the muted ink where its percent will be.
const pctClass = (m: Meter) => (m.pending ? 'm' : `c-${m.level ?? m.kind}`)
const pctText = (m: Meter) => (m.pending ? '—' : `${m.percent}%`)
// A meter's title in full when it fits its room (letter-spaced), else its first word: SESSION LIMIT
// becomes SESSION on a narrow card rather than being cut.
// The two limits shorten together: measured as the longer of them, so equal cards never read Session beside Weekly limit.
const usageLabel = (m: Meter, room = Infinity, size = 9.5) => {
  const full = m.label.toUpperCase()
  const longest = m.kind === 'context' ? full : 'SESSION LIMIT'
  return monoWidth(longest, size) + longest.length * 0.08 * size <= room ? full : full.split(' ')[0]!
}
// One line of a usage cell, cut to its room.
const utext = (cls: string, x: number, y: number, s: string, size: number, room: number, extra = '') =>
  s ? `<text class="${cls}" x="${+x.toFixed(1)}" y="${+y.toFixed(1)}" font-family="${MONO}" font-size="${size}"${extra}>${xml(fitMono(s, size, Math.max(8, room)))}</text>` : ''
const cellsOf = (w: number, n: number) => {
  const cw = (w - GAP * (n - 1)) / n
  return { cw, at: (i: number) => i * (cw + GAP) }
}
// A percent's size: what the height allows, never wider than its room for `100%`.
const pctSize = (fromHeight: number, room: number) => Math.max(12, Math.min(fromHeight, Math.floor(room / monoWidth('100%', 1))))
const cardRect = (x: number, w: number, h: number) => `<rect class="p" x="${+x.toFixed(1)}" width="${+w.toFixed(1)}" height="${h}" rx="10"/>`

// A card per limit as tall as the usage: the label, a large percent, a bar, then the details.
function tilesStyle(look: Look, list: readonly Meter[], w: number, h: number, bar: BarStyle, now?: number): string {
  const { cw, at } = cellsOf(w, list.length)
  const roomy = h >= 110
  const big = pctSize(Math.max(18, Math.min(44, Math.round(h * 0.3))), cw - 28)
  if (h < USAGE_SHORT_H) {
    const size = pctSize(16, (cw - 28) / 2)
    return list
      .map((m, i) => {
        const x = at(i)
        const inner = cw - 28
        const pctW = monoWidth(pctText(m), size)
        return (
          cardRect(x, cw, h) +
          utext('m', x + 14, 18, usageLabel(m, inner - pctW - 6, 9.5), 9.5, inner - pctW - 6, ' font-weight="700" letter-spacing=".08em"') +
          utext(pctClass(m), x + cw - 14, 19, pctText(m), size, inner, ' font-weight="800" text-anchor="end"') +
          pixelBar(`sabai-u-${m.kind}`, x + 14, 26, inner, 6, m.percent / 100, look.bar(m.kind, m.level), 0, bar) +
          utext('t', x + 14, Math.min(h - 6, 46), mainOf(m), 10.5, inner, ' font-weight="600"')
        )
      })
      .join('')
  }
  return list
    .map((m, i) => {
      const x = at(i)
      const inner = cw - 28
      const barY = h - (roomy ? 44 : 30)
      return (
        cardRect(x, cw, h) +
        utext('m', x + 14, 18, usageLabel(m, inner, 9.5), 9.5, inner, ' font-weight="700" letter-spacing=".08em"') +
        utext(pctClass(m), x + 14, Math.min(barY - 6, 18 + big + 4), pctText(m), big, inner, ' font-weight="800"') +
        pixelBar(`sabai-u-${m.kind}`, x + 14, barY, inner, roomy ? 8 : 6, m.percent / 100, look.bar(m.kind, m.level), 0, bar) +
        utext('t', x + 14, h - (roomy ? 22 : 10), mainOf(m), 10.5, roomy ? inner : inner / 2, ' font-weight="600"') +
        (roomy ? utext('m', x + 14, h - 8, subOf(m, now), 10, inner) : utext('m', x + cw - 14, h - 10, subOf(m, now), 9.5, inner / 2 - 6, ' text-anchor="end"'))
      )
    })
    .join('')
}

// A card per limit with a ring sized to the height and the percent inside; the words beside it,
// or under it when the card is too narrow.
function ringsStyle(look: Look, list: readonly Meter[], w: number, h: number, _bar: BarStyle, now?: number): string {
  const { cw, at } = cellsOf(w, list.length)
  return list
    .map((m, i) => {
      const x = at(i)
      // Stacked needs height for a ring and two lines under it; short cells keep words beside.
      const stacked = h >= 96 && cw < Math.min(h - 16, cw * 0.52) + 120
      const d = stacked ? Math.max(40, Math.min(h - 46, cw - 24)) : Math.max(24, Math.min(h - 12, cw * 0.52))
      const r = d / 2 - 5
      const sw = Math.max(5, d * 0.09)
      const c = 2 * Math.PI * r
      const cx = stacked ? x + cw / 2 : x + 10 + d / 2
      const cy = stacked ? 8 + d / 2 : h / 2
      const fs = Math.max(12, Math.round(d * 0.24))
      const at2 = (n: number) => +n.toFixed(1)
      const ring =
        `<circle class="k-stroke" cx="${at2(cx)}" cy="${at2(cy)}" r="${at2(r)}" fill="none" stroke-width="${at2(sw)}"/>` +
        // None at 0%: a round cap on an empty arc still draws a dot.
        (m.percent > 0 ? `<circle cx="${at2(cx)}" cy="${at2(cy)}" r="${at2(r)}" fill="none" stroke="${look.bar(m.kind, m.level)}" stroke-width="${at2(sw)}" stroke-linecap="round" stroke-dasharray="${at2((c * m.percent) / 100)} ${at2(c)}" transform="rotate(-90 ${at2(cx)} ${at2(cy)})"/>` : '')
      const pct = utext(pctClass(m), cx, cy + fs * 0.35, pctText(m), fs, d - 2 * sw, ' font-weight="800" text-anchor="middle"')
      const words = stacked
        ? utext('t', cx, cy + d / 2 + 16, [usageLabel(m, cw - 32 - monoWidth(mainOf(m), 10), 10), mainOf(m)].filter(Boolean).join(' · '), 10, cw - 12, ' font-weight="600" text-anchor="middle"') +
          (h - (cy + d / 2) >= 34 ? utext('m', cx, cy + d / 2 + 30, subOf(m, now), 9.5, cw - 12, ' text-anchor="middle"') : '')
        : utext('m', x + 18 + d, h / 2 - 8, usageLabel(m, cw - d - 26, 9.5), 9.5, cw - d - 26, ' font-weight="700" letter-spacing=".08em"') +
          utext('t', x + 18 + d, h / 2 + 8, mainOf(m), 10.5, cw - d - 26, ' font-weight="600"') +
          (h >= 90 ? utext('m', x + 18 + d, h / 2 + 22, subOf(m, now), 9.5, cw - d - 26) : '')
      return cardRect(x, cw, h) + ring + pct + words
    })
    .join('')
}

// A card per limit with a column filling from the bottom in the bar style stood upright; the
// label, a large percent and the details beside it.
function columnsStyle(look: Look, list: readonly Meter[], w: number, h: number, bar: BarStyle, now?: number): string {
  const { cw, at } = cellsOf(w, list.length)
  const short = h < USAGE_SHORT_H
  const big = pctSize(short ? 15 : Math.max(18, Math.min(40, Math.round(h * 0.28))), cw - 52)
  return list
    .map((m, i) => {
      const x = at(i)
      const colH = h - 20
      const inner = cw - 52
      // Drawn along the column's height, then turned a quarter so it fills from the bottom.
      const column = `<g transform="translate(${+(x + 12).toFixed(1)},${10 + colH}) rotate(-90)">${pixelBar(`sabai-c-${m.kind}`, 0, 0, colH, 16, m.percent / 100, look.bar(m.kind, m.level), 0, bar)}</g>`
      return (
        cardRect(x, cw, h) +
        column +
        utext('m', x + 40, 20, usageLabel(m, inner, 9.5), 9.5, inner, ' font-weight="700" letter-spacing=".08em"') +
        utext(pctClass(m), x + 40, short ? 20 + big + 1 : Math.min(h - 26, 20 + big + 2), pctText(m), big, inner, ' font-weight="800"') +
        (short && h < 20 + big + 1 + 14 ? '' : utext('t', x + 40, h - (h >= 110 ? 24 : 6), mainOf(m), short ? 9.5 : 10.5, inner, ' font-weight="600"')) +
        (h >= 110 ? utext('m', x + 40, h - 10, subOf(m, now), 9.5, inner) : '')
      )
    })
    .join('')
}

// One card holding the limits as rows spread over the height: label, bar, details, a large percent.
function rowsStyle(look: Look, list: readonly Meter[], w: number, h: number, bar: BarStyle, now?: number): string {
  const rowH = h / list.length
  const big = Math.max(13, Math.min(26, Math.round(rowH * 0.42)))
  const pctW = monoWidth('100%', big) + 14
  const wordsW = Math.min(140, Math.max(60, w * 0.3))
  const barX = 84
  const barW = Math.max(20, w - barX - wordsW - pctW - 14)
  return (
    cardRect(0, w, h) +
    list
      .map((m, i) => {
        const y = i * rowH
        const mid = y + rowH / 2
        return (
          (i ? `<rect class="k" x="12" y="${+y.toFixed(1)}" width="${w - 24}" height="1"/>` : '') +
          utext('m', 14, mid + 4, usageLabel(m, barX - 20, 10), 10, barX - 20, ' font-weight="700" letter-spacing=".08em"') +
          pixelBar(`sabai-r-${m.kind}`, barX, mid - 4, barW, 8, m.percent / 100, look.bar(m.kind, m.level), 0, bar) +
          utext('t', w - pctW - 8, mid + (rowH >= 44 ? -1 : 4), mainOf(m), 10.5, wordsW - 10, ' font-weight="600" text-anchor="end"') +
          (rowH >= 44 ? utext('m', w - pctW - 8, mid + 13, subOf(m, now), 9.5, wordsW - 10, ' text-anchor="end"') : '') +
          utext(pctClass(m), w - 14, mid + big * 0.36, pctText(m), big, pctW, ' font-weight="800" text-anchor="end"')
        )
      })
      .join('')
  )
}

const USAGE_DRAW: Record<UsageStyle, (look: Look, list: readonly Meter[], w: number, h: number, bar: BarStyle, now?: number) => string> = { tiles: tilesStyle, rings: ringsStyle, columns: columnsStyle, rows: rowsStyle }
// The usage limits in the chosen style, filling w × h from (x, y).
function usagePart(look: Look, list: readonly Meter[], x: number, y: number, w: number, h: number, style: UsageStyle, bar: BarStyle, now?: number): Part {
  const alt = list.map(m => `${m.label} ${value(m)}${m.resetsInMs === undefined ? '' : `, resets in ${countdown(m.resetsInMs)}`}`).join('; ')
  return { body: `<g class="usage" transform="translate(${x},${y})">${USAGE_DRAW[style](look, list, w, h, bar, now)}</g><!--usage-->`, height: h, alt }
}
// The usage's place when the engine has answered with nothing to show: its card, and why it is empty.
function notePart(text: string, x: number, y: number, w: number, h: number): Part {
  return { body: `<g transform="translate(${x},${y})">${cardRect(0, w, h)}${utext('m', w / 2, h / 2 + 4, text, 10.5, w - 28, ' text-anchor="middle"')}</g>`, height: h, alt: text }
}

// The comfortable band: Clawd large in his own panel at the left, with his mood and the turn's
// time under him; at the right the live strip, tasks and crew when present, then the usage
// limits; from 760 px the race at the far right.
function heroBand(p: Progress | undefined, list: readonly Meter[], W: number, opts: BandOpts): Drawing | undefined {
  const { mood = 'idle', skin = 'auto', style = 'dither', crew, live, accessory, clawd = true, clawdLine, usageStyle = 'tiles', usageNote, now } = opts
  // The race shows from 760 px; below that its time and agents stay in the live strip and crew rows.
  const race = W >= RACE_MIN_W ? opts.race : undefined
  const look = lookOf(skin)
  const x0 = clawd ? HERO_PANEL_W + GAP : 0
  const rw = W - x0 - (race ? RACE_W + GAP : 0)
  const parts: Part[] = []
  let y = 0
  const add = (part: Part) => {
    parts.push(part)
    y += part.height + GAP
  }
  // Clawd's line carries the turn's time while he works, so the live strip leaves it out.
  if (live && !race) add(livePart(look, clawd && mood === 'working' ? { ...live, elapsedMs: undefined } : live, rw, y))
  if (p) add(progressPart(look, p, rw, mood, y, style, false))
  if (crew?.runs.length && !race) add(crewPart(look, crew.runs, crew.now, rw, y))
  const middleH = Math.max(0, y - GAP + 2)
  const raced = race ? racePart(look, race, RACE_W, 0) : undefined
  // The usage fills what the band's height leaves under the rows above it.
  const usageTop = y
  const usage = list.length > 0 || Boolean(usageNote)
  const H = Math.max(clawd ? 112 : 0, raced?.height ?? 0, usage ? usageTop + USAGE_MIN_H : middleH)
  if (H === 0) return undefined
  if (list.length > 0) parts.push(usagePart(look, list, 0, usageTop, rw, H - usageTop, usageStyle, style, now))
  else if (usageNote) parts.push(notePart(usageNote, 0, usageTop, rw, H - usageTop))
  let panel = ''
  // The race's header carries the turn's time, so beside it Clawd keeps his own line.
  // Background work left running stands in for his line while it is the person's turn.
  // Background tasks (shells, monitors): "in background" would not fit Clawd's panel beside the dot.
  const running = opts.running && (mood === 'idle' || mood === 'sleeping') ? `${opts.running} background` : ''
  const words = running || (mood === 'working' && live?.elapsedMs !== undefined && !race ? clock(live.elapsedMs) : (clawdLine ?? ''))
  const wordsClass = mood === 'sad' ? 'c-alert' : 'm'
  if (clawd) {
    const scale = 3
    const hat = hatted(accessory) ? HAT_H * scale : 0
    const cw = spriteSize('tasks').width * scale
    const ch = spriteSize('tasks').height * scale
    const block = hat + ch + 8 + 14 + (words ? 13 : 0)
    const cy = Math.max(6, (H - block) / 2) + hat
    const cx = (HERO_PANEL_W - cw) / 2 - (accessory === 'coffee' || accessory === 'halloween' || accessory === 'songkran' ? PROP_W : 0)
    panel =
      `<rect class="p" width="${HERO_PANEL_W}" height="${H}" rx="10"/>` +
      `<g transform="translate(${cx},${cy}) scale(${scale})">${clawdAt(look, 0, 0, mood, accessory, opts.trick)}</g>` +
      `<text class="t" x="${HERO_PANEL_W / 2}" y="${cy + ch + 18}" text-anchor="middle" font-family="${SANS}" font-size="11.5" font-weight="600">${MOOD_WORDS[mood]}</text>` +
      (running
        ? runningLine(look, running, cy + ch + 32)
        : words ? `<text class="${wordsClass}" x="${HERO_PANEL_W / 2}" y="${cy + ch + 32}" text-anchor="middle" font-family="${MONO}" font-size="10.5">${xml(words)}</text>` : '')
  }
  // Shorter than the band, the middle sits in its middle; with the usage it fills the band.
  const dy = usage ? 0 : Math.max(0, Math.round((H - middleH) / 2))
  const box = raced ? `<g transform="translate(${W - RACE_W},0)"><rect class="p" width="${RACE_W}" height="${H}" rx="10"/>${raced.body}</g>` : ''
  const body = panel + `<g transform="translate(${x0},${dy})">${parts.map(part => part.body).join('')}</g>` + box
  const alt = [...(clawd ? [`Clawd: ${MOOD_WORDS[mood]}${words ? `, ${words}` : ''}`] : []), ...parts.map(part => part.alt), ...(raced ? [raced.alt] : [])]
  return drawing(look, W, H, body, alt.join('; '))
}

// "N running" in the ok ink after a pulsing dot, centred in Clawd's panel as a pair.
function runningLine(look: Look, words: string, y: number): string {
  const x = (HERO_PANEL_W - (11 + monoWidth(words, 10.5))) / 2
  return `<circle class="d0" cx="${+(x + 3.5).toFixed(1)}" cy="${y - 3.5}" r="3.5" fill="${look.bar('context')}"/>` +
    `<text class="c-ok" x="${+(x + 11).toFixed(1)}" y="${y}" font-family="${MONO}" font-size="10.5" font-weight="700">${words}</text>`
}

// How the band is drawn, past its rows' content.
export type BandOpts = {
  mood?: Mood
  skin?: string
  style?: BarStyle
  crew?: { runs: readonly AgentRun[]; now: number }
  density?: 'comfortable' | 'compact'
  clawd?: boolean
  live?: LiveStrip
  accessory?: Accessory
  hero?: boolean
  race?: Race
  // Clawd's second line under his headline (moodLine); working shows the turn's time instead.
  clawdLine?: string
  // Background tasks the last turn left running: "N running" takes his line while idle or asleep.
  running?: number
  trick?: Trick
  usageStyle?: UsageStyle
  // Said in the usage's place when the engine has answered with nothing to show.
  usageNote?: string
  // The band's clock, for the reset's clock time.
  now?: number
}

// The turn as it runs, for the live strip: its time, the step in flight and how long it has run,
// the turn's finished calls (the last RACE_TILES of `calls`), the lines its edits changed, its tests.
export type LiveStrip = {
  elapsedMs?: number
  // A call the race's kinds do not cover (MCP, a skill) carries its own kind for its icon.
  step?: { icon: StepIcon; title: string; kind?: ActKind }
  stepMs?: number
  // With no call in flight, how long since its last call ended (or the turn began), as the race says it.
  thinkingMs?: number
  trail?: readonly { kind: CallKind; ok: boolean }[]
  calls?: number
  lines?: { added: number; removed: number }
  files: number
  commands: number
  test?: { passed: number; failed: number }
}
// The step's icon as the call kind whose tile it wears.
const STEP_KIND: Record<StepIcon, CallKind> = { terminal: 'command', flask: 'test', pen: 'edit', file: 'edit', read: 'read', stop: 'command' }
const TILE = 12
const TILE_STEP = 14

// The live strip: Clawd (when he stands here) and the turn's elapsed time; the call in flight as
// its tile (blinking), its words and its own time, or three blinking dots while the turn thinks;
// at the right the turn's calls as a trail of tiles (newest last, a failure red), then the lines
// its edits changed and its tests.
function livePart(look: Look, live: LiveStrip, W: number, top: number, mood?: Mood, accessory?: Accessory, trick?: Trick): Part {
  // Room for Clawd and anything he holds to his right.
  const lead = mood ? spriteSize('tasks').width + PROP_W + 6 : 0
  const time = live.elapsedMs === undefined ? '' : clock(live.elapsedMs)
  const stepX = lead + (time ? monoWidth(time, 11.5) + 12 : 0)
  const ty = top + 14
  let right = ''
  let edge = W
  // On a narrow band the step outranks everything at the right: the tests and lines go first.
  const roomy = !live.step || W - stepX >= 260
  if (live.test && roomy) {
    const t = live.test.failed ? `✗ ${live.test.failed}` : `✓ ${live.test.passed}`
    right += `<text class="${live.test.failed ? 'c-alert' : 'c-ok'}" x="${edge}" y="${ty}" text-anchor="end" font-family="${MONO}" font-size="11" font-weight="700">${t}</text>`
    edge -= monoWidth(t, 11) + 10
  }
  if (live.lines && live.lines.added + live.lines.removed > 0 && roomy) {
    const removed = `−${live.lines.removed}`
    const added = `+${live.lines.added}`
    right +=
      `<text class="c-alert" x="${edge}" y="${ty}" text-anchor="end" font-family="${MONO}" font-size="11">${removed}</text>` +
      `<text class="c-ok" x="${+(edge - monoWidth(removed, 11) - 4).toFixed(1)}" y="${ty}" text-anchor="end" font-family="${MONO}" font-size="11">${added}</text>`
    edge -= monoWidth(removed, 11) + 4 + monoWidth(added, 11) + 10
  }
  // The trail takes at most 40% of the room, and none when the step would have under 120 px.
  const trail = live.trail ?? []
  const fits = Math.max(0, Math.min(trail.length, Math.floor(((edge - stepX) * 0.4) / TILE_STEP), Math.floor((edge - stepX - 120) / TILE_STEP)))
  const shown = trail.slice(trail.length - fits)
  const tilesX = edge - shown.length * TILE_STEP
  right += shown.map((c, i) => kindTile(c.kind, c.ok, +(tilesX + i * TILE_STEP).toFixed(1), top + 3, TILE)).join('')
  const earlier = shown.length ? (live.calls ?? trail.length) - shown.length : 0
  if (earlier > 0) right += `<text class="m" x="${+(tilesX - 4).toFixed(1)}" y="${ty}" text-anchor="end" font-family="${MONO}" font-size="10">+${earlier}</text>`
  const room = tilesX - (earlier > 0 ? monoWidth(`+${earlier}`, 10) + 8 : 0) - stepX - 10
  let left = ''
  if (live.step) {
    const took = live.stepMs !== undefined && live.stepMs >= 1000 ? clock(live.stepMs) : ''
    const title = room > 60 ? fit(live.step.title, 12, room - 22 - (took ? monoWidth(took, 11) + 8 : 0)) : ''
    left =
      statusTile({ call: live.step.kind ?? STEP_KIND[live.step.icon] }, stepX, top + 2, 16) +
      (title ? `<text class="st" x="${stepX + 22}" y="${ty}" font-family="${SANS}" font-size="12" font-weight="600">${xml(title)}</text>` : '') +
      (title && took ? `<text class="m" x="${+(stepX + 22 + textWidth(title, 12) + 8).toFixed(1)}" y="${ty}" font-family="${MONO}" font-size="11">${took}</text>` : '')
  } else {
    // With no call in flight the turn is thinking, so the strip never stands empty.
    left =
      statusTile('thinking', stepX, top + 2, 16) +
      (room > 60 ? `<text class="m" x="${stepX + 22}" y="${ty}" font-family="${SANS}" font-size="12">Thinking${live.thinkingMs !== undefined ? ` ${clock(live.thinkingMs)}` : ''}</text>` : '')
  }
  const body =
    (mood ? clawdAt(look, 0, top + (ROW_H - spriteSize('tasks').height) / 2, mood, accessory, trick) : '') +
    (time ? `<text class="st" x="${lead}" y="${ty}" font-family="${MONO}" font-size="11.5" font-weight="600">${time}</text>` : '') +
    left +
    right
  const words = [live.files && plural(live.files, 'file'), live.commands && plural(live.commands, 'command'), live.test && (live.test.failed ? `${live.test.failed} failed` : `${live.test.passed} passed`)].filter(Boolean).join(', ')
  return { body: `<g>${body}</g>`, height: ROW_H, alt: `Working${time ? ` ${time}` : ''}: ${live.step ? live.step.title : `Thinking${live.thinkingMs !== undefined ? ` ${clock(live.thinkingMs)}` : ''}`}${words ? `; ${words}` : ''}` }
}

// The whole band as one drawing, so its own spacing (8px) holds rather than a row of the
// surface's between two elements. Rows top to bottom: live strip, tasks, crew, usage cards.
// The info row is a drawing of its own (infoSvg), in the top row above.
export function bandSvg(p: Progress | undefined, list: readonly Meter[], W: number, opts: BandOpts = {}): Drawing | undefined {
  const { mood = 'idle', skin = 'auto', style = 'dither', crew, clawd = true, live, accessory } = opts
  const compact = opts.density === 'compact'
  if (opts.hero && !compact && W >= HERO_MIN_W) return heroBand(p, list, W, opts)
  const gap = compact ? 4 : GAP
  const look = lookOf(skin)
  const parts: Part[] = []
  let y = 0
  const add = (part: Part) => {
    parts.push(part)
    y += part.height + gap
  }
  // One Clawd: the tasks row holds him, else the live strip (else the top row's info card).
  const clawdInLive = !p && Boolean(live) && clawd
  // A hat rises above Clawd: when he stands in the first row, the band starts lower to show it.
  if (clawd && hatted(accessory) && (clawdInLive || Boolean(p))) y = HAT_H
  if (live) add(livePart(look, live, W, y, clawdInLive ? mood : undefined, accessory, opts.trick))
  if (p) add(progressPart(look, p, W, mood, y, style, clawd, accessory, opts.trick))
  if (crew?.runs.length) add(crewPart(look, crew.runs, crew.now, W, y))
  // Compact draws the chosen usage style at its shortest; the comfortable band, stacked, keeps its cards.
  if (list.length > 0) add(compact ? usagePart(look, list, 0, y, W, USAGE_MIN_H, opts.usageStyle ?? 'tiles', style, opts.now) : cardsPart(look, list, W, y, style))
  else if (opts.usageNote) add(notePart(opts.usageNote, 0, y, W, compact ? USAGE_MIN_H : CARD_H))
  if (parts.length === 0) return undefined
  return drawing(look, W, y - gap, parts.map(part => part.body).join(''), parts.map(part => part.alt).join('; '))
}

// The info row on its own, for the desktop's top row beside the buttons: every chip from the
// left on a card of the band's colour that fills W, with Clawd leading it when he stands here.
const INFO_PAD = 8
// The inks the info card's words take.
const INFO_INKS = ['p', 't', 'm', 'c-session', 'c-ok', 'c-context', 'c-warn'] as const
export function infoSvg(
  info: { left: readonly Chip[]; right: readonly Chip[]; pending?: boolean },
  W: number,
  opts: { skin?: string; clawd?: { mood: Mood; accessory?: Accessory; trick?: Trick } } = {},
): Drawing | undefined {
  const { clawd } = opts
  if (info.left.length + info.right.length === 0 && !info.pending && !clawd) return undefined
  const look = lookOf(opts.skin ?? 'auto')
  const hat = clawd && hatted(clawd.accessory) ? HAT_H : 0
  const part = infoPart(info, W - INFO_PAD * 2, hat, look, clawd ? { look, ...clawd } : undefined)
  // On the card the row's words take the card's inks (as the usage cards' do), not the surface's.
  const words = part.body.replace(/class="s([tm])"/g, 'class="$1"').replace(/class="s-/g, 'class="c-')
  const body = `<rect class="p" y="${hat}" width="${W}" height="${part.height}" rx="6"/><g transform="translate(${INFO_PAD},0)">${words}</g>`
  if (clawd) return drawing(look, W, hat + part.height, body, part.alt)
  const h = part.height
  return { source: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}"><style>${leanCss(look, INFO_INKS)}</style>${body}</svg>`, width: W, height: h, alt: part.alt }
}

// A choice's sketch in the settings, its Button under it: the sample on a tint of the track, and
// when in use a ring and a check in Clawd's colour.
const PICK_PAD = 8
function pickTile(look: Look, w: number, innerH: number, inner: string, inUse: boolean): { body: string; height: number } {
  const h = PICK_PAD * 2 + innerH
  const mark = inUse
    ? `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="10" fill="none" stroke="${look.clawd}" stroke-width="2"/>` +
      `<circle cx="${w - 9}" cy="9" r="6.5" fill="${look.clawd}"/><path d="M${w - 12.2} 9l2.3 2.3l4.2-4.6" stroke="#ffffff" stroke-width="1.5" fill="none"/>`
    : ''
  return { body: `<rect class="k" fill-opacity=".45" width="${w}" height="${h}" rx="10"/><g transform="translate(${PICK_PAD},${PICK_PAD})">${inner}</g>${mark}`, height: h }
}
const PICK_INKS = ['p', 'k', 't', 'm'] as const
const leanPick = (look: Look, w: number, tile: { body: string; height: number }, alt: string, inks: readonly string[] = PICK_INKS): Drawing => ({
  source: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${tile.height}" viewBox="0 0 ${w} ${tile.height}"><style>${leanCss(look, inks)}</style>${tile.body}</svg>`,
  width: w,
  height: tile.height,
  alt,
})
const sketchBlock = (x: number, y: number, w: number, h: number, paint = 'class="p"', rx = 3) =>
  `<rect ${paint} x="${+x.toFixed(1)}" y="${+y.toFixed(1)}" width="${+Math.max(0, w).toFixed(1)}" height="${+h.toFixed(1)}" rx="${rx}"/>`
const filled = (color: string) => `fill="${color}"`

// The look picker's choice: a strip of the look's card colour with its text colours (`Aa`) and the
// four accents as segmented bars. Only the look in use carries Clawd (~14k), walking, since a
// pane's whole tree must stay under 100,000 characters.
const SWATCH_H = 32
const SEGMENTS = 6
const SAMPLE_FILL: Record<MeterKind | 'tasks', number> = { tasks: 5, context: 3, session: 2, week: 4 }
export function skinPreview(skin: string, W: number, inUse = false): Drawing {
  const look = lookOf(skin)
  const w = Math.max(200, W)
  const sw = w - PICK_PAD * 2
  const clawd = spriteSize('tasks')
  const textX = PAD + (inUse ? clawd.width + 8 : 0)
  const cardX = textX + 52
  const cardW = sw - cardX - 6
  const kinds = Object.keys(SAMPLE_FILL) as (MeterKind | 'tasks')[]
  const barW = (cardW - PAD * 2 - GAP * (kinds.length - 1)) / kinds.length
  const segW = barW / SEGMENTS
  const bars = kinds
    .map((kind, i) =>
      Array.from({ length: SEGMENTS }, (_, j) => {
        const x = (cardX + PAD + i * (barW + GAP) + j * segW).toFixed(1)
        const paint = j < SAMPLE_FILL[kind] ? `fill="${look.bar(kind)}"` : 'class="k"'
        return `<rect ${paint} x="${x}" y="${SWATCH_H / 2 - 3}" width="${(segW - 2).toFixed(1)}" height="6" rx="1"/>`
      }).join(''),
    )
    .join('')
  const inner =
    strip(sw) +
    (inUse ? sprite('tasks', PAD, (SWATCH_H - clawd.height) / 2, 'run', look.clawd) : '') +
    `<text x="${textX}" y="${SWATCH_H / 2 + 4.5}" font-family="${SANS}" font-size="13" font-weight="600"><tspan class="t">Aa</tspan><tspan class="m" dx="4">Aa</tspan></text>` +
    bars
  const name = SKIN_NAMES[skin] ?? SKIN_NAMES.auto!
  const tile = pickTile(look, w, SWATCH_H, inner, inUse)
  return drawing(look, w, tile.height, tile.body, `${name} cards${inUse ? ', in use' : ''}`, !inUse)
}

// The layout picker's choice: the band sketched in either layout, Clawd's block in his colour,
// the usage as cards with their bars, and in the comfortable one the race's lanes.
const SKETCH_H = 56
export function densityPreview(density: 'comfortable' | 'compact', skin: string, W: number, inUse = false): Drawing {
  const look = lookOf(skin)
  const w = Math.max(160, W)
  const sw = w - PICK_PAD * 2
  const tones = [look.bar('context'), look.bar('session'), look.bar('week')]
  const fills = [0.26, 0.1, 0.32]
  // Clawd in a few pixels: his body, his claws and two eyes.
  const crab = (x: number, y: number, u: number) =>
    [[1, 0, 4, 1], [0, 1, 6, 2], [0, 3, 1, 1], [5, 3, 1, 1], [1, 3, 1, 1], [4, 3, 1, 1]].map(([a, b, c, d]) => sketchBlock(x + a! * u, y + b! * u, c! * u, d! * u, filled(look.clawd), 0)).join('') +
    sketchBlock(x + 2 * u, y + u, u * 0.6, u * 0.6, 'class="t"', 0) + sketchBlock(x + 4 * u, y + u, u * 0.6, u * 0.6, 'class="t"', 0)
  const meter = (x: number, y: number, mw: number, mh: number, i: number) =>
    sketchBlock(x, y, mw, mh) + sketchBlock(x + 5, y + 5, 14, 3, 'class="k"', 1) + sketchBlock(x + 5, y + 11, 18, 5, filled(tones[i]!), 1) +
    sketchBlock(x + 5, y + mh - 9, mw - 10, 3, 'class="k"', 1) + sketchBlock(x + 5, y + mh - 9, (mw - 10) * fills[i]!, 3, filled(tones[i]!), 1)
  const lane = (x: number, y: number, lw: number, color: string, at: number) => sketchBlock(x, y + 6, lw, 1.5, 'class="k"', 0) + sketchBlock(x + lw * at, y + 1, 5, 5, filled(color), 1)
  let inner: string
  if (density === 'comfortable') {
    const raceX = sw * 0.66
    const mw = (raceX - 46 - 12) / 3
    inner = sketchBlock(0, 0, 40, SKETCH_H) + crab(7, 18, 4) + [0, 1, 2].map(i => meter(44 + i * (mw + 4), 0, mw, SKETCH_H, i)).join('') + sketchBlock(raceX, 0, sw - raceX, SKETCH_H) +
      [look.clawd, tones[0]!, tones[1]!].map((c, i) => lane(raceX + 4, 8 + i * 16, sw - raceX - 8, c, [0.55, 0.3, 0.75][i]!)).join('')
  } else {
    const cw = (sw - 8) / 3
    inner = sketchBlock(0, 0, sw, 14) + crab(4, 3, 1.4) + sketchBlock(18, 5, 50, 4, 'class="k"', 1) +
      sketchBlock(0, 18, sw, 14) + sketchBlock(4, 23, sw * 0.6, 4, 'class="k"', 1) + sketchBlock(4, 23, sw * 0.25, 4, filled(look.bar('tasks')), 1) +
      [0, 1, 2].map(i => sketchBlock(i * (cw + 4), 36, cw, 20) + sketchBlock(4 + i * (cw + 4), 49, cw - 8, 3, 'class="k"', 1) + sketchBlock(4 + i * (cw + 4), 49, (cw - 8) * fills[i]!, 3, filled(tones[i]!), 1)).join('')
  }
  const name = density === 'comfortable' ? 'Comfortable' : 'Compact'
  return leanPick(look, w, pickTile(look, w, SKETCH_H, inner, inUse), `${name} layout${inUse ? ', in use' : ''}`)
}

// The usage style picker's choice: one card of the style sketched, its words as track lines and
// its meter in the context's colour (Rows: the three limits in theirs).
const USAGE_SKETCH_H = 44
export function usageSketch(style: UsageStyle, skin: string, W: number, inUse = false): Drawing {
  const look = lookOf(skin)
  const w = Math.max(110, W)
  const cw = w - PICK_PAD * 2
  const h = USAGE_SKETCH_H
  const tone = look.bar('context')
  const p = 0.62
  const k = 'class="k"'
  let inner = sketchBlock(0, 0, cw, h, 'class="p"', 6)
  if (style === 'tiles')
    inner += sketchBlock(8, 8, cw * 0.3, 4, k, 2) + sketchBlock(8, 17, cw * 0.38, 10, filled(tone), 2) + sketchBlock(8, h - 15, cw - 16, 4, k, 2) + sketchBlock(8, h - 15, (cw - 16) * p, 4, filled(tone), 2)
  else if (style === 'rings') {
    const r = h / 2 - 8
    const cx = 10 + r
    const c = 2 * Math.PI * r
    inner +=
      `<circle class="k-stroke" cx="${cx}" cy="${h / 2}" r="${r}" fill="none" stroke-width="4"/>` +
      `<circle cx="${cx}" cy="${h / 2}" r="${r}" fill="none" stroke="${tone}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${cx} ${h / 2})"/>` +
      sketchBlock(18 + r * 2, h / 2 - 7, cw * 0.3, 4, k, 2) + sketchBlock(18 + r * 2, h / 2 + 3, cw * 0.4, 4, 'class="m"', 2)
  } else if (style === 'columns') {
    const ch = h - 14
    inner += sketchBlock(8, 7, 10, ch, k, 3) + sketchBlock(8, 7 + ch * (1 - p), 10, ch * p, filled(tone), 3) + sketchBlock(26, 9, cw * 0.3, 4, k, 2) + sketchBlock(26, 18, cw * 0.36, 10, filled(tone), 2)
  } else {
    const rh = (h - 8) / 3
    const tones = [tone, look.bar('session'), look.bar('week')]
    inner += [0, 1, 2]
      .map(i => {
        const y = 4 + i * rh + rh / 2
        return (
          (i ? sketchBlock(6, 4 + i * rh, cw - 12, 0.8, k, 0) : '') +
          sketchBlock(8, y - 2, cw * 0.18, 4, k, 2) + sketchBlock(8 + cw * 0.26, y - 2, cw * 0.4, 4, k, 2) +
          sketchBlock(8 + cw * 0.26, y - 2, cw * 0.4 * [p, 0.3, 0.45][i]!, 4, filled(tones[i]!), 2) + sketchBlock(cw - 8 - cw * 0.14, y - 3, cw * 0.14, 6, filled(tones[i]!), 2)
        )
      })
      .join('')
  }
  const name = USAGE_STYLES[style]
  return leanPick(look, w, pickTile(look, w, h, inner, inUse), `${name} usage${inUse ? ', in use' : ''}`, [...PICK_INKS, 'k-stroke'])
}

// The bar style's sample: one bar, part filled, in the skin's task colour, on a framed strip
// marked as a preview. Drawn at a set width, so a wide pane does not stretch it.
const PREVIEW_W = 320
export function barPreview(style: BarStyle, skin: string, W: number): Drawing {
  const look = lookOf(skin)
  const w = Math.max(200, Math.min(PREVIEW_W, W))
  const sw = w - PICK_PAD * 2
  const top = 22
  const h = top + SWATCH_H + PICK_PAD
  const body =
    `<rect class="k" fill-opacity=".45" width="${w}" height="${h}" rx="10"/>` +
    `<text class="m" x="10" y="15" font-family="${MONO}" font-size="9" letter-spacing=".08em">PREVIEW</text>` +
    `<g transform="translate(${PICK_PAD},${top})">${strip(sw)}${pixelBar(`sabai-sample-${style}`, PAD, (SWATCH_H - 12) / 2, sw - PAD * 2, 12, 0.62, look.bar('tasks'), 5, style)}</g>`
  return drawing(look, w, h, body, `${BAR_STYLES[style]} progress bars`, style !== 'dither')
}

const strip = (w: number) => `<rect class="p" width="${w}" height="${SWATCH_H}" rx="8"/>`

const drawing = (look: Look, W: number, height: number, body: string, alt: string, still = false): Drawing => ({
  source: svg(look, W, height, body, still),
  width: W,
  height,
  alt,
})

// An agent type's hat and colour; a hat in Clawd's own colour would vanish into him, so that one
// takes the deeper pill clay.
function hatOf(look: Look, type: string) {
  const { hat, accent } = typeStyle(type)
  const color = accent ? look.bar(accent) : look.bar('session')
  return { hat, accent, color, hatColor: accent === 'tasks' ? look.pill : accent ? color : undefined }
}

// Running: a dot whose ring ripples out. Done, failed and stopped: a check, a cross or a hand
// on its pastel ground, as the agents pane's badges.
type Mark = AgentRun['status'] | 'stopped'
function statusMark(look: Look, status: Mark, x: number, y: number): string {
  if (status === 'running')
    return `<circle cx="${x}" cy="${y}" r="3.5" fill="${look.clawd}"/><circle class="ripple" cx="${x}" cy="${y}" r="3.5" fill="none" stroke="${look.clawd}" stroke-width="1.2"/>`
  return statusTile(status, x - 7, y - 7, 14)
}

// A card's pixel-block bar has a fixed cell count, so a wide pane does not multiply its size.
const CARD_CELLS = 24
const CARD_BAR_H = 8
const HOP_MS = 3000

// The band's bar, sized for a card: dither as twinkling dots faded in from the left (one pattern
// and a mask rather than a rect per dot, so a pane of cards stays small), blocks or solid as the
// band draws them, a tick per step, and the n/total pill riding the head of the fill.
function cardBar(look: Look, uid: string, x: number, y: number, w: number, ratio: number, color: string, style: BarStyle, steps = 0, pill = ''): string {
  const h = CARD_BAR_H
  const fillW = Math.round(w * Math.max(0, Math.min(1, ratio)))
  const ticks = Array.from({ length: Math.max(0, Math.min(steps, MAX_TICKS) - 1) }, (_, i) => Math.round((w * (i + 1)) / Math.min(steps, MAX_TICKS)))
    .filter(tx => tx > fillW + 4)
    .map(tx => `<rect class="m" x="${x + tx}" y="${y + h / 2 - 2.5}" width="1.5" height="5" rx=".75"/>`)
    .join('')
  let bar: string
  if (style === 'blocks') {
    // The cells as two patterns, track and fill, so their count costs nothing.
    const cell = (w + 2) / CARD_CELLS
    const filled = Math.round(CARD_CELLS * Math.max(0, Math.min(1, ratio))) * cell
    const pattern = (id: string, paint: string) =>
      `<pattern id="${id}" width="${cell.toFixed(2)}" height="${h}" patternUnits="userSpaceOnUse" x="${x}" y="${y}"><rect ${paint} width="${(cell - 2).toFixed(2)}" height="${h}" rx="1.5"/></pattern>`
    bar =
      `<defs>${pattern(`sabai-cells-${uid}`, 'class="k"')}${pattern(`sabai-on-${uid}`, `fill="${color}"`)}</defs>` +
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#sabai-cells-${uid})"/>` +
      `<rect x="${x}" y="${y}" width="${Math.min(w, filled).toFixed(1)}" height="${h}" fill="url(#sabai-on-${uid})"/>`
  } else {
    const fill =
      style === 'solid'
        ? `<rect x="${x}" y="${y}" width="${fillW}" height="${h}" fill="${color}"/>`
        : `<defs><pattern id="sabai-dots-${uid}" width="6" height="6" patternUnits="userSpaceOnUse" x="${x}" y="${y}">` +
          // Still dots: the pane restarts every animation each second, which would make them snap.
          [0, 1, 2, 3].map(i => `<rect x="${(i % 2) * 3 + 0.5}" y="${Math.floor(i / 2) * 3 + 0.5}" width="2" height="2" fill="${color}"/>`).join('') +
          `</pattern><linearGradient id="sabai-fade-${uid}"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff"/></linearGradient>` +
          `<mask id="sabai-mask-${uid}"><rect x="${x}" y="${y}" width="${fillW}" height="${h}" fill="url(#sabai-fade-${uid})"/></mask></defs>` +
          `<rect x="${x}" y="${y}" width="${fillW}" height="${h}" fill="url(#sabai-dots-${uid})" mask="url(#sabai-mask-${uid})"/>`
    bar =
      `<defs><clipPath id="sabai-clip-${uid}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}"/></clipPath></defs>` +
      `<rect class="k" x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}"/>` +
      `<g clip-path="url(#sabai-clip-${uid})">${fill}</g>`
  }
  if (!pill) return bar + ticks
  const pillW = Math.round(10 + pill.length * 4.8)
  const pillX = x + Math.max(0, Math.min(w - pillW, fillW - pillW))
  return (
    bar +
    ticks +
    `<rect x="${pillX}" y="${y}" width="${pillW}" height="${h}" rx="${h / 2}" fill="${look.pill}"/>` +
    `<text x="${pillX + pillW / 2}" y="${y + h / 2 + 2.6}" text-anchor="middle" font-family="${MONO}" font-size="7.5" font-weight="700" fill="#ffffff">${pill}</text>`
  )
}


// ---- The agents pane: a crew's overview, a lane per agent, and one agent's detail. Each is its
// own drawing with only the inks it uses, and the sprites' motion only while something moves.

const AGENT_INKS = ['p', 'k', 't', 'm', 'c-ok', 'c-alert', 'c-warn', 'c-context', 'c-session', 'c-week', 'c-tasks'] as const
const SM_INK = `.sm{fill:${TEXT.m[0]}}${DARK}.sm{fill:${TEXT.m[1]}}}`
// The sprites' stylesheet as its top-level rules and keyframes.
// The sprites' motion and the race's flash, cut into rules so a pane drawing takes only those it uses.
const MOVES = SPRITE_CSS + RACE_MOTION + TILE_MOTION
const SPRITE_RULES = (() => {
  const out: string[] = []
  let depth = 0
  let from = 0
  for (let i = 0; i < MOVES.length; i++) {
    if (MOVES[i] === '{') depth++
    else if (MOVES[i] === '}' && --depth === 0) {
      out.push(MOVES.slice(from, i + 1))
      from = i + 1
    }
  }
  return out
})()
// Only the motion a drawing's classes use: each rule whose classes it all has, and their keyframes.
function motionOf(body: string): string {
  const classes = new Set([...body.matchAll(/class="([^"]+)"/g)].flatMap(m => m[1]!.split(' ')))
  const rules = SPRITE_RULES.filter(r => !r.startsWith('@keyframes') && [...r.slice(0, r.indexOf('{')).matchAll(/\.([\w-]+)/g)].every(m => classes.has(m[1]!)))
  if (!rules.length) return ''
  const used = rules.join('')
  const frames = SPRITE_RULES.filter(r => r.startsWith('@keyframes') && new RegExp(`animation:${r.slice(11, r.indexOf('{'))}\\b`).test(used))
  return `${used}${frames.join('')}@media (prefers-reduced-motion: reduce){*{animation:none!important}}`
}
// A pane drawing with only the inks its words and shapes use, and the motion only while it moves.
const paneDrawing = (look: Look, W: number, H: number, drawn: string, alt: string, moving = false): Drawing => {
  // The faces once in the stylesheet rather than on every word: sans by default, mono by class.
  const body = drawn
    .replaceAll(` font-family="${SANS}"`, '')
    .replace(new RegExp(`<text class="([^"]+)"([^>]*?) font-family="${MONO}"`, 'g'), '<text class="$1 mo"$2')
    .replace(new RegExp(`<text ([^>]*?)font-family="${MONO}"`, 'g'), '<text class="mo" $1')
  const inks = AGENT_INKS.filter(c => body.includes(`class="${c}"`) || body.includes(`class="${c} `))
  return {
    source: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><style>text{font-family:${SANS}}.mo{font-family:${MONO}}${leanCss(look, inks)}${body.includes('class="sm"') ? SM_INK : ''}${moving ? motionOf(body) : ''}${paletteCss(body)}</style>${iconDefs(body)}${body}</svg>`,
    width: W,
    height: H,
    alt,
  }
}

// Each mood as Clawd's pose, the ink of its words, and its colour on a bar.
const MOOD_SPRITE: Record<AgentMood, string> = { working: 'run', thinking: 'idle', quiet: 'sleep', context: 'sweat', failed: 'dizzy', stopped: 'idle', done: 'idle', waiting: 'idle' }
const MOOD_INK: Record<AgentMood, string> = { working: 'm', thinking: 'm', quiet: 'c-warn', context: 'c-context', failed: 'c-alert', stopped: 'm', done: 'c-ok', waiting: 'm' }
const TROUBLE: readonly AgentMood[] = ['quiet', 'context', 'failed']
const moodColor = (mood: AgentMood) => kl(mood === 'failed' ? 'fail' : mood === 'quiet' ? 'warn' : mood === 'done' ? 'ok' : mood === 'stopped' ? 'stop' : 'skill')
export function moodLabel(a: AgentRun, now: number, window?: number): string {
  const mood = agentMood(a, now, window)
  const said = mood === 'quiet' ? `quiet ${Math.floor(quietFor(a, now) / 1000)}s` : mood === 'context' ? `context ${contextPercent(a, window)}%` : mood === 'waiting' ? `waiting on ${a.waitingOn}` : mood
  return said[0]!.toUpperCase() + said.slice(1)
}
// Whether a run's drawing moves: at work, or in the few seconds after it ended.
const justEnded = (a: AgentRun, now: number) => a.endedAt !== undefined && now - a.endedAt < HOP_MS
const moving = (a: AgentRun, now: number) => a.status === 'running' || justEnded(a, now)

// Clawd in the run's hat and mood, 31×20 at scale 1 (his tool held at his right).
const CLAWD_W = spriteSize('tasks').width + PROP_W
const CLAWD_H = spriteSize('tasks').height + HAT_H
// A sprite's one-pixel rows of one fill as one path: the pane draws a Clawd per agent, and a rect
// per run of pixels would make each several times larger.
const ROW_RECT = /<rect x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="1" fill="([^"]+)"\/>/g
export function asPaths(sprite: string): string {
  return sprite.replace(new RegExp(`(?:${ROW_RECT.source})+`, 'g'), run => {
    let out = ''
    let fill = ''
    let d = ''
    for (const [, x, y, w, f] of run.matchAll(ROW_RECT)) {
      if (f !== fill && d) out += `<path fill="${fill}" d="${d}"/>`
      if (f !== fill) d = ''
      fill = f!
      d += `M${x} ${y}h${w}v1h-${w}z`
    }
    return out + (d ? `<path fill="${fill}" d="${d}"/>` : '')
  })
}
function agentClawd(look: Look, a: AgentRun, mood: AgentMood, now: number, x: number, y: number, scale: number, trick = ''): string {
  const { hat, hatColor } = hatOf(look, a.type)
  const fresh = justEnded(a, now)
  const mode = (fresh && mood === 'done' ? 'hop' : fresh && mood === 'failed' ? 'out' : MOOD_SPRITE[mood]) + (trick ? ` ${trick}` : '')
  const prop = a.status === 'running' ? true : a.status === 'done' ? ('scroll' as const) : false
  // Claude himself wears the captain's cap, not a type's hat.
  const worn = isMain(a) ? { kind: 'captain' as const, prop } : { kind: hat, color: hatColor, prop }
  return `<g transform="translate(${x},${y}) scale(${scale})"${mood === 'stopped' ? ' opacity=".55"' : ''}>${asPaths(sprite('tasks', 0, HAT_H, mode, look.clawd, worn))}</g>`
}
// A run's share done: its steps, else its pace by calls while it runs, else whole.
const shareOf = (a: AgentRun): number => {
  const p = progressOf(a)
  return a.status === 'done' ? 1 : p ? p.done / p.total : a.status === 'running' ? paceOf(a.callCount ?? 0) : 0
}
const trackBar = (x: number, y: number, w: number, h: number, ratio: number, color: string) =>
  `<rect class="k" x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}"/>` +
  (ratio > 0 ? `<rect x="${x}" y="${y}" width="${Math.max(h, Math.round(w * Math.min(1, ratio)))}" height="${h}" rx="${h / 2}" fill="${color}"/>` : '')
const label = (x: number, y: number, s: string, extra = '') => `<text class="m" x="${x}" y="${y}" font-family="${MONO}" font-size="9" font-weight="700" letter-spacing=".08em"${extra}>${xml(s)}</text>`
const secs = (ms: number) => (ms < 50 ? '' : ms < 10_000 ? `${(ms / 1000).toFixed(1)}s` : clock(ms))

// A call as a tile: its kind's Lucide icon on its pastel ground, a failed call's on the failure's.
const KIND_HUE: Record<ActKind, Hue> = { read: 'read', search: 'read', edit: 'edit', command: 'command', test: 'ok', web: 'web', mcp: 'web', skill: 'skill', other: 'command' }
const kindTile = (kind: ActKind, ok: boolean, x: number, y: number, size = 14) => {
  const hue = ok ? KIND_HUE[kind] : 'fail'
  return `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="3" fill="${kb(hue)}"/><use href="#sabai-ic-${CALL_ICON[kind]}" stroke="${kf(hue)}" transform="translate(${x + 2},${y + 2}) scale(${((size - 4) / 24).toFixed(3)})"/>`
}

// A run's state as a tile before its line, the same in the race, the live strip, a lane and a
// head: its call's tile while one runs, else its state's own glyph on its hue.
export type StatusTile = { call: ActKind } | 'thinking' | 'summing' | 'waiting' | 'quiet' | 'context' | 'done' | 'failed' | 'stopped'
const STATUS_GLYPH: Record<'waiting' | 'quiet' | 'context' | 'done' | 'failed' | 'stopped', [Hue, StrokeKind, string]> = {
  waiting: ['edit', 'hourglass', 'st-flip'],
  quiet: ['warn', 'moon', 'st-fade'],
  // Teal, as its words and the band's Context meter are.
  context: ['read', 'gauge', 'st-wob'],
  done: ['ok', 'circle-check', ''],
  failed: ['fail', 'circle-x', ''],
  stopped: ['stop', 'circle-stop', ''],
}
// A race lane's tile, by its state, its silence, its context and its call in flight.
const laneTile = (l: Lane): StatusTile =>
  l.state === 'done' || l.state === 'failed' || l.state === 'stopped' || l.state === 'waiting'
    ? l.state
    : l.quietMs !== undefined ? 'quiet' : l.mood === 'context' ? 'context' : l.doing ? { call: l.act ?? l.doing } : 'thinking'
// A run's tile, by its mood: its call's while one runs, its summary being written once done.
const runTile = (a: AgentRun, mood: AgentMood): StatusTile =>
  mood === 'working' ? { call: a.doing!.at(-1)!.kind } : mood === 'done' ? (a.summary === 'pending' ? 'summing' : 'done') : mood
function statusTile(s: StatusTile, x: number, y: number, size = 16): string {
  // A frameless duotone: the glyph's shape filled with its hue's soft tint inside its deep outline.
  const glyphAt = (hue: Hue, glyph: StrokeKind) => `<use href="#sabai-du-${glyph}" fill="${kb(hue)}" stroke="${kf(hue)}" transform="translate(${x},${y}) scale(${(size / 24).toFixed(3)})"/>`
  if (typeof s === 'object') return `<g class="st-pulse">${glyphAt(KIND_HUE[s.call], CALL_ICON[s.call])}</g>`
  if (s === 'thinking' || s === 'summing') {
    const hue: Hue = s === 'summing' ? 'ok' : 'command'
    const dot = (i: number) => `<circle class="st-b${i}" cx="${+(x + size / 2 + (i - 2) * size * 0.32).toFixed(1)}" cy="${+(y + size / 2).toFixed(1)}" r="${+(size * 0.14).toFixed(2)}" fill="${kf(hue)}"/>`
    return dot(1) + dot(2) + dot(3)
  }
  const [hue, glyph, motion] = STATUS_GLYPH[s]
  return motion ? `<g class="${motion}">${glyphAt(hue, glyph)}</g>` : glyphAt(hue, glyph)
}

// The viewed run's Clawd stands in a soft light of his colour.
const spotlight = (id: string, look: Look, cx: number, cy: number, rx: number, ry: number) =>
  `<defs><radialGradient id="sabai-spot-${id}"><stop offset="0" stop-color="${look.clawd}" stop-opacity=".32"/><stop offset="1" stop-color="${look.clawd}" stop-opacity="0"/></radialGradient></defs><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#sabai-spot-${id})"/>`

// The overview of the crews at work: each member a bar on one time axis, from its start to its
// end in its mood's colour, a Clawd riding the end of each one still at work and a mark at the
// end of each one done; then three tiles (calls, tokens, time). The box's title says how they stand.
const TIMELINE_ROWS = 6
const TIMELINE_ROW = 24
export function crewSvg(runs: readonly AgentRun[], W: number, now: number, skin: string = 'auto', windowOf: (a: AgentRun) => number | undefined = () => undefined): Drawing {
  const look = lookOf(skin)
  const running = runs.some(a => a.status === 'running')
  const start = Math.min(...runs.map(a => a.startedAt))
  const end = running ? now : Math.max(...runs.map(a => a.endedAt ?? a.startedAt))
  const span = Math.max(1000, end - start)
  const shown = runs.slice(0, TIMELINE_ROWS)
  const nameW = Math.min(118, Math.round(W * 0.3))
  const x0 = PAD + 6 + nameW + 8
  // Room after the axis for a riding Clawd or an end mark.
  const x1 = W - PAD - 6 - 26
  const xs = (t: number) => x0 + ((Math.min(t, end) - start) / span) * (x1 - x0)
  const top = 12
  let b = ''
  // Faint guides at the quarters, so lengths compare at a glance.
  for (let q = 0; q <= 4; q++) b += `<rect class="k" x="${(x0 + ((x1 - x0) * q) / 4).toFixed(1)}" y="${top - 2}" width="1" height="${shown.length * TIMELINE_ROW + 2}" opacity=".7"/>`
  shown.forEach((a, i) => {
    const mood = agentMood(a, now, windowOf(a))
    const y = top + i * TIMELINE_ROW
    b += `<text class="${TROUBLE.includes(mood) ? MOOD_INK[mood] : 't'}" x="${PAD + 6}" y="${y + 15}" font-family="${SANS}" font-size="11.5" font-weight="${a.status === 'running' ? 600 : 500}">${xml(fit(a.description || a.type, 11.5, nameW))}</text>`
    const s = xs(a.startedAt)
    const e = Math.max(s + 6, xs(a.status === 'running' ? now : (a.endedAt ?? now)))
    b += `<rect x="${s.toFixed(1)}" y="${y + 7}" width="${(e - s).toFixed(1)}" height="10" rx="5" fill="${moodColor(mood)}"${a.status === 'running' ? '' : ' fill-opacity=".55"'}/>`
    b +=
      a.status === 'running'
        ? agentClawd(look, a, mood, now, e - 6, y - 1, 0.8)
        : statusTile(mood === 'done' ? 'done' : mood === 'stopped' ? 'stopped' : 'failed', +(e + 4).toFixed(1), y + 5, 14)
  })
  let y = top + shown.length * TIMELINE_ROW + 2
  if (runs.length > shown.length) {
    b += `<text class="m" x="${PAD + 6}" y="${y + 10}" font-family="${SANS}" font-size="10.5">+ ${runs.length - shown.length} more</text>`
    y += 14
  }
  // The axis: the crew's start, its middle, and now (or its end).
  b += `<text class="m" x="${x0}" y="${y + 10}" font-family="${MONO}" font-size="9">0s</text>`
  b += `<text class="m" x="${((x0 + x1) / 2).toFixed(1)}" y="${y + 10}" text-anchor="middle" font-family="${MONO}" font-size="9">${clock(span / 2)}</text>`
  b += `<text class="m" x="${x1}" y="${y + 10}" text-anchor="end" font-family="${MONO}" font-size="9">${running ? 'now' : clock(span)}</text>`
  y += 20
  // The tiles, three across, or one under another on a very narrow pane.
  const cols = W >= 300 ? 3 : 1
  const tw = (W - PAD * 2 - 12 - 8 * (cols - 1)) / cols
  const th = 50
  const calls = runs.reduce((n, a) => n + (a.callCount ?? 0), 0)
  const fails = runs.reduce((n, a) => n + (a.callFails ?? 0), 0)
  const spent = runs.reduce((n, a) => n + (a.spent ?? a.contextTokens), 0)
  const tile = (i: number, name: string, big: string, note = '') => {
    const x = PAD + 6 + (i % cols) * (tw + 8)
    const ty = y + Math.floor(i / cols) * (th + 8)
    return (
      `<rect class="k" fill-opacity=".45" x="${x.toFixed(1)}" y="${ty}" width="${tw.toFixed(1)}" height="${th}" rx="9"/>` +
      label(x + 10, ty + 16, name) +
      `<text class="t" x="${x + 10}" y="${ty + 39}" font-family="${SANS}" font-size="18" font-weight="700">${xml(fit(big, 18, tw - 20))}</text>` +
      (note ? `<text x="${(x + tw - 10).toFixed(1)}" y="${ty + 16}" text-anchor="end" font-family="${MONO}" font-size="10.5">${note}</text>` : '')
    )
  }
  b += tile(0, 'CALLS', String(calls), fails ? `<tspan class="c-alert">✗ ${fails}</tspan>` : '')
  b += tile(1, 'TOKENS', tokens(spent))
  b += tile(2, 'TIME', clock(end - start))
  const H = y + Math.ceil(3 / cols) * (th + 8) + 4
  const subagents = runs.filter(a => !isMain(a)).length
  const who = [runs.some(isMain) ? 'Main' : '', subagents ? plural(subagents, 'subagent') : ''].filter(Boolean).join(' and ')
  const alt = `${who} on the timeline: ${shown.map(a => `${a.description || a.type} ${agentMood(a, now, windowOf(a))}`).join(', ')}; ${plural(calls, 'call')}${fails ? `, ${fails} failed` : ''}; ${tokens(spent)} tokens; ${clock(end - start)}`
  return paneDrawing(look, W, H, `<rect class="p" width="${W}" height="${H}" rx="8"/>` + b, alt, running)
}

// One agent as a lane: a stripe in its mood's colour, Clawd in his mood, the task (Main's with
// its badge), his Thai line (in his mood's ink when something needs a look), his share done and
// his time. The one viewed is ringed and tinted in Clawd's colour, and its Clawd waves in a soft light.
export const AGENT_LANE_H = 42
// A lane that called skills or MCP servers grows a row of chips naming them.
const USES_ROW = 17

// A skill's lightbulb or an MCP server's plug, in its hue; a call using it now pulses.
function useIcon(kind: 'skill' | 'mcp', x: number, y: number, size: number, live = false): string {
  const hue: Hue = kind === 'mcp' ? KIND_HUE.mcp : KIND_HUE.skill
  const g = `<use href="#sabai-du-${CALL_ICON[kind]}" fill="${kb(hue)}" stroke="${kf(hue)}" transform="translate(${x},${y}) scale(${(size / 24).toFixed(3)})"/>`
  return live ? `<g class="st-pulse">${g}</g>` : g
}
// The skills and MCP servers a run called as chips on their hue's ground, its glyph ink for the
// words: the one in use first (outlined, its icon pulsing), then the most called; "+N" past the room.
function usesChips(u: Uses, x: number, y: number, room: number): string {
  const items = [...u.skills.map(([n, c]) => ['skill', n, c] as const), ...u.mcp.map(([n, c]) => ['mcp', n, c] as const)]
  const live = (k: string, n: string) => u.live === `${k}:${n}`
  items.sort((a, b) => +live(b[0], b[1]) - +live(a[0], a[1]) || b[2] - a[2])
  let cx = x
  let out = ''
  for (const [i, [kind, name, n]] of items.entries()) {
    const label = `${name}${n > 1 ? ` ×${n}` : ''}`
    const w = 20 + textWidth(label, 10.5) + 8
    // Room for this chip, and for "+N" after it unless it is the last.
    if (cx + w > x + room - (i < items.length - 1 ? 26 : 0)) {
      out += `<text class="m" x="${+(cx + 2).toFixed(1)}" y="${y + 12.5}" font-family="${SANS}" font-size="10.5">+${items.length - i}</text>`
      break
    }
    const hue: Hue = KIND_HUE[kind]
    const now = live(kind, name)
    out +=
      `<rect x="${+cx.toFixed(1)}" y="${y}" width="${+w.toFixed(1)}" height="16" rx="8" fill="${kb(hue)}"${now ? ` stroke="${kf(hue)}" stroke-width="1"` : ''}/>` +
      useIcon(kind, +(cx + 4).toFixed(1), y + 2, 12, now) +
      `<text x="${+(cx + 20).toFixed(1)}" y="${y + 12}" font-family="${SANS}" font-size="10.5" fill="${kf(hue)}">${xml(label)}</text>`
    cx += w + 5
  }
  return out
}
// An ended lane's badge on its Clawd: a green check, a red cross or a hand for a stop, as the
// timeline marks them, ringed in the card's colour. In the seconds after a run ends its lane is tinted green or red.
function endTint(a: AgentRun, mood: AgentMood, now: number, W: number, H: number): string {
  const stopped = mood === 'stopped'
  if (a.status === 'running' || stopped || !justEnded(a, now)) return ''
  return `<rect class="flash" x="5" y="2" width="${W - 7}" height="${H - 4}" rx="6" fill="${kl(mood === 'done' ? 'ok' : 'fail')}" opacity=".35"/>`
}

export function laneSvg(a: AgentRun, W: number, now: number, skin: string = 'auto', window?: number, selected = false, style: BarStyle = 'dither'): Drawing {
  const look = lookOf(skin)
  const mood = agentMood(a, now, window)
  const line = laneLine(a, now, window)
  const p = progressOf(a)
  const time = clock(elapsed(a, now))
  const wide = W >= 340
  const right = W - PAD
  const timeW = monoWidth(time, 11.5)
  const barW = 64
  const barX = right - timeW - 12 - (p ? monoWidth(`${p.done}/${p.total}`, 10) + 6 : 0) - barW
  const textX = 12 + CLAWD_W + 8
  const size = selected ? 13.2 : 12.5
  const textRoom = (wide ? barX - 10 : right - timeW - 14) - textX
  const name = fit(a.description || a.type, size, textRoom)
  const uid = `lane-${a.id.replace(/\W/g, '_')}`
  const chips = usesChips(usesOf(a), textX, AGENT_LANE_H - 2, W - textX - PAD)
  const H = AGENT_LANE_H + (chips ? USES_ROW : 0)
  const body =
    `<rect class="p" width="${W}" height="${H}" rx="8"/>` +
    chips +
    (selected
      ? `<rect x=".75" y=".75" width="${W - 1.5}" height="${H - 1.5}" rx="7.5" fill="${look.clawd}" fill-opacity=".08" stroke="${look.clawd}" stroke-width="1.5"/>` +
        spotlight(uid, look, 12 + CLAWD_W / 2, H / 2 + 2, 26, 20)
      : '') +
    `<rect y="6" width="4" height="${H - 12}" rx="2" fill="${moodColor(mood)}"/>` +
    endTint(a, mood, now, W, H) +
    agentClawd(look, a, mood, now, 12, (H - CLAWD_H) / 2, 1, selected ? 'wave' : '') +
    `<text class="t" x="${textX}" y="17" font-family="${SANS}" font-size="${size}" font-weight="${selected ? 800 : 600}">${xml(name)}</text>` +
    statusTile(runTile(a, mood), textX, 21, 16) +
    `<text class="${TROUBLE.includes(mood) ? MOOD_INK[mood] : 'm'}" x="${textX + 21}" y="33" font-family="${SANS}" font-size="11.5">${xml(fit(line, 11.5, W - textX - PAD - 21))}</text>` +
    (wide ? cardBar(look, uid, barX, 9, barW, shareOf(a), moodColor(mood), style) : '') +
    (wide && p ? `<text class="m" x="${barX + barW + 6}" y="17" font-family="${MONO}" font-size="10">${p.done}/${p.total}</text>` : '') +
    `<text class="t" x="${right}" y="17" text-anchor="end" font-family="${MONO}" font-size="11.5" font-weight="500">${time}</text>`
  const u = usesOf(a)
  const used = [...u.skills, ...u.mcp].map(([n]) => n).join(', ')
  return paneDrawing(look, W, H, body, `${a.description || a.type}: ${moodLabel(a, now, window)}, ${time}. ${line}${used ? `. Used ${used}` : ''}`, moving(a, now))
}

// The detail's head, a line for each thing: Clawd large in his mood, waving in a soft light,
// beside the task (Main's with its badge) and its time; his mood as a tag and his call in flight
// or latest; three meters (steps, context, tokens); and what runs it (type, model, effort) as a
// footnote, with when he was last heard from while that says something his tag does not.
export function agentHeadSvg(a: AgentRun, W: number, now: number, skin: string = 'auto', window?: number): Drawing {
  const look = lookOf(skin)
  const mood = agentMood(a, now, window)
  const tag = moodLabel(a, now, window)
  const time = clock(elapsed(a, now))
  const since = Math.max(0, quietFor(a, now))
  const effort = effortLabel(a.effort)
  const meta = [isMain(a) ? 'main conversation' : a.type, a.teammate ? 'teammate' : '', modelName(a.model).replace(/^./, c => c.toUpperCase()), effort ? (effort.startsWith('budget') ? effort : `${effort} effort`) : '', a.background ? 'background' : '', a.workflow ? 'workflow' : ''].filter(Boolean).join(' · ')
  const doing = a.doing?.at(-1)
  const last = a.calls?.at(-1)
  const latest = doing ? { mark: '▶', ink: 'm', title: doing.now ?? doing.title } : last ? { mark: last.ok ? '✓' : '✗', ink: last.ok ? 'c-ok' : 'c-alert', title: last.title } : undefined
  // A quiet agent's tag already counts its silence.
  const heard = a.status === 'running' && mood !== 'quiet' ? `active ${clock(since)} ago` : ''
  const H = 128
  const scale = 2
  const tx = 14 + CLAWD_W * scale + 14
  const right = W - 14
  const timeW = monoWidth(time, 13) + 12
  const name = fit(`${typeEmoji(a.type)} ${a.description || a.type}`, 15, right - tx - timeW)
  const tagW = textWidth(tag, 10.5) + 18 + 17
  const p = progressOf(a)
  const pct = contextPercent(a, window)
  const meters: [string, string, number | undefined, string][] = [
    ['STEPS', p ? `${p.done}/${p.total}` : a.status === 'done' ? 'done' : '—', p ? p.done / p.total : a.status === 'done' ? 1 : 0, moodColor(mood)],
    ['CONTEXT', pct === undefined ? tokens(a.contextTokens) : `${tokens(a.contextTokens)} · ${pct}%`, pct === undefined ? 0 : pct / 100, (pct ?? 0) >= FULL_AT ? look.bar('tasks', 'warn') : look.bar('context')],
    ['TOKENS', tokens(a.spent ?? a.contextTokens), undefined, ''],
  ]
  const mw = (right - 14 - 16 * 2) / 3
  const body =
    `<rect class="p" width="${W}" height="${H}" rx="8"/>` +
    spotlight(`head-${a.id.replace(/\W/g, '_')}`, look, 14 + CLAWD_W, 20 + CLAWD_H, CLAWD_W * 1.25, CLAWD_H * 1.15) +
    agentClawd(look, a, mood, now, 14, 20, scale, 'wave') +
    `<text class="t" x="${tx}" y="30" font-family="${SANS}" font-size="15" font-weight="700">${xml(name)}</text>` +
    `<text class="t" x="${right}" y="30" text-anchor="end" font-family="${MONO}" font-size="13" font-weight="600">${time}</text>` +
    `<rect x="${tx}" y="42" width="${tagW.toFixed(1)}" height="18" rx="9" fill="${moodColor(mood)}" fill-opacity=".16"/>` +
    statusTile(runTile(a, mood), tx + 5, 44, 14) +
    `<text class="${MOOD_INK[mood]}" x="${tx + 23}" y="55" font-family="${SANS}" font-size="10.5" font-weight="700">${xml(tag)}</text>` +
    (latest
      ? `<text class="${latest.ink}" x="${tx + tagW + 10}" y="55" font-family="${SANS}" font-size="11.5">${latest.mark}</text>` +
        `<text class="m" x="${tx + tagW + 24}" y="55" font-family="${SANS}" font-size="11.5">${xml(fit(latest.title, 11.5, right - tx - tagW - 24))}</text>`
      : '') +
    meters
      .map(([n, value, ratio, color], i) => {
        const x = 14 + i * (mw + 16)
        return (
          label(x, 88, n) +
          `<text class="t" x="${(x + mw).toFixed(1)}" y="88" text-anchor="end" font-family="${MONO}" font-size="10.5">${xml(fitMono(value, 10.5, mw - monoWidth(n, 9) - 12))}</text>` +
          (ratio === undefined ? `<rect class="k" x="${x}" y="94" width="${mw.toFixed(1)}" height="1"/>` : trackBar(x, 94, mw, 5, ratio, color))
        )
      })
      .join('') +
    `<text class="m" x="14" y="${H - 12}" font-family="${SANS}" font-size="10.5">${xml(fit(meta, 10.5, right - 14 - (heard ? textWidth(heard, 10.5) + 12 : 0)))}</text>` +
    (heard ? `<text class="m" x="${right}" y="${H - 12}" text-anchor="end" font-family="${SANS}" font-size="10.5">${heard}</text>` : '')
  const alt = `${a.description || a.type}: ${tag}, ${meta}, ${time}${latest ? `; latest ${latest.title}` : ''}`
  return paneDrawing(look, W, H, body, alt, moving(a, now))
}

// The tools an agent called, as chips in three rows (built-in, skills, MCP), each with how often.
export function toolsSvg(a: AgentRun, W: number, skin: string = 'auto'): Drawing | undefined {
  const look = lookOf(skin)
  const { builtin, skills, mcp } = toolsOf(a)
  const rows = ([['BUILT-IN', builtin, kl('command')], ['SKILLS', skills, kl('skill')], ['MCP', mcp, kl('web')]] as const).filter(r => r[1].length)
  if (!rows.length) return undefined
  const x0 = 84
  let y = 8
  let b = ''
  for (const [name, list, color] of rows) {
    b += label(10, y + 14, name)
    let x = x0
    for (const [tool, n] of list) {
      const count = `×${n}`
      // Sized as fitMono measures a mono line, so a name that fits its chip is never cut.
      const w = Math.min(W - x0 - 8, (monoWidth(tool, 11) * 0.64) / 0.6 + monoWidth(count, 10.5) + 34)
      if (x + w > W - 8 && x > x0) {
        x = x0
        y += 26
      }
      b +=
        `<rect x="${x}" y="${y}" width="${w.toFixed(1)}" height="20" rx="10" fill="${color}" fill-opacity=".16"/><circle cx="${x + 10}" cy="${y + 10}" r="3.5" fill="${color}"/>` +
        `<text class="t" x="${x + 19}" y="${y + 14}" font-family="${MONO}" font-size="11">${xml(fitMono(tool, 11, w - monoWidth(count, 10.5) - 31))}</text>` +
        `<text class="m" x="${(x + w - 8).toFixed(1)}" y="${y + 14}" text-anchor="end" font-family="${MONO}" font-size="10.5">${count}</text>`
      x += w + 6
    }
    y += 26
  }
  const H = y + 4
  const alt = `Tools: ${[...builtin, ...skills, ...mcp].map(([t, n]) => `${t} ${n}×`).join(', ')}`
  return paneDrawing(look, W, H, `<rect class="p" width="${W}" height="${H}" rx="8"/>` + b, alt)
}

// The steps an agent reported through the step tool: those it moved past ticked, the one in
// progress ringed, and how many more it planned.
export function stepsSvg(a: AgentRun, W: number, skin: string = 'auto'): Drawing | undefined {
  const look = lookOf(skin)
  const p = progressOf(a)
  const notes = a.notes ?? []
  if (!notes.length && !p) return undefined
  const finished = a.status === 'done' || (p !== undefined && p.done >= p.total)
  const rows = notes.length ? notes : [p!.title]
  const more = p ? Math.max(0, p.total - Math.max(rows.length, p.done)) : 0
  const H = rows.length * 20 + (more ? 18 : 0) + 8
  let b = `<rect class="p" width="${W}" height="${H}" rx="8"/>`
  rows.forEach((note, i) => {
    const y = 14 + i * 20
    const current = !finished && i === rows.length - 1
    b += current
      ? `<circle cx="16" cy="${y}" r="5.5" fill="none" stroke="${look.clawd}" stroke-width="2"/><circle cx="16" cy="${y}" r="2" fill="${look.clawd}"/>`
      : `<circle cx="16" cy="${y}" r="6" fill="${kb('ok')}"/><path d="M13 ${y}l2 2.2 4-4.4" stroke="${kf('ok')}" stroke-width="1.5" fill="none"/>`
    b += `<text class="${current ? 't' : 'm'}" x="30" y="${y + 4}" font-family="${SANS}" font-size="12"${current ? ' font-weight="600"' : ''}>${xml(fit(note, 12, W - 40))}</text>`
  })
  if (more) b += `<text class="m" x="30" y="${rows.length * 20 + 16}" font-family="${SANS}" font-size="11">${plural(more, 'more step')} planned</text>`
  return paneDrawing(look, W, H, b, `Steps: ${rows.join('; ')}${more ? `; ${more} more` : ''}`)
}

// An agent's calls, latest last: a tile for its kind, its title, its time and whether it worked;
// calls in flight at the end, and how many earlier ones are left out.
export function activitySvg(a: AgentRun, W: number, skin: string = 'auto', max = 8): Drawing | undefined {
  const look = lookOf(skin)
  const calls = (a.calls ?? []).slice(-max)
  const doing = a.doing ?? []
  if (!calls.length && !doing.length) return undefined
  // How many are left out is the box's to say, in its title.
  let y = 6
  let b = ''
  const row = (kind: ActKind, title: string, end: string, ok: boolean) => {
    b +=
      kindTile(kind, ok, 10, y + 4) +
      `<text class="t" x="32" y="${y + 15}" font-family="${MONO}" font-size="11.5">${xml(fitMono(title, 11.5, W - 32 - 70))}</text>` +
      end
    y += 22
  }
  for (const c of calls)
    row(c.kind, c.title, `<text class="m" x="${W - 28}" y="${y + 15}" text-anchor="end" font-family="${MONO}" font-size="10.5">${secs(c.ms)}</text><text class="${c.ok ? 'c-ok' : 'c-alert'}" x="${W - 10}" y="${y + 15}" text-anchor="end" font-family="${SANS}" font-size="12">${c.ok ? '✓' : '✗'}</text>`, c.ok)
  for (const d of doing)
    row(d.kind, d.title, `<text class="m" x="${W - 28}" y="${y + 15}" text-anchor="end" font-family="${MONO}" font-size="10.5">Running…</text><circle cx="${W - 15}" cy="${y + 11}" r="4" fill="none" stroke="${look.clawd}" stroke-width="2" stroke-dasharray="12 6"/>`, true)
  const H = y + 6
  // Each title cut short in the alt, which the pane's tree carries whole.
  const said = (t: string) => fit(t, 1, 45)
  const alt = `Calls: ${calls.map(c => `${said(c.title)} ${c.ok ? 'worked' : 'failed'}`).join('; ')}${doing.length ? `; running ${doing.map(d => said(d.title)).join(', ')}` : ''}`
  return paneDrawing(look, W, H, `<rect class="p" width="${W}" height="${H}" rx="8"/>` + b, alt)
}

// The files an agent touched: the ones it changed first, each its name, folder, lines added and
// removed with a five-cell bar, NEW when it made the file, and how often it edited and read it;
// then the ones it only read, a line each.
const READ_SHOWN = 8
export function filesSvg(a: AgentRun, W: number, skin: string = 'auto'): Drawing | undefined {
  const look = lookOf(skin)
  const all = filesOf(a)
  if (!all.length) return undefined
  const changed = all.filter(f => f.file.edits > 0)
  const read = all.filter(f => f.file.edits === 0)
  const dir = (p: string) => (p.includes('/') ? `${p.slice(0, p.lastIndexOf('/'))}/` : '')
  let y = 0
  let b = ''
  const head = (name: string) => {
    b += label(12, y + 16, name)
    y += 24
  }
  if (changed.length) {
    head(`Changed · ${changed.length}`)
    for (const { path, file } of changed) {
      const tint = kl(file.created ? 'ok' : 'edit')
      const name = fitMono(basename(path), 12.5, W - 200)
      const nameW = monoWidth(name, 12.5)
      const n = Math.max(1, file.added + file.removed)
      const greens = Math.round((5 * file.added) / n)
      const reds = file.added + file.removed ? Math.min(5 - greens, Math.max(file.removed ? 1 : 0, Math.round((5 * file.removed) / n))) : 0
      const cells = Array.from({ length: 5 }, (_, i) => `<rect x="${W - 62 + i * 9}" y="${y + 9}" width="7" height="7" rx="1.5" ${i < greens ? 'class="c-ok"' : i < greens + reds ? 'class="c-alert"' : 'class="k"'}/>`).join('')
      b +=
        `<rect class="k" fill-opacity=".4" x="8" y="${y}" width="${W - 16}" height="34" rx="7"/><rect x="8" y="${y}" width="3" height="34" rx="1.5" fill="${tint}"/>` +
        `<text class="t" x="20" y="${y + 15}" font-family="${MONO}" font-size="12.5" font-weight="600">${xml(name)}</text>` +
        (file.created ? `<rect x="${26 + nameW}" y="${y + 5}" width="30" height="13" rx="3" fill="${kb('ok')}"/><text fill="${kf('ok')}" x="${41 + nameW}" y="${y + 15}" text-anchor="middle" font-family="${SANS}" font-size="9" font-weight="700">NEW</text>` : '') +
        `<text class="m" x="20" y="${y + 28}" font-family="${MONO}" font-size="10">${xml(fitMono(dir(path), 10, W - 150))}</text>` +
        `<text x="${W - 70}" y="${y + 16}" text-anchor="end" font-family="${MONO}" font-size="11" font-weight="600"><tspan class="c-ok">+${file.added}</tspan> <tspan class="c-alert">−${file.removed}</tspan></text>` +
        cells +
        `<text class="m" x="${W - 16}" y="${y + 28}" text-anchor="end" font-family="${SANS}" font-size="10">${plural(file.edits, 'edit')}${file.reads ? ` · read ${file.reads}×` : ''}</text>`
      y += 40
    }
  }
  if (read.length) {
    head(`Read · ${read.length}`)
    for (const { path, file } of read.slice(0, READ_SHOWN)) {
      const name = fitMono(basename(path), 12, W * 0.5)
      b +=
        `<circle cx="16" cy="${y + 8}" r="3" fill="${look.bar('context')}"/><text class="t" x="26" y="${y + 12}" font-family="${MONO}" font-size="12">${xml(name)}</text>` +
        `<text class="m" x="${32 + monoWidth(name, 12)}" y="${y + 12}" font-family="${MONO}" font-size="10">${xml(fitMono(dir(path), 10, Math.max(10, W - 80 - monoWidth(name, 12))))}</text>` +
        `<text class="m" x="${W - 16}" y="${y + 12}" text-anchor="end" font-family="${MONO}" font-size="10">${file.reads}×</text>`
      y += 20
    }
    if (read.length > READ_SHOWN) {
      b += `<text class="m" x="26" y="${y + 12}" font-family="${SANS}" font-size="11">${plural(read.length - READ_SHOWN, 'more file')}</text>`
      y += 20
    }
  }
  const H = y + 6
  const alt = `Files: ${changed.map(f => `${f.path} +${f.file.added} −${f.file.removed}${f.file.created ? ' new' : ''}`).join(', ')}${read.length ? `; read ${read.map(f => f.path).join(', ')}` : ''}`
  return paneDrawing(look, W, H, `<rect class="p" width="${W}" height="${H}" rx="8"/>` + b, alt)
}

// The detail with no agent viewed: a sleeping Clawd and how to pick one.
export function emptyDetailSvg(W: number, skin: string = 'auto'): Drawing {
  const look = lookOf(skin)
  const x = 16 + CLAWD_W * 1.6 + 14
  const body =
    `<rect class="p" width="${W}" height="64" rx="8"/>` +
    `<g transform="translate(16,14) scale(1.6)">${asPaths(sprite('tasks', 0, HAT_H, 'sleep', look.clawd))}</g>` +
    `<text class="t" x="${x}" y="28" font-family="${SANS}" font-size="13" font-weight="600">Pick one to view</text>` +
    `<text class="m" x="${x}" y="46" font-family="${SANS}" font-size="11.5">${xml(fit('Press View on a lane to see its work.', 11.5, W - x - 12))}</text>`
  return paneDrawing(look, W, 64, body, 'Pick one to view. Press View on a lane to see its work.')
}

// An earlier crew in one line: when it started and how many it had, what they were about (its
// MVP crowned), and how it went (done, failed, stopped), its time and tokens.
export function earlierSvg(crew: readonly AgentRun[], W: number, skin: string = 'auto'): Drawing {
  const look = lookOf(skin)
  // The crew's agents: its main turn is counted in its time and tokens, not among them.
  const runs = crew.filter(a => !isMain(a))
  const start = Math.min(...crew.map(a => a.startedAt))
  const end = Math.max(...crew.map(a => a.endedAt ?? a.startedAt))
  const at = new Date(start)
  const time = hhmm(at)
  const failed = runs.filter(a => a.status === 'failed' && a.reason !== 'aborted').length
  const stopped = runs.filter(a => a.reason === 'aborted').length
  const done = runs.filter(a => a.status === 'done').length
  const spent = crew.reduce((n, a) => n + (a.spent ?? a.contextTokens), 0)
  // The MVP, of two or more: done without a failed call, the most files changed, then the quickest.
  const changed = (a: AgentRun) => Object.values(a.files ?? {}).filter(f => f.edits > 0).length
  const mvp = runs.length > 1 ? runs.filter(a => a.status === 'done' && !a.callFails).sort((x, y) => changed(y) - changed(x) || elapsed(x, end) - elapsed(y, end))[0] : undefined
  // How it ended, as the timeline's tiles with their counts, then its time and tokens.
  const ends = ([['done', done], ['failed', failed], ['stopped', stopped]] as const).filter(([s, n]) => n || s === 'done')
  const rest = `${clock(end - start)} · ${tokens(spent)}`
  const tally = [...ends.map(([s, n]) => `${n} ${s}`), rest].join(' · ')
  // A dynamic workflow's run is named so; a turn's group needs no name.
  const title = `${time}${crew.some(a => a.crew?.startsWith('wf:')) ? ' · workflow run' : ''} · ${plural(runs.length, 'subagent')}`
  const what = runs.map(a => `${a === mvp ? '👑 ' : ''}${a.description || a.type}`).join(' · ')
  const restW = monoWidth(rest, 10.5)
  const countW = (n: number) => 14 + 3 + monoWidth(String(n), 10.5) + 8
  const tallyW = ends.reduce((w, [, n]) => w + countW(n), 0) + restW
  let cx = W - 10 - tallyW
  const marks = ends.map(([s, n]) => {
    const mark = statusTile(s, +cx.toFixed(1), 6, 14) + `<text class="m" x="${+(cx + 17).toFixed(1)}" y="17" font-family="${MONO}" font-size="10.5">${n}</text>`
    cx += countW(n)
    return mark
  }).join('')
  const body =
    `<rect class="p" width="${W}" height="40" rx="8"/>` +
    `<text class="t" x="12" y="17" font-family="${SANS}" font-size="12" font-weight="600">${xml(fit(title, 12, W - 24))}</text>` +
    (12 + textWidth(title, 12) + 16 + tallyW + 10 <= W ? marks + `<text class="m" x="${W - 10}" y="17" text-anchor="end" font-family="${MONO}" font-size="10.5">${rest}</text>` : '') +
    `<text class="m" x="12" y="32" font-family="${SANS}" font-size="11">${xml(fit(what, 11, W - 24))}</text>`
  return paneDrawing(look, W, 40, body, `${title}: ${tally}. ${what}`)
}

export function emptyAgentsSvg(W: number, skin: string = 'auto'): Drawing {
  const look = lookOf(skin)
  const clawd = spriteSize('tasks')
  const body =
    `<rect class="p" width="${W}" height="56" rx="8"/>` +
    sprite('tasks', PAD, 20, 'idle', look.clawd) +
    `<text class="t" x="${PAD + clawd.width + 12}" y="24" font-family="${SANS}" font-size="12.5" font-weight="600">No subagents yet</text>` +
    `<text class="m" x="${PAD + clawd.width + 12}" y="41" font-family="${SANS}" font-size="11.5">${xml(fit('They show here when Claude hands work off — try “explore the codebase in parallel”.', 11.5, W - PAD * 2 - clawd.width - 12))}</text>`
  return drawing(look, W, 56, body, 'No subagents yet. They show here when Claude hands work off.')
}

// Ink as a fill (text, bar cells) and as a stroke (icons), light then dark.
const ink = (prefix: string, prop: 'fill' | 'stroke', colours: Record<string, readonly [string, string]>) =>
  Object.entries(colours).map(([k, v]) => `.${prefix}-${k}{${prop}:${v[0]}}`).join('') +
  `@media (prefers-color-scheme: dark){${Object.entries(colours).map(([k, v]) => `.${prefix}-${k}{${prop}:${v[1]}}`).join('')}}`
const CHAT_CSS = ink('k', 'fill', CHAT_INK) + ink('s', 'stroke', CHAT_INK) + `.trk{fill:${TEXT.m[0]};opacity:.16}@media (prefers-color-scheme: dark){.trk{fill:${TEXT.m[1]}}}`
// One-shot motion, starting from a visible frame; reduced motion keeps it still.
const CHAT_MOTION =
  '.an-pop,.an-shake{transform-box:fill-box;transform-origin:center}' +
  '.an-pop{animation:an-pop .45s ease-out}@keyframes an-pop{0%,100%{transform:scale(1)}45%{transform:scale(1.2)}}' +
  '.an-shake{animation:an-shake .4s ease-in-out}@keyframes an-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-1.5px)}75%{transform:translateX(1.5px)}}' +
  '@media (prefers-reduced-motion: reduce){.an-pop,.an-shake{animation:none}}'
const CHAT_ICON = 18
const STEP_W = 560
const STEP_H = 24
const TITLE_H = 24

const stroke = (icon: StrokeKind, cls: string, x: number, y: number, size: number) =>
  `<g transform="translate(${x},${y}) scale(${size / 24})"><g class="${cls}" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${STROKES[icon]}</g></g>`

// The desktop toolbar's buttons as icons. A Button draws its text label alone, so each icon is
// an image link in a Markdown; the count and the colour that marks it worth a press are drawn in.
// The guard draws the same way, in green, its word and count beside the shield.
export type ToolIcon = 'compact' | 'agents' | 'settings' | 'guard'
const TOOL_STROKE: Record<ToolIcon, StrokeKind> = { compact: 'fold-vertical', agents: 'bot', settings: 'settings', guard: 'shield-check' }
const TOOL_SIZE = 16

// Each icon sits on a tile of the band's card, as tall as the info row's, so the top row reads as
// one strip. The shape is a mask over a rect, so it takes the skin's fill inks like the cards' words.
const TOOL_H = INFO_H
const TOOL_PAD = 5
export function toolIconSvg(kind: ToolIcon, count?: string, tone: 'm' | 'warn' | 'alert' | 'tasks' | 'ok' = 'm', skin = 'auto'): Drawing {
  const ink = tone === 'm' ? 'm' : `c-${tone}`
  const w = TOOL_PAD * 2 + TOOL_SIZE + (count ? 4 + Math.ceil(monoWidth(count, 11)) : 0)
  const y = (TOOL_H - TOOL_SIZE) / 2
  const body =
    `<rect class="p" width="${w}" height="${TOOL_H}" rx="6"/>` +
    `<mask id="sabai-tool"><g stroke="#fff">${stroke(TOOL_STROKE[kind], '', TOOL_PAD, y, TOOL_SIZE)}</g></mask>` +
    `<rect class="${ink}" x="${TOOL_PAD}" y="${y}" width="${TOOL_SIZE}" height="${TOOL_SIZE}" mask="url(#sabai-tool)"/>` +
    (count ? `<text class="${ink}" x="${TOOL_PAD + TOOL_SIZE + 4}" y="${y + 12}" font-family="${MONO}" font-size="11" font-weight="700">${xml(count)}</text>` : '')
  return { source: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${TOOL_H}" viewBox="0 0 ${w} ${TOOL_H}"><style>${leanCss(lookOf(skin), ['p', ink])}</style>${body}</svg>`, width: w, height: TOOL_H, alt: kind }
}

const STEP_ICON: Record<StepIcon, StrokeKind> = { terminal: 'terminal', flask: 'flask-conical', pen: 'square-pen', file: 'file-plus', read: 'book-open', stop: 'ban' }

// One tool call as a minimal step on one line: a small stroke icon in its tool's colour, a
// title saying what it was about, then what it did, dim; at the right a meter, the result in a
// tinted pill and the time. Drawn at a fixed size, which the row is told, so it never stretches.
export function stepSvg(step: Step): Drawing {
  const resultText = step.result.map(p => p.text).join('')
  const pillTone = step.result[0]?.tone ?? 'muted'
  // Always kept, so pills line up from row to row whether or not a step has a time; a long time
  // (a slow run's tortoise) widens it rather than run under the pill.
  const timeW = Math.max(44, step.time ? monoWidth(step.time, 10.5) + 6 : 0)
  const pillW = resultText ? monoWidth(resultText, 11) + 12 : 0
  const meterW = step.meter ? 5 * 5 + 6 : 0
  const right = STEP_W - 2 - timeW
  let x = right - pillW
  let pill = ''
  if (resultText) {
    pill = `<rect class="k-${pillTone}" opacity="${PILL_TINT}" x="${x.toFixed(1)}" y="4" width="${pillW.toFixed(1)}" height="16" rx="8"/>`
    let tx = x + 6
    for (const p of step.result) {
      pill += `<text class="k-${p.tone}" x="${tx.toFixed(1)}" y="15.5" font-family="${MONO}" font-size="11" xml:space="preserve">${xml(p.text)}</text>`
      tx += monoWidth(p.text, 11)
    }
  }
  let meter = ''
  if (step.meter) {
    const { good, bad } = step.meter
    const n = good + bad
    let goodCells = n ? Math.round((5 * good) / n) : 0
    if (good > 0 && goodCells === 0) goodCells = 1
    if (bad > 0 && goodCells === 5) goodCells = 4
    const start = x - meterW
    meter = Array.from({ length: 5 }, (_, i) => `<rect class="k-${i < goodCells ? 'ok' : 'bad'}" x="${start + i * 5}" y="8" width="3" height="8" rx="1"/>`).join('')
    x = start
  }
  const time = step.time ? `<text class="k-muted" x="${STEP_W - 2}" y="15.5" text-anchor="end" font-family="${MONO}" font-size="10.5">${xml(step.time)}</text>` : ''
  const room = x - 20 - 10
  const title = fit(step.title, 12, Math.min(room, room * 0.7 + 60), 1)
  const titleW = textWidth(title, 12)
  const detailRoom = room - titleW - 10
  const detail = detailRoom > 40 ? fitMono(step.detail, 10.5, detailRoom) : ''
  const motion = step.tone === 'ok' ? ' an-pop' : step.tone === 'bad' ? ' an-shake' : ''
  const body =
    stroke(STEP_ICON[step.icon], `s-${step.tone}${motion}`, 1, 5.5, 13) +
    `<text class="k-text" x="20" y="16" font-family="${SANS}" font-size="12" font-weight="600">${xml(title)}</text>` +
    (detail ? `<text class="k-muted" x="${(20 + titleW + 10).toFixed(1)}" y="15.5" font-family="${MONO}" font-size="10.5" xml:space="preserve">${xml(detail)}</text>` : '') +
    meter +
    pill +
    time
  return {
    source: `<svg xmlns="http://www.w3.org/2000/svg" width="${STEP_W}" height="${STEP_H}" viewBox="0 0 ${STEP_W} ${STEP_H}"><style>${CHAT_CSS}${CHAT_MOTION}</style>${body}</svg>`,
    width: STEP_W,
    height: STEP_H,
    alt: stepText(step),
  }
}

const RECEIPT_ICON: Record<Tone, StrokeKind> = { ok: 'party-popper', bad: 'circle-x', warn: 'triangle-alert', edit: 'circle-check', text: 'circle-check', muted: 'circle-check', read: 'circle-check' }

// A turn's receipt under its answer, as one minimal line like a step's: an icon and headline in
// the colour of how the turn went, then its files, tests and commands, muted, with colour only on
// what changed or failed. Parts that would not fit are left off the end.
export function receiptSvg(r: Receipt): Drawing {
  const groups: { text: string; tone: Tone }[][] = []
  if (r.files) groups.push([{ text: `${r.files.count} file${r.files.count === 1 ? '' : 's'} `, tone: 'muted' }, { text: `+${r.files.added}`, tone: 'ok' }, { text: ` −${r.files.removed}`, tone: 'bad' }])
  if (r.test) groups.push([r.test.failed ? { text: `${r.test.failed} of ${r.test.passed + r.test.failed} failed`, tone: 'bad' } : { text: `${r.test.passed} passed`, tone: 'ok' }])
  if (r.commands) groups.push([{ text: `${r.commands.count} command${r.commands.count === 1 ? '' : 's'}`, tone: 'muted' }, ...(r.commands.failed ? [{ text: ` · ${r.commands.failed} failed`, tone: 'bad' as Tone }] : [])])
  const headW = textWidth(r.headline, 12)
  let x = 20 + headW
  let words = ''
  for (const g of groups) {
    const parts = [{ text: '  ·  ', tone: 'muted' as Tone }, ...g]
    const w = parts.reduce((n, p) => n + monoWidth(p.text, 10.5), 0)
    if (x + w > STEP_W - 2) break
    for (const p of parts) {
      words += `<text class="k-${p.tone}" x="${x.toFixed(1)}" y="15.5" font-family="${MONO}" font-size="10.5" xml:space="preserve">${xml(p.text)}</text>`
      x += monoWidth(p.text, 10.5)
    }
  }
  const motion = r.tone === 'ok' ? ' an-pop' : r.tone === 'bad' ? ' an-shake' : ''
  const body =
    stroke(RECEIPT_ICON[r.tone], `s-${r.tone}${motion}`, 1, 5.5, 13) +
    `<text class="k-${r.tone}" x="20" y="16" font-family="${SANS}" font-size="12" font-weight="600">${xml(r.headline)}</text>` +
    words
  const said = [r.headline, ...groups.map(g => g.map(p => p.text).join(''))].join('; ')
  return {
    source: `<svg xmlns="http://www.w3.org/2000/svg" width="${STEP_W}" height="${STEP_H}" viewBox="0 0 ${STEP_W} ${STEP_H}"><style>${CHAT_CSS}${CHAT_MOTION}</style>${body}</svg>`,
    width: STEP_W,
    height: STEP_H,
    alt: `Turn receipt: ${said}`,
  }
}

// Each callout kind: its stroke icon, the theme key its box's border takes, and its SVG ink as
// [light, dark].
export const CALLOUT_KINDS = {
  note: { title: 'Note', icon: 'info', key: 'suggestion', ink: ['#0969da', '#4493f8'] },
  tip: { title: 'Tip', icon: 'lightbulb', key: 'success', ink: CHAT_INK.ok },
  important: { title: 'Important', icon: 'badge-alert', key: 'claude', ink: ['#a8461f', '#e8916b'] },
  warning: { title: 'Warning', icon: 'triangle-alert', key: 'warning', ink: CHAT_INK.warn },
  caution: { title: 'Caution', icon: 'octagon-x', key: 'error', ink: CHAT_INK.bad },
} as const satisfies Record<CalloutKind, { title: string; icon: StrokeKind; key: string; ink: readonly [string, string] }>

// A callout's title: its icon and name in its kind's colour.
export function calloutTitleSvg(kind: CalloutKind): Drawing {
  const k = CALLOUT_KINDS[kind]
  const w = CHAT_ICON + 8 + k.title.length * 8.5
  const css = `.co{stroke:${k.ink[0]}}.cot{fill:${k.ink[0]}}@media (prefers-color-scheme: dark){.co{stroke:${k.ink[1]}}.cot{fill:${k.ink[1]}}}`
  return {
    source: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${TITLE_H}" viewBox="0 0 ${w} ${TITLE_H}"><style>${css}${CHAT_MOTION}</style>${stroke(k.icon, 'co an-pop', 0, 3, CHAT_ICON)}<text class="cot" x="${CHAT_ICON + 8}" y="17" font-family="${SANS}" font-size="14" font-weight="600">${k.title}</text></svg>`,
    width: w,
    height: TITLE_H,
    alt: k.title,
  }
}
