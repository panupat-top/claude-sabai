# claude-sabai

Claude Code mods for the desktop Code tab, in Thai and English. Needs Claude Code 2.1.287 or later.

| Mod | What it does | Status |
|---|---|---|
| `sabai-spinner` | Spinner words in Thai or English | skeleton |

Plan and feature catalog: [docs/PLAN.md](docs/PLAN.md).

## Install

In a terminal Claude Code session:

```
/plugin install sabai-spinner --marketplace panupat-top/claude-sabai
```

## Develop

```bash
claude --plugin-dir plugins/sabai-spinner
```

Turn on the pre-commit hook once per clone; it validates and tests every mod before a commit that touches one:

```bash
git config core.hooksPath .githooks
```

## Credits

Built by reading [hellosverre/claude-skins](https://github.com/hellosverre/claude-skins),
[JohnnyVizz/claude-kit](https://github.com/JohnnyVizz/claude-kit) and
[data-goblin/claude-code-filetree](https://github.com/data-goblin/claude-code-filetree) (all MIT).

## License

[MIT](LICENSE)
