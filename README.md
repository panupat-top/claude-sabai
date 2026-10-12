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

  He waves when a turn ends, yawns after a quiet couple of minutes, looks at the race while it runs and up at a limit running high. He dresses for the hour and the holidays: coffee in the morning (6–11), a nightcap at night (22–5), a pumpkin on 31 October, a flower shirt for Songkran (13–15 April), a Santa hat on 24–25 December and a party hat at New Year.
- **The middle:**
  - the info row (the top row above): the project's folder, its branch as a tag with what is ahead (`↑`), behind (`↓`) and uncommitted (`±`), then quietly your git user and Node at its full version. On a narrow window the user goes first, then Node, then the sync counts; then the folder is shortened and, if still too long, left out, so the branch stays longest;
  - Claude's task list as a progress bar, when it keeps one;
  - the usage limits (Context, 5H, 7D), filling the band's height, amber and red at your thresholds. When there is room each also shows what is left of the context or when the limit resets (`resets 14:30`). Until the session has read them, the band stands as a still outline with no numbers; with nothing to read yet, it says so.
  - Pick how they look in Settings → Usage → Style:
    - **Tiles** (default): a card each with a big percent;
    - **Rings**;
    - **Columns**: a pixel column filling from the bottom;
    - **Rows**: one card with a row each.
- **The race**, while Claude or a subagent works:
  - the header counts who is running and done, the turn's calls that worked (`✓`) and failed (`✗`), and the time;
  - each lane is `Main` or a subagent, named by its task, with its step (its reported progress, or else its latest call) and, before its own time, its calls that worked (`✓`) and failed (`✗`), on a line above its ground;
  - more agents of one type than the lanes hold share a lane (`Explore ×3`); `+N` counts any left over;
  - a runner's place is its progress, from Claude's task list or the agent's step reports, or else how far its calls have carried it (quick at first, never to the flag before it is done);
  - behind the runner, a pixel icon per call, the newest closest, in the colour of its kind:

    | Icon | Call | Colour |
    |---|---|---|
    | magnifier | a read | the Context meter's teal |
    | pencil | an edit or a write | the 5H meter's indigo |
    | `>_` | a command | grey |
    | flask | a test run that passed | green |
    | cross | any call that failed | red |

  - a running lane's ground scrolls in dashes of Clawd's colour;
  - a runner holds the tool of its call in flight (pencil, book, terminal, flask) over a glow in its colour;
  - a failed call trips it (`OUCH`), a passing test throws a coin;
  - Main waiting on its agents, and a finished agent, fold to one line (a finished one with a green check); a failed one stays full and is `OUT`.

  Turning **Activity** off in Settings hides the race.

On a narrower window the race gives way to a line of what Claude is doing now and a row of small Clawds for the subagents. Below 480 px the band stacks its rows. The **compact** density keeps the stacked band, with the usage limits in your style at its shortest.

The info row sits above the band on a card of its own, everything from the left with Node at its full version, and the toolbar shares its line as icons at the right: **Guard** (a green shield, while the guard is on, with what it caught; it opens the settings), **Compact** (a fold, with the context percentage once it reaches the amber mark, in amber or red while no agents run; on a window under 480 px the icons drop their figures), **Agents** (a robot, counting the agents at work in Clawd's clay) and **Settings** (a gear).

### The agents panel

Press the Agents icon or type `/sabai-agents` to see a card per subagent:
- Clawd in a hat for its type;
- the task, effort, model and step progress;
- a status that pops when done or shakes on failure.

Finished agents fold behind **▸ Show**; press **▸ Report** on one to read what it found, and **Clear finished** to tidy up.

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
| Agents | Race lanes or the crew row, on or off; Step reports: agents report their own progress to their lane and card (on; from the next session) |
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

sabai reads only what Claude Code gives a mod, and runs `git` and `node --version` in your project folder. It reads no other files, uses no credentials and makes no network requests. Callouts add one line to Claude's system prompt; nothing else changes what Claude reads.

## Troubleshooting

| You see | Why |
|---|---|
| No 5H or 7D card | No plan-limit reading yet (before the first reply), or not a subscription plan |
| No task row | Claude has not made a task list in this session |
| No Node or branch in the info row | `node` is not on Claude Code's `PATH`, or the folder is not a git repository |
| Thai spinner words rarely show | The desktop usually names the step itself; the words replace only its generic `Working` |
| Nothing of sabai in a terminal session | By design: the mod works only where the desktop draws |
| An agent card shows a step count, not `3/5` | That agent type is not given the step tool (e.g. claude-code-guide) |

## Contributing

How the mod is built and tested: [CLAUDE.md](CLAUDE.md). Roadmap: [docs/PLAN.md](docs/PLAN.md).

## Credits

Built by reading [hellosverre/claude-skins](https://github.com/hellosverre/claude-skins), [JohnnyVizz/claude-kit](https://github.com/JohnnyVizz/claude-kit) (Pixel Clawd, after DockCrab) and [data-goblin/claude-code-filetree](https://github.com/data-goblin/claude-code-filetree), all MIT.

Icons from [Lucide](https://lucide.dev) (ISC) as animated by [pqoqubbw/icons](https://github.com/pqoqubbw/icons) (MIT), [Octicons](https://github.com/primer/octicons) (MIT) and [Simple Icons](https://simpleicons.org) (CC0). The logos are trademarks of their owners. Skin colours follow each theme's published palette.

## License

[MIT](LICENSE)
