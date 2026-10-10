# Agents pane redesign — design

Date: 2026-10-10 · Mod: `sabai-band` · Status: approved direction, awaiting spec review

## Goal

Make the agents pane (`/sabai-agents`, the `✻` button) useful, fun and delightful, equally for three jobs: following agents live, reading what they brought back, and seeing how much they used. Inspired by a reference pane with summary cards, per-agent progress and characterful avatars.

## Constraints

- Everything shown comes from the engine; a value it cannot give is hidden, never estimated or faked. No cost (the user chose not to show it; the engine only has a session-wide USD total).
- Desktop: each site is drawn as images plus native Buttons. A Button holds only a text `label`, cannot hold an `Svg`, and is drawn on its own line under an image. A pane's whole tree must stay under 100,000 characters.
- Terminal gets a text version of the same structure. Every skin colours the pane, as it does the band.

## What the engine gives (researched in `index.d.ts`)

| Need | Source |
|---|---|
| Type, description, model | `agent.spawn` (`subagentType`, `description`; result `model`, `agentId`) |
| Effort | `turn.step` input `effort`, with `agentId` |
| Context tokens, step count | `turn.step` result `usage` (already used) |
| An agent's own task list | `tool.call` on `TaskCreate` / `TaskUpdate` / `TodoWrite` carries `e.agentId` when a subagent made the call |
| Result or failure | `turn.complete` with `agentId`: `answer`, `reason` (`answer` / `aborted` / `refusal` / `error`), `durationMs` |

Not available, so out of scope: a run or workflow title, a queue of planned agents, stopping an agent, opening an agent's transcript, per-agent cost.

## Fix that comes first: task routing

The `tool.call` hooks for `TaskCreate` / `TaskUpdate` / `TodoWrite` write the band's task list whatever loop made the call, so a subagent's own TodoWrite replaces the main conversation's progress row. Calls with `e.agentId` go to that agent's run instead; calls without it keep driving the band.

## Data model

`AgentRun` (in `types/index.d.ts`) gains:

- `effort?: string`: the latest `turn.step` effort.
- `tasks: Task[]`: the agent's own list, kept by the existing `created` / `updated` / `fromTodos` reducers and read with `progress()`.
- `result?: string`: `turn.complete`'s `answer`, cut to 600 characters.
- `reason?: 'answer' | 'aborted' | 'refusal' | 'error'`. `status` stays `running | done | failed`.

New pane-only atoms: `finishedOpen` (boolean, default `false`, so Finished starts collapsed) and `openResults` (ids whose result is expanded). Clear removes finished runs from `agents`. The 40-run cap stays.

## Layout (desktop)

1. **Summary**: one SVG of three cards. **Agents**: `1 running · 2 done`. **Context**: the sum of the cards' context tokens. **Time**: from the earliest listed start to now, or to the last end when none runs.
2. **Running · n**: a heading, then one SVG card per running agent.
3. **Finished · n**: a heading row with the Buttons `Clear` and `▾ Hide` / `▸ Show`. When open, at most the 8 newest finished cards, each followed by a `Result ›` / `▾ Result` Button. An expanded result is a wrapped `Text` under its button: the answer, or for a failure its reason. A `+ n more` line counts what is not drawn.
4. **Empty state**: an idle Clawd and one line saying agents show here when Claude hands work to them, with an example prompt.

### Agent card (one SVG, 44px high, full width)

- **Clawd with a hat by agent type**, tinted with the type's colour from the skin's accents. Explore: explorer hat, `context` accent. Plan: hard hat, `session`. general-purpose: cap, `tasks`. claude-code-guide: graduation cap, `week`. Any other type: beanie, `subtext`.
- **Line 1**: the description (bold); the elapsed clock on the right, plus a live dot while running, ✓ when done, ✗ when failed.
- **Line 2**: the effort label (`low` → `quick`, `medium` → `steady`, `high` → `careful`, `xhigh` / `max` → `deep`; omitted when unknown), the type and the model.
- **Line 3**: `3/5 · <current task title>` when the agent keeps a task list, else `n steps`; `<ctx> ctx` on the right.
- **Bar**: in the type's colour, filled to `done/total` when there is a list. With no list it runs as an indeterminate shimmer while running, and is full when done.
- **Motion**: Clawd walks while running. A finished one hops once, drawn only for the first 3 seconds after `endedAt`, since every redraw restarts an image's animation. A failed one shows dizzy ✗ eyes, still. Reduced-motion turns all of it off.

### Terminal

The same groups as text rows: a status glyph in the type colour, description, `effort · type · model`, `3/5 · title` or `n steps`, clock. The Buttons draw as `[ label ]`; the result shows as wrapped dim text.

## Size budget

- `sprite()` merges horizontal runs of same-colour pixels into one `rect`. A Clawd goes from about 14k characters to about 3k; the band and the skin swatches get smaller too.
- Hats are small sprite overlays (a few rects each).
- A test fills the pane with 40 runs (8 drawn as finished, all results open) and asserts the drawn tree is under 100,000 characters.

## Files

- `types/index.d.ts`: the `AgentRun` fields.
- `hooks/agents.ts`: reducers for effort, the agent's tasks, result and reason; `summary()`; `effortLabel()`; `clearFinished()`.
- `hooks/sprites.ts`: run-merged rects, hat overlays, hop and dizzy modes.
- `hooks/svg.ts`: `summarySvg`, `agentCardSvg` (replaces `agentsSvg`'s single drawing).
- `hooks/register.tsx`: task routing by `agentId`; effort, result and reason capture; the two atoms; the pane render (desktop and terminal); Clear, Hide/Show and Result handlers.

## Testing

- Unit (`agents.test.ts`): the effort label map, task reducers per agent, result truncation, `summary()` figures, `clearFinished()`.
- Sprites: a merged Clawd draws the same pixels as before (compare the expanded pixel set) and is under 4k characters.
- Integration (`band.test.tsx`):
  - a subagent's TodoWrite updates its card and leaves the band's row alone;
  - effort from `turn.step` shows its label;
  - `turn.complete` with an answer shows under `Result ›` after a press, and a failure shows its reason;
  - Hide/Show and Clear work;
  - an empty pane shows the tip;
  - 40 runs stay under the tree limit;
  - both surfaces.
- Contrast: card text colours stay ≥ 4.5:1 on every skin (the existing theme test covers the stylesheet).

## Out of scope

Cost; a run title; planned or queued agents; stopping an agent; opening its transcript; sending a follow-up to an agent (offered, not chosen).
