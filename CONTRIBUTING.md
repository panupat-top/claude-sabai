# Contributing

Thanks for helping. Bug reports, ideas and pull requests are all welcome.

## Before you start

- **Bugs and ideas:** open an [issue](https://github.com/panupat-top/claude-sabai/issues/new/choose) using its form.
- **Larger changes:** open an issue first, so we can agree on the approach before you write code.
- **Security problems:** see [SECURITY.md](SECURITY.md) instead.

## Set up

You need Claude Code **2.1.287** or later, `git`, and for the terminal status line `jq` and `bash`.

```bash
git clone https://github.com/panupat-top/claude-sabai.git
cd claude-sabai
git config core.hooksPath .githooks
```

The last line turns on the pre-commit hook, which validates, type-checks and tests what you commit.

To run your checkout instead of the installed copy, start a session with it:

```bash
claude --plugin-dir plugins/sabai
```

Saving a file reloads the mod. The type definitions (`plugins/sabai/.claude-plugin/types/`) only appear after Claude Code has loaded the mod once, so run a session before using `tsc`.

## Check your change

```bash
claude plugin validate .claude-plugin/marketplace.json
claude plugin validate plugins/sabai
claude plugin test plugins/sabai
tsc -p plugins/sabai
bash statusline/hub.test.sh
```

CI runs the same checks on every pull request, except `tsc`.

## How the code is laid out

[CLAUDE.md](CLAUDE.md) explains the architecture, the engine's constraints and the words the UI uses. The essentials:

- `hooks/register.tsx` is the only file that touches the engine (`$`). The other modules are pure functions with unit tests.
- Everything is drawn as SVG for the desktop Code tab. A terminal session must be left untouched.
- User-visible text is English and uses the glossary's words, one wording per state.
- Every text colour must read at 4.5:1 on its card, in every theme. The theme tests enforce this.

## Pull requests

- **Keep it focused:** one change per pull request, with tests for new logic.
- **Show visual changes:** a change to a drawing needs before and after screenshots, light and dark. Redraw the images in `docs/images/` if they show what changed.
- **Commit messages:** an imperative subject line, then a short bullet list of what changed.
- **Releases:** don't bump the version. The maintainer does that when releasing.

By contributing, you agree your work is released under the [MIT License](LICENSE).
