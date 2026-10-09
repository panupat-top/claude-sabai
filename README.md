# claude-sabai

Claude Code mods for the desktop Code tab. Needs Claude Code 2.1.287 or later.

| Mod | What it does | Status |
|---|---|---|
| `sabai-spinner` | Spinner words in Thai or English; set `words` (`auto` · `th` · `en` · `off`) in `/config` | beta |
| `sabai-band` | Pixel-art band above the prompt in savvy-progress's style: a task progress bar fed by Claude's own task list, an info row (directory · git user · branch ± uncommitted files, node at the right), and Context (`434.5k / 1M (43%)`) · 5H Limit · 7D All · 7D <model> meters with reset countdowns. Text meters in a terminal. `/sabai-skin [name]` picks a skin (auto, Catppuccin Latte/Frappé/Macchiato/Mocha, Dracula, Tokyo Night, Nord, Gruvbox, Rosé Pine). `/sabai-demo` previews the bar | beta |

Plan and feature catalog: [docs/PLAN.md](docs/PLAN.md).

## Install

In a terminal Claude Code session:

```
/plugin install sabai-spinner --marketplace panupat-top/claude-sabai
```

```
/plugin install sabai-band --marketplace panupat-top/claude-sabai
```

## Notes

`sabai-band`'s 7D <model> meter reads the cache an `awesome-statusline`-style status line writes to `$TMPDIR/claude-statusline-usage.json`; without that file the meter is hidden. The mod never reads credentials itself.

## Develop

```bash
claude --plugin-dir plugins/sabai-spinner --plugin-dir plugins/sabai-band
```

Turn on the pre-commit hook once per clone; it validates, type-checks (`tsc`, once the mod has loaded) and tests every mod before a commit that touches one:

```bash
git config core.hooksPath .githooks
```

## Credits

Info-row marks: folder and branch from [Octicons](https://github.com/primer/octicons) (MIT); the Git and Node.js logos from [Simple Icons](https://simpleicons.org) (CC0), trademarks of their owners.


Built by reading [hellosverre/claude-skins](https://github.com/hellosverre/claude-skins),
[JohnnyVizz/claude-kit](https://github.com/JohnnyVizz/claude-kit) and
[data-goblin/claude-code-filetree](https://github.com/data-goblin/claude-code-filetree) (all MIT).

## License

[MIT](LICENSE)
