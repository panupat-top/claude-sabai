# claude-sabai

[Claude Code](https://claude.com/claude-code) mods. The one mod, **sabai-band**, shows at a glance what Claude is doing:
- a pixel-art status band above the prompt;
- a panel for subagents;
- tool calls in the chat as easy-to-read steps.

It is built for the desktop app's Code tab and drawn as text in a terminal.

## Install

Needs Claude Code **2.1.287** or later. Run in a **terminal** (the Code tab has no `/plugin install`):

```bash
claude plugin marketplace add panupat-top/claude-sabai
claude plugin install sabai-band@claude-sabai
```

The band appears in every new session, the Code tab included. Mods do not load in the desktop app's WSL sessions.

## What you get

### The band, above the prompt

| Row | Shows |
|---|---|
| Info | Folder, git user, branch (`↑` ahead, `↓` behind, `±` uncommitted) and Node, plus a shield `guard` chip while the guard is on |
| Tasks | Claude's task list as a progress bar, with Pixel Clawd walking while it works |
| Crew | A small Clawd per running subagent, with its task and the running, done and failed counts |
| Usage | Context, 5H and 7D limits with reset countdowns (amber from 70%, red from 90%) |
| Toolbar | `/review`, `/compact`, `/rewind`, `/resume`, and the `✻ Agents` and `⚙ Settings` buttons |

It fills itself in as you work. Tasks show when Claude keeps a task list, and agents when it hands work to subagents.

### The agents panel

Press `✻ Agents` or type `/sabai-agents` to see a card per subagent:
- Clawd in a hat for its type;
- the task, effort, model and step progress;
- a status that pops when done or shakes on failure.

Press **Report** on a finished agent to read what it found, and **Clear** to tidy up.

### In the conversation

```
✎ Edited svg.ts  …/sabai-band/hooks/            ▮▮▮▮▯ [+3 −2]
⚗ Run the tests  $ bun test                     ▮▮▮▮▮ [✓ 159 passed]   5.4s
› List a folder  "/x": No such file…                  [✗ exit 2]
```

- **Tool summaries:** each Edit, Write, Read and Bash call is one line. It says what the call was about, what it did and how it ended, and a failure says why.
- **Test results:** runs of bun, jest, vitest, pytest, cargo or go show their pass and fail counts.
- **Callouts:** `> [!NOTE]`, `[!TIP]`, `[!WARNING]` and the other GitHub alerts in a reply become coloured boxes.
- **Spinner words:** Thai words while Claude works (`กำลังคิด`, `กำลังลงมือทำ`).

Want the native rows that expand to output and diffs? Turn **Tool summaries** off.

## Settings

Press `⚙ Settings` or type `/sabai-settings`. Changes apply at once and are kept for new sessions.

| Group | Choices |
|---|---|
| Band | Show or hide each row |
| Conversation | Tool summaries, Test results, Callouts, Spinner words (all on) |
| Agents | Step reports: agents report their own progress to their card (on; takes effect from the next session) |
| Safety | Guard: refuses deleting the whole disk or home folder, force-pushing to `main`/`master`, and reading `.env` files (off) |
| Alerts | A notification when a long turn ends or an agent fails; a toast when 5H or 7D passes 90% (on) |
| Appearance | Progress bar style, and ten colour themes (`auto` follows your OS) |

The guard is a safety net, not a sandbox: it catches common slips, not someone set on getting round it.

## Update and uninstall

```bash
claude plugin marketplace update claude-sabai
claude plugin update sabai-band@claude-sabai
```

```bash
claude plugin uninstall sabai-band@claude-sabai
```

Restart Claude Code after either one.

## Privacy

sabai-band reads only what Claude Code gives a mod, and runs `git` and `node --version` in your project folder. It reads no other files, uses no credentials and makes no network requests. Callouts add one line to Claude's system prompt; nothing else changes what Claude reads.

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
