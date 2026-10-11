import type { AgentRun, BarStyle } from '../types'
import { clock, effortLabel, elapsed, modelName, progressOf, summary, typeStyle } from './agents'
import type { Chip, Meter, Mood, Progress } from './model'
import { countdown, level, tokens, value } from './model'
import type { CalloutKind, Receipt, Step, StepIcon, Tone } from './chat'
import { stepText } from './chat'
import { icon } from './icons'
import { STROKES } from './strokes'
import type { StrokeKind } from './strokes'
import { ICON_COLORS, HAT_H, PROP_W, SPRITE_CSS, sprite, spriteSize } from './sprites'
import type { MeterKind } from './model'
import { THEMES, cardOf, readable } from './themes'

// Desktop drawings in savvy-progress's pixel style (MIT). The desktop wraps sibling elements
// onto new lines, so each group is one SVG; Buttons sit beside it. Light and dark follow the OS.

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
const css = (i: 0 | 1) => Object.entries(TEXT).map(([k, v]) => `.${k.length > 1 ? `c-${k}` : k}{fill:${v[i]}}`).join('')
// White on this clay reads at 4.5:1; the brand clay itself is kept for the bar.
const PILL = '#b5532f'
const MOTION =
  '.d0,.d1,.d2,.d3{animation:tw 2.2s ease-in-out infinite}.d1{animation-duration:2.8s;animation-delay:-.7s}' +
  '.d2{animation-duration:1.9s;animation-delay:-1.3s}.d3{animation-duration:3.3s;animation-delay:-.4s}' +
  '@keyframes tw{0%,100%{opacity:1}50%{opacity:.3}}' +
  '.live{animation:tw 1.6s ease-in-out infinite}' +
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

// Rough advance of system UI text in em: enough to size a slot, not to typeset.
const charEm = (ch: string): number => (/[\s.,:;'|!il1()[\]]/.test(ch) ? 0.3 : /[A-Z@%mw]/.test(ch) ? 0.72 : 0.56)
const textWidth = (s: string, size: number): number => [...s].reduce((w, ch) => w + charEm(ch) * size, 0)

function fit(s: string, size: number, maxW: number): string {
  if (textWidth(s, size) <= maxW) return s
  let out = ''
  for (const ch of s) {
    if (textWidth(out + ch + '…', size) > maxW) break
    out += ch
  }
  return out + '…'
}

// Deterministic noise, so the dither does not shimmer between redraws.
const noise = (x: number, y: number): number => {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return s - Math.floor(s)
}

// The text class for a meter's figures: its own colour, or the warning one past 70 and 90.
export function textClass(percent: number, kind: string): string {
  return `c-${level(percent) ?? kind}`
}

export function fillColor(percent: number, base: string): string {
  const l = level(percent)
  return l === 'alert' ? ALERT : l === 'warn' ? WARN : base
}

// How a skin paints the band: its stylesheet, a bar's colour, the pill behind white figures,
// and Clawd's tint. No skin paints a background: the band sits on the surface's own, as `auto` does.
export type Look = { css: string; bar: (kind: MeterKind | 'tasks', lvl?: 'warn' | 'alert') => string; pill: string; clawd: string }

const wink = (body: string) => `@keyframes wink{91%,96%{fill:${body}}}`

const AUTO: Look = {
  css: `${css(0)}.k{fill:#e8e8e5}.p{fill:${CARD[0]}}@media (prefers-color-scheme: dark){${css(1)}.k{fill:#2a2a2a}.p{fill:${CARD[1]}}}${wink(ICON_COLORS.tasks)}`,
  bar: (kind, lvl) => (lvl === 'alert' ? ALERT : lvl === 'warn' ? WARN : ICON_COLORS[kind]),
  pill: PILL,
  clawd: ICON_COLORS.tasks,
}

// A skin, or a pair of skins that follows the OS between light and dark.
export type SkinChoice = string | { light: string; dark: string }

const ROLES = ['tasks', 'context', 'session', 'week', 'warn', 'alert', 'pill', 'clawd'] as const
// A skin's colours as custom properties on the drawing, for a pair that switches with the OS.
function vars(look: Look): string {
  const value = (role: (typeof ROLES)[number]) =>
    role === 'pill' ? look.pill : role === 'clawd' ? look.clawd : role === 'warn' ? look.bar('tasks', 'warn') : role === 'alert' ? look.bar('tasks', 'alert') : look.bar(role)
  return `svg{${ROLES.map(r => `--${r}:${value(r)}`).join(';')}}`
}

// How a skin choice paints: a single skin's own colours, or a pair whose colours are custom
// properties set by the light skin and again, under the OS's dark mode, by the dark one.
export function lookOf(choice: SkinChoice): Look {
  if (typeof choice === 'string') return single(choice)
  const light = single(choice.light)
  const dark = single(choice.dark)
  return {
    css: `${vars(light)}${light.css}@media (prefers-color-scheme: dark){${vars(dark)}${dark.css}}${wink('var(--clawd)')}`,
    bar: (kind, lvl) => `var(--${lvl ?? kind})`,
    pill: 'var(--pill)',
    clawd: 'var(--clawd)',
  }
}

// A theme's own colours; any text colour that would not read on its card is stepped until it does.
function single(skin: string): Look {
  const t = THEMES[skin]
  if (!t) return AUTO
  const card = cardOf(t)
  const ink = (c: string) => readable(c, card)
  const kinds = Object.entries(t.accents).map(([k, c]) => `.c-${k}{fill:${ink(c)}}`).join('')
  return {
    css: `.t{fill:${ink(t.text)}}.m{fill:${ink(t.subtext)}}.k{fill:${readable(t.track, card, 1.35)}}.p{fill:${card}}${kinds}.c-warn{fill:${ink(t.warn)}}.c-alert{fill:${ink(t.alert)}}${wink(t.accents.tasks)}`,
    bar: (kind, lvl) => (lvl === 'alert' ? t.alert : lvl === 'warn' ? t.warn : t.accents[kind]),
    pill: readable(t.accents.tasks, '#ffffff'),
    clawd: t.accents.tasks,
  }
}

const CELL = 3
const DOT_COLS = 200
const MAX_TICKS = 12

export const BAR_STYLES: Record<BarStyle, string> = { dither: 'Dither', blocks: 'Pixel blocks', solid: 'Solid' }

// A rounded track and its fill, drawn in `style`: dither (sparse at the start, dense toward the
// head), square segments as tall as the bar, or one solid run. `id` must be unique in the page.
function pixelBar(id: string, x: number, y: number, w: number, h: number, ratio: number, color: string, ticks = 0, style: BarStyle = 'dither'): string {
  const fillW = Math.round(w * Math.max(0, Math.min(1, ratio)))
  if (style === 'blocks') {
    const count = Math.max(1, Math.floor((w + 2) / (h + 2)))
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
  const dots: string[] = []
  for (let c = 0; c < cols; c++) {
    const density = 0.55 + 0.45 * Math.pow(c / Math.max(1, cols), 1.2)
    for (let r = 0; r < Math.floor(h / CELL); r++) {
      if (noise(c, r) < density) {
        dots.push(`<rect class="d${Math.floor(noise(r, c) * 4)}" x="${+(c * cellX + 1).toFixed(1)}" y="${r * CELL + 1}" width="${+(cellX - 1).toFixed(1)}" height="2"/>`)
      }
    }
  }
  const marks: string[] = []
  const steps = Math.min(ticks, MAX_TICKS)
  for (let i = 1; i < steps; i++) {
    const tx = Math.round((w * i) / steps)
    if (tx > fillW + 4) marks.push(`<rect class="m" x="${tx}" y="${h / 2 - 3}" width="1.5" height="6" rx="0.75"/>`)
  }
  const fill = style === 'solid' ? `<rect fill="${color}" width="${fillW}" height="${h}"/>` : `<g fill="${color}">${dots.join('')}</g>`
  return (
    `<g transform="translate(${x},${y})"><defs><clipPath id="${id}"><rect width="${w}" height="${h}" rx="${h / 2}"/></clipPath></defs>` +
    `<rect class="k" width="${w}" height="${h}" rx="${h / 2}"/>` +
    `<g clip-path="url(#${id})">${fill}${marks.join('')}</g></g>`
  )
}

// Text drawn straight on the surface, with no card behind it, takes the OS's light or dark ink
// whatever the skin: a skin's ink is only checked against its own card.
const SURFACE_INK = `.st{fill:${TEXT.t[0]}}.sm{fill:${TEXT.m[0]}}@media (prefers-color-scheme: dark){.st{fill:${TEXT.t[1]}}.sm{fill:${TEXT.m[1]}}}`

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
  const tail = room(`${m.percent}%${countdownText}`) >= 40 ? `${m.percent}%${countdownText}` : `${m.percent}%`
  const barX = labelX + monoWidth(label, 10) + 8
  const barW = Math.max(30, room(tail))
  return (
    `<rect class="p" x="${x}" y="${y}" width="${w}" height="${CARD_H_COMPACT}" rx="6"/>` +
    (m.kind === 'context' ? sprite('context', x + PAD + 1, y + CARD_H_COMPACT / 2 - spriteSize('context').height / 2) : '') +
    `<text class="m" x="${labelX}" y="${y + 15}" font-family="${MONO}" font-size="10" font-weight="600" letter-spacing=".08em">${label}</text>` +
    pixelBar(`sabai-${m.kind}`, barX, y + 7, barW, 8, m.percent / 100, look.bar(m.kind, m.level), 0, style) +
    `<text class="c-${m.level ?? m.kind}" x="${x + w - PAD}" y="${y + 15}" text-anchor="end" font-family="${MONO}" font-size="11" font-weight="700">${xml(tail)}</text>`
  )
}

type Part = { body: string; height: number; alt: string }


// Each mood's sprite mode, and the words a reader is told for it (idle and working say nothing).
const MOOD_MODE: Record<Mood, string> = { startled: 'startle', sad: 'dizzy', celebrating: 'hop', sweating: 'sweat', working: 'run', sleeping: 'sleep', idle: 'idle' }
const moodSaid = (mood: Mood) => (mood === 'idle' || mood === 'working' ? '' : `; Clawd is ${mood}`)

// Confetti beside Clawd's head in the band, clear of his face and of the next chip or title.
const BAND_CONFETTI = [
  [25, 1, 'context'],
  [29, 5, 'session'],
  [26, 9, 'week'],
  [30, 12, 'tasks'],
] as const

// Clawd in his mood, in the skin's colour, with confetti while he celebrates.
function clawdAt(look: Look, x: number, y: number, mood: Mood): string {
  const confetti =
    mood === 'celebrating'
      ? BAND_CONFETTI.map(([cx, cy, kind], i) => `<rect class="cf" style="animation-delay:-${i * 0.25}s" x="${x + cx}" y="${y + cy}" width="2" height="2" fill="${look.bar(kind)}"/>`).join('')
      : ''
  return sprite('tasks', x, y, MOOD_MODE[mood], look.clawd) + confetti
}

// The tasks row: Clawd, the title, the pixel bar with its n/total pill, the percent.
// Clawd shows the session's mood: walking while the turn works, blinking while it waits.
function progressPart(look: Look, p: Progress, W: number, mood: Mood, top: number, style: BarStyle, withClawd = true): Part {
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
    (withClawd ? clawdAt(look, 0, (ROW_H - clawd.height) / 2, mood) : '') +
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
      `<text class="c-${m.level ?? m.kind}" x="${right}" y="${bottom + 4}" text-anchor="end" font-family="${MONO}" font-size="11.5" font-weight="700">${m.percent}%</text>`
    )
  })
  const alt = list
    .map(m => `${m.label} ${value(m)}${m.resetsInMs === undefined ? '' : `, resets in ${countdown(m.resetsInMs)}`}`)
    .join('; ')
  return { body: cards.join(''), height: rows * cardH + (rows - 1) * gap, alt }
}

const CHIP_H = 20
const CHIP_PAD = 8
const ICON = 13
const monoWidth = (s: string, size: number) => s.length * size * 0.6
// A monospace line cut to `maxW`, with room to spare for the advance of the system's mono face.
// Cut on whole characters, never inside a surrogate pair, which would leave the SVG malformed.
const fitMono = (s: string, size: number, maxW: number) => {
  const room = Math.floor(maxW / (size * 0.64))
  const chars = [...s]
  return chars.length <= room ? s : `${chars.slice(0, Math.max(1, room - 1)).join('')}…`
}

// The info row: one chip per fact, its mark then its value. The left group runs from the
// left edge (after Clawd, when the band has no tasks row to hold him), the right group ends at
// the right edge; left chips that would meet it are left out.
function chipsPart(info: { left: readonly Chip[]; right: readonly Chip[] }, W: number, y: number, clawd?: { look: Look; mood: Mood }): Part {
  const width = (c: Chip) => Math.ceil(CHIP_PAD * 2 + ICON + 6 + monoWidth(c.value, 11.5))
  const chip = (c: Chip, x: number) =>
    `<rect class="p" x="${x}" y="${y}" width="${width(c)}" height="${CHIP_H}" rx="6"/>` +
    icon(c.icon, x + CHIP_PAD, y + (CHIP_H - ICON) / 2, ICON) +
    `<text class="t" x="${x + CHIP_PAD + ICON + 6}" y="${y + CHIP_H / 2 + 4}" font-family="${MONO}" font-size="11.5" font-weight="600">${xml(c.value)}</text>`
  let right = W
  const rightBody = [...info.right].reverse().map(c => chip(c, (right -= width(c) + GAP) + GAP)).join('')
  const lead = clawd ? clawdAt(clawd.look, 0, y + (CHIP_H - spriteSize('tasks').height) / 2, clawd.mood) : ''
  let x = clawd ? spriteSize('tasks').width + GAP : 0
  const drawn: Chip[] = []
  const leftBody = info.left
    .map(c => {
      if (x + width(c) > right - GAP) return ''
      drawn.push(c)
      const at = x
      x += width(c) + GAP
      return chip(c, at)
    })
    .join('')
  const alt = [...drawn, ...info.right].map(c => `${c.label} ${c.value}`).join(', ') + (clawd ? moodSaid(clawd.mood) : '')
  return { body: lead + leftBody + rightBody, height: CHIP_H, alt: alt.replace(/^; /, '') }
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

// How the band is drawn, past its rows' content.
export type BandOpts = {
  mood?: Mood
  skin?: SkinChoice
  style?: BarStyle
  crew?: { runs: readonly AgentRun[]; now: number }
  density?: 'comfortable' | 'compact'
  clawd?: boolean
}

// The whole band as one drawing, so its own spacing (8px) holds rather than a row of the
// surface's between two elements. Rows top to bottom: info chips, tasks, usage cards.
export function bandSvg(
  p: Progress | undefined,
  info: { left: readonly Chip[]; right: readonly Chip[]; show?: boolean },
  list: readonly Meter[],
  W: number,
  opts: BandOpts = {},
): Drawing | undefined {
  const { mood = 'idle', skin = 'auto', style = 'dither', crew, clawd = true } = opts
  const compact = opts.density === 'compact'
  const gap = compact ? 4 : GAP
  const look = lookOf(skin)
  const parts: Part[] = []
  let y = 0
  const add = (part: Part) => {
    parts.push(part)
    y += part.height + gap
  }
  // Clawd stands in the info row when there is no tasks row to hold him.
  const clawdInInfo = !p && Boolean(info.show) && clawd
  if (info.left.length + info.right.length > 0 || clawdInInfo) add(chipsPart(info, W, y, clawdInInfo ? { look, mood } : undefined))
  if (p) add(progressPart(look, p, W, mood, y, style, clawd))
  if (crew?.runs.length) add(crewPart(look, crew.runs, crew.now, W, y))
  if (list.length > 0) add(cardsPart(look, list, W, y, style, compact))
  if (parts.length === 0) return undefined
  return drawing(look, W, y - gap, parts.map(part => part.body).join(''), parts.map(part => part.alt).join('; '))
}

// The skin picker's swatch: a strip of the skin's card colour with its text colours (`Aa`) and
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
  return swatch(look, w, body, `${THEMES[skin]?.name ?? 'Auto'} skin colours`)
}

// The picker's sample of a bar style: one bar, part filled, in the skin's task colour.
export function barPreview(style: BarStyle, skin: SkinChoice, W: number): Drawing {
  const look = lookOf(skin)
  const w = Math.max(200, W)
  const body = strip(w) + pixelBar(`sabai-sample-${style}`, PAD, (SWATCH_H - 12) / 2, w - PAD * 2, 12, 0.62, look.bar('tasks'), 5, style)
  return swatch(look, w, body, `${BAR_STYLES[style]} progress bars`)
}

const strip = (w: number) => `<rect class="p" width="${w}" height="${SWATCH_H}" rx="8"/>`

// The pane has no spacing finer than a row, so the gap under a swatch's name row is drawn here.
function swatch(look: Look, w: number, body: string, alt: string): Drawing {
  const h = SWATCH_TOP + SWATCH_H
  return { source: svg(look, w, h, `<g transform="translate(0,${SWATCH_TOP})">${body}</g>`), width: w, height: h, alt }
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
export function agentCardSvg(a: AgentRun, W: number, now: number, skin: SkinChoice = 'auto', style: BarStyle = 'dither'): Drawing {
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
    `<text class="m" x="${textX + effortW + (effort ? 6 : 0)}" y="18" font-family="${MONO}" font-size="11">${xml(fitMono(meta, 11, Math.max(40, right - markW - 4 - monoWidth(time, 11.5) - 10 - textX - effortW - (effort ? 6 : 0))))}</text>` +
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
export function summarySvg(list: AgentRun[], W: number, now: number, skin: SkinChoice = 'auto'): Drawing {
  const look = lookOf(skin)
  const s = summary(list, now)
  const cells = [
    ['AGENTS', s.running > 0 ? `${s.running} running · ${s.done} done` : `${s.done} done`],
    ['CONTEXT', tokens(s.context)],
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
  return drawing(look, W, 44, body, `Agents ${cells[0][1]}; context ${cells[1][1]}; time ${cells[2][1]}`)
}

export function emptyAgentsSvg(W: number, skin: SkinChoice = 'auto'): Drawing {
  const look = lookOf(skin)
  const clawd = spriteSize('tasks')
  const body =
    `<rect class="p" width="${W}" height="56" rx="8"/>` +
    sprite('tasks', PAD, 20, 'idle', look.clawd) +
    `<text class="t" x="${PAD + clawd.width + 12}" y="24" font-family="${SANS}" font-size="12.5" font-weight="600">No subagents yet</text>` +
    `<text class="m" x="${PAD + clawd.width + 12}" y="41" font-family="${SANS}" font-size="11.5">${xml(fit('They show here when Claude hands work off — try “explore hooks/ and tests/ in parallel”.', 11.5, W - PAD * 2 - clawd.width - 12))}</text>`
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
  // Always kept, so pills line up from row to row whether or not a step has a time.
  const timeW = 44
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

// Each callout kind: its stroke icon, the theme key its box and terminal title take, a terminal
// glyph, and its SVG ink as [light, dark].
export const CALLOUT_KINDS = {
  note: { title: 'Note', icon: 'info', key: 'suggestion', glyph: 'ℹ', ink: ['#0969da', '#4493f8'] },
  tip: { title: 'Tip', icon: 'lightbulb', key: 'success', glyph: '✱', ink: CHAT_INK.ok },
  important: { title: 'Important', icon: 'badge-alert', key: 'claude', glyph: '✦', ink: ['#a8461f', '#e8916b'] },
  warning: { title: 'Warning', icon: 'triangle-alert', key: 'warning', glyph: '▲', ink: CHAT_INK.warn },
  caution: { title: 'Caution', icon: 'octagon-x', key: 'error', glyph: '✖', ink: CHAT_INK.bad },
} as const satisfies Record<CalloutKind, { title: string; icon: StrokeKind; key: string; glyph: string; ink: readonly [string, string] }>

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
