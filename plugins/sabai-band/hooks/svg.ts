import type { AgentRun, BarStyle } from '../types'
import { clock, effortLabel, elapsed, modelName, summary, taskLine, typeStyle } from './agents'
import type { Chip, Meter, Progress } from './model'
import { countdown, level, tokens, value } from './model'
import { icon } from './icons'
import { ICON_COLORS, HAT_H, SPRITE_CSS, sprite, spriteSize } from './sprites'
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
  m: ['#5f5f5c', '#a3a39f'],
  context: ['#13766b', '#3ccbbb'],
  session: ['#5450cf', '#aba8ff'],
  week: ['#8a5700', '#f0b44a'],
  warn: ['#a8490a', '#ff9d57'],
  alert: ['#c0262c', '#ff7377'],
} as const
const css = (i: 0 | 1) => Object.entries(TEXT).map(([k, v]) => `.${k.length > 1 ? `c-${k}` : k}{fill:${v[i]}}`).join('')
// White on this clay reads at 4.5:1; the brand clay itself is kept for the bar.
const PILL = '#b5532f'
const MOTION =
  '.d0,.d1,.d2,.d3{animation:tw 2.2s ease-in-out infinite}.d1{animation-duration:2.8s;animation-delay:-.7s}' +
  '.d2{animation-duration:1.9s;animation-delay:-1.3s}.d3{animation-duration:3.3s;animation-delay:-.4s}' +
  '@keyframes tw{0%,100%{opacity:1}50%{opacity:.3}}' +
  '.live{animation:tw 1.6s ease-in-out infinite}' +
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
export type Look = { css: string; bar: (kind: MeterKind | 'tasks', percent: number) => string; pill: string; clawd: string }

const wink = (body: string) => `@keyframes wink{91%,96%{fill:${body}}}`

const AUTO: Look = {
  css: `${css(0)}.k{fill:#e8e8e5}.p{fill:${CARD[0]}}@media (prefers-color-scheme: dark){${css(1)}.k{fill:#2a2a2a}.p{fill:${CARD[1]}}}${wink(ICON_COLORS.tasks)}`,
  bar: (kind, percent) => fillColor(percent, ICON_COLORS[kind]),
  pill: PILL,
  clawd: ICON_COLORS.tasks,
}

// A theme's own colours; any text colour that would not read on its card is stepped until it does.
export function lookOf(skin: string): Look {
  const t = THEMES[skin]
  if (!t) return AUTO
  const card = cardOf(t)
  const ink = (c: string) => readable(c, card)
  const kinds = Object.entries(t.accents).map(([k, c]) => `.c-${k}{fill:${ink(c)}}`).join('')
  return {
    css: `.t{fill:${ink(t.text)}}.m{fill:${ink(t.subtext)}}.k{fill:${t.track}}.p{fill:${card}}${kinds}.c-warn{fill:${ink(t.warn)}}.c-alert{fill:${ink(t.alert)}}${wink(t.accents.tasks)}`,
    bar: (kind, percent) => {
      const l = level(percent)
      return l === 'alert' ? t.alert : l === 'warn' ? t.warn : t.accents[kind]
    },
    pill: readable(t.accents.tasks, '#ffffff'),
    clawd: t.accents.tasks,
  }
}

const CELL = 3

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
  const fill = style === 'solid' ? `<rect fill="${color}" width="${fillW}" height="${h}"/>` : `<g fill="${color}">${dots.join('')}</g>`
  return (
    `<g transform="translate(${x},${y})"><defs><clipPath id="${id}"><rect width="${w}" height="${h}" rx="${h / 2}"/></clipPath></defs>` +
    `<rect class="k" width="${w}" height="${h}" rx="${h / 2}"/>` +
    `<g clip-path="url(#${id})">${fill}${marks.join('')}</g></g>`
  )
}

const svg = (look: Look, w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><style>${look.css}${MOTION}</style>${body}</svg>`

const ROW_H = 20
const GAP = 8
const PAD = 10
const CARD_H = 44

type Part = { body: string; height: number; alt: string }

// The tasks row: Clawd, the title, the pixel bar with its n/total pill, the percent.
// Clawd walks while the turn is working and waits, blinking, otherwise, in the skin's colour.
function progressPart(look: Look, p: Progress, W: number, isWorking: boolean, top: number, style: BarStyle): Part {
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
    sprite('tasks', 0, (ROW_H - clawd.height) / 2, isWorking ? 'run' : 'idle', look.clawd) +
    `<text class="t" x="${titleX}" y="${ROW_H / 2 + 4.5}" font-family="${SANS}" font-size="13" font-weight="500">${xml(title)}</text>` +
    pixelBar('sabai-band-tasks', barX, y0, barW, barH, ratio, look.bar('tasks', 0), p.total, style) +
    `<rect x="${pillX}" y="${y0}" width="${pillW}" height="${barH}" rx="${barH / 2}" fill="${look.pill}"/>` +
    `<text x="${pillX + pillW / 2}" y="${y0 + barH / 2 + 3.8}" text-anchor="middle" font-family="${MONO}" font-size="10" font-weight="700" fill="#ffffff">${pill}</text>` +
    `<text class="m" x="${W}" y="${ROW_H / 2 + 4}" text-anchor="end" font-family="${MONO}" font-size="11.5" font-weight="600">${percent}</text>`
  return { body: `<g transform="translate(0,${top})">${body}</g>`, height: ROW_H, alt: `${p.title}: ${pill} tasks, ${percent}` }
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
    const color = look.bar(m.kind, m.percent)
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
      pixelBar(`sabai-band-${m.kind}`, x + PAD, bottom - 4.5, cardW - PAD * 2 - 44, 9, m.percent / 100, color, 0, style) +
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
// A monospace line cut to `maxW`, with room to spare for the advance of the system's mono face.
const fitMono = (s: string, size: number, maxW: number) => {
  const room = Math.floor(maxW / (size * 0.64))
  return s.length <= room ? s : `${s.slice(0, Math.max(1, room - 1))}…`
}

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
// surface's between two elements. Rows top to bottom: info chips, tasks, usage cards.
export function bandSvg(
  p: Progress | undefined,
  info: { left: readonly Chip[]; right: readonly Chip[] },
  list: readonly Meter[],
  W: number,
  isWorking = false,
  skin = 'auto',
  style: BarStyle = 'dither',
): Drawing | undefined {
  const look = lookOf(skin)
  const parts: Part[] = []
  let y = 0
  const add = (part: Part) => {
    parts.push(part)
    y += part.height + GAP
  }
  if (info.left.length + info.right.length > 0) add(chipsPart(info, W, y))
  if (p) add(progressPart(look, p, W, isWorking, y, style))
  if (list.length > 0) add(cardsPart(look, list, W, y, style))
  if (parts.length === 0) return undefined
  return drawing(look, W, y - GAP, parts.map(part => part.body).join(''), parts.map(part => part.alt).join('; '))
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
        const paint = j < SAMPLE_FILL[kind] ? `fill="${look.bar(kind, 0)}"` : 'class="k"'
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
export function barPreview(style: BarStyle, skin: string, W: number): Drawing {
  const look = lookOf(skin)
  const w = Math.max(200, W)
  const body = strip(w) + pixelBar(`sabai-band-sample-${style}`, PAD, (SWATCH_H - 12) / 2, w - PAD * 2, 12, 0.62, look.bar('tasks', 0), 5, style)
  return swatch(look, w, body, `${BAR_STYLES[style]} progress bars`)
}

const strip = (w: number) => `<rect class="p" width="${w}" height="${SWATCH_H}" rx="8"/>`

// The pane has no spacing finer than a row, so the gap under a swatch's name row is drawn here.
function swatch(look: Look, w: number, body: string, alt: string): Drawing {
  const h = SWATCH_TOP + SWATCH_H
  return { source: svg(look, w, h, `<g transform="translate(0,${SWATCH_TOP})">${body}</g>`), width: w, height: h, alt }
}

const drawing = (look: Look, W: number, height: number, body: string, alt: string): Drawing => ({ source: svg(look, W, height, body), width: W, height, alt })

const AGENT_H = 64
const HOP_MS = 3000

// One subagent, a drawing of its own so a Result button can sit under it: Clawd in his type's
// hat, the task and clock, effort · type · model, own progress or steps with the context, and a
// bar in the type's colour (an indeterminate sweep while running with no list).
export function agentCardSvg(a: AgentRun, W: number, now: number, skin = 'auto', style: BarStyle = 'dither'): Drawing {
  const look = lookOf(skin)
  const { hat, accent } = typeStyle(a.type)
  const color = accent ? look.bar(accent, 0) : look.bar('session', 0)
  const textCls = accent ? `c-${accent}` : 'm'
  const right = W - PAD
  const clawd = spriteSize('tasks')
  const textX = PAD + clawd.width + 12
  const mode = a.status === 'running' ? 'run' : a.status === 'failed' ? 'dizzy' : a.endedAt !== undefined && now - a.endedAt < HOP_MS ? 'hop' : 'idle'
  const line = taskLine(a.tasks)
  const effort = effortLabel(a.effort)
  const effortW = effort ? monoWidth(effort, 10) + 12 : 0
  const meta = `${a.type} · ${modelName(a.model)}`
  const mark =
    a.status === 'running'
      ? `<circle class="live" cx="${right - 4}" cy="14" r="3.5" fill="${color}"/>`
      : `<text class="${a.status === 'failed' ? 'c-alert' : 'c-context'}" x="${right}" y="18" text-anchor="end" font-family="${MONO}" font-size="12" font-weight="700">${a.status === 'failed' ? '✗' : '✓'}</text>`
  const markW = 16
  const progressText = line ? `${line.done}/${line.total} · ${line.title}` : `${a.steps} ${a.steps === 1 ? 'step' : 'steps'}`
  const ctx = `${tokens(a.contextTokens)} ctx`
  const barY = 52
  const barW = right - textX
  const bar = line
    ? pixelBar(`sabai-band-agent-${a.id}`, textX, barY, barW, 5, line.done / line.total, color, 0, style)
    : a.status === 'running'
      ? `<defs><clipPath id="sabai-band-sw-${a.id}"><rect x="${textX}" y="${barY}" width="${barW}" height="5" rx="2.5"/></clipPath></defs>` +
        `<rect class="k" x="${textX}" y="${barY}" width="${barW}" height="5" rx="2.5"/>` +
        `<g clip-path="url(#sabai-band-sw-${a.id})"><rect class="sweep" x="${textX - barW * 0.3}" y="${barY}" width="${barW * 0.3}" height="5" fill="${color}"/></g>` +
        `<style>.sweep{animation:sw 1.6s linear infinite}@keyframes sw{to{transform:translateX(${Math.round(barW * 1.3)}px)}}</style>`
      : pixelBar(`sabai-band-agent-${a.id}`, textX, barY, barW, 5, 1, color, 0, style)
  const body =
    `<rect class="p" width="${W}" height="${AGENT_H}" rx="8"/>` +
    sprite('tasks', PAD, 14 + HAT_H, mode, look.clawd, { kind: hat, color: accent ? color : undefined }) +
    `<text class="t" x="${textX}" y="18" font-family="${SANS}" font-size="12.5" font-weight="600">${xml(fit(a.description || a.type, 12.5, Math.max(40, right - textX - 60)))}</text>` +
    `<text class="m" x="${right - markW - 4}" y="18" text-anchor="end" font-family="${MONO}" font-size="11.5" font-weight="500">${clock(elapsed(a, now))}</text>` +
    mark +
    (effort
      ? `<rect x="${textX}" y="24" width="${effortW}" height="14" rx="4" fill="${color}" fill-opacity=".16"/><text class="${textCls}" x="${textX + 6}" y="34" font-family="${MONO}" font-size="10" font-weight="600">${effort}</text>`
      : '') +
    `<text class="m" x="${textX + effortW + (effort ? 6 : 0)}" y="34" font-family="${MONO}" font-size="11">${xml(fitMono(meta, 11, Math.max(40, right - textX - effortW - 6)))}</text>` +
    `<text class="m" x="${textX}" y="47" font-family="${MONO}" font-size="11">${xml(fitMono(progressText, 11, Math.max(40, barW - monoWidth(ctx, 11) - 10)))}</text>` +
    `<text class="m" x="${right}" y="47" text-anchor="end" font-family="${MONO}" font-size="11">${ctx}</text>` +
    bar
  return drawing(look, W, AGENT_H, body, `${a.description || a.type}: ${a.type}, ${modelName(a.model)}, ${a.status}, ${clock(elapsed(a, now))}`)
}

// Three cards: how many agents run and finished, their context together, and the wall time.
export function summarySvg(list: AgentRun[], W: number, now: number, skin = 'auto'): Drawing {
  const look = lookOf(skin)
  const s = summary(list, now)
  const cells = [
    ['AGENTS', s.running > 0 ? `${s.running} running · ${s.done} done` : `${s.done} done`],
    ['CONTEXT', tokens(s.context)],
    ['TIME', clock(s.ms)],
  ] as const
  const cw = (W - GAP * 2) / 3
  const body = cells
    .map(([label, value], i) => {
      const x = i * (cw + GAP)
      return (
        `<rect class="p" x="${x}" y="0" width="${cw}" height="44" rx="8"/>` +
        `<text class="m" x="${x + PAD}" y="16" font-family="${MONO}" font-size="10" font-weight="600" letter-spacing=".08em">${label}</text>` +
        `<text class="t" x="${x + PAD}" y="35" font-family="${SANS}" font-size="12.5" font-weight="600">${xml(fit(value, 12.5, cw - PAD * 2))}</text>`
      )
    })
    .join('')
  return drawing(look, W, 44, body, `Agents ${cells[0][1]}; context ${cells[1][1]}; time ${cells[2][1]}`)
}

export function emptyAgentsSvg(W: number, skin = 'auto'): Drawing {
  const look = lookOf(skin)
  const clawd = spriteSize('tasks')
  const body =
    `<rect class="p" width="${W}" height="56" rx="8"/>` +
    sprite('tasks', PAD, 20, 'idle', look.clawd) +
    `<text class="t" x="${PAD + clawd.width + 12}" y="24" font-family="${SANS}" font-size="12.5" font-weight="600">No subagents yet</text>` +
    `<text class="m" x="${PAD + clawd.width + 12}" y="41" font-family="${SANS}" font-size="11.5">${xml(fit('They show here when Claude hands work off — try “explore hooks/ and tests/ in parallel”.', 11.5, W - PAD * 2 - clawd.width - 12))}</text>`
  return drawing(look, W, 56, body, 'No subagents yet. They show here when Claude hands work off.')
}
