---
name: executor-plan-pitfalls
description: Recurring pitfalls when writing or reviewing handover plans / pre-commit reviews in this repo (Windows + Git Bash, agy CLI, dev port 5174, capture-screens evidence)
metadata:
  type: project
---

Plans for weaker executors in StoryTools need: shell vars re-declared in every tool call (state does not persist), servers started via run_in_background (not `&`; `$!` is an MSYS PID useless for taskkill, use `netstat -ano` PID), temp servers on a port other than 5174 (user's `.env` sets PORT=5174), and baseline/worktree servers started from the repo root because `.env` is gitignored and `server/index.js` loads `dotenv/config` from cwd.

Pre-commit reviews: compare `ls --time-style=full-iso` mtimes of src files against `plans/**/screens/*.log` before trusting "evidence is fresh" — on 2026-10-25 styles.css was saved after the last capture run, and `screens/view/*.jpg` were hours stale. `plans/**/screens/` is gitignored, so look at the fresh PNGs, not view JPGs. Watch for CSS tuned to pass `height-*` limits in capture-screens.mjs (limits were designed for 1440px).

**Why:** Reviewed plan `plans/261023-1453-character-consistency-prompts` on 2026-10-23 and the UI polish diff on 2026-10-25; these were the concrete defects found. User prefers Vietnamese-language output with mechanically decidable Verify steps.

gflow-cli 0.90.0 (installed at `~/AppData/Roaming/uv/tools/gflow-cli/Lib/site-packages/gflow_cli`): with `--json` the failure envelope `{status:"fail", error:{title, detail, remediation_hint, class, exit_code, retryable}}` goes to STDOUT; stderr only carries structlog JSON (`event:"error_raised"`). Exit codes: 3 auth expired, 4 rate limit, 5 content policy, 8 auth missing, 11 config (project-not-found has `reason=project` in detail; ProfileLocked is also 11), 37 insufficient credits. Spike `out-reuse/` dirs held signed `fife_url`s and were not covered by `.gitignore` (2026-10-26).

Outfits/assets feature review (2026-10-26): agy hit "Individual quota reached, resets in 148h" that day, so the costume-director endpoint (`/outfits/plan`) was only verified via `E2E_MANUAL=1` (no live LLM run). Recurring defect class here: long AI calls (planner up to 420 s) whose result is merged with `update(cur => …)` but overwrites whole lists (outfits/assets) while the UI leaves inputs/draw buttons enabled — check merge-vs-replace first.

**How to apply:** Check these items first; verify test counts by running `npm test` (38 tests as of 2026-10-26).
