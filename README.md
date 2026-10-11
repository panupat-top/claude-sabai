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
╭─────────┬──────────────────────────────────────────┬──────────────────────────╮
│  CLAWD  │ 📁 claude-skins  ⎇ main ±1     🛡 guard·2 ⬢ v24 │ LV 5  ●×2  ❤❤♡  ×4 COMBO 1:42│
│   (×3)  │ CONTEXT ▓▓▓▓▓▓▓░░░░░  743.5k / 1M     74% │ Main    ▬▬▬▬  🦀✏      ⚑ │
│ working │ 5H      ▓▓▓▓▒▒▒░░░░░  ↻ 19m    27% → ~45% │ Explore ▬▬▬    🦀📖     ⚑ │
│  1m 42s │ 7D      ▓▓▓░░░░░░░░░  ↻ 4d 11h       18% │ Plan    ▬▬▬       🦀✓  ⚑ │
╰─────────┴──────────────────────────────────────────┴──────────────────────────╯
```

- **Clawd**, large, with his mood (`working`, `all green`, `tests failed`, `context full`, `sleeping`, `caught one!`) and the turn's time. He dresses for the hour and the holidays: coffee in the morning (6–11), a nightcap at night (22–5), a pumpkin on 31 October, a flower shirt for Songkran (13–15 April), a Santa hat on 24–25 December and a party hat at New Year.
- **The middle:**
  - the info row: folder, git user, branch (`↑` ahead, `↓` behind, `±` uncommitted), the `guard` shield (`guard · 2` once it has caught something) and Node;
  - Claude's task list as a progress bar, when it keeps one;
  - the usage limits as rows: Context, 5H and 7D with reset countdowns, amber and red at your thresholds, and a faint ghost to where 5H and 7D are heading by their reset (`→ ~45%`, `→ full`).
- **The race**, while Claude or a subagent works. It is a little game:
  - each member runs its own lane: `Main` and up to three subagents, `+N` for more;
  - a runner's place is its progress, from Claude's task list or the agent's step reports;
  - the ground is a tile per call (read, edit, command, test, failure);
  - a runner holds the tool of its call in flight (pencil, book, terminal, flask) over a glow in its colour;
  - a passing test is a coin, a failed command a trip (`OUCH`) and, for Main, a lost heart;
  - a finished agent waves a green flag, and a failed one is `OUT`;
  - the header counts the level (one per five calls), coins, hearts, a combo of clean calls and the time.

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
| Band | Each row (Info, Tasks, Live, Crew, Usage, Toolbar); each info chip and usage card; amber and red thresholds (60/70/80, 85/90/95); Clawd |
| Conversation | Tool summaries, Test results, Callouts, Turn receipt, Spinner words (all on) |
| Agents | Step reports: agents report their own progress to their card (on; takes effect from the next session) |
| Safety | Guard (off). Each rule is set to Block, Ask (opens the permission dialog; in auto mode the classifier decides) or Off: deleting the whole disk or home folder (Block), force-pushing to `main`/`master` (Ask), reading `.env` files (Block), discarding uncommitted work with `git reset --hard`, `git clean -f` or `git checkout`/`restore .` (Ask) |
| Alerts | A notification when a long turn ends or an agent fails; a toast when 5H or 7D passes 90% (on) |
| Appearance | Density (comfortable or compact), progress bar style, and ten colour themes (`auto` follows your OS) |

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
