---
title: Polish dark studio UI and run 15-slide funny story
date: 2026-10-25
summary: "Fixed 4 UX polish items and narrow compose sidebar, extended screen checks to landscape/narrow/empty/focus, finished a 15-slide funny story despite agy image quota exhaustion"
---

# Polish dark studio UI and run 15-slide funny story

## What happened
- Fixed four UX audit polish items, all in src/:
  - the remove-image button is now larger;
  - the compose help text is folded away;
  - the frames step uses a two-column card on an auto-fit grid;
  - disabled copy buttons now show a hint.
- `.compose-side` is no longer sticky below 1000px.
- capture-screens.mjs gained `--story`, `--width`, `--base` and `--empty` modes, plus `no-hscroll` and `focus-visible` checks. All four cases report 0 failed checks: portrait 1440, landscape 1440, 900px and empty data.
- The first UI subagent died mid-task on an OAuth expiry. Its edits survived, and the work was verified and finished in the main session.
- Kongming (opus, high) gave GO-with-edits:
  - reverted an out-of-scope `.setup-grid` breakpoint change that clipped text at 900px;
  - scoped the page-height budgets to widths of 1200px and above, instead of changing the layout to pass;
  - stopped relying on screenshots taken before the final edits.
- The 15-slide funny story (24 frames) completed with every frame drawn and bubbled. agy image quota ran out from slide 7, so run-test-job.mjs gained resume (`TEST_PROJECT_ID`) and patient retries. The run took about 8 hours.
- Stopped a stale `npm run dev` tree started on 2026-10-23 that held no port.

## Decision
- Height budgets stay as desktop-only limits. Narrow widths log INFO lines instead.

## Next steps
- Make the "Tải ảnh lên" label keyboard reachable.
- Fix frame cards being squeezed below about 600px wide.
- Make the focus check compare focus and blur styles.
- Consider dropping the backpack from Minh's description for home scenes.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
