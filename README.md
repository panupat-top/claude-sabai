# claude-sabai

A small marketplace of [Claude Code](https://claude.com/claude-code) mods. Its one mod, **sabai-band**, adds a pixel-art status band above the prompt and a panel of subagents, built for the desktop app's Code tab and drawn as text in a terminal.

## What sabai-band shows

**The band, above the prompt**

| Row | What it shows |
|---|---|
| Info | Current directory, git user and branch on the left — the branch with commits ahead `↑` / behind `↓` its upstream and uncommitted files `±` — and the Node.js version on the right. |
| Tasks | Clawd, a pixel Claude mascot, beside a progress bar of Claude's own task list: the task in progress, `done/total` and percent. Clawd walks while Claude works and blinks while it waits. The row leaves once every task is done. |
| Crew | While subagents are around: a small Clawd per running agent in its type's hat, holding its tool, walking; the newest agent's task and progress; running ●, done ✓ and failed ✗ counts and the time. Once all are done the crew stands by with a summary. |
| Usage | Cards for **Context** (`434.5k / 1M (43%)`), the **5H Limit** and the **7D All** limit, each with a pixel bar and, for the limits, a reset countdown. Figures turn amber from 70% and red from 90%. |
| Toolbar | Under the band: `/context`, `/usage`, `/review`, `/compact`, `/rewind`, `/resume` and `/clear` on the left (those your surface offers), and icon buttons on the right: `✻` **Agents** (with the number of running subagents) and `⚙` **Skins**. Each opens or hides its panel; `a` and `s` press them while the band has the focus. |

**The agents panel** (`/sabai-agents`, or `✻` under the band)

A summary of how many subagents run and finished, their context and the wall time, then a card per agent:
- the task as its title, marked by its type (🔍 Explore, 📐 Plan, 🔧 general-purpose, 🎓 guide, 🎨 statusline, 🍴 fork, 🎧 teammate, 🎩 a plugin's agent, ☕ any other), with a **Report** button at the right once the agent has finished;
- Clawd in a hat for its type, holding its tool, which moves while it works; he hops and waves his report when it finishes, and wears a plaster if it fails:

  | Type | Hat | Tool |
  |---|---|---|
  | Explore | explorer's hat | magnifier |
  | Plan | hard hat | pencil |
  | general-purpose | cap | wrench |
  | claude-code-guide | mortarboard | book |
  | statusline-setup | beret | paintbrush |
  | fork | bandana | fork |
  | teammate | headset | clipboard |
  | a plugin's agent (`plugin:name`) | top hat | wand |
  | any other | beanie | steaming cup |

- a status mark: a rippling dot while running, a check that pops when done, a cross that shakes on failure;
- its effort as Claude names it (`low`, `medium`, `high`, `xhigh`, `max`, or `budget 32k` for a token budget), its type and model, and `workflow` for an agent a workflow started;
- its own step progress, drawn like the band's bar with its `3/5` pill, or its step count, context and time.

The newest six running agents get a card and the rest are counted. Finished agents fold away. Show them, then press **Report** to read an agent's whole report as Markdown in its colour, one at a time; a failed one says why it stopped. **Clear** them when you are done.

**Skins**

Ten looks for the band and the panels, picked from a panel of previews (`/sabai-skin`): `auto` (the default, follows your OS light or dark mode), `catppuccin-latte`, `catppuccin-frappe`, `catppuccin-macchiato`, `catppuccin-mocha`, `dracula`, `tokyo-night`, `nord`, `gruvbox` and `rose-pine`.

The panel has two groups, each choice with a preview and a **Use** button: **Color theme**, and **Progress bar**, how the bars are drawn: **Dither** (the default), **Pixel blocks** or **Solid**. Both are remembered across sessions.

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
