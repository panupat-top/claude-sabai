# claude-sabai

A small marketplace of [Claude Code](https://claude.com/claude-code) mods. Its one mod, **sabai-band**, adds a pixel-art status band above the prompt and a panel of subagents, built for the desktop app's Code tab and drawn as text in a terminal.

## What sabai-band shows

**The band, above the prompt**

| Row | What it shows |
|---|---|
| Info | Current directory, git user and branch on the left — the branch with commits ahead `↑` / behind `↓` its upstream and uncommitted files `±` — and the Node.js version on the right. |
| Tasks | Clawd, a pixel Claude mascot, beside a progress bar of Claude's own task list: the task in progress, `done/total` and percent. Clawd walks while Claude works and blinks while it waits. The row leaves once every task is done. |
| Usage | Cards for **Context** (`434.5k / 1M (43%)`), the **5H Limit** and the **7D All** limit, each with a pixel bar and, for the limits, a reset countdown. Figures turn amber from 70% and red from 90%. |
| Toolbar | Under the band: `/context`, `/usage`, `/review`, `/compact`, `/rewind`, `/resume` and `/clear` on the left (those your surface offers), and icon buttons on the right: `✻` **Agents** (with the number of running subagents) and `⚙` **Skins**. Each opens or hides its panel; `a` and `s` press them while the band has the focus. |

**The agents panel** (`/sabai-agents`)

A card per subagent: Clawd, the task, the agent type, model, number of model requests, context used and elapsed time. Running agents come first; finished ones fade, and failed ones are marked ✗.

**Skins**

Ten looks for the band and the panels, picked from a panel of previews (`/sabai-skin`): `auto` (the default, follows your OS light or dark mode), `catppuccin-latte`, `catppuccin-frappe`, `catppuccin-macchiato`, `catppuccin-mocha`, `dracula`, `tokyo-night`, `nord`, `gruvbox` and `rose-pine`.

## Requirements

- Claude Code **2.1.287** or later.
- The desktop app's Code tab or a terminal. Mods do not load in the desktop app's WSL sessions.
- Optional: `git` and `node` on your `PATH` for the info row. Anything missing is simply left out.

## Install

Run this in Claude Code in a **terminal** (the Code tab does not offer `/plugin install`):

```
/plugin install sabai-band --marketplace panupat-top/claude-sabai
```

Answer `y` to add the marketplace and choose a scope (user is the usual choice). The band appears in the same session and in every new one, the Code tab included.

Or from your shell:

```bash
claude plugin marketplace add panupat-top/claude-sabai
claude plugin install sabai-band@claude-sabai
```

## Usage

| Command | What it does |
|---|---|
| `/sabai-skin` | Opens the skins panel, or hides it if it is open: every skin with a swatch in its colours. Press **Use** to switch. |
| `/sabai-skin <name>` | Switches skin. Names are forgiving: `mocha`, `Catppuccin Mocha`, `TokyoNight` and `Frappé` all work. Your choice is remembered across sessions. |
| `/sabai-agents` | Shows the agents panel, or hides it if it is open. |

The band needs no command: it fills itself in as you work, and its toolbar opens both panels.

- **Task progress** appears when Claude keeps a task list, for example when you ask it to plan a multi-step change and work through it step by step.
- **Agents** appear when Claude hands work to subagents, for example when you ask it to explore parts of a codebase in parallel.

## Update and uninstall

```bash
claude plugin marketplace update claude-sabai
claude plugin update sabai-band@claude-sabai
```

```bash
claude plugin uninstall sabai-band@claude-sabai
```

Restart Claude Code after either one. Open sessions keep the version they started with.

## Privacy

sabai-band reads only what Claude Code gives a mod (context, plan limits, tasks, subagents) and runs `git` and `node --version` in your project folder. It reads no other files, uses no credentials and makes no network requests. Your skin choice is kept in Claude Code's own mod store.

## Troubleshooting

| You see | Why |
|---|---|
| No 5H or 7D card | Claude Code has no plan-limit reading yet — right after starting or resuming, before the first reply — or you are not on a subscription plan. |
| No task row | Claude has not made a task list in this session, or the session has no task tools. |
| No Node chip | `node` is not on the `PATH` that Claude Code sees (common with version managers when Claude Code is started from the desktop app). |
| No branch chip | The folder is not a git repository. `↑` / `↓` show only when the branch has an upstream. |

## Contributing

Development notes — how the mod is built, tested and type-checked — are in [CLAUDE.md](CLAUDE.md). The roadmap is in [docs/PLAN.md](docs/PLAN.md).

## Credits

Built by reading [hellosverre/claude-skins](https://github.com/hellosverre/claude-skins), [JohnnyVizz/claude-kit](https://github.com/JohnnyVizz/claude-kit) (Pixel Clawd, after DockCrab) and [data-goblin/claude-code-filetree](https://github.com/data-goblin/claude-code-filetree), all MIT.

Info-row marks: folder and branch from [Octicons](https://github.com/primer/octicons) (MIT); the Git and Node.js logos from [Simple Icons](https://simpleicons.org) (CC0), trademarks of their owners. Skin colours follow each theme's published palette.

## License

[MIT](LICENSE)
