---
name: lean-swarm
description: >-
  Use this skill whenever running `/swarm`, orchestrating multi-agent tasks, or when
  the user wants to minimize token and quota burn during parallel audits, refactors,
  or subagent workflows.
---

# Lean Swarm & Token-Budget Playbook

Follow these rules to keep multi-agent runs fast and quota-efficient without sacrificing accuracy.

## 1. Choose the Cheapest Pattern That Fits

- **1–2 targeted tasks or read-only lookups:** Use `invoke_subagent` (prefer `research` for read-only scans) instead of `swarm`.
- **Many uniform, independent checks (no agent-to-agent discussion needed):** Use `run_workflow` to fan out and aggregate instead of a live swarm board.
- **True multi-role collaboration (shared state, handoffs, parallel edits):** Use `swarm`.

## 2. Cap Worker Count & Overhead

- Default to **2–3 workers max** unless the user explicitly asks for more.
- Merge related scopes (e.g., one `backend-audit` worker for both security and bugs) instead of spawning one worker per checklist category.
- Skip optional roles (`monitor`, `narrator`) on small/medium swarms.
- Only spawn a `verifier` worker when files or database records are actually modified—skip it for read-only audits.

## 3. Model Tiering (With User Consent)

- `swarm` workers inherit the coordinator's model unless the user asks for another.
- When the user wants lower token cost, offer or apply a tiered setup (after confirming with the user if not already requested):
  - **Coordinator / final synthesis / complex edits:** Main model.
  - **Read-only scanners, grep/file collectors, or mechanical tasks:** Lighter model (`Model: "flash"` or `"flash_lite"` on `invoke_subagent`, or a lighter model from `swarm(action: "models")` on `swarm add`).

## 4. Tight Scope & Output Budgets in Every Brief

Every worker brief MUST include:
1. **Exact scope:** Specific directories or files owned (never "scan the whole repo").
2. **Bounded reading:** Search first (`rg -n`), then read only relevant line ranges (`StartLine`–`EndLine` <= 150 lines). Do not read entire large files.
3. **Compact report format:** Return only `severity | file:line | issue | 1-line fix`. No prose summaries, no pasted file contents, and no repeated board recaps.

## 5. Board & Wakeup Hygiene

- Always pass the latest seen sequence number to `swarm_wait(since: N)` so you never re-read old messages.
- Direct messages with `@worker` so unrelated workers stay asleep (`waiting` costs 0 tokens).
- For large tasks (e.g., full-repo audit + fixes), **split into phases** (e.g., Phase 1: Backend, pause for user confirmation, Phase 2: Frontend) instead of running everything in one burst.
