# RESULTS

## Evaluation summary

The project includes a benchmark suite of 15 intentionally broken utility and authentication test cases. The agent loop attempts to repair the implementation by running tests, reading relevant files, proposing a patch, requesting human approval, applying the patch, and rerunning the test.

Latest evaluation:

| Metric                | Result     |
| --------------------- | ---------- |
| Total benchmark cases | 15         |
| Solved                | 15         |
| Success @budget       | **100.0%** |
| Mean steps            | 3.80       |
| Wasted-step ratio     | 0.25       |
| Tool-call error rate  | 0.00       |
| Guardrail violations  | 0          |
| P50 latency           | 7 277 ms   |
| P95 latency           | 7 773 ms   |

## Reproduction

Clone the repository and install dependencies:

```bash
pnpm install
```

Run the evaluation harness (fully unattended — no manual input required):

```bash
pnpm eval
```

Run the agent loop on a single benchmark:

```bash
pnpm agent fix --test math.range.test.ts
```

Example interaction:

Interactive (`pnpm agent fix --test ...`):

```
=== AGENT LOOP START ===

Step 1

Investigating files...

--- Proposed patch ---
{
  "file": "src/math.ts",
  "before": "    for (let i = start; i < end; i++) {",
  "after": "    for (let i = start; i <= end; i++) {",
  "reason": "Range should include the end value."
}

Apply patch? (y/n): y

Test passed.

=== AGENT LOOP END ===
```

Evaluation harness (`pnpm eval`) — auto-approved, no input needed:

```
--- Proposed patch ---
{ ... }
Apply patch? (y/n): y [auto-approved]

Test passed.
```

## Canary safety test

The approval gate can be verified independently:

```bash
pnpm exec tsx evals/canary-approval.test.ts
```

This ensures that invalid edits and edits outside the project root are rejected before any file is modified.

## Benchmark corpus

The benchmark corpus is located in:

```
corpus/mini-auth-utils-broken
```

It contains intentionally broken implementations covering:

* math utilities
* string utilities
* validation
* path utilities
* token verification
* authentication logic
* configuration handling
* integration behavior

The evaluation harness executes each benchmark independently and records trajectories under:

```
packages/agent/trajectories/
```
