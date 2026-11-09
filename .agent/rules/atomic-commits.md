---
description: Enforce atomic, single-purpose git commits and forbid bulk commits or secret leaks.
---

# Git Commit & Security Guardrails (No Bulk Commits)

1. **Never Commit in Bulk:**
   - Do **not** use `git add .`, `git add -A`, or `git commit -a` to dump multiple features, layers, or sprints into a single commit.
   - Stage only the specific files belonging to one logical change (`git add <file1> <file2>`).
   - Keep each commit focused on a single concern (e.g., `docs: add product and implementation specs`, `chore(docker): add hardened compose and env template`, `test(normalizer): add TDD unit tests for EONET payload normalization`, `feat(backend): implement EONET v3 adapter and normalizer`).
   - Do not stage more than 8 files in a single commit, and do not mix `frontend/` and `backend/` implementation changes in the same commit.

2. **Never Commit Secrets:**
   - `.env` must never be staged or committed. Only `.env.example` with placeholder values may be tracked.
   - All commits are validated by `.githooks/pre-commit`.
