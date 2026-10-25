---
title: Cook dark studio UI redesign
date: 2026-10-24
summary: All 6 phases of the StoryTools UI redesign delivered via subagents under kongming supervision
---

# Cook dark studio UI redesign

## What happened
- Ran plans/261023-1714-ui-redesign with one fullstack-developer subagent per phase. Kongming gave a go/no-go after every phase and reviewed the final result.
- Commits:
  - ec3128d: theme and stepper
  - f61e863: story list and characters
  - f982234: script step
  - 091f802: frames step
  - 2a853c1: compose and publish
  - ca41f7e: audit polish
  - 08620b4: docs and plan files
- Final capture run: CHECKS FAILED: 0, including auto-run through the UI.
  - Script page went from 2479px to 1530px.
  - Frames page went from 2815px to 1501px.
  - Every contrast check passes.
- npm test 19/0, build 0. No change to server, api, hooks or existing lib files.

## Lessons
- Chrome returns oklch() computed colors unparsed, so the contrast checker could not read them. Tokens are written as hex, with the oklch value kept in a comment.
- Overwriting a source file with a heredoc while Vite HMR was running served an empty module. Use Edit/Write, or touch the file to recover.
- An unanchored `grep FAIL` also matched the `CHECKS FAILED:` summary line. Anchor it as `^CHECK .* FAIL`.
- `npm run dev` started through the harness background facility was killed at the time limit, so the app was restarted detached with Start-Process and tracked by PID.

## Next steps
- Run the checks on a landscape test story.
- Check the layout at a viewport of about 900px.
- Decide on the 4 polish items the audit left open.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
