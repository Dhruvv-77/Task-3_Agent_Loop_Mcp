# RESULTS

## Evaluation summary

The project includes a benchmark suite of 15 intentionally broken utility and authentication test cases. The agent loop attempts to repair the implementation by running tests, reading relevant files, proposing a patch, requesting human approval, applying the patch, and rerunning the test.

Latest evaluation:

| Metric                | Result     |
| --------------------- | ---------- |
| Total benchmark cases | 15         |
| Solved                | 15         |
| Pass rate             | **100.0%** |
| Average iterations    | 1.00       |
| Average tool calls    | 1.00       |
| Average files read    | 0.00       |
| Average duration      | 6.7 s      |
| Approval rejections   | 0          |

## Reproduction

Clone the repository and install dependencies:

```bash
pnpm install
```

Run the evaluation harness:

```bash
pnpm eval
```

Run the agent loop on a single benchmark:

```bash
pnpm agent fix --test math.range.test.ts
```

Example interaction:

```
=== AGENT LOOP START ===

Step 1
Test failed

Investigating files...

--- Proposed patch ---
{
  "file": "src/math.ts",
  "before": "for (let i = start; i < end; i++) {",
  "after": "for (let i = start; i <= end; i++) {",
  "reason": "Range should be inclusive."
}

Apply patch? (y/n): y

Patch applied successfully.

Re-running test...

Step 2
Test passed.

=== AGENT LOOP END ===
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
