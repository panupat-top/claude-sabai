import type { MeterKind } from './model'

// Pixel sprites, one character per pixel ('.' is empty). Each colour key may carry a class
// that the band's stylesheet animates. Drawn at `px` (default PX) css pixels per sprite pixel.

export const PX = 2

type Sprite = { rows: string[]; colors: Record<string, string>; classes?: Record<string, string>; px?: number }

export const ICON_COLORS: Record<MeterKind | 'tasks', string> = {
  tasks: '#D97757',
  context: '#2bb5a6',
  session: '#8f8cf4',
  week: '#e0a030',
}

const c = ICON_COLORS
// Only Clawd and the context have a sprite; the limit cards carry their label alone.
export type SpriteKind = 'tasks' | 'context'

const SPRITES: Record<SpriteKind, Sprite> = {
  // Pixel Clawd, the shape savvy-progress draws (after DockCrab's Clawdy): walks while work
  // runs, stands and blinks while it waits.
  tasks: {
    rows: [
      '....oooooooooooooooo....',
      '....oooooooooooooooo....',
      '....ookkooooooookkoo....',
      '....ookkooooooookkoo....',
      'oooooooooooooooooooooooo',
      'oooooooooooooooooooooooo',
      'oooooooooooooooooooooooo',
      'oooooooooooooooooooooooo',
      '....oooooooooooooooo....',
      '....oooooooooooooooo....',
      '....oooooooooooooooo....',
      '....oooooooooooooooo....',
      '....ll..nn....ll..nn....',
      '....ll..nn....ll..nn....',
      '....ll..nn....ll..nn....',
      '....ll..nn....ll..nn....',
    ],
    colors: { o: c.tasks, k: '#1F1E1D', l: c.tasks, n: c.tasks },
    classes: { o: 'bd', k: 'eye', l: 'la', n: 'lb' },
    px: 1,
  },
  // A memory chip whose two LEDs blink out of step.
  context: {
    rows: ['.l.l.l.l.', 'lgggggggl', '.gdddddg.', 'lgdLdMdgl', '.gdddddg.', 'lgggggggl', '.l.l.l.l.'],
    colors: { l: '#9a9a9a', g: c.context, d: '#2c2c2c', L: '#5fe0a0', M: '#5fe0a0' },
    classes: { L: 'led1', M: 'led2' },
  },
}

export const spriteSize = (kind: SpriteKind) => {
  const { rows, px = PX } = SPRITES[kind]
  return { width: (rows[0]?.length ?? 0) * px, height: rows.length * px }
}

export type HatKind = 'explorer' | 'hardhat' | 'cap' | 'grad' | 'beret' | 'bandana' | 'headset' | 'tophat' | 'beanie'
export const HAT_H = 4

// Hats for the agents pane, 24 wide like Clawd and HAT_H rows tall, drawn just above him.
const HATS: Record<HatKind, string[]> = {
  explorer: ['........................', '......hhhhhhhhhhhh......', '......hhhhhhhhhhhh......', '..hhhhhhhhhhhhhhhhhhhh..'],
  hardhat: ['........................', '.......hhhhhhhhhh.......', '......hhhhhhhhhhhh......', '....hhhhhhhhhhhhhhhh....'],
  cap: ['........................', '......hhhhhhhhhh........', '......hhhhhhhhhh........', '......hhhhhhhhhhhhhhhh..'],
  grad: ['..hhhhhhhhhhhhhhhhhhhh..', '.......hhhhhhhhhh..h....', '.......hhhhhhhhhh..h....', '........................'],
  beret: ['...........h............', '.......hhhhhhhh.........', '.....hhhhhhhhhhhh.......', '......hhhhhhhhhhh.......'],
  bandana: ['........................', '........................', '.....hhhhhhhhhhhhhh.hh..', '....hhhhhhhhhhhhhhhh.h..'],
  headset: ['........hhhhhhhh........', '.......h........h.......', '......h..........h......', '.....hh..........hh.....'],
  tophat: ['.......hhhhhhhhhh.......', '.......hhhhhhhhhh.......', '.......hhhhhhhhhh.......', '....hhhhhhhhhhhhhhhh....'],
  beanie: ['...........hh...........', '.........hhhhhh.........', '.......hhhhhhhhhh.......', '......hhhhhhhhhhhh......'],
}

// What each type holds to Clawd's right, PROP_W wide, from his arm row down: a magnifier, a
// pencil, a wrench, a book, a steaming cup. A key's class is the motion `.run` gives it.
export const PROP_W = 7
const PROPS: Record<HatKind, { rows: string[]; colors: Record<string, string>; classes: Record<string, string> }> = {
  explorer: {
    rows: ['.ggg...', 'g...g..', 'g...g..', 'g...g..', '.ggg...', '....h..', '.....h.', '......h'],
    colors: { g: '#8e929a', h: '#a0703f' },
    classes: { g: 'pr-scan', h: 'pr-scan' },
  },
  hardhat: {
    rows: ['.....yy', '....yy.', '...yy..', '..yy...', '.yy....', 'k......'],
    colors: { y: '#f5c542', k: '#3a3a3c' },
    classes: { y: 'pr-scrib', k: 'pr-scrib' },
  },
  cap: {
    rows: ['s.s....', 'sss....', '.s.....', '.s.....', '.s.....', '.s.....'],
    colors: { s: '#8e929a' },
    classes: { s: 'pr-twist' },
  },
  grad: {
    rows: ['bbbbbb.', 'bwwwwb.', 'bwbbwb.', 'bwwwwb.', 'bwbbwb.', 'bbbbbb.'],
    colors: { b: '#7a4a26', w: '#f8f6f1' },
    classes: { b: 'pr-flip', w: 'pr-flip' },
  },
  beret: {
    rows: ['....pp.', '...pp..', '..ww...', '.ww....', 'ww.....', 'w......'],
    colors: { p: '#e5484d', w: '#a0703f' },
    classes: { p: 'pr-scrib', w: 'pr-scrib' },
  },
  bandana: {
    rows: ['s.s.s..', 's.s.s..', 'sssss..', '.sss...', '..s....', '..s....', '..s....'],
    colors: { s: '#c9ccd2' },
    classes: { s: 'pr-twist' },
  },
  headset: {
    rows: ['.ccc...', 'bbbbb..', 'bwwwb..', 'bwkwb..', 'bwwwb..', 'bwkwb..', 'bbbbb..'],
    colors: { c: '#8e929a', b: '#a0703f', w: '#f8f6f1', k: '#9aa0c0' },
    classes: { c: 'pr-scan', b: 'pr-scan', w: 'pr-scan', k: 'pr-scan' },
  },
  tophat: {
    rows: ['...y...', '..yyy..', '...y...', '..k....', '.k.....', 'k......'],
    colors: { y: '#f5c542', k: '#3a3a3c' },
    classes: { y: 'pr-steam', k: 'pr-twist' },
  },
  beanie: {
    rows: ['.v.v...', 'v.v....', 'cccc...', 'ccccmm.', 'cccc.m.', 'cccc...', '.cc....'],
    colors: { v: '#9aa0c0', c: '#c9a66b', m: '#c9a66b' },
    classes: { v: 'pr-steam', c: 'pr-cup', m: 'pr-cup' },
  },
}

// A finished agent holds up its report instead of its tool, waving it.
const SCROLL = {
  rows: ['dddddd.', 'pppppp.', 'pkkkkp.', 'pppppp.', 'pkkkkp.', 'pppppp.', 'dddddd.'],
  colors: { d: '#d6c7a1', p: '#f8f6f1', k: '#9aa0c0' } as Record<string, string>,
  classes: { d: 'pr-wave', p: 'pr-wave', k: 'pr-wave' } as Record<string, string>,
}
// A failed one wears a sticking plaster across the cheek.
const BANDAGE = ['.ww...', 'wwwwww', '.ww...']

// Rows of colour keys as rects, a run of one key in a row merged into one rect, grouped by class
// so one animation moves a part together. `paint` gives a key's fill, or a class when it has none.
function draw(rows: string[], px: number, y0: number, paint: (ch: string) => { fill?: string; cls?: string; group?: string } | undefined, x0 = 0) {
  const groups = new Map<string, string[]>()
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; ) {
      const ch = row[c]!
      let end = c + 1
      while (end < row.length && row[end] === ch) end++
      const p = paint(ch)
      if (p) {
        const look = p.fill ? `fill="${p.fill}"` : `class="${p.cls}"`
        const rect = `<rect x="${(x0 + c) * px}" y="${(y0 + r) * px}" width="${(end - c) * px}" height="${px}" ${look}/>`
        groups.set(p.group ?? '', [...(groups.get(p.group ?? '') ?? []), rect])
      }
      c = end
    }
  })
  return [...groups].map(([g, rects]) => (g ? `<g class="${g}">${rects.join('')}</g>` : rects.join(''))).join('')
}

// `mode`: `run` walks, `idle` blinks, `hop` jumps twice (a finished agent), `dizzy` shuts the
// eyes (a failed one); for the band's moods, `startle` jolts under a `!`, `sweat` drips a drop
// and `sleep` shuts the eyes under a rising `z`. `tint` repaints Clawd's body; `hat` sits on top and moves with the body,
// and with `prop` its type's tool is held to his right.
export function sprite(kind: SpriteKind, x: number, y: number, mode = '', tint?: string, hat?: { kind: HatKind; color?: string; prop?: boolean | 'scroll' }): string {
  const { rows, classes = {}, px = PX } = SPRITES[kind]
  const colors = tint && kind === 'tasks' ? { ...SPRITES[kind].colors, o: tint, l: tint, n: tint } : SPRITES[kind].colors
  // Shut eyes: the lower of the two eye rows is painted as body.
  const body = (mode === 'dizzy' || mode === 'sleep') && kind === 'tasks' ? rows.map((r, i) => (i === 3 ? r.replace(/k/g, 'o') : r)) : rows
  const held = hat?.prop === 'scroll' ? SCROLL : hat?.prop ? PROPS[hat.kind] : undefined
  const art =
    (hat ? draw(HATS[hat.kind], px, -HAT_H, ch => (ch === 'h' ? { fill: hat.color, cls: 'm', group: 'bd' } : undefined)) : '') +
    draw(body, px, 0, ch => (colors[ch] ? { fill: colors[ch], group: classes[ch] } : undefined)) +
    (held ? draw(held.rows, px, 3, ch => (held.colors[ch] ? { fill: held.colors[ch], group: held.classes[ch] } : undefined), 24) : '') +
    (mode === 'dizzy' && kind === 'tasks' ? draw(BANDAGE, px, 4, ch => (ch === 'w' ? { fill: '#f8f6f1', group: 'bd' } : undefined), 10) : '') +
    (kind === 'tasks' ? (MOOD_MARKS[mode] ?? '') : '')
  return `<g transform="translate(${x},${y})" shape-rendering="crispEdges"${mode ? ` class="${mode}"` : ''}>${art}</g>`
}

// A mood's mark beside Clawd (24×16 at px 1), mid-tones that read on light and dark; the `z` takes
// the band's muted ink.
const MOOD_MARKS: Record<string, string> = {
  startle: '<g class="bang"><rect x="11" y="-8" width="2" height="4" fill="#e3b341"/><rect x="11" y="-3" width="2" height="1" fill="#e3b341"/></g>',
  sweat: '<g class="drop"><rect x="21" y="1" width="2" height="2" fill="#5fb4ff"/><rect x="21.5" y="0" width="1" height="1" fill="#5fb4ff"/></g>',
  sleep: '<g class="zz"><rect x="19" y="-6" width="3" height="1" class="sm"/><rect x="20" y="-5" width="1" height="1" class="sm"/><rect x="19" y="-4" width="3" height="1" class="sm"/></g>',
}

export const SPRITE_CSS =
  '.run g.la{animation:step .4s steps(1) infinite}.run g.lb{animation:step .4s steps(1) infinite -.2s}' +
  '.run g.bd,.run g.eye{animation:bob .4s steps(1) infinite -.1s}' +
  '@keyframes step{50%{transform:translateY(-1px)}}@keyframes bob{50%{transform:translateY(1px)}}' +
  // A blink repaints the eyes in the body's colour (the look's `wink` keyframes), so no hole shows.
  '.idle g.eye rect{animation:wink 3.2s steps(1) infinite}' +
  'g.led1{animation:blink 1.2s steps(1) infinite}g.led2{animation:blink 1.2s steps(1) infinite -.6s}' +
  '@keyframes blink{50%{opacity:.15}}' +
  '.hop g{animation:hop .45s ease-out 2}@keyframes hop{50%{transform:translateY(-3px)}}' +
  // Props move only while the agent works; every loop fits the pane's one-second redraw.
  '.run g[class^=pr-]{transform-box:fill-box}' +
  '.run g.pr-scan{animation:scan 1s steps(4) infinite}@keyframes scan{25%{transform:translate(-1px,1px)}50%{transform:translate(-2px,0)}75%{transform:translate(-1px,-1px)}}' +
  '.run g.pr-scrib{animation:scrib .5s steps(2) infinite}@keyframes scrib{50%{transform:translate(1px,1px)}}' +
  '.run g.pr-twist{transform-origin:50% 100%;animation:twist .5s ease-in-out infinite}@keyframes twist{50%{transform:rotate(-35deg)}}' +
  '.run g.pr-flip{transform-origin:50% 50%;animation:flip 1s steps(2) infinite}@keyframes flip{50%{transform:scaleX(-1)}}' +
  '.run g.pr-steam{animation:blink .5s steps(1) infinite}' +
  'g.pr-wave{transform-box:fill-box;transform-origin:0 100%;animation:wave 1s ease-in-out infinite}@keyframes wave{50%{transform:rotate(-12deg)}}' +
  // The moods' marks: each starts where it is drawn, fully shown, so a still first frame reads.
  '.startle g.bd,.startle g.eye,.startle g.la,.startle g.lb{animation:jolt .35s ease-out 1}@keyframes jolt{40%{transform:translateY(-3px)}}' +
  '.bang{animation:blink .5s steps(1) 2}' +
  '.drop{animation:drip 1s ease-in infinite}@keyframes drip{60%{transform:translateY(2px);opacity:1}61%{opacity:0}}' +
  '.zz{animation:zz 1s ease-out infinite}@keyframes zz{70%{transform:translate(1px,-2px);opacity:.3}}'
