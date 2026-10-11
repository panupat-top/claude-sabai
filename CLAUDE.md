# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Claude Code plugin marketplace (`claude-sabai`, `.claude-plugin/marketplace.json`) holding **mods**: plugins built on Claude Code's function-hooks API (Claude Code ≥ 2.1.287). Each mod lives in its own folder under `plugins/`. Today there is one, `plugins/sabai`. The plan, decisions and backlog are in `docs/PLAN.md` (written in Thai).

## Commands

Run from the repo root; each mod is checked on its own folder.

```bash
claude plugin validate .claude-plugin/marketplace.json   # marketplace manifest
claude plugin validate plugins/sabai                # manifest + what the hooks module hooks/calls, and anything the engine would refuse
claude plugin test plugins/sabai                    # runs every *.test.ts(x) under the folder (no per-test filter)
tsc -p plugins/sabai                                 # type-check; needs the engine-laid types (see below)
claude --plugin-dir plugins/sabai                    # run the mod in a session; saving a file hot-reloads it
git config core.hooksPath .githooks                       # once per clone: pre-commit validates, type-checks and tests
```

- `plugins/sabai/tsconfig.json` extends `.claude-plugin/types/tsconfig.json`, which Claude Code writes beside a mod only after it has loaded it (hot reload or `--plugin-dir`). That folder is gitignored and absent on a fresh clone, so `tsc` works only after one load. CI (`.github/workflows/check.yml`) therefore only validates and tests; the pre-commit hook type-checks when the types exist.
- The API reference is that laid file, `.claude-plugin/types/claude-code/index.d.ts` (~14k lines, every event, `$` noun and element prop). Grep it rather than guessing an API.

## sabai architecture

A band above the prompt (comfortable: three panels — Clawd large with his mood, a reason and his tricks, the info row with the usage limits in one of four styles filling the band's height, and a race box where Main and each subagent run a lane while work runs; compact and narrow: stacked rows with the live strip and crew; a toolbar of Buttons under it), two panes (agents: cards and reports; settings: layout, info chips, usage style and limits, Clawd's extras, agents, chat, the guard, notifications, bar style, ten skins, reset), and touches to the conversation (tool calls drawn as one-line steps, test results, callouts, Thai spinner words, a receipt under each working turn). Clawd shows the session's mood in the band.

- `hooks/register.tsx` is the only module that touches `$`. It hooks engine events (`session.start`, `session.measure`, `tool.call` on `TaskCreate`/`TaskUpdate`/`TodoWrite`/`Edit`/`Write`/`Bash`/`Read`, `tool.check`, `agent.spawn`, `turn.step`, `turn.complete`, `turn.start`, `prompt.compose`, `classic.SessionStart`), writes state, registers `/sabai-settings` and `/sabai-agents`, and renders `AbovePrompt` (the band), `Pane` (agents, settings) and the conversation rows `ToolUse`, `AssistantMessage`, `Spinner` and `SessionMode`.
- **The turn log and the guard.** `turn.start` empties a `turnLog` atom; `tool.call` hooks on Edit/Write/Bash fold the main turn's calls into it (`logged`), and `turn.complete` files the log under the turn's answer in `receipts`; the `AssistantMessage` row whose text is that answer draws the receipt line (`receiptSvg`) under itself. A turn with no answer of its own returns `receiptText` as its text, a notice under it. The guard blocks in `tool.call` and asks in `tool.check` (`{ decision: 'ask', reason }`), per rule as `prefs.guardRules` says; its `tool.call` and `tool.check` hooks carry a `.catch` that refuses (`failClosed`), since a failed hook is skipped and its call would run. Each catch counts in `guardCaught` and stamps the log, so Clawd startles.
- **State** lives in `$.state` atoms declared in the contract `types/index.d.ts` (`interface PluginState['sabai']`); a draw `read`s them and redraws when an `update` writes. Module variables (e.g. `cwd`) are only for things `session.start` re-sets, since a reload starts the module over. The chosen skin is also persisted with `$.store`.
- **The band's layout.** `bandSvg(p, info, list, W, opts: BandOpts)` draws the stacked band, or with `opts.hero` (comfortable density, W ≥ 480) `heroBand`: the Clawd panel (his headline from `MOOD_WORDS`, the `moodLine` reason, his `trickOf` trick), the middle (`infoPart`: the project, a branch tag with sync counts, then guard, Node and git user in the surface's muted ink, the same in the stacked band; tasks; then `usagePart` in `prefs.usageStyle`: tiles, rings, columns or rows) and, from 760 px, `racePart`; below 760 the live strip and crew rows stay in the middle. The band's height is the tallest of Clawd's panel (112 px), the race and the rows above the usage plus 50 px; the usage fills what is left. The race's state is the `race` atom (`RaceLog`: each member's tiles, call in flight, last fall and score, and the turn's `total` and `fails`), written by the Read/Edit/Write/Bash hooks through `racing` and laid out by `raceOf`, which names lanes by the agent's description and merges agents of one type when more run than three lanes hold. The main turn's start and step are `turnStartedAt`/`liveStep`. `prefs.extras` turns Clawd's accessories and tricks off. The race's CSS rides inside its own box so other drawings stay small.
- **Pure logic** — `model.ts` (meters with levels, chips, task reducers, formatting, `moodOf`, `moodLine`, `trickOf`, `resetClock`, `accessoryOf`, `raced`), `agents.ts` (subagent run reducers, `progressOf`, `raceOf`, type styles), `chat.ts` (tool summary lines, test-output parsers, callout splitting, spinner words, the turn log's `logged` and `receiptText`), `themes.ts` (palettes, `contrast`, `readable`), `guard.ts` (`riskOf`, `GUARD_RULES`, the commands the guard catches) — takes plain values and is unit-tested directly.
- **Drawing** — `svg.ts` builds the desktop SVGs (`bandSvg`, `agentsSvg`) from a `Look` (`lookOf(skin)`: stylesheet, bar colours, pill, Clawd tint; no skin paints a background, so the band sits on the surface like `auto`); `sprites.ts` holds pixel sprites and their CSS animations; `icons.ts` holds the info-row marks (Octicons / Simple Icons path data), and `strokes.ts` the chat's Lucide stroke icons (animated by CSS in `svg.ts`), generated once from Lucide's files.
- Desktop and other SVG-capable surfaces get one SVG per site; the terminal gets `Box`/`Text` rows built in `register.tsx`.

## Engine constraints that shape the code

- A render tree (a band or a pane) must stay under 100,000 characters serialized, or nothing of it is drawn ("Nothing to show yet" in a pane). A Clawd sprite alone is ~14k.

- `$` cannot be passed across an import: any helper taking `$` must be declared in `register.tsx` itself.
- The terminal's element table lists `Svg` but cannot draw it — branch on `e.surface !== 'terminal'`, not on `'Svg' in ui`.
- The desktop draws an `Svg` as an image and wraps sibling elements onto new lines, so each site is a single SVG. With no `width` prop the surface scales a wider markup down to the slot (never up), hence drawing at `bodyColumns × 8.25`. Svg width/height must be 1–4096 px and its source ≤ 131,072 characters; clip-path ids must be unique (`sabai-*`).
- The desktop draws a `Button` as a native button from its `label` alone (children, colours and `hover` are ignored; a `hotkey` shows as a keycap), and a `Button` cannot hold an `Svg`. Put what the desktop should show in `label`; the terminal draws the children. Of the common commands the Code tab offers `/clear` and `/compact`, not `/rewind` or `/resume`.
- SVG animations: the desktop draws each drawing as an image and redraws the agents pane every second while an agent runs, restarting its animations. Keep loops ≤ 1s, and start every animation from a visible frame (an image can sit on its first frame); a `stroke-dashoffset` draw-in never runs there, so use transforms or opacity.
- Native `Text`, `Button` and `Markdown` keep the surface's own ink, which follows the OS light/dark theme; `Button` and `Markdown` take no colour. Never put them on a fixed skin colour (a `Box` `backgroundColor`): the ink may not read on it.
- `session.measure` only fires on the next API response, so `session.start` reads `$.session.usage()` itself.
- Work started from a button press is cancelled when the press ends; run it via `$.clock.after`.
- In the desktop Code tab `$.ui.status` is not shown and `/config` is unavailable, so settings are slash commands.
- A drawn tree's size depends on the drawings in it: the agents pane picks cards by their drawn size (`PANE_BUDGET`), and repeated marks (dither dots, ticks) are capped so a very wide band stays inside the limits.
- Conversation rows: a `ui.render` hook on `ToolUse`, `AssistantMessage`, `UserMessage` or `ToolGroup` replaces the row, and a tree wrapping `await next(e)` keeps the engine's row with ours under it (both checked on the desktop). Round borders and `Text` colours are honoured there; an `Svg` is drawn as an image and, without `width`/`height` props, stretched to the row's full width, so chat drawings are fixed-size and pass both. The desktop always draws its own `ToolGroup` line and the thinking summary, and shows no `SessionMode` footer, so the guard label lives in the band's info row. Transcript `Text`/`Box` colours are theme keys (`success`, `error`, …), since the conversation follows the person's theme, not the skin. A standalone tool row's `output` is often absent on the desktop (its result is a separate `ToolResult`), so steps fall back to the call's input. Bash durations are a `StateFamily` keyed by `tool_use_id` (read with `memberOf(atom, e)`), so a new call redraws only its own row; a call that opened the permission dialog (`classic.PermissionRequest`) shows no time, while the auto-mode classifier's `ask` keeps it.
- Turn ends and permissions (checked on the desktop): `turn.complete` returning `{ text }` keeps the answer and draws the text as plain text in a folded "Claude Code notice" under it, prefixed with the names of the plugins hooking it. An event registered twice without a matcher is refused at load, so a feature extends the existing hook. `classic.PreToolUse` answering `{ ask }` opens no dialog; `tool.check` answering `{ decision: 'ask', reason }` opens the permission dialog with the reason in default mode, while in auto mode the ask goes to the classifier, which may allow it. Neither hook sees the permission mode. An SVG drawing follows the OS's light/dark switch live, both through a class set inside `@media (prefers-color-scheme: dark)` and through a CSS custom property used as a `fill="var(--x)"` attribute (checked on the desktop). A `ToolGroup` row starts folded; `isExpanded: true` unfolds it into its steps. An `AssistantMessage` carries no turn id, but the final reply's `text` equals `turn.complete`'s `answer`, which is how the receipt finds its reply.
- Everything the band shows must come from the engine or the project's own `git`/`node`; values that cannot be read are hidden, never faked. No credentials or external files.

## Conventions

- `README.md` is for people installing and using the mods (what it is, install, commands, privacy, troubleshooting). Development notes belong here; the roadmap and decisions in `docs/PLAN.md`.
- Code, comments, commit messages and repo docs are in English; `docs/PLAN.md` is in Thai.
- A release bumps the mod's `version` in both `plugins/<mod>/.claude-plugin/plugin.json` and its entry in `.claude-plugin/marketplace.json`, and updates the README if commands or behaviour changed.
- Before committing, run validate, test and `tsc` (the pre-commit hook does all three). Commit messages: an imperative subject line, then a short bullet list of what changed.
- User-visible text in the band and pane is English. The spinner words are Thai, the one exception, by the owner's choice. Keep every text colour at ≥ 4.5:1 on its card; the theme test enforces it, and `readable()` is the way to fix a palette colour that fails.

## Tests

Tests import `test`, `expect`, `mock` from `claude-code/testing`. In a test, `$` is the engine's (it has no `env`, `settings`, `store` or `fs` nouns), and hooks registered with the test's `on` sit beneath the plugin and stand in for the engine — e.g. `process.run`, `session.usage`, `store.get` answered as `{ value }`, while object-result events like `session.start` return the object directly. UI is checked by `$.ui.mount({ plugin, surface, component, requestId, props })` and `findAll`, looping over `['terminal', 'desktop']`. Contrast of every skin's text colours is asserted (≥ 4.5:1) in `tests/themes.test.ts`.
