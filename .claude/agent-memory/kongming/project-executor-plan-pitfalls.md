---
name: executor-plan-pitfalls
description: Recurring pitfalls when writing or reviewing handover plans / pre-commit reviews in this repo (Windows + Git Bash, agy CLI, dev port 5174, capture-screens evidence)
metadata:
  type: project
---

Plans for weaker executors in StoryTools need: shell vars re-declared in every tool call (state does not persist), servers started via run_in_background (not `&`; `$!` is an MSYS PID useless for taskkill, use `netstat -ano` PID), temp servers on a port other than 5174 (user's `.env` sets PORT=5174), and baseline/worktree servers started from the repo root because `.env` is gitignored and `server/index.js` loads `dotenv/config` from cwd.

Pre-commit reviews: compare `ls --time-style=full-iso` mtimes of src files against `plans/**/screens/*.log` before trusting "evidence is fresh" — on 2026-10-25 styles.css was saved after the last capture run, and `screens/view/*.jpg` were hours stale. `plans/**/screens/` is gitignored, so look at the fresh PNGs, not view JPGs. Watch for CSS tuned to pass `height-*` limits in capture-screens.mjs (limits were designed for 1440px).

**Why:** Reviewed plan `plans/261023-1453-character-consistency-prompts` on 2026-10-23 and the UI polish diff on 2026-10-25; these were the concrete defects found. User prefers Vietnamese-language output with mechanically decidable Verify steps.

**How to apply:** Check these items first; verify test counts by running `npm test` (19 tests as of 2026-10-25).
