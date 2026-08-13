# agent-loop-mcp

A lightweight autonomous code-repair agent built as an internship project.

The agent runs a loop: it executes a failing test, reads the relevant source file,
proposes a patch, requests human approval, applies the patch, and re-runs the test.
The loop continues until the test passes or the step budget is exhausted.

## Quick start

```bash
pnpm install

# Fix a single failing benchmark test (interactive y/n approval)
pnpm agent fix --test math.range.test.ts

# Run the full evaluation harness unattended (auto-approved)
pnpm eval

# Start the MCP stdio server
pnpm mcp
```

## About the benchmark planner

The benchmark planner (`packages/agent/src/planner.ts`) is **deterministic**.

Each test case maps to a hardcoded `before` / `after` patch that was written by hand
to fix the corresponding bug in the benchmark corpus. The planner does not use an LLM
or any form of autonomous reasoning — it looks up the right patch by test name.

This is intentional. The project focuses on:

- **Agent loop** — the step-by-step run / inspect / patch / verify cycle
- **Safety guardrails** — the approval gate validates that the target text exists in the
  file before any write is allowed; edits outside the corpus root are rejected
- **MCP integration** — the agent exposes `read_file`, `grep`, `run_test`, and
  `fix_test` tools via the Model Context Protocol stdio server
- **Trajectory logging** — every agent action is appended to a JSONL log for later
  analysis and metric computation
- **Evaluation infrastructure** — the harness resets the corpus before each test,
  applies patches, verifies results, and produces a structured `evals/report.json`

The deterministic planner keeps benchmark results reproducible and lets the
infrastructure be evaluated independently of any LLM backend.

## Results

See [RESULTS.md](RESULTS.md) for the latest benchmark metrics.

## Design

See [DESIGN.md](DESIGN.md) for the full architecture and component overview.
