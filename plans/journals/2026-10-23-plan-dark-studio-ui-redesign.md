---
title: Plan dark studio UI redesign
date: 2026-10-23
summary: 6-phase handover plan with a mechanical UI check tool for the StoryTools redesign
---

# Plan dark studio UI redesign

## What happened
- The user found the UI sparse and unintuitive. Brainstorm decisions: redo layout and visuals, dark studio theme, all screens, plain CSS, no server/api/hooks/existing lib changes.
- Wrote `plans/261023-1714-ui-redesign/capture-screens.mjs`. It drives headless Chrome over CDP, with no extra dependency.
  - It captures 7 screens.
  - It checks visible labels, WCAG contrast, page heights, stepper state, compose canvas geometry, and a real double-click bubble-editor alignment.
  - Optional `--auto-run` runs "Tự động tạo cả truyện" through the UI (1 image, 1 frame) and deletes its own test story.
- Baseline on the current UI:
  - PASS: labels, geometry, bubble alignment, auto-run.
  - FAIL, as expected: contrast (white on orange is about 4.0), script page 2479px, frames page 2815px, no stepper.
- The API died once because the `npm run dev` wrapper was killed at the 30-minute background limit, so the API was restarted.

## Decision
- Six phases, each gated by the capture tool and committed separately:
  1. tokens, shell and stepper;
  2. project list, characters and settings;
  3. script step;
  4. frames step;
  5. compose and publish;
  6. audit, docs and final checks.
- Stepper state comes from a new pure `src/lib/step-status.js`. Its tests already pass, and it gives the right result on the real test story.
- Kongming review edits applied:
  - a dark-background contrast rule;
  - `.topbar` min-height 52px for the sticky toolbar;
  - `auto-fill` grid guard;
  - inset shadow instead of a border on the canvas wrap, so the bubble editor does not shift;
  - no `--auto-run` in phase 5.

## Next steps
- Execute with `/ak-cook --advice plans/261023-1714-ui-redesign/plan.md`.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
