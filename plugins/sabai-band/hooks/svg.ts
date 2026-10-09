import type { Chip, Meter, Progress } from './model'
import { countdown, level, value } from './model'
import { icon } from './icons'
import { ICON_COLORS, SPRITE_CSS, sprite, spriteSize } from './sprites'

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
  m: ['#5f5f5c', '#a3a39f'],
  context: ['#13766b', '#3ccbbb'],
  session: ['#5450cf', '#aba8ff'],
  week: ['#8a5700', '#f0b44a'],
  scoped: ['#a82c78', '#f08cc9'],
  warn: ['#a8490a', '#ff9d57'],
  alert: ['#c0262c', '#ff7377'],
} as const
const css = (i: 0 | 1) => Object.entries(TEXT).map(([k, v]) => `.${k.length > 1 ? `c-${k}` : k}{fill:${v[i]}}`).join('')
// White on this clay reads at 4.5:1; the brand clay itself is kept for the bar.
const PILL = '#b5532f'
const THEME =
  `${css(0)}.k{fill:#e8e8e5}.p{fill:${CARD[0]}}` +
  `@media (prefers-color-scheme: dark){${css(1)}.k{fill:#2a2a2a}.p{fill:${CARD[1]}}}` +
  '.d0,.d1,.d2,.d3{animation:tw 2.2s ease-in-out infinite}.d1{animation-duration:2.8s;animation-delay:-.7s}' +
  '.d2{animation-duration:1.9s;animation-delay:-1.3s}.d3{animation-duration:3.3s;animation-delay:-.4s}' +
  '@keyframes tw{0%,100%{opacity:1}50%{opacity:.3}}' +
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

const CELL = 3

// A rounded track with a dithered fill: sparse at the start, dense toward the head.
// `id` must be unique in the page, since the desktop inlines every drawing.
function ditherBar(id: string, x: number, y: number, w: number, h: number, ratio: number, color: string, ticks = 0): string {
  const fillW = Math.round(w * Math.max(0, Math.min(1, ratio)))
  const cols = Math.floor(fillW / CELL)
  const dots: string[] = []
  for (let c = 0; c < cols; c++) {
    const density = 0.55 + 0.45 * Math.pow(c / Math.max(1, cols), 1.2)
    for (let r = 0; r < Math.floor(h / CELL); r++) {
      if (noise(c, r) < density) {
        dots.push(`<rect class="d${Math.floor(noise(r, c) * 4)}" x="${c * CELL + 1}" y="${r * CELL + 1}" width="2" height="2"/>`)
      }
    }
  }
  const marks: string[] = []
  for (let i = 1; i < ticks; i++) {
    const tx = Math.round((w * i) / ticks)
    if (tx > fillW + 4) marks.push(`<rect class="m" x="${tx}" y="${h / 2 - 3}" width="1.5" height="6" rx="0.75"/>`)
  }
  return (
    `<g transform="translate(${x},${y})"><defs><clipPath id="${id}"><rect width="${w}" height="${h}" rx="${h / 2}"/></clipPath></defs>` +
    `<rect class="k" width="${w}" height="${h}" rx="${h / 2}"/>` +
    `<g clip-path="url(#${id})"><g fill="${color}">${dots.join('')}</g>${marks.join('')}</g></g>`
  )
}

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><style>${THEME}</style>${body}</svg>`

const ROW_H = 20
const GAP = 8
const PAD = 10
const CARD_H = 44

type Part = { body: string; height: number; alt: string }

// The tasks row: Clawd, the title, the pixel bar with its n/total pill, the percent.
// Clawd walks while a task runs or the turn is working, and waits, blinking, otherwise.
function progressPart(p: Progress, W: number, isWorking: boolean, top: number): Part {
  const ratio = p.done / p.total
  const percent = `${Math.round(ratio * 100)}%`
  const clawd = spriteSize('tasks')
  const titleX = clawd.width + 10
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
    sprite('tasks', 0, (ROW_H - clawd.height) / 2, p.isRunning || isWorking ? 'run' : 'idle') +
    `<text class="t" x="${titleX}" y="${ROW_H / 2 + 4.5}" font-family="${SANS}" font-size="13" font-weight="500">${xml(title)}</text>` +
    ditherBar('sabai-band-tasks', barX, y0, barW, barH, ratio, ICON_COLORS.tasks, p.total) +
    `<rect x="${pillX}" y="${y0}" width="${pillW}" height="${barH}" rx="${barH / 2}" fill="${PILL}"/>` +
    `<text x="${pillX + pillW / 2}" y="${y0 + barH / 2 + 3.8}" text-anchor="middle" font-family="${MONO}" font-size="10" font-weight="700" fill="#ffffff">${pill}</text>` +
    `<text class="m" x="${W}" y="${ROW_H / 2 + 4}" text-anchor="end" font-family="${MONO}" font-size="11.5" font-weight="600">${percent}</text>`
  return { body: `<g transform="translate(0,${top})">${body}</g>`, height: ROW_H, alt: `${p.title}: ${pill} tasks, ${percent}` }
}

// Usage as cards of two lines: icon, label and detail (tokens or reset countdown) on the
// first, the pixel bar and its percent on the second. Four across, two or one when narrow.
function cardsPart(list: readonly Meter[], W: number, y0: number): Part {
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
    const color = fillColor(m.percent, ICON_COLORS[m.kind])
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
      ditherBar(`sabai-band-${m.kind}`, x + PAD, bottom - 4.5, cardW - PAD * 2 - 44, 9, m.percent / 100, color) +
      `<text class="${textClass(m.percent, m.kind)}" x="${right}" y="${bottom + 4}" text-anchor="end" font-family="${MONO}" font-size="11.5" font-weight="700">${m.percent}%</text>`
    )
  })
  const alt = list
    .map(m => `${m.label} ${value(m)}${m.resetsInMs === undefined ? '' : `, resets in ${countdown(m.resetsInMs)}`}`)
    .join('; ')
  return { body: cards.join(''), height: rows * CARD_H + (rows - 1) * GAP, alt }
}

const CHIP_H = 20
const CHIP_PAD = 8
const ICON = 13
const monoWidth = (s: string, size: number) => s.length * size * 0.6

// The info row: one chip per fact, its mark then its value. The left group runs from the
// left edge, the right group ends at the right edge; left chips that would meet it are left out.
function chipsPart(info: { left: readonly Chip[]; right: readonly Chip[] }, W: number, y: number): Part {
  const width = (c: Chip) => Math.ceil(CHIP_PAD * 2 + ICON + 6 + monoWidth(c.value, 11.5))
  const chip = (c: Chip, x: number) =>
    `<rect class="p" x="${x}" y="${y}" width="${width(c)}" height="${CHIP_H}" rx="6"/>` +
    icon(c.icon, x + CHIP_PAD, y + (CHIP_H - ICON) / 2, ICON) +
    `<text class="t" x="${x + CHIP_PAD + ICON + 6}" y="${y + CHIP_H / 2 + 4}" font-family="${MONO}" font-size="11.5" font-weight="600">${xml(c.value)}</text>`
  let right = W
  const rightBody = [...info.right].reverse().map(c => chip(c, (right -= width(c) + GAP) + GAP)).join('')
  let x = 0
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
  const alt = [...drawn, ...info.right].map(c => `${c.label} ${c.value}`).join(', ')
  return { body: leftBody + rightBody, height: CHIP_H, alt }
}

// The whole band as one drawing, so its own spacing (8px) holds rather than a row of the
// surface's between two elements.
// Rows top to bottom: info chips, tasks, usage cards.
export function bandSvg(
  p: Progress | undefined,
  info: { left: readonly Chip[]; right: readonly Chip[] },
  list: readonly Meter[],
  W: number,
  isWorking = false,
): Drawing | undefined {
  const parts: Part[] = []
  let y = 0
  const add = (part: Part) => {
    parts.push(part)
    y += part.height + GAP
  }
  if (info.left.length + info.right.length > 0) add(chipsPart(info, W, y))
  if (p) add(progressPart(p, W, isWorking, y))
  if (list.length > 0) add(cardsPart(list, W, y))
  if (parts.length === 0) return undefined
  const height = y - GAP
  return { source: svg(W, height, parts.map(part => part.body).join('')), width: W, height, alt: parts.map(part => part.alt).join('; ') }
}
