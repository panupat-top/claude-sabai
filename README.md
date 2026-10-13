# claude-sabai

[Claude Code](https://claude.com/claude-code) mods. The one mod, **sabai**, shows at a glance what Claude is doing:
- a pixel-art status band above the prompt;
- a panel for subagents;
- tool calls in the chat as easy-to-read steps.

It works in the desktop app's Code tab only. In a terminal session it stays out of the way entirely (no band, no chat changes, no extra tool or prompt text, no guard), so the terminal runs as light as Claude Code itself.

## Install

Needs Claude Code **2.1.287** or later. Run in a **terminal** (the Code tab has no `/plugin install`):

```bash
claude plugin marketplace add panupat-top/claude-sabai
claude plugin install sabai@claude-sabai
```

The band appears in every new Code tab session. Mods do not load in the desktop app's WSL sessions.

## What you get

### The band, above the prompt

A top row sits above the band: the info row on a card, and the guard and toolbar as icons at the right. In the comfortable density (the default) the band under it is three panels:

```
 ▪ claude-skins (⑂ main) ↑2 ±1  ◆ Panupat  ⬢ v24.21.0                [🛡 2] [⇕ 74%] [🤖 3] [⚙]
╭─────────┬─────────────────────────────────────────────┬────────────────────────────────╮
│  CLAWD  │ ╭─────────────╮ ╭─────────────╮ ╭─────────────╮ │ 3 running · 1 done  ✗1 ✓12 1:42 │
│   (×3)  │ │ CONTEXT     │ │ 5H          │ │ 7D          │ │ Main · Editing svg.ts     1:42 │
│ working │ │ 74%         │ │ 27%         │ │ 18%         │ │ ▬▬▬▬▬     🦀✏            ⚑ │
│         │ │ ▓▓▓▓▓▓▓░░░  │ │ ▓▓▓░░░░░░░  │ │ ▓▓░░░░░░░░  │ │ Explore ×3 · 3 running    0:12 │
│         │ │ 743.5k / 1M │ │ ↻ 19m       │ │ ↻ 4d 11h    │ │ ▬▬      🦀🦀🦀📖          ⚑ │
╰─────────┴─────────────────────────────────────────────┴────────────────────────────────╯
```

- **Clawd**, large, with his mood in a word and why under it:
  - `ready` · `your turn`;
  - `working` · the turn's time (beside the race, its header carries the time instead);
  - `blocked` · `guard stopped 1`;
  - `tests failing` · `2 failed`;
  - `all green` · `12 passed`;
  - `context full` · `84% · compact?`;
  - `napping` · `idle 20m`.

  While background work Claude started is still running (a shell or a monitor; agents run in the race), his line says so on your turn, `● 1 running` with a pulsing dot, until each ends or is stopped.

  He waves when a turn ends, yawns after a quiet couple of minutes, looks at the race while it runs and up at a limit running high. He dresses for the hour and the holidays: coffee in the morning (6–11), a nightcap at night (22–5), a pumpkin on 31 October, a flower shirt for Songkran (13–15 April), a Santa hat on 24–25 December and a party hat at New Year.
- **The middle:**
  - the info row (the top row above): the project's folder, its branch as a tag with what is ahead (`↑`), behind (`↓`) and uncommitted (`±`), then quietly your git user and Node at its full version. On a narrow window the user goes first, then Node, then the sync counts; then the folder is shortened and, if still too long, left out, so the branch stays longest;
  - while Claude works, the line of what he is doing: the call in flight as a blinking icon with its words and how long it has run (three blinking dots and `thinking` between calls), and at the right the turn's calls as a trail of small icons, coloured by kind (read, edit, command, test; a failed one red), then the lines its edits changed (`+42 −8`) and its tests (`✓ 12`). On a narrow band the call in flight keeps its room first;
  - Claude's task list as a progress bar, when it keeps one;
  - the usage limits (Context, 5H, 7D), filling the band's height, amber and red at your thresholds. When there is room each also shows what is left of the context or when the limit resets (`resets 14:30`). Until the session has read them, the band stands as a still outline with no numbers; with nothing to read yet, it says so.
  - Pick how they look in Settings → Usage → Style:
    - **Tiles** (default): a card each with a big percent;
    - **Rings**;
    - **Columns**: a pixel column filling from the bottom;
    - **Rows**: one card with a row each.
- **The race**, while subagents work (Claude working alone keeps the line of what he is doing now):
  - the header counts the agents running, then those done, failed and stopped, the turn's failed calls (`✗`) and the time;
  - a row for `Main` (in his captain's cap; `waiting on 3` while his agents work), then one per subagent, named by its task: a stripe in its mood's colour (amber when quiet, red when it failed, green when done), its Clawd in its type's hat holding the tool of its call in flight, its step (its reported progress, or else its latest call), its failed calls (`✗`), its plan's done and total with a small bar when it keeps one, and its time;
  - an agent that has said nothing for 30 s dozes and reads `quiet 47s`; a failed call trips it for a moment;
  - an agent that just failed falls on a red-flashing row, then folds to a red cross (`✗ … · Failed`); one you stopped stands faded and reads `Stopped`;
  - an agent that just finished hops among confetti on a flashing row (`Done! 🎉`), then folds to a green check;
  - more agents of one type than the rows hold share a row (`Explore ×3`); `+N more · open Agents for all` counts any left over. The details live in the agents panel.

  Turning **Activity** off in Settings hides the race.

On a narrower window the race gives way to a line of what Claude is doing now and a row of small Clawds for the subagents. Below 480 px the band stacks its rows. The **compact** density keeps the stacked band, with the usage limits in your style at its shortest.

The info row sits above the band on a card of its own, everything from the left with Node at its full version, and the toolbar shares its line as icons at the right: **Guard** (a green shield, while the guard is on, with what it caught; it opens the settings), **Compact** (a fold, with the context percentage once it reaches the amber mark, in amber or red while no agents run; on a window under 480 px the icons drop their figures), **Agents** (a robot, counting the agents at work in Clawd's clay) and **Settings** (a gear).

### The agents panel

Press the Agents icon or type `/sabai-agents`. Each of Claude's turns is a **crew**: Claude and the agents that turn started. The panel has three boxes:
- **Now**, the crew at work, its title saying how many are running, done, failed or stopped:
  - a timeline: each member a bar from its start to its end on one time axis in its mood's colour, a Clawd riding the end of each bar still at work and ✓, ✗ or ✋ at the end of the others; then three tiles: calls (with failures), tokens (the new ones each request sent and got back; cache reads are left out) and time;
  - a lane for Claude (in his captain's cap, with a **main** badge), then one per agent (in its type's hat): a stripe in its mood's colour, its Clawd, its task, a line in Thai saying what it is doing with the real numbers in it (`กำลังอ่าน svg.ts 📖`, `เงียบไป 45 วิ… หลับอยู่หรือเปล่า 😴`), its progress and time, and **View**. A lane that has ended wears a badge on its Clawd: a green ✓, a red ✗, or ✋ for one you stopped; for its first seconds the lane is tinted green or red.
- **Viewing**, the lane you opened with **View**: the lane is ringed and tinted, its Clawd waves and its button reads **Viewing**. Press it again, or **✕ Close**, to close the view. With none viewed, Viewing invites you to pick one and names an agent that needs a look (quiet, or its context nearly full), with **View it**. A viewed run shows:
  - its head: its task and time; its mood and its call in flight or latest; steps, context and tokens as meters; and its type, model and effort in small print;
  - **Asked to**: the first line of what it was asked, **▸ More** for the rest;
  - **Summary** once it finishes: what sabai counted (files read and changed, calls, time, tokens), then, for an agent, two to four lines Haiku writes in Thai from its report;
  - **Plan** (the steps it reported), **Tools** (built-in tools, skills and MCP tools, with how often each was called), **Calls** (its latest, each with its time and whether it worked; **All calls** for up to 60), **Files** (those it changed first, with `+N −M` and NEW for a file it created, then those it only read);
  - **Report** (Claude's **Answer**, for Claude), with earlier rounds when an agent was sent more work after finishing.
- **Earlier**: the last crews before this one that had agents, folded to one line while a crew is at work. Each line crowns its MVP 👑: the agent that finished without a failed call, changed the most files, and was quickest. **▸ Show** a crew to see its lanes; crews are grouped by day when they span more than one; **Clear** drops them.

A turn that called nothing and started no agents (a quick reply) is not kept as a crew. An agent's mood: working, thinking, quiet (nothing heard for 30 seconds, maybe stuck), context nearly full (80 %, known only when it runs on Claude's own model), failed, stopped (you stopped it) or done. Claude is never quiet: writing a long answer is quiet work.

### In the conversation

```
✎ Edited svg.ts  …/sabai/hooks/            ▮▮▮▮▯ [+3 −2]
⚗ Run the tests  $ bun test                     ▮▮▮▮▮ [✓ 159 passed]   5.4s
› List a folder  "/x": No such file…                  [✗ exit 2]
```

- **Tool summaries:** each Edit, Write, Read and Bash call is one line. It says what the call was about, what it did and how it ended, and a failure says why.
- **Test results:** runs of bun, jest, vitest, pytest, cargo or go show their pass and fail counts.
- **Callouts:** `> [!NOTE]`, `[!TIP]`, `[!WARNING]` and the other GitHub alerts in a reply become coloured boxes.
- **Spinner words:** Thai words while Claude works (`กำลังคิด`, `กำลังลงมือทำ`).
- **Turn receipt:** a turn that changed files, ran tests or ran commands ends with one line under its last reply: how it went (`All green`, `Tests failing`, `1 command failed`, `Done`), then its files `+40 −12`, tests and commands. Commands that only read (`cat`, `grep`, `git status` …) count only beside real work.

Want the native rows that expand to output and diffs? Turn **Tool summaries** off.

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

## Settings

Press the gear or type `/sabai-settings`. Changes apply at once and are kept for new sessions.

Groups run from what you see most to what you set once. A part of the band with choices of its own has its On/Off at the right of its group's title. A choice of how something looks shows a sketch over its button, the one in use ringed and ticked.

| Group | Choices |
|---|---|
| Look | Layout: **Comfortable** (side by side) or **Compact** (stacked and shorter), and cards: **Raised** (the default) or **Flat**, both following the app's light or dark appearance; each a sketch with its button under it. The bar style, with a sample; and Tasks, Activity (the race on a wide window, else a one-line strip) and Toolbar to show or hide |
| Usage | On or off; style (Tiles, Rings, Columns, Rows), each a sketch with its button; each limit (Context, 5H, 7D); amber and red thresholds (60/70/80, 85/90/95) |
| Info row | On or off; each part: Folder, Branch, Git user, Node, with the row as it reads |
| Clawd | On or off; Hats and props, Tricks (waves, yawns, looks) |
| Agents | Race lanes or the crew row, on or off; Step reports: agents report their own progress to their lane and the agents panel (on; from the next session); Thai summary: Haiku sums up each finished agent's report in Thai in the agents panel (on) |
| Conversation | A sample of each touch that is on; Tool summaries, Test results, Callouts, Turn receipt, Spinner words (all on) |
| Guard | Off by default. Each rule is set to Block, Ask (opens the permission dialog; in auto mode the classifier decides) or Off: deleting the whole disk or home folder (Block), force-pushing to `main`/`master` (Ask), reading `.env` files (Block), discarding uncommitted work with `git reset --hard`, `git clean -f`, a forced `git checkout`/`switch`, or `git checkout`/`restore .` (Ask) |
| Notifications | Turn ended: when a turn of a minute or more ends or an agent fails; Limit warnings: once per window when 5H or 7D passes your red mark (on) |

**Reset to defaults**, at the bottom, asks for a second press, then puts the settings (the guard off), the look and the bar style back.

The guard is a safety net, not a sandbox: it catches common slips, not someone set on getting round it.

## Update and uninstall

```bash
claude plugin marketplace update claude-sabai
claude plugin update sabai@claude-sabai
```

```bash
claude plugin uninstall sabai@claude-sabai
```

Restart Claude Code after either one.

## Privacy

sabai reads only what Claude Code gives a mod, and runs `git` and `node --version` in your project folder. It reads no other files, uses no credentials and makes no network requests of its own. Callouts add one line to Claude's system prompt; nothing else changes what Claude reads. With **Thai summary** on, a finished agent's task, report, file names and failed calls are sent to Haiku through Claude Code's own API client (your session's account) to be summed up; turn it off in Settings › Agents to send nothing.

## Troubleshooting

| You see | Why |
|---|---|
| No 5H or 7D card | No plan-limit reading yet (before the first reply), or not a subscription plan |
| No task row | Claude has not made a task list in this session |
| No Node or branch in the info row | `node` is not on Claude Code's `PATH`, or the folder is not a git repository |
| Thai spinner words rarely show | The desktop usually names the step itself; the words replace only its generic `Working` |
| Nothing of sabai in a terminal session | By design: the mod works only where the desktop draws |
| An agent shows no steps, only its calls | That agent type is not given the step tool (e.g. claude-code-guide) |
| No Thai summary under a finished agent | Thai summary is off, the agent failed or was stopped, or Haiku gave no answer in 20 seconds |
| No context meter or "context" mood for an agent | It runs on another model than Claude's, whose context window Claude Code does not report |

## Contributing

How the mod is built and tested: [CLAUDE.md](CLAUDE.md). Roadmap: [docs/PLAN.md](docs/PLAN.md).

## Credits

Built by reading [hellosverre/claude-skins](https://github.com/hellosverre/claude-skins), [JohnnyVizz/claude-kit](https://github.com/JohnnyVizz/claude-kit) (Pixel Clawd, after DockCrab) and [data-goblin/claude-code-filetree](https://github.com/data-goblin/claude-code-filetree), all MIT.

Icons from [Lucide](https://lucide.dev) (ISC) as animated by [pqoqubbw/icons](https://github.com/pqoqubbw/icons) (MIT), [Octicons](https://github.com/primer/octicons) (MIT) and [Simple Icons](https://simpleicons.org) (CC0). The logos are trademarks of their owners. Skin colours follow each theme's published palette.

## License

[MIT](LICENSE)
