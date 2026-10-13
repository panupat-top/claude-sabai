# sabai guide

Everything sabai shows and every setting, in detail. For install and a quick look, see the [README](../README.md).

- [The band](#the-band-above-the-prompt)
- [The Subagents pane](#the-subagents-pane)
- [In the conversation](#in-the-conversation)
- [Settings](#settings)
- [In a terminal: the hub status line](#in-a-terminal-the-hub-status-line)
- [Troubleshooting](#troubleshooting)

## The band, above the prompt

A top row sits above the band: the info row on a card, and the guard and toolbar as icons at the right. In the comfortable density (the default) the band under it is three panels:

```
 ▪ claude-skins (⑂ main) ↑2 ±1  ◆ Panupat  ⬢ v24.21.0                       [🛡 2] [⇕ 74%] [🤖 3] [⚙]
╭─────────┬───────────────────────────────────────────────┬─────────────────────────────────────╮
│  CLAWD  │ ✎ Editing svg.ts 4s           ▪▪▪▪+12  +42 −8 │ 3 running · 1 done       ✗ 1  1m 42s │
│   (×3)  │ ╭─────────────╮ ╭─────────────╮ ╭─────────────╮ │ ▌🦀 Main     ✎ Editing svg.ts 1m 42s │
│ working │ │ CONTEXT     │ │SESSION LIMIT│ │WEEKLY LIMIT │ │ ▌🦀 Fix race 📖 Reading… 2/5 ▬  58s │
│         │ │ 74%         │ │ 27%         │ │ 18%         │ │ ▌🦀 Explore ×2 ••• Thinking 3s  12s │
│         │ │ ▓▓▓▓▓▓▓░░░  │ │ ▓▓▓░░░░░░░  │ │ ▓▓░░░░░░░░  │ │ ▌🦀 Run tests ✓ Done            20s │
╰─────────┴───────────────────────────────────────────────┴─────────────────────────────────────╯
```

- **Clawd**, large, with his mood in a word and why under it:
  - `ready` · `your turn`;
  - `working` · the turn's time (beside the race, its header carries the time instead);
  - `blocked` · `guard stopped 1`;
  - `tests failing` · `2 failed`;
  - `all green` · `12 passed`;
  - `context full` · `84% · compact?`;
  - `napping` · `idle 20m`.

  While background tasks Claude started are still running (a shell or a monitor; subagents run in the race), his line says so on your turn, `● 1 background` with a pulsing dot, until each ends or is stopped.

  He waves when a turn ends, yawns after a quiet couple of minutes, looks at the race while it runs and up at a limit running high. He dresses for the hour and the holidays: coffee in the morning (6–11), a nightcap at night (22–5), a pumpkin on 31 October, a flower shirt for Songkran (13–15 April), a Santa hat on 24–25 December and a party hat at New Year.
- **The middle:**
  - the info row (the top row above): the project's folder, its branch as a tag with what is ahead (`↑`), behind (`↓`) and uncommitted (`±`), then quietly your git user and Node at its full version. On a narrow window the user goes first, then Node, then the sync counts; then the folder is shortened and, if still too long, left out, so the branch stays longest;
  - while Claude works, the line of what he is doing: the call in flight as a blinking icon with its words and how long it has run (three hopping dots and `Thinking 12s` between calls, how long since the last call), and at the right the turn's calls as a trail of small icons, coloured by kind (read, edit, command, test; a failed one red), then the lines its edits changed (`+42 −8`) and its tests (`✓ 12`). On a narrow band the call in flight keeps its room first;
  - Claude's task list as a progress bar, when it keeps one;
  - the usage limits (Context, Session limit and Weekly limit, Claude Code's own names for the five-hour and seven-day windows; a narrow card says Session and Weekly), filling the band's height, amber and red at your thresholds. When there is room each also shows what is left of the context or when the limit resets (`resets 14:30`). Until the session has read them, the band stands as a still outline with no numbers; with nothing to read yet, it says so. In a new session, and right after `/compact` or `/clear`, the context is Claude Code's local estimate, shown with a `~` (`~18k / 200k`), until the next reply measures it.
  - Pick how they look in Settings → Usage → Style:
    - **Tiles** (default): a card each with a big percent;
    - **Rings**;
    - **Columns**: a pixel column filling from the bottom;
    - **Rows**: one card with a row each.
- **The race**, while subagents work (Claude working alone keeps the line of what he is doing now):
  - the header counts the subagents running, then those done, failed and stopped (`3 running · 1 done`, as the Subagents pane counts them), the turn's failed calls (`✗`) and the time;
  - a row for `Main`, the main conversation (in his captain's cap; `Waiting on 3` while his subagents work), then one per subagent, named by its description: a stripe in its mood's colour (amber when quiet, red when it failed, green when done), its Clawd in its type's hat holding the tool of its call in flight, what it is doing, led by its state's icon, a frameless duotone (a call's icon pulsing, three hopping dots while thinking, a turning hourglass while Main waits, a fading moon when quiet, a rocking gauge when its context is nearly full; a check, a cross or a stop once ended; an MCP call's plug and a skill's lightbulb) (its reported progress, else its call in flight in plain words such as `Reading svg.ts` or `Using Browser · computer`, else `Thinking 12s`, how long since its last call), how many skills (a lightbulb) and MCP servers (a plug) it has called, its failed calls (`✗`), its plan's done and total with a small bar when it keeps one, and its time;
  - a subagent that has said nothing for 30 s dozes and reads `Quiet 47s`; a failed call trips it for a moment;
  - a subagent that just failed falls on a red-flashing row, then settles, its Clawd dimmed and its line led by a red cross (`Failed`); one you stopped settles with a stop mark (`Stopped`);
  - a subagent that just finished hops among confetti on a flashing row (`Done 🎉`), then settles, its Clawd dimmed and its line led by a green check;
  - each finished, failed or stopped subagent wears the same mark everywhere, in the race, the subagents row and the Subagents pane: a check, a cross or a stop on a soft tile. Every tile, bar and word takes your theme's colours (Settings › Look), one theme in light mode and one in dark;
  - more subagents of one type than the rows hold share a row (`Explore ×3`); `+N more · open Subagents for all` counts any left over. The details live in the Subagents pane.

  Turning **Subagents** off in Settings hides the race; **Activity** is the line of what Main is doing.

On a narrower window the race gives way to a line of what Claude is doing now and a row of small Clawds for the subagents. Below 480 px the band stacks its rows. The **compact** density keeps the stacked band, with the usage limits in your style at its shortest.

The info row sits above the band on a card of its own, everything from the left with Node at its full version, and the toolbar shares its line as icons at the right: **Guard** (a green shield, while the guard is on, with what it caught; it opens the settings), **Compact** (a fold, with the context percentage once it reaches the amber mark, in amber or red while no subagents run; on a window under 480 px the icons drop their figures), **Subagents** (a robot, counting the subagents running in Clawd's clay) and **Settings** (a gear).

## The Subagents pane

Press the Subagents icon or type `/sabai-agents`. The pane shows the subagents by the **turn** that started them (or the **workflow run**, for a dynamic workflow's), together with Main, the main conversation, in that turn. It has three boxes:
- **Now**, the turn at work, its title counting its subagents running, done, failed or stopped:
  - a timeline: each member a bar from its start to its end on one time axis in its mood's colour, a Clawd riding the end of each bar still at work and the same check, cross or stop tile as the lanes at the end of the others; then three tiles: calls (with failures), tokens (the new ones each request sent and got back; cache reads are left out) and time;
  - a lane for Main (in his captain's cap; `Waiting on N` once his turn ends while its subagents still work, as in the band), then one per subagent (in its type's hat): a stripe in its mood's colour, its Clawd, its description, a line saying what it is doing after the same state tile as in the race, in the band's words and with the real numbers in it (`Reading svg.ts`, `Thinking 12s · editing svg.ts, chat.ts`, the files it touched last; `Quiet 45s`, `Done in 20s`; an MCP tool by its server's own name, as in Tools and Calls), its progress and time, and **View**. A lane that has called skills or MCP servers names them on a row of chips (`pdf`, `Slack ×2`: a skill's lightbulb, an MCP server's plug, how often past one), the one in use first, outlined and pulsing, then the most called; `+N` counts what the row cannot hold. A lane that has ended says so by the tile before its line alone (a check, a cross, or a stop for one you stopped), the same tile everywhere; for its first seconds the lane is tinted green or red.
- **Viewing**, the lane you opened with **View**: the lane is ringed and tinted, its Clawd waves and its button reads **Viewing**. Press it again, or **✕ Close**, to close the view. With none viewed, Viewing invites you to pick one and names a subagent that needs a look (quiet, or its context nearly full), with **View it**. A viewed run shows:
  - its head: its description and time; its mood, then what it runs on: its model after a robot and its effort after a gauge, in the model family's colour; steps, context and tokens as meters; and its type (**main conversation** for Main, and **teammate** for an agent team's teammate) in small print. Its calls are listed under **Calls**;
  - **Asked to**: the first line of its prompt, **▸ More** for the rest;
  - **Summary** once it finishes: what sabai counted (files read and changed, calls, time, tokens), then, for a subagent, two to four lines Haiku writes in Thai from its report;
  - **Progress** (the steps it reported, or its task list), **Tools** (built-in tools, skills and MCP tools, with how often each was called), **Calls** (its latest, each with its time and whether it worked; **All calls** for up to 60), **Files** (those it changed first, with `+N −M` and NEW for a file it created, then those it only read);
  - **Report** (an **Answer** for Main), with earlier rounds when a subagent was sent more work after finishing.
- **Earlier**, its title counting the turns and workflow runs it holds: the last turns before this one that had subagents (a dynamic workflow's run says **workflow run**, in Now too), folded to one line while a turn is at work. Each line crowns its MVP 👑: the subagent that finished without a failed call, changed the most files, and was quickest. **▸ Show** a turn to see its lanes; turns are grouped by day when they span more than one; **Clear** drops them.

A turn that called nothing and started no subagents (a quick reply) is not kept. A subagent's mood: working, thinking, quiet (nothing heard for 30 seconds, maybe stuck), context nearly full (80 %, known only when it runs on Claude's own model), failed, stopped (you stopped it) or done. Main is never quiet: writing a long answer is quiet work; once its turn ends while its subagents run, it is waiting.

## In the conversation

```
✎ Edited svg.ts  …/sabai/hooks/            ▮▮▮▮▯ [+3 −2]
⚗ Run the tests  $ bun test                     ▮▮▮▮▮ [✓ 159 passed]   5.4s
› List a folder  "/x": No such file…                  [✗ exit 2]
```

- **Tool summaries:** each Edit, Write, Read and Bash call is one line. It says what the call was about, what it did and how it ended, and a failure says why.
- **Test results:** runs of bun, jest, vitest, pytest, cargo or go show their pass and fail counts.
- **Callouts:** `> [!NOTE]`, `[!TIP]`, `[!WARNING]` and the other GitHub alerts in a reply become coloured boxes.
- **Turn receipt:** a turn that changed files, ran tests or ran commands ends with one line under its last reply: how it went (`All green`, `Tests failing`, `1 command failed`, `Done`), then its files `+40 −12`, tests and commands. Commands that only read (`cat`, `grep`, `git status` …) count only beside real work.

Want the native rows that expand to output and diffs? Turn **Tool summaries** off.

## Settings

Press the gear or type `/sabai-settings`. Changes apply at once and are kept for new sessions.

Groups run from what you see most to what you set once. A part of the band with choices of its own has its On/Off at the right of its group's title. A choice of how something looks shows a sketch of the one in use, with a button for each choice under it.

| Group | Choices |
|---|---|
| Look | Layout: **Comfortable** (side by side) or **Compact** (stacked and shorter). The theme: one for light (**Mono**, the default, **Pastel** or **Matcha**) and one for dark (**Ink**, the default, **Forest** or **Synthwave**), the band and the panes switching between them with the app's light or dark appearance; a sketch shows the pair in use. The bar style, with a sample; and Tasks, Activity (the line of what Main is doing while he works) and Toolbar to show or hide |
| Usage | On or off; style (Tiles, Rings, Columns, Rows); each limit (Context, Session, Weekly); amber and red thresholds (60/70/80, 85/90/95) |
| Info row | On or off; each part: Folder, Branch, Git user, Node, with the row as it reads |
| Clawd | On or off; Hats and props, Tricks (waves, yawns, looks) |
| Subagents | Race lanes or the subagents row, on or off; Step reports: subagents report their own progress to their lane and the Subagents pane (on; from the next session); Thai summary: Haiku sums up each finished subagent's report in Thai in the Subagents pane (on) |
| Conversation | A sample of each touch that is on; Tool summaries, Test results, Callouts, Turn receipt (all on) |
| Guard | Off by default. Each rule is set to Block, Ask (opens the permission dialog; in auto mode the classifier decides) or Off: deleting the whole disk or home folder (Block), force-pushing to `main`/`master` (Ask), reading `.env` files (Block), discarding uncommitted work with `git reset --hard`, `git clean -f`, a forced `git checkout`/`switch`, or `git checkout`/`restore .` (Ask) |
| Notifications | Turn ended: when a turn of a minute or more ends or a subagent fails; Limit warnings: once per window when the session or weekly limit passes your red mark (on) |

**Reset to defaults**, at the bottom, asks for a second press, then puts the settings (the guard off), the theme (Mono and Ink) and the bar style back.

The last line says which sabai you run: its version, then **Release** with the marketplace it was installed from (`sabai 2.24.0 · Release (claude-sabai) · Claude Code 2.1.300`), or **Dev** for a copy loaded from a folder (`--plugin-dir` or `CLAUDE_CODE_PLUGIN_DIRS`) with the branch and commit that folder stands at. A dev copy's version is that of the last release, so the branch and commit tell it apart. Include this line when you report a bug.

The guard is a safety net, not a sandbox: it catches common slips, not someone set on getting round it.

## In a terminal: the hub status line

sabai stays out of terminal sessions. For a terminal, the repository carries **hub**, a two-line status line with the band's essentials:

```
󰉖 claude-skins  󰘬 main ↑2 ±3    󱙺 Opus 5.5  󰓅 high  󰇁 1.42  󰔛 38m
󰧑 CTX ━━━━━━━━━━━━   7%     󰅐 5H ━━━━━━━━━━━━  27%  1h 12m     󰭧 7D ━━━━━━━━━━━━  18%  Fri 04:00
```

- the folder, its branch with what is ahead (`↑`), behind (`↓`) and uncommitted (`±`), then the model, effort, cost and time (from the first minute);
- context, 5H and 7D as line bars, the icon and bar amber from 70% and red from 90%, with when each limit resets (5H as time left, 7D as the local day and time);
- in your terminal's own colours, so it reads on a light or dark theme; a part with nothing to read is left out.

The icons need a [Nerd Font](https://www.nerdfonts.com) (v3) in your terminal; without one, set `SABAI_HUB_ICONS=0` (in `env` in `settings.json`) for the same lines without icons.

It needs `jq` and `git`, reads only what Claude Code passes it and the folder's git, makes no network requests and touches no credentials. Adding the marketplace puts it on your machine; point `statusLine` in `~/.claude/settings.json` at it:

```json
"statusLine": { "type": "command", "command": "bash ~/.claude/plugins/marketplaces/claude-sabai/statusline/hub.sh" }
```

`claude plugin marketplace update claude-sabai` updates it with the mod. The desktop Code tab does not use it.

## Troubleshooting

| You see | Why |
|---|---|
| No Session or Weekly limit card | No plan-limit reading yet (before the first reply), or not a subscription plan |
| No task row | Claude has not made a task list in this session |
| No Node or branch in the info row | `node` is not on Claude Code's `PATH`, or the folder is not a git repository |
| Nothing of sabai in a terminal session | By design: the mod works only where the desktop draws |
| A subagent shows no steps, only its calls | That subagent type is not given the step tool (e.g. claude-code-guide) |
| No Thai summary under a finished subagent | Thai summary is off, the subagent failed or was stopped, or Haiku gave no answer in 20 seconds |
| No context meter or "context" mood for a subagent | It runs on another model than Main's, whose context window Claude Code does not report |
