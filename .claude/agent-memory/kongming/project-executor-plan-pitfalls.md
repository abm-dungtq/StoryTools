---
name: executor-plan-pitfalls
description: Recurring pitfalls when writing handover plans for weaker executor models in this repo (Windows + Git Bash, agy CLI, dev port 5174)
metadata:
  type: project
---

Plans for weaker executors in StoryTools need: shell vars re-declared in every tool call (state does not persist), servers started via run_in_background (not `&`; `$!` is an MSYS PID useless for taskkill, use `netstat -ano` PID), temp servers on a port other than 5174 (user's `.env` sets PORT=5174), and baseline/worktree servers started from the repo root because `.env` is gitignored and `server/index.js` loads `dotenv/config` from cwd.

**Why:** Reviewed plan `plans/261023-1453-character-consistency-prompts` on 2026-10-23; these were the concrete defects found. User prefers Vietnamese-language plans with mechanically decidable Verify steps and a kongming Failure Protocol.

**How to apply:** When reviewing or drafting executor plans here, check these four items first; verify test counts by running `npm test` (10 tests as of 2026-10-23).
