---
phase: 1
title: "Khởi tạo git và commit trạng thái hiện tại"
status: pending
depends_on: []
---

# Phase 1 — Khởi tạo git

## Mục tiêu

Có một commit chứa đúng trạng thái trước khi sửa, để phase 5 dựng lại code cũ bằng `git worktree` và để mọi thay đổi sau này xem lại được.

## File

- Tạo `.git/` ở `D:\TQD\StoryTools`. Không sửa file mã nguồn nào.

## Tasks

### Task 1.1 — Kiểm `.gitignore` trước khi add

- **Goal:** chắc chắn dữ liệu thật và file bí mật không vào git.
- **Target:** `D:\TQD\StoryTools\.gitignore`.
- **Steps:**
  1. Chạy `cat .gitignore` từ thư mục dự án.
  2. File phải có đủ 4 dòng `node_modules/`, `dist/`, `data/`, và dòng tên file biến môi trường (dấu chấm + `env`). Không sửa file.
- **Success criteria:** cả 4 dòng có mặt.
- **Verify:** `grep -c -E '^(node_modules/|dist/|data/)$' .gitignore` in ra `3`. Nếu khác `3`, áp dụng Failure Protocol.

### Task 1.2 — `git init` và commit

- **Goal:** repo có đúng một commit.
- **Steps:**
  1. `git init -b main`
  2. `git add -A`
  3. `git status --porcelain | grep -E '^A  (data/|node_modules/|dist/)' | head -1` phải không in gì. Nếu in ra dòng nào, dừng (Failure Protocol).
  4. `git status --porcelain | grep -i -E 'settings\.json|\.env$'` phải không in gì (`.env.example` được phép). Nếu in ra dòng nào, dừng.
  5. `git commit -m "chore: snapshot before character consistency work"` (không thêm dòng nhắc tới AI).
  6. Ghi lại hash: `git rev-parse HEAD > plans/261023-1453-character-consistency-prompts/baseline-commit.txt`.
- **Success criteria:** một commit, `baseline-commit.txt` chứa 40 ký tự hex.
- **Verify:** `git log --oneline | wc -l` in ra `1`, và `wc -c < plans/261023-1453-character-consistency-prompts/baseline-commit.txt` in ra `41`.

## Failure Protocol
If any Verify step does not meet its stated pass condition, STOP this phase.
Do not improvise a fix, retry blindly, or reason around the failure.
Spawn the `kongming` subagent for next-step counsel and pass:
- the phase and task id,
- what you attempted (the steps you ran),
- the exact command and its full output,
- the pass condition it failed to meet.
Apply kongming's guidance, then re-run the Verify step.
If `kongming` cannot be spawned in this environment, STOP and report the same
failure evidence to the user. Never continue by self-reasoning.
