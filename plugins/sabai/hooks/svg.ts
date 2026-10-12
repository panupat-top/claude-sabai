import type { AgentRun, BarStyle, CallKind, UsageStyle } from '../types'
import { clock, effortLabel, elapsed, modelName, progressOf, summary, typeStyle } from './agents'
import type { Race } from './agents'
import type { Accessory, Chip, Meter, Mood, Progress, Trick } from './model'
import { countdown, paceOf, resetClock, tokens, value } from './model'
import type { CalloutKind, Receipt, Step, StepIcon, Tone } from './chat'
import { stepText } from './chat'
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
  edit: ['#0550ae', '#79c0ff'],
  read: ['#0a6158', '#3ccbbb'],
}
// How strongly a result pill is tinted with its ink: the ink must still read on the tint.
export const PILL_TINT = 0.1
const css = (i: 0 | 1, text: Readonly<Record<string, readonly [string, string]>> = TEXT) => Object.entries(text).map(([k, v]) => `.${k.length > 1 ? `c-${k}` : k}{fill:${v[i]}}`).join('')
// White on this clay reads at 4.5:1; the brand clay itself is kept for the bar.
const PILL = '#b5532f'
export const MOTION =
  // Each loop within a second: the band redraws every second while work runs, restarting them.
  '.d0,.d1,.d2,.d3{animation:tw 1s ease-in-out infinite}.d1{animation-duration:.8s;animation-delay:-.3s}' +
  '.d2{animation-duration:.9s;animation-delay:-.6s}.d3{animation-duration:.7s;animation-delay:-.2s}' +
  '@keyframes tw{0%,100%{opacity:1}50%{opacity:.3}}' +
  '.ripple{transform-box:fill-box;transform-origin:center;animation:rp 1s ease-out infinite}@keyframes rp{0%{transform:scale(.6);opacity:.9}100%{transform:scale(2.2);opacity:0}}' +
  // A pop that starts and ends at full size: an image's animation can sit frozen on its first
  // frame (a hidden window), so no motion here may begin by hiding what it moves.
  '.pop{transform-box:fill-box;transform-origin:center;animation:pop .45s ease-out 2}@keyframes pop{50%{transform:scale(1.45)}}' +
  '.cf{animation:cf 1s ease-out infinite}@keyframes cf{50%{transform:translateY(-3px)}}' +
  '.shake{animation:sh .4s ease-in-out 2}@keyframes sh{25%{transform:translateX(-1.5px)}75%{transform:translateX(1.5px)}}' +
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
  return chars.slice(0, Math.max(min, n)).join('') + '…'
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

// `still` leaves the motion stylesheet out: a drawing with nothing moving need not carry it.
const svg = (look: Look, w: number, h: number, body: string, still = false) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><style>${look.css}${SURFACE_INK}${still ? '' : MOTION}</style>${body}</svg>`

const ROW_H = 20
const GAP = 8
const PAD = 10
const CARD_H = 44
const CARD_H_COMPACT = 22

// A usage card on one line, for the compact band: its mark (context only), label, bar, percent,
// and the reset countdown when there is room.
function compactCard(look: Look, m: Meter, x: number, y: number, w: number, style: BarStyle): string {
  const labelX = m.kind === 'context' ? x + PAD + 26 : x + PAD
  const label = m.kind === 'context' ? 'CTX' : m.label.split(' ')[0]!.toUpperCase()
  const countdownText = m.resetsInMs === undefined ? '' : ` ↻${countdown(m.resetsInMs).replace(' ', '')}`
  const room = (tail: string) => x + w - PAD - monoWidth(tail, 11) - 8 - (labelX + monoWidth(label, 10) + 8)
  const tail = room(`${pctText(m)}${countdownText}`) >= 40 ? `${pctText(m)}${countdownText}` : pctText(m)
  const barX = labelX + monoWidth(label, 10) + 8
  const barW = Math.max(30, room(tail))
  return (
    `<rect class="p" x="${x}" y="${y}" width="${w}" height="${CARD_H_COMPACT}" rx="6"/>` +
    (m.kind === 'context' ? sprite('context', x + PAD + 1, y + CARD_H_COMPACT / 2 - spriteSize('context').height / 2) : '') +
    `<text class="m" x="${labelX}" y="${y + 15}" font-family="${MONO}" font-size="10" font-weight="600" letter-spacing=".08em">${label}</text>` +
    pixelBar(`sabai-${m.kind}`, barX, y + 7, barW, 8, m.percent / 100, look.bar(m.kind, m.level), 0, style) +
    `<text class="${pctClass(m)}" x="${x + w - PAD}" y="${y + 15}" text-anchor="end" font-family="${MONO}" font-size="11" font-weight="700">${xml(tail)}</text>`
  )
}

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
function cardsPart(look: Look, list: readonly Meter[], W: number, y0: number, style: BarStyle, compact = false): Part {
  const cols = Math.min(list.length, W >= 720 ? 4 : W >= 400 ? 2 : 1)
  const rows = Math.ceil(list.length / cols)
  const gap = compact ? 4 : GAP
  const cardH = compact ? CARD_H_COMPACT : CARD_H
  const cardW = Math.floor((W - gap * (cols - 1)) / cols)
  const cards = list.map((m, i) => {
    const x = (i % cols) * (cardW + gap)
    const y = y0 + Math.floor(i / cols) * (cardH + gap)
    if (compact) return compactCard(look, m, x, y, cardW, style)
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
      `<text class="m" x="${labelX}" y="${top + 3.5}" font-family="${MONO}" font-size="10" font-weight="600" letter-spacing=".08em">${xml(m.label.toUpperCase())}</text>` +
      detail +
      pixelBar(`sabai-${m.kind}`, x + PAD, bottom - 4.5, cardW - PAD * 2 - 44, 9, m.percent / 100, color, 0, style) +
      `<text class="${pctClass(m)}" x="${right}" y="${bottom + 4}" text-anchor="end" font-family="${MONO}" font-size="11.5" font-weight="700">${pctText(m)}</text>`
    )
  })
  const alt = list
    .map(m => `${m.label} ${value(m)}${m.resetsInMs === undefined ? '' : `, resets in ${countdown(m.resetsInMs)}`}`)
    .join('; ')
  return { body: cards.join(''), height: rows * cardH + (rows - 1) * gap, alt }
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
  // Until git and node answer, two still bars where the folder and branch will be.
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
  const failed = ended.filter(a => a.status === 'failed').length
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
  const title = lead ? lead.description || lead.type : failed ? `${ended.length - failed} done · ${failed} failed` : `All ${ended.length} done`
  const detail = lead ? (line ? `${line.done}/${line.total} · ${line.title}` : `${lead.steps} ${lead.steps === 1 ? 'step' : 'steps'}`) : ''
  // The right side, laid out from the edge: time, then failed, done and running counts.
  const s = summary([...runs], now)
  const time = clock(s.ms)
  let rx = W - monoWidth(time, 11)
  const right: string[] = [`<text class="sm" x="${W}" y="${top + 15}" text-anchor="end" font-family="${MONO}" font-size="11">${time}</text>`]
  const count = (n: number, status: AgentRun['status']) => {
    rx -= monoWidth(String(n), 11.5) + 18
    right.push(statusMark(look, status, rx + 4, top + 11, look.clawd, false))
    right.push(`<text class="st" x="${rx + 12}" y="${top + 15}" font-family="${MONO}" font-size="11.5" font-weight="700">${n}</text>`)
  }
  if (failed) count(failed, 'failed')
  if (ended.length - failed) count(ended.length - failed, 'done')
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
  const counts = [running.length ? `${running.length} running` : '', ended.length ? `${ended.length - failed} done` : '', failed ? `${failed} failed` : ''].filter(Boolean).join(', ')
  return { body, height: CREW_H, alt: `Agents: ${counts}; ${lead ? lead.description || lead.type : title}` }
}

// The race's motion, carried only by the race box: the ground scrolls, coins spin and rise, flags
// flutter, the glow pulses.
const RACE_MOTION =
  '.scroll{animation:rsc 1s linear infinite}@keyframes rsc{to{transform:translateX(-10px)}}' +
  '.coin{transform-box:fill-box;transform-origin:center;animation:rcn .6s steps(2) infinite}@keyframes rcn{50%{transform:scaleX(.35)}}' +
  '.rise{animation:rrs 1s ease-out infinite}@keyframes rrs{70%{transform:translateY(-6px);opacity:.25}}' +
  '.flag{transform-box:fill-box;transform-origin:0 50%;animation:rfl .5s steps(2) infinite}@keyframes rfl{50%{transform:scaleY(.8)}}' +
  '.glow{animation:rgl 1s ease-in-out infinite}@keyframes rgl{50%{opacity:.35}}' +
  '@media (prefers-reduced-motion: reduce){.scroll,.coin,.rise,.flag,.glow{animation:none}}'
const RACE_W = 300
const RACE_HEAD = 24
const LANE_H = 42
// A lane not at work (Main waiting on agents, a finished agent) folds to one line.
const SLIM_H = 18
const RACE_BODY = '#b9b9b4'
// The footprints' pixel icons, 7×7: a magnifier for a read, a pencil for an edit, a prompt for a
// command, a flask for a passing test, and a cross for any call that failed. Each is one path at
// its origin, a rect per run of pixels in a row.
const TRAIL_ROWS: Record<CallKind | 'fail', string[]> = {
  read: ['.###...', '#...#..', '#...#..', '#...#..', '.###...', '....##.', '.....##'],
  edit: ['.....##', '....###', '...###.', '..###..', '.###...', '#.#....', '##.....'],
  command: ['.......', '#......', '.#.....', '..#....', '.#.....', '#..####', '.......'],
  test: ['..###..', '...#...', '...#...', '..#.#..', '.#.#.#.', '#######', '#######'],
  fail: ['#.....#', '.#...#.', '..#.#..', '...#...', '..#.#..', '.#...#.', '#.....#'],
}
export const TRAIL_ICONS = Object.fromEntries(
  Object.entries(TRAIL_ROWS).map(([k, rows]) => [k, rows.flatMap((row, y) => [...row.matchAll(/#+/g)].map(m => `M${m.index} ${y}h${m[0].length}v1h-${m[0].length}z`)).join('')]),
) as Record<CallKind | 'fail', string>
const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`

// The race: a header (how many run and are done, the turn's calls that worked and failed, the
// time), then a lane per member: its name, step and time on a line above its ground, its runner at
// its progress (or paced by its calls when unknown) holding the tool of its call in flight over a
// glow, its footprints (a pixel icon per call) trailing it, and its flag. While a lane moves its ground
// scrolls. A lane shared by agents of one type draws three runners.
export function racePart(look: Look, race: Race, W: number, top: number): Part {
  // A kind's colour as attributes, merged with the element's own classes: two class attributes on
  // one element make the drawing invalid, and the desktop then draws nothing.
  const kindFill = (k: CallKind, ok: boolean, cls = '') => {
    const paint = !ok ? { fill: look.bar('tasks', 'alert') } : k === 'read' ? { fill: look.bar('context') } : k === 'edit' ? { fill: look.bar('session') } : { cls: k === 'test' ? 'c-ok' : 'm' }
    const classes = [cls, paint.cls].filter(Boolean).join(' ')
    return `${classes ? `class="${classes}"` : ''}${paint.fill ? ` fill="${paint.fill}"` : ''}`
  }
  const time = race.elapsedMs === undefined ? '' : mmss(race.elapsedMs)
  // The header's right side from the edge: each figure at its slot, or further left when the one
  // after it runs long (an hour and more, a thousand calls).
  let edge = W
  const figure = (slot: number, cls: string, s: string, size: number, bold = true) => {
    const x = Math.min(slot, edge - 10)
    edge = x - monoWidth(s, size)
    return `<text class="${cls}" x="${+x.toFixed(1)}" y="${top + 16}" text-anchor="end" font-family="${MONO}" font-size="${size}"${bold ? ' font-weight="700"' : ''}>${s}</text>`
  }
  const right = [
    time ? figure(W - 12, 'm', time, 10.5, false) : '',
    figure(W - 50, 'c-ok', `✓ ${race.ok}`, 10.5),
    race.fails ? figure(W - 90, 'c-alert', `✗ ${race.fails}`, 10.5) : '',
    race.more ? figure(W - 128, 'm', `+${race.more}`, 10) : '',
  ]
  const head =
    `<text class="t" x="12" y="${top + 16}" font-family="${SANS}" font-size="11" font-weight="700">${race.running} running${race.done ? ` · ${race.done} done` : ''}</text>` +
    right.reverse().join('')
  const laneX = 12
  const laneW = W - laneX - 26
  // Each lane starts where the one above it ends: slim lanes are shorter.
  let next = top + RACE_HEAD
  // Each footprint's shape is drawn once in <defs> and placed by <use>: the race is redrawn every
  // second while work runs, and a lane holds up to 16 of them.
  const used = new Set<string>()
  // A lane's calls that worked and failed, at the right of its line before its time; `room` is
  // what they and the time leave for the step.
  const tally = (l: Race['lanes'][number], laneTime: string, ty: number) => {
    const ok = Math.max(0, l.count - (l.fails ?? 0))
    let edge = W - 12 - (laneTime ? monoWidth(laneTime, 9.5) + 6 : 0)
    const marks: string[] = []
    // In the header's order, from the time leftward: worked, then failed.
    for (const [n, cls, s] of [[ok, 'c-ok', '✓'], [l.fails ?? 0, 'c-alert', '✗']] as const) {
      if (!n) continue
      marks.push(`<text class="${cls}" x="${+edge.toFixed(1)}" y="${ty}" text-anchor="end" font-family="${MONO}" font-size="9.5" font-weight="700">${s}${n}</text>`)
      edge -= monoWidth(`${s}${n}`, 9.5) + 5
    }
    return { svg: marks.join(''), room: (stepX: number) => Math.max(20, edge - stepX - 6) }
  }
  const lanes = race.lanes.map((l, i) => {
    const y = next
    const laneTime = l.timeMs === undefined ? '' : mmss(l.timeMs)
    if (l.state === 'waiting' || l.state === 'finished') {
      next += SLIM_H
      const done = l.state === 'finished'
      const cy = y + 8
      const mark = done ? statusMark(look, 'done', laneX + 4, cy, look.clawd, false) : `<path class="m" opacity=".7" fill-rule="evenodd" d="M${laneX + 1} ${cy}a3 3 0 1 0 6 0a3 3 0 1 0-6 0zM${laneX + 2.4} ${cy}a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0z"/>`
      const slimName = fit(l.who, 10.5, 150)
      const slimStepX = laneX + 16 + textWidth(slimName, 10.5) + 8
      const slimTally = tally(l, laneTime, cy + 3.5)
      return (
        mark +
        `<text class="${done ? 'c-ok' : 'm'}" x="${laneX + 16}" y="${cy + 3.5}" font-family="${SANS}" font-size="10.5" font-weight="700">${xml(slimName)}</text>` +
        `<text class="m" x="${slimStepX}" y="${cy + 3.5}" font-family="${SANS}" font-size="10">${xml(fit(`· ${l.step}`, 10, slimTally.room(slimStepX)))}</text>` +
        slimTally.svg +
        (laneTime ? `<text class="m" x="${W - 12}" y="${cy + 3.5}" text-anchor="end" font-family="${MONO}" font-size="9.5">${laneTime}</text>` : '')
      )
    }
    next += LANE_H
    const ground = y + LANE_H - 8
    const moving = l.state === 'running' || l.state === 'scored'
    const rx = laneX + Math.min(laneW - 22, laneW * (l.progress ?? paceOf(l.count ?? l.calls.length)))
    // Footprints: the newest right behind the (back) runner, older ones leftward, as many as fit.
    const back = rx - (l.many ? 14 : 0)
    const room = Math.max(0, Math.floor((back - laneX) / 10))
    const tiles = (room ? l.calls.slice(-room) : [])
      .reverse()
      .map((c, j) => {
        const shape = c.ok ? c.kind : 'fail'
        used.add(shape)
        return `<use href="#sabai-tr-${shape}" x="${+(back - (j + 1) * 10 + 1.5).toFixed(1)}" y="${ground - 3}" ${kindFill(c.kind, c.ok)}/>`
      })
      .join('')
    const mode = l.state === 'running' ? 'run' : l.state === 'tripped' ? 'dizzy' : l.state === 'scored' ? 'hop' : l.state === 'out' ? 'out' : 'idle'
    const hat = l.type ? hatOf(look, l.type) : undefined
    const body = l.state === 'out' ? RACE_BODY : look.clawd
    const one = (dx: number) => `<g transform="translate(${rx + dx},${ground - 16}) scale(.8)">${sprite('tasks', 0, 4, mode, body, hat ? { kind: hat.hat, color: hat.hatColor } : undefined, undefined, l.state === 'running' || l.state === 'thinking' ? l.doing : undefined)}</g>`
    // A merged lane's two ghosts are the runner again, by reference.
    const runners = l.many ? `<use href="#sabai-run-${i}" x="-14" opacity=".45"/><use href="#sabai-run-${i}" x="-7" opacity=".7"/><g id="sabai-run-${i}">${one(0)}</g>` : one(0)
    const glow = l.doing && l.state !== 'out' ? `<ellipse cx="${rx + 10}" cy="${ground}" rx="11" ry="2.5" ${kindFill(l.doing, true, 'glow')}/>` : ''
    const flagX = laneX + laneW + 6
    const flag = `<rect class="m" x="${flagX}" y="${ground - 15}" width="1.2" height="16"/><path class="flag m" opacity=".7" d="M${flagX + 1.2} ${ground - 15}h8l-2.5 3.5 2.5 3.5h-8z"/>`
    // Marks sit beside the runner, clear of the line above.
    const marks =
      l.state === 'tripped' ? `<path d="M${rx + 22} ${ground + 1}l3-6 3 6z" fill="${look.bar('tasks', 'alert')}"/><text class="c-alert" x="${rx + 30}" y="${ground - 2}" font-family="${MONO}" font-size="8" font-weight="800">OUCH</text>` :
      l.state === 'scored' ? `<circle class="rise coin" cx="${rx + 26}" cy="${ground - 10}" r="3" fill="#e0a030"/>` :
      l.state === 'out' ? `<text class="c-alert" x="${rx + 26}" y="${ground - 2}" font-family="${MONO}" font-size="8" font-weight="800">OUT</text>` : ''
    const nameClass = l.state === 'tripped' || l.state === 'out' ? 'c-alert' : 't'
    const name = fit(l.who, 10.5, 150)
    const nameW = textWidth(name, 10.5)
    const badge = l.many ? `<rect class="k" x="${laneX + nameW + 4}" y="${y + 1.5}" width="20" height="11" rx="5.5"/><text class="t" x="${laneX + nameW + 14}" y="${y + 10}" text-anchor="middle" font-family="${MONO}" font-size="8.5" font-weight="700">×${l.many}</text>` : ''
    const stepX = laneX + nameW + (l.many ? 30 : 8)
    const laneTally = tally(l, laneTime, y + 10)
    const line =
      `<text class="${nameClass}" x="${laneX}" y="${y + 10}" font-family="${SANS}" font-size="10.5" font-weight="700">${xml(name)}</text>` +
      badge +
      `<text class="m" x="${stepX}" y="${y + 10}" font-family="${SANS}" font-size="10">${xml(fit(`· ${l.step}`, 10, laneTally.room(stepX)))}</text>` +
      laneTally.svg +
      (laneTime ? `<text class="m" x="${W - 12}" y="${y + 10}" text-anchor="end" font-family="${MONO}" font-size="9.5">${laneTime}</text>` : '')
    // While the lane moves its ground is dashes in Clawd's colour scrolling left; a 10 px period loops
    // without a seam. At rest it is a faint line. Both in inks that show on every card.
    const clip = `sabai-race-${l.id.replace(/\W/g, '_')}`
    const groundLine = moving
      ? `<clipPath id="${clip}"><rect x="${laneX}" y="${ground + 3}" width="${laneW}" height="3"/></clipPath><g clip-path="url(#${clip})"><g class="scroll"><path fill="${look.clawd}" opacity=".7" d="M${laneX} ${ground + 4.5}${'h6v1h-6zm10 0'.repeat(Math.ceil(laneW / 10) + 1)}"/></g></g>`
      : `<rect class="m" opacity=".4" x="${laneX}" y="${ground + 4.5}" width="${laneW}" height="1"/>`
    return line + groundLine + tiles + flag + glow + runners + marks
  })
  const alt = [
    `Race: ${race.running} running${race.done ? `, ${race.done} done` : ''}, ${race.ok} ok${race.fails ? `, ${race.fails} failed` : ''}${time ? `, ${time}` : ''}`,
    ...race.lanes.map(l => {
      const calls = [l.count - (l.fails ?? 0) > 0 ? `${l.count - (l.fails ?? 0)} ok` : '', l.fails ? `${l.fails} failed` : ''].filter(Boolean).join(', ')
      return `${l.who}${l.many ? ` ×${l.many}` : ''} ${l.state}: ${l.step}${calls ? ` (${calls})` : ''}`
    }),
    ...(race.more ? [`${race.more} more`] : []),
  ].join('; ')
  const defs = used.size ? `<defs>${[...used].map(k => `<path id="sabai-tr-${k}" d="${TRAIL_ICONS[k as keyof typeof TRAIL_ICONS]}"/>`).join('')}</defs>` : ''
  return { body: `<style>${RACE_MOTION}</style>` + defs + head + lanes.join(''), height: next - top + 6, alt }
}

export const HERO_MIN_W = 480
const RACE_MIN_W = 760
const HERO_PANEL_W = 108
// What Clawd's panel says under him for each mood.
const MOOD_WORDS: Record<Mood, string> = { idle: 'ready', working: 'working', startled: 'blocked', sad: 'tests failing', celebrating: 'all green', sweating: 'context full', sleeping: 'napping' }

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
const usageLabel = (m: Meter) => (m.kind === 'context' ? 'CONTEXT' : m.label.split(' ')[0]!.toUpperCase())
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
          utext('m', x + 14, 18, usageLabel(m), 9.5, inner - pctW - 6, ' font-weight="700" letter-spacing=".08em"') +
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
        utext('m', x + 14, 18, usageLabel(m), 9.5, inner, ' font-weight="700" letter-spacing=".08em"') +
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
        ? utext('t', cx, cy + d / 2 + 16, [usageLabel(m), mainOf(m)].filter(Boolean).join(' · '), 10, cw - 12, ' font-weight="600" text-anchor="middle"') +
          (h - (cy + d / 2) >= 34 ? utext('m', cx, cy + d / 2 + 30, subOf(m, now), 9.5, cw - 12, ' text-anchor="middle"') : '')
        : utext('m', x + 18 + d, h / 2 - 8, usageLabel(m), 9.5, cw - d - 26, ' font-weight="700" letter-spacing=".08em"') +
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
        utext('m', x + 40, 20, usageLabel(m), 9.5, inner, ' font-weight="700" letter-spacing=".08em"') +
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
          utext('m', 14, mid + 4, usageLabel(m), 10, barX - 20, ' font-weight="700" letter-spacing=".08em"') +
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
  if (live && !race) add(livePart(look, live, rw, y))
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
  const words = mood === 'working' && live?.elapsedMs !== undefined && !race ? clock(live.elapsedMs) : (clawdLine ?? '')
  const wordsClass = mood === 'sad' ? 'c-alert' : 'm'
  if (clawd) {
    const scale = 3
    const hat = accessory === 'newyear' || accessory === 'xmas' || accessory === 'nightcap' ? HAT_H * scale : 0
    const cw = spriteSize('tasks').width * scale
    const ch = spriteSize('tasks').height * scale
    const block = hat + ch + 8 + 14 + (words ? 13 : 0)
    const cy = Math.max(6, (H - block) / 2) + hat
    const cx = (HERO_PANEL_W - cw) / 2 - (accessory === 'coffee' || accessory === 'halloween' || accessory === 'songkran' ? PROP_W : 0)
    panel =
      `<rect class="p" width="${HERO_PANEL_W}" height="${H}" rx="10"/>` +
      `<g transform="translate(${cx},${cy}) scale(${scale})">${clawdAt(look, 0, 0, mood, accessory, opts.trick)}</g>` +
      `<text class="t" x="${HERO_PANEL_W / 2}" y="${cy + ch + 18}" text-anchor="middle" font-family="${SANS}" font-size="11.5" font-weight="600">${MOOD_WORDS[mood]}</text>` +
      (words ? `<text class="${wordsClass}" x="${HERO_PANEL_W / 2}" y="${cy + ch + 32}" text-anchor="middle" font-family="${MONO}" font-size="10.5">${xml(words)}</text>` : '')
  }
  // Shorter than the band, the middle sits in its middle; with the usage it fills the band.
  const dy = usage ? 0 : Math.max(0, Math.round((H - middleH) / 2))
  const box = raced ? `<g transform="translate(${W - RACE_W},0)"><rect class="p" width="${RACE_W}" height="${H}" rx="10"/>${raced.body}</g>` : ''
  const body = panel + `<g transform="translate(${x0},${dy})">${parts.map(part => part.body).join('')}</g>` + box
  const alt = [...(clawd ? [`Clawd: ${MOOD_WORDS[mood]}${words ? `, ${words}` : ''}`] : []), ...parts.map(part => part.alt), ...(raced ? [raced.alt] : [])]
  return drawing(look, W, H, body, alt.join('; '))
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
  trick?: Trick
  usageStyle?: UsageStyle
  // Said in the usage's place when the engine has answered with nothing to show.
  usageNote?: string
  // The band's clock, for the reset's clock time.
  now?: number
}

// The turn as it runs, for the live strip.
export type LiveStrip = { elapsedMs?: number; step?: { icon: StepIcon; title: string }; files: number; commands: number; test?: { passed: number; failed: number } }
const LIVE_GLYPH: Record<StepIcon, string> = { terminal: '›', flask: '⚗', pen: '✎', file: '+', read: '≡', stop: '■' }

// The live strip: Clawd (when he stands here), the turn's elapsed time, the step in flight, and
// the turn's tallies so far at the right.
function livePart(look: Look, live: LiveStrip, W: number, top: number, mood?: Mood, accessory?: Accessory, trick?: Trick): Part {
  // Room for Clawd and anything he holds to his right.
  const lead = mood ? spriteSize('tasks').width + PROP_W + 6 : 0
  const time = live.elapsedMs === undefined ? '' : clock(live.elapsedMs)
  const allTallies = [live.files ? `✎ ${live.files}` : '', live.commands ? `› ${live.commands}` : '', live.test ? (live.test.failed ? `✗ ${live.test.failed}` : `✓ ${live.test.passed}`) : ''].filter(Boolean).join('  ·  ')
  const stepX = lead + (time ? monoWidth(time, 11.5) + 12 : 0)
  // On a narrow band the step outranks the tallies: they go first when both would not fit.
  const tallies = live.step && W - stepX - monoWidth(allTallies, 11) - 16 < 80 ? '' : allTallies
  const room = W - stepX - (tallies ? monoWidth(tallies, 11) + 16 : 0)
  const title = live.step && room > 40 ? fit(`${LIVE_GLYPH[live.step.icon]} ${live.step.title}`, 12, room) : ''
  const body =
    (mood ? clawdAt(look, 0, top + (ROW_H - spriteSize('tasks').height) / 2, mood, accessory, trick) : '') +
    (time ? `<text class="st" x="${lead}" y="${top + 14}" font-family="${MONO}" font-size="11.5" font-weight="600">${time}</text>` : '') +
    (title ? `<text class="sm" x="${stepX}" y="${top + 14}" font-family="${SANS}" font-size="12">${xml(title)}</text>` : '') +
    (tallies ? `<text class="sm" x="${W}" y="${top + 14}" text-anchor="end" font-family="${MONO}" font-size="11">${xml(tallies)}</text>` : '')
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
  const words = [live.files && plural(live.files, 'file'), live.commands && plural(live.commands, 'command'), live.test && (live.test.failed ? `${live.test.failed} failed` : `${live.test.passed} passed`)].filter(Boolean).join(', ')
  return { body: `<g>${body}</g>`, height: ROW_H, alt: `Working${time ? ` ${time}` : ''}${live.step ? `: ${live.step.title}` : ''}${words ? `; ${words}` : ''}` }
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
  const hatted = clawd && (accessory === 'newyear' || accessory === 'xmas' || accessory === 'nightcap')
  if (hatted && (clawdInLive || Boolean(p))) y = HAT_H
  if (live) add(livePart(look, live, W, y, clawdInLive ? mood : undefined, accessory, opts.trick))
  if (p) add(progressPart(look, p, W, mood, y, style, clawd, accessory, opts.trick))
  if (crew?.runs.length) add(crewPart(look, crew.runs, crew.now, W, y))
  if (list.length > 0) add(cardsPart(look, list, W, y, style, compact))
  else if (opts.usageNote) add(notePart(opts.usageNote, 0, y, W, compact ? CARD_H_COMPACT : CARD_H))
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
  const hat = clawd && (clawd.accessory === 'newyear' || clawd.accessory === 'xmas' || clawd.accessory === 'nightcap') ? HAT_H : 0
  const part = infoPart(info, W - INFO_PAD * 2, hat, look, clawd ? { look, ...clawd } : undefined)
  // On the card the row's words take the card's inks (as the usage cards' do), not the surface's.
  const words = part.body.replace(/class="s([tm])"/g, 'class="$1"').replace(/class="s-/g, 'class="c-')
  const body = `<rect class="p" y="${hat}" width="${W}" height="${part.height}" rx="6"/><g transform="translate(${INFO_PAD},0)">${words}</g>`
  if (clawd) return drawing(look, W, hat + part.height, body, part.alt)
  const h = part.height
  return { source: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}"><style>${leanCss(look, INFO_INKS)}</style>${body}</svg>`, width: W, height: h, alt: part.alt }
}

// The look picker's swatch: a strip of the look's card colour with its text colours (`Aa`) and
// the four accents as segmented bars. Kept small, since a pane's whole tree
// must stay under 100,000 characters: only the skin in use carries Clawd (~14k), walking.
const SWATCH_H = 32
const SWATCH_TOP = 8
const SEGMENTS = 6
const SAMPLE_FILL: Record<MeterKind | 'tasks', number> = { tasks: 5, context: 3, session: 2, week: 4 }

export function skinPreview(skin: string, W: number, inUse = false): Drawing {
  const look = lookOf(skin)
  const w = Math.max(200, W)
  const clawd = spriteSize('tasks')
  const textX = PAD + (inUse ? clawd.width + 8 : 0)
  const cardX = textX + 52
  const cardW = w - cardX - 6
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
  const body =
    strip(w) +
    (inUse ? sprite('tasks', PAD, (SWATCH_H - clawd.height) / 2, 'run', look.clawd) : '') +
    `<text x="${textX}" y="${SWATCH_H / 2 + 4.5}" font-family="${SANS}" font-size="13" font-weight="600"><tspan class="t">Aa</tspan><tspan class="m" dx="4">Aa</tspan></text>` +
    bars
  return swatch(look, w, body, `${SKIN_NAMES[skin] ?? SKIN_NAMES.auto} cards`, !inUse)
}

// The picker's sample of a bar style: one bar, part filled, in the skin's task colour.
export function barPreview(style: BarStyle, skin: string, W: number): Drawing {
  const look = lookOf(skin)
  const w = Math.max(200, W)
  const body = strip(w) + pixelBar(`sabai-sample-${style}`, PAD, (SWATCH_H - 12) / 2, w - PAD * 2, 12, 0.62, look.bar('tasks'), 5, style)
  return swatch(look, w, body, `${BAR_STYLES[style]} progress bars`, style !== 'dither')
}

const strip = (w: number) => `<rect class="p" width="${w}" height="${SWATCH_H}" rx="8"/>`

// The pane has no spacing finer than a row, so the gap under a swatch's name row is drawn here.
function swatch(look: Look, w: number, body: string, alt: string, still = false): Drawing {
  const h = SWATCH_TOP + SWATCH_H
  return { source: svg(look, w, h, `<g transform="translate(0,${SWATCH_TOP})">${body}</g>`, still), width: w, height: h, alt }
}

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

// Running: a dot whose ring ripples out. Done: a check that pops in while fresh. Failed: a
// cross that shakes once while fresh. `fresh` is the few seconds after an agent ends.
function statusMark(look: Look, status: AgentRun['status'], x: number, y: number, color: string, fresh: boolean): string {
  if (status === 'running')
    return `<circle cx="${x}" cy="${y}" r="3.5" fill="${color}"/><circle class="ripple" cx="${x}" cy="${y}" r="3.5" fill="none" stroke="${color}" stroke-width="1.2"/>`
  if (status === 'done')
    return `<path${fresh ? ' class="pop"' : ''} d="M${x - 5} ${y}l3.5 3.5 6.5-7" fill="none" stroke="${look.bar('context')}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
  return `<g${fresh ? ' class="shake"' : ''}><path d="M${x - 4} ${y - 4}l8 8M${x + 4} ${y - 4}l-8 8" stroke="${look.bar('tasks', 'alert')}" stroke-width="1.8" stroke-linecap="round"/></g>`
}

const AGENT_H = 52
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


// A few pixels of confetti over a just-finished agent; they twinkle and drift, starting in place.
const CONFETTI = [
  [44, 10, 'context'],
  [50, 16, 'session'],
  [40, 20, 'week'],
  [54, 8, 'tasks'],
] as const

// One subagent, below the title row the pane draws itself (a Button, so a finished agent's title
// opens its report): Clawd in his type's hat with his tool (his report once finished, a plaster
// if he failed), effort · type · model with the clock and status, own progress or steps with
// the context, and the band's bar.
export function agentCardSvg(a: AgentRun, W: number, now: number, skin: string = 'auto', style: BarStyle = 'dither'): Drawing {
  const look = lookOf(skin)
  const { hat, accent, color, hatColor } = hatOf(look, a.type)
  const textCls = accent ? `c-${accent}` : 'm'
  const right = W - PAD
  const clawd = spriteSize('tasks')
  // Clawd and his hat drawn half again as large, so the hat reads at a glance.
  const scale = 1.5
  const textX = PAD + (clawd.width + PROP_W) * scale + 8
  const fresh = a.endedAt !== undefined && now - a.endedAt < HOP_MS
  const mode = a.status === 'running' ? 'run' : a.status === 'failed' ? 'dizzy' : fresh ? 'hop' : 'idle'
  const prop = a.status === 'running' ? true : a.status === 'done' ? 'scroll' : false
  const line = progressOf(a)
  const effort = effortLabel(a.effort)
  const effortW = effort ? monoWidth(effort, 10) + 12 : 0
  const meta = `${a.type} · ${modelName(a.model)}`
  const time = clock(elapsed(a, now))
  const H = AGENT_H
  const mark = statusMark(look, a.status, right - 5, 14, color, fresh)
  const markW = 16
  const metaRoom = right - markW - 4 - monoWidth(time, 11.5) - 10 - textX - effortW - (effort ? 6 : 0)
  // A workflow's agent says so on the second line, where a narrow pane leaves it room.
  const progressText =
    (a.workflow ? 'workflow · ' : '') + (line ? (line.done === line.total ? 'Done' : line.title) : `${a.steps} ${a.steps === 1 ? 'step' : 'steps'}`)
  const ctx = `${tokens(a.contextTokens)} ctx`
  const barY = 38
  const barW = right - textX
  const uid = a.id.replace(/\W/g, '_')
  const failedColor = look.bar('tasks', 'alert')
  // A failed run's bar takes the alert colour, so a full bar never reads as success.
  const barColor = a.status === 'failed' ? failedColor : color
  const bar = line
    ? cardBar(look, uid, textX, barY, barW, line.done / line.total, barColor, style, line.total, `${line.done}/${line.total}`)
    : a.status === 'running'
      ? `<defs><clipPath id="sabai-sw-${uid}"><rect x="${textX}" y="${barY}" width="${barW}" height="${CARD_BAR_H}" rx="${CARD_BAR_H / 2}"/></clipPath></defs>` +
        `<rect class="k" x="${textX}" y="${barY}" width="${barW}" height="${CARD_BAR_H}" rx="${CARD_BAR_H / 2}"/>` +
        `<g clip-path="url(#sabai-sw-${uid})"><rect class="sweep" x="${textX}" y="${barY}" width="${barW * 0.3}" height="${CARD_BAR_H}" fill="${color}"/></g>` +
        // One sweep per second, starting in view: the pane redraws each second while an agent
        // runs, restarting it, and a frozen first frame must still show the bar moving.
        `<style>.sweep{animation:sw 1s linear infinite}@keyframes sw{to{transform:translateX(${Math.round(barW * 0.7)}px)}}</style>`
      : cardBar(look, uid, textX, barY, barW, 1, barColor, style)
  const confetti =
    a.status === 'done' && fresh
      ? CONFETTI.map(([cx, cy, kind], i) => `<rect class="cf" style="animation-delay:-${i * 0.25}s" x="${cx}" y="${cy}" width="2" height="2" fill="${look.bar(kind)}"/>`).join('')
      : ''
  const body =
    `<rect class="p" width="${W}" height="${H}" rx="8"/>` +
    `<g transform="translate(${PAD},${(AGENT_H - (clawd.height + HAT_H) * scale) / 2}) scale(${scale})">` +
    sprite('tasks', 0, HAT_H, mode, look.clawd, { kind: hat, color: hatColor, prop }) +
    '</g>' +
    confetti +
    (effort
      ? `<rect x="${textX}" y="8" width="${effortW}" height="14" rx="4" fill="${color}" fill-opacity=".16"/><text class="${textCls}" x="${textX + 6}" y="18" font-family="${MONO}" font-size="10" font-weight="600">${xml(effort)}</text>`
      : '') +
    // On a narrow pane the type and model give way rather than run under the time.
    (metaRoom >= 30 ? `<text class="m" x="${textX + effortW + (effort ? 6 : 0)}" y="18" font-family="${MONO}" font-size="11">${xml(fitMono(meta, 11, metaRoom))}</text>` : '') +
    `<text class="m" x="${right - markW - 4}" y="18" text-anchor="end" font-family="${MONO}" font-size="11.5" font-weight="500">${time}</text>` +
    mark +
    `<text class="m" x="${textX}" y="33" font-family="${MONO}" font-size="11">${xml(fitMono(progressText, 11, Math.max(40, barW - monoWidth(ctx, 11) - 10)))}</text>` +
    `<text class="m" x="${right}" y="33" text-anchor="end" font-family="${MONO}" font-size="11">${ctx}</text>` +
    bar
  // A run that ended a while ago has settled: drawn still, it skips the motion stylesheet (a third
  // of a card), which keeps a pane of finished cards inside the engine's size limit.
  const alt = `${a.description || a.type}: ${a.type}, ${modelName(a.model)}, ${a.status}, ${clock(elapsed(a, now))}`
  return drawing(look, W, H, body, alt, a.status !== 'running' && !fresh)
}

// Three cards: how many agents run and finished, their context together, and the wall time.
export function summarySvg(list: AgentRun[], W: number, now: number, skin: string = 'auto'): Drawing {
  const look = lookOf(skin)
  const s = summary(list, now)
  const cells = [
    ['AGENTS', [s.running > 0 && `${s.running} running`, `${s.done} done`, s.failed > 0 && `${s.failed} failed`].filter(Boolean).join(' · ')],
    ['TOKENS', tokens(s.context)],
    ['TIME', clock(s.ms)],
  ] as const
  // The agents count is the longest value, so its cell takes half the width.
  const unit = (W - GAP * 2) / 4
  const widths = [unit * 2, unit, unit]
  const body = cells
    .map(([label, value], i) => {
      const cw = widths[i]!
      const x = widths.slice(0, i).reduce((n, w) => n + w + GAP, 0)
      return (
        `<rect class="p" x="${x}" y="0" width="${cw}" height="44" rx="8"/>` +
        `<text class="m" x="${x + PAD}" y="16" font-family="${MONO}" font-size="10" font-weight="600" letter-spacing=".08em">${label}</text>` +
        `<text class="t" x="${x + PAD}" y="35" font-family="${SANS}" font-size="12.5" font-weight="600">${xml(fit(value, 12.5, cw - PAD * 2))}</text>`
      )
    })
    .join('')
  // Nothing in it moves: no motion stylesheet, though the pane redraws it every second.
  return drawing(look, W, 44, body, `Agents ${cells[0][1]}; tokens ${cells[1][1]}; time ${cells[2][1]}`, true)
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
const TOOL_H = 22
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
// A semibold proportional face's width, by kind of character: near enough to set the next
// word after it without overlap, and to cut a title short of the right column.
// Combining marks (Thai vowels and tones) take no width; CJK and pictographs a full em.
const charWidth = (c: string) =>
  /\p{M}/u.test(c) ? 0
  : /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Extended_Pictographic}]/u.test(c) ? 1
  : /[il.,:;'|!]/.test(c) ? 0.3 : /[fjrt() -]/.test(c) ? 0.4 : /[mwMW]/.test(c) ? 0.9 : /[A-Z]/.test(c) ? 0.7 : 0.6
const sansWidth = (s: string, size: number) => [...s].reduce((w, c) => w + size * charWidth(c), 0)
// One pass: keep characters while they and an ellipsis fit.
const fitSans = (s: string, size: number, maxW: number) => {
  if (sansWidth(s, size) <= maxW) return s
  const room = maxW - size * 0.6
  let w = 0
  let out = ''
  for (const c of s) {
    w += size * charWidth(c)
    if (w > room) break
    out += c
  }
  return `${out || [...s][0]}…`
}

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
  const title = fitSans(step.title, 12, Math.min(room, room * 0.7 + 60))
  const titleW = sansWidth(title, 12)
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
  const headW = sansWidth(r.headline, 12)
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
