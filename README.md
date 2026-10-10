# claude-sabai

Claude Code mods for the desktop Code tab. Needs Claude Code 2.1.287 or later.

## sabai-band

A pixel-art band above the prompt, in savvy-progress's style.

- **Info row:** directory · git user · branch with commits ahead/behind its upstream and uncommitted files, Node version at the right. Whatever a machine cannot tell (no git, no upstream, no node) is left out.
- **Tasks:** Clawd walks while Claude works and blinks while it waits, beside a dithered progress bar fed by Claude's own task list (`TaskCreate`, `TaskUpdate`, `TodoWrite`).
- **Usage cards:** Context as `434.5k / 1M (43%)`, 5H Limit and 7D All with reset countdowns; amber from 70%, red from 90%. Plan limits show once Claude Code has a reading for them.
- **Skins:** `/sabai-skin [name]` — `auto` (follows the OS), Catppuccin Latte / Frappé / Macchiato / Mocha, Dracula, Tokyo Night, Nord, Gruvbox Dark, Rosé Pine. Remembered across sessions.
- **Agents panel:** `/sabai-agents` shows or hides a panel with a Clawd per subagent — running ones first, then finished — with its task, type, model, model requests, context and elapsed time. Failed runs are marked ✗.
- In a terminal the same rows are drawn as text.

Everything comes from Claude Code itself and the project's own `git`; the mod reads no other files and no credentials.

## Install

In a terminal Claude Code session:

```
/plugin install sabai-band --marketplace panupat-top/claude-sabai
```

## Develop

```bash
claude --plugin-dir plugins/sabai-band
```

Once Claude Code has loaded the mod it writes the API types beside it (`.claude-plugin/types/`), which `plugins/sabai-band/tsconfig.json` extends.

Turn on the pre-commit hook once per clone; it validates, type-checks (once the mod has loaded) and tests every mod before a commit that touches one:

```bash
git config core.hooksPath .githooks
```

CI validates and tests on every push. It cannot type-check: Claude Code publishes the mod API types only beside a loaded mod.

## Credits

Built by reading [hellosverre/claude-skins](https://github.com/hellosverre/claude-skins),
[JohnnyVizz/claude-kit](https://github.com/JohnnyVizz/claude-kit) (Pixel Clawd, after DockCrab) and
[data-goblin/claude-code-filetree](https://github.com/data-goblin/claude-code-filetree) (all MIT).

Info-row marks: folder and branch from [Octicons](https://github.com/primer/octicons) (MIT); the Git and Node.js logos from [Simple Icons](https://simpleicons.org) (CC0), trademarks of their owners.

## License

[MIT](LICENSE)
