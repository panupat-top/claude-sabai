# Security policy

## Supported versions

Only the latest release of sabai gets fixes. Update with:

```bash
claude plugin marketplace update claude-sabai
claude plugin update sabai@claude-sabai
```

## Reporting a vulnerability

Please do not open a public issue for a security problem. Report it privately through [GitHub's private vulnerability reporting](https://github.com/panupat-top/claude-sabai/security/advisories/new) instead.

Say what you found, how to reproduce it, and which versions of sabai and Claude Code you used. The maintainer aims to reply within a week. Once it is fixed, the release notes credit you unless you would rather stay anonymous.

## What counts

- **The guard lets a call through that one of its rules is meant to catch.** For example, a way to delete the home folder, force-push `main` or read `.env` that slips past a rule set to Block. The guard is a safety net, not a sandbox, but a bypass of a rule is still worth knowing about.
- **sabai reads, sends or runs something it says it does not.** It reads only what Claude Code gives a mod and runs `git` and `node --version`. Its only network use is Thai summary through Claude Code's own client.
- **Hub misuses its input.** The terminal status line (`statusline/hub.sh`) runs something from the input Claude Code gives it.

Problems in Claude Code itself go to [Anthropic](https://www.anthropic.com/responsible-disclosure-policy).
