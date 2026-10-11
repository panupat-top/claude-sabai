# claude-sabai

[Claude Code](https://claude.com/claude-code) mods. The one mod, **sabai**, shows at a glance what Claude is doing:
- a pixel-art status band above the prompt;
- a panel for subagents;
- tool calls in the chat as easy-to-read steps.

It is built for the desktop app's Code tab and drawn as text in a terminal.

## Install

Needs Claude Code **2.1.287** or later. Run in a **terminal** (the Code tab has no `/plugin install`):

```bash
claude plugin marketplace add panupat-top/claude-sabai
claude plugin install sabai@claude-sabai
```

The band appears in every new session, the Code tab included. Mods do not load in the desktop app's WSL sessions.

## What you get

### The band, above the prompt

In the comfortable density (the default) the band is three panels:

```
╭─────────┬─────────────────────────────────────────────┬────────────────────────────────╮
│  CLAWD  │ ▪ claude-skins (⑂ main) ↑2 ±1  ◇ guard 2 ⬢ v24 │ 3 running · 1 done  ✗1 ✓12 1:42 │
│   (×3)  │ ╭─────────────╮ ╭─────────────╮ ╭─────────────╮ │ Main · Editing svg.ts     1:42 │
│ working │ │ CONTEXT     │ │ 5H          │ │ 7D          │ │ ▬▬▬▬▬     🦀✏            ⚑ │
│  1m 42s │ │ 74%         │ │ 27%         │ │ 18%         │ │ Explore ×3 · 3 running    0:12 │
│         │ │ ▓▓▓▓▓▓▓░░░  │ │ ▓▓▓░░░░░░░  │ │ ▓▓░░░░░░░░  │ │ ▬▬      🦀🦀🦀📖          ⚑ │
│         │ │ 743.5k / 1M │ │ ↻ 19m       │ │ ↻ 4d 11h    │ │ Write tests · bun test… 0:31 │
╰─────────┴─────────────────────────────────────────────┴────────────────────────────────╯
```

- **Clawd**, large, with his mood in a word and why under it:
  - `ready` · `your turn`;
  - `working` · the turn's time;
  - `blocked` · `guard stopped 1`;
  - `tests failing` · `2 failed`;
  - `all green` · `12 passed`;
  - `context full` · `84% · compact?`;
  - `napping` · `idle 20m`.

  He waves when a turn ends, yawns after a quiet couple of minutes, looks at the race while it runs and up at a limit running high. He dresses for the hour and the holidays: coffee in the morning (6–11), a nightcap at night (22–5), a pumpkin on 31 October, a flower shirt for Songkran (13–15 April), a Santa hat on 24–25 December and a party hat at New Year.
- **The middle:**
  - the info row: the project's name, its branch as a tag with what is ahead (`↑`), behind (`↓`) and uncommitted (`±`), then quietly at the right the guard (`guard 2` once it has caught something), Node and your git user. On a narrow window the user goes first, then the guard;
  - Claude's task list as a progress bar, when it keeps one;
  - the usage limits (Context, 5H, 7D), filling the band's height, amber and red at your thresholds. When there is room each also shows what is left of the context or when the limit resets (`resets 14:30`).
  - Pick how they look in Settings → Usage → Style:
    - **Tiles** (default): a card each with a big percent;
    - **Rings**;
    - **Columns**: a pixel column filling from the bottom;
    - **Rows**: one card with a row each.
- **The race**, while Claude or a subagent works:
  - the header counts who is running and done, the turn's calls that worked (`✓`) and failed (`✗`), and the time;
  - each lane is `Main` or a subagent, named by its task, with its step and its own time on a line above its ground;
  - more agents of one type than the lanes hold share a lane (`Explore ×3`); `+N` counts any left over;
  - a runner's place is its progress, from Claude's task list or the agent's step reports;
  - the ground is a tile per call (read, edit, command, test, failure);
  - a runner holds the tool of its call in flight (pencil, book, terminal, flask) over a glow in its colour;
  - a failed call trips it (`OUCH`), a passing test throws a coin;
  - a finished agent reaches a green flag, and a failed one is `OUT`.

  Turning **Activity** off in Settings hides the race.

On a narrower window the race gives way to a line of what Claude is doing now and a row of small Clawds for the subagents. Below 480 px the band stacks its rows. The **compact** density keeps the stacked band with one-line usage cards.

Under it, the toolbar: `/review`, `/compact`, `/rewind`, `/resume`, and the `✻ Agents` and `⚙ Settings` buttons.

### The agents panel

Press `✻ Agents` or type `/sabai-agents` to see a card per subagent:
- Clawd in a hat for its type;
- the task, effort, model and step progress;
- a status that pops when done or shakes on failure.

Press **Report** on a finished agent to read what it found, and **Clear** to tidy up.

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

## Settings

Press `⚙ Settings` or type `/sabai-settings`. Changes apply at once and are kept for new sessions.

| Group | Choices |
|---|---|
| Layout | Density (comfortable or compact); each row as a toggle: Info, Tasks, Activity (the race or the live strip), Agents (race lanes or the crew row), Usage, Toolbar |
| Info | Each chip: Folder, Git user, Branch, Node |
| Usage | Style (Tiles, Rings, Columns, Rows); each limit (Context, 5H, 7D); amber and red thresholds (60/70/80, 85/90/95) |
| Clawd | Clawd on or off; extras: Accessories (hats and props) and Tricks (waves, yawns, looks) |
| Agents | Step reports: agents report their own progress to their card (on; takes effect from the next session) |
| Conversation | Tool summaries, Test results, Callouts, Turn receipt, Spinner words (all on) |
| Safety | Guard (off). Each rule is set to Block, Ask (opens the permission dialog; in auto mode the classifier decides) or Off: deleting the whole disk or home folder (Block), force-pushing to `main`/`master` (Ask), reading `.env` files (Block), discarding uncommitted work with `git reset --hard`, `git clean -f` or `git checkout`/`restore .` (Ask) |
| Notifications | A notification when a long turn ends or an agent fails; a toast when 5H or 7D passes 90% (on) |
| Look | Progress bar style, and ten colour themes (`auto` follows your OS) |

**Reset to defaults**, at the bottom, puts the settings, the skin and the bar style back.

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
| No Node or branch chip | `node` is not on Claude Code's `PATH`, or the folder is not a git repository |
| Thai spinner words rarely show on the desktop | The desktop usually names the step itself; the words replace only its generic `Working` |
| An agent card shows a step count, not `3/5` | That agent type is not given the step tool (e.g. claude-code-guide) |

## Contributing

How the mod is built and tested: [CLAUDE.md](CLAUDE.md). Roadmap: [docs/PLAN.md](docs/PLAN.md).

## Credits

Built by reading [hellosverre/claude-skins](https://github.com/hellosverre/claude-skins), [JohnnyVizz/claude-kit](https://github.com/JohnnyVizz/claude-kit) (Pixel Clawd, after DockCrab) and [data-goblin/claude-code-filetree](https://github.com/data-goblin/claude-code-filetree), all MIT.

Icons from [Lucide](https://lucide.dev) (ISC) as animated by [pqoqubbw/icons](https://github.com/pqoqubbw/icons) (MIT), [Octicons](https://github.com/primer/octicons) (MIT) and [Simple Icons](https://simpleicons.org) (CC0). The logos are trademarks of their owners. Skin colours follow each theme's published palette.

## License

[MIT](LICENSE)
