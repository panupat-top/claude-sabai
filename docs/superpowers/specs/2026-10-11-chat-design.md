# Chat and response — design

Date: 2026-10-11 · Mod: `sabai-band` · Status: approved in conversation, awaiting spec review

## Goal

Make the chat itself more useful and more fun, not only the band and panes: a Thai spinner, a one-line summary under tool rows, test results as a bar, callout boxes in answers, and a guard label under the prompt (backlog A1–A5). Desktop Code tab first; the terminal gets the same information as text.

## What a spike established (2026-10-10, desktop)

| Finding | Consequence |
|---|---|
| A tree of `Box`/`Text` drawn by `ui.render` replaces `UserMessage`, `AssistantMessage`, `ToolUse` and `ToolGroup` rows. A round border and `Text` colours are honoured. | Native elements can be laid out and coloured in the transcript, unlike a pane's `Button`. |
| The desktop always draws its own `ToolGroup` line ("Ran a command, read X ›"); a hook's tree is added under it. | `ToolGroup` is left alone. |
| The thinking summary line is drawn by the desktop without a hook. | Out of reach. |
| Not tested: `Svg` in transcript rows, `Spinner`, `SessionMode`, wrapping the engine's drawing (`next(e)` inside our tree), prop-only rewrites. | Task 1 of the plan verifies `Svg` and wrapping on the desktop before anything else is built on them; every feature falls back to the engine's own drawing. |

## Decisions

| Topic | Choice | Why |
|---|---|---|
| Where | Inside `sabai-band`, a **Chat** group in Settings | Shares prefs, the guard state (A5) and the settings pane; each feature has its own toggle. |
| Tool rows | Keep the engine's row and add one summary line under it | The desktop's row expands to the output and diff natively; replacing it would lose that. If wrapping does not draw on the desktop, the summary replaces the row. |
| Colour | Theme keys (`success`, `error`, `warning`, `suggestion`, `claude`, `diffAdded`, `diffRemoved`, `subtle`) for `Text`/`Box`; OS-following CSS inside SVGs | The transcript sits on the person's light or dark theme; a skin's hex colours are not designed for it. Skins stay on the band and panes. |
| Icons | Brand logos from [svgl](https://github.com/pheralb/svgl) (MIT; marks belong to their owners) for commands and test runners; Octicons (MIT, already in `icons.ts`) for UI marks | Real logos read at a glance; one icon family for UI marks. |
| Spinner language | Thai, plain words | The person's choice; the one exception to "user-visible text is English" (recorded in CLAUDE.md). |
| Callouts | The mod adds one line to the system prompt while Callouts is on | Claude rarely writes `> [!NOTE]` unprompted; without the line the feature would hardly ever show. |

## Settings

A **Chat** group after Alerts, every toggle on by default, kept in `$.store` with the rest of `prefs`:

| Toggle | Feature |
|---|---|
| Spinner words | A1 |
| Tool summaries | A2 |
| Test results | A3 |
| Callouts | A4 (and its system-prompt line) |
| Guard label | A5 |

`Prefs` gains `chat: { spinner, tools, tests, callouts, label }`; `withDefaults()` fills it for prefs saved before it existed.

## Features

### A1 Spinner words

`ui.render` on `Spinner` rewrites `word`. On the desktop only while the engine's word is generic (`Working`); a word that names the step (`Creating notes.md`) is kept. On the terminal the engine's sampled word (`Sauteing`) is always replaced. The word is picked once per turn (re-picked on `turn.start`), so it does not change on every redraw; `message` and `suffix` are left as the engine has them.

| `mode` | Words |
|---|---|
| `thinking` | กำลังคิด · ขอคิดแป๊บนึงนะ · กำลังเรียบเรียงความคิด · กำลังหาทางที่ดีที่สุด |
| `requesting` | กำลังส่งคำขอ · รอคำตอบสักครู่ |
| `tool-input` | กำลังเตรียมคำสั่ง |
| `tool-use` | กำลังลงมือทำ · กำลังจัดการให้ · กำลังตรวจดูให้ |
| `responding` | กำลังเขียนคำตอบ · กำลังสรุปให้ · ใกล้เสร็จแล้ว |

The engine adds its own ellipsis (`suffix`), so the words carry none.

### A2 Tool summaries

`ui.render` on `ToolUse` for `Edit`, `Write`, `Read` and `Bash`, once the call has resolved (`isRunning` false): the engine's drawing, then one summary line. Other tools, running calls and calls with nothing to add pass through with `next(e)`.

| Tool | Icon | Line | Source |
|---|---|---|---|
| Edit | Octicon `pencil` | `+12 −3 · 2 hunks` and a 10-cell bar of added against removed lines | `structuredPatch` lines starting `+` / `-` |
| Write (create) | Octicon `file-added` | `new file · 48 lines` | `type`, `content` |
| Write (update) | Octicon `pencil` | as Edit | `structuredPatch` |
| Read | Octicon `eye` | `lines 1–20 of 131`, or `all 131 lines` | `file.startLine`, `numLines`, `totalLines` |
| Bash | The logo of the command's first word, else svgl `bash` | `✓ 4.2s`, `✗ failed · 3.4s`, `⏹ interrupted` | `isErrored`, `isInterrupted`, and a duration the mod measures |

- Bash has no exit code or duration in its result. The mod measures the duration itself: a `tool.call` hook on `Bash` stamps the start and end by `tool_use_id` into a `durations` atom (the 200 newest kept). Nothing is shown for a duration the mod did not see (a resumed session).
- A Bash call that succeeded in under a second gets no line.
- The command's first word is read after `cd … &&`, `sudo`, `npx`/`bunx`/`pnpm dlx` and env assignments. Known words and their logos: `git`, `bun`, `npm`, `pnpm`, `node`, `deno`, `python`/`python3`/`pip`/`pytest`/`uv` (Python), `cargo`/`rustc` (Rust), `go`, `docker`, `tsc` (TypeScript), `npx playwright` (Playwright), `mocha`, `jest`.
- Read of an image, PDF or notebook passes through.

### A3 Test results

When a resolved Bash call's stdout (and stderr) parses as a test summary, its line becomes the test line instead of A2's:

- all passed: runner logo, Octicon `check-circle-fill` in the success colour, `all 96 passed`, a full bar, the duration;
- some failed: runner logo, `x-circle-fill` in the error colour, `2 of 98 failed · 1 skipped`, the bar's failed cells in the error colour, the duration.

Parsed summaries, last match wins (a run prints one at its end):

| Runner | Pattern (examples) |
|---|---|
| bun | ` 96 pass` / ` 0 fail` / ` 2 skip` lines |
| jest | `Tests: 1 failed, 2 skipped, 95 passed, 98 total` |
| vitest | `Tests  95 passed \| 1 failed (96)` |
| pytest | `=== 95 passed, 2 failed, 1 skipped in 12.40s ===` |
| cargo | `test result: ok. 95 passed; 0 failed; 1 ignored` (summed over crates) |
| go | `ok`/`FAIL` package lines; counts from `--- PASS` / `--- FAIL` when `-v` |

The runner is named by the pattern that matched, and its logo follows: bun → Bun, jest → Jest, pytest → Python, cargo → Rust, go → Go; vitest has no logo in svgl and shows only the status mark. A summary with no total (no tests found) falls back to A2.

### A4 Callouts

`ui.render` on `AssistantMessage`, only for a block whose text holds a GitHub alert (`> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`, case-insensitive). The block is split into Markdown parts and callouts and drawn in order: each Markdown part as `Markdown`, each callout as a `Box` with a round border in the kind's theme colour, its title row (icon and name), and its body as `Markdown`. Blocks without an alert, and summaries (`isSummary`), pass through.

| Kind | Octicon | Theme key |
|---|---|---|
| Note | `info` | `suggestion` |
| Tip | `light-bulb` | `success` |
| Important | `report` | `claude` |
| Warning | `alert` | `warning` |
| Caution | `stop` | `error` |

The title row is one small SVG on surfaces that draw `Svg` (the icon and name in the kind's colour), and a coloured `Text` with a glyph on the terminal. A `>` line inside a code fence is not a callout. A callout runs until the first line that is not a `>` line.

While Callouts is on, a `prompt.compose` hook appends one `session` section: "When an aside deserves a box (a caveat, a tip, a warning), write it as a GitHub alert: `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]` or `> [!CAUTION]`. Use them sparingly." A toggle takes effect from the next request and spends the prompt cache once.

### A5 Guard label

`ui.render` on `SessionMode` appends `🛡 guard` to `modes` while the guard is on. Nothing else is added.

## Drawing

- **Desktop, A2/A3 line and A4 title:** one SVG per line, as on the band (an `Svg` wraps its siblings onto new lines, so a line is one drawing): icon, text and bar. Text uses OS-following CSS classes like the band's `.st` / `.sm`, at ≥ 4.5:1 on both themes; status colours have a light and a dark value. Height 20 px; width from `bodyColumns` is not given to transcript rows, so the drawing is laid out at a fixed 560 px and the surface scales it down, never up.
- **Terminal:** the same line as `Text` parts in theme keys with glyphs (`✎`, `▶`, `✓`, `✗`, `ℹ`, `💡`, `✦`, `⚠`, `⛔`).
- **Fallback:** if Task 1 shows the desktop does not draw `Svg` in transcript rows, the desktop uses the terminal's `Text` line.
- Logos are stored as path data in `icons.ts` beside the existing marks, each with its brand colours and a dark variant where svgl has one; a logo too large for a 16 px mark is simplified to its silhouette.

## Files

- `hooks/chat.ts` (new, pure): `spinnerWord(mode, seed)`, `isGenericWord(word)`, `commandOf(command)`, `toolSummary(tool, input, output, durationMs?)`, `testResult(text)`, `splitCallouts(markdown)`.
- `hooks/icons.ts`: the Octicons and svgl logos above.
- `hooks/svg.ts`: `summaryLineSvg(...)`, `calloutTitleSvg(...)`.
- `hooks/register.tsx`: the Chat settings group; `ui.render` hooks on `Spinner`, `ToolUse`, `AssistantMessage`, `SessionMode`; `prompt.compose`; Bash timing in `tool.call`; re-pick on `turn.start`.
- `types/index.d.ts`: `Prefs.chat`, the `durations` atom.
- README (Settings table, the Chat features, svgl credit), CLAUDE.md (the Thai spinner exception; transcript constraints learned), PLAN.

## Testing

- `chat.test.ts`: every spinner mode has words and the pick is stable for a seed; generic-word detection; `commandOf` through `cd`/`sudo`/`npx`/env prefixes; Edit counts across several hunks; Write create/update; Read ranges; real output samples of each runner (all pass, some fail, skipped, no tests); callouts: each kind, case, inside a code fence, back-to-back, text before and after, a malformed marker.
- `band.test.tsx`: each slot on both surfaces draws our line when on and passes through (`next(e)`) when its toggle is off or there is nothing to add; Bash timing shows a measured duration; the prompt section appears only while Callouts is on; the guard label follows the guard; drawn trees stay well under the 100,000-character limit.
- `themes.test.ts` / `svg.test.ts`: summary-line text colours ≥ 4.5:1 on light and dark.
- On the desktop: Task 1's check of `Svg` and wrapping, then a look at every feature before release.

## Out of scope

Code-block file headers (Claude rarely writes a file name on a fence); rewriting `ToolGroup`, `UserMessage` or `TurnDuration`; mode labels other than the guard; spinner words in other languages.
