# DESIGN

## Overview

This project implements a lightweight MCP-style autonomous code repair agent that can diagnose failing tests, inspect source files, propose a minimal patch, request human approval, apply the patch safely, and rerun the test until it passes or the step budget is exhausted.

The implementation is intentionally compact and deterministic so the behavior is reproducible across benchmark runs.

## Architecture

```text
                +----------------------+
                |      CLI             |
                | pnpm agent fix ...   |
                +----------+-----------+
                           |
                           v
                +----------------------+
                |      Agent Loop      |
                | runLoop(test)        |
                +----------+-----------+
                           |
        +------------------+------------------+
        |                  |                  |
        v                  v                  v
+---------------+  +----------------+  +------------------+
| Test Runner   |  | Planner         |  | Approval Gate    |
| Vitest        |  | proposeFix()    |  | requestApproval()|
+-------+-------+  +--------+--------+  +---------+--------+
        |                   |                     |
        |                   v                     |
        |         +----------------+              |
        |         | File Tools      |<-------------+
        |         | read / write    |
        |         +--------+--------+
        |                  |
        +------------------+
                           |
                           v
                +----------------------+
                | Trajectory Logger    |
                | JSONL event log      |
                +----------------------+
```

## Components

### CLI

Entry point:

```
packages/agent/src/cli.ts
```

Parses:

```
pnpm agent fix --test math.range.test.ts
```

and invokes:

```
runLoop(testName)
```

### Agent loop

Core implementation:

```
packages/agent/src/loop.ts
```

Workflow:

1. Run the requested test
2. Parse the failure output
3. Read the failing test file
4. Read the relevant source file
5. Ask the planner for a patch
6. Request approval
7. Validate the edit
8. Apply the patch
9. Rerun the test
10. Repeat until success or `MAX_STEPS`

### Planner

File:

```
packages/agent/src/planner.ts
```

The planner is deterministic and benchmark-oriented. It maps known benchmark tests to minimal source-level edits.

Example:

```ts
{
  file: "src/math.ts",
  before: "for (let i = start; i < end; i++) {",
  after: "for (let i = start; i <= end; i++) {",
  reason: "Range should be inclusive."
}
```

### Approval gate

File:

```
packages/agent/src/approval.ts
```

Before any write occurs:

* path traversal is rejected
* edits outside the project root are rejected
* the expected `before` text must exist
* invalid patches throw an approval violation

This prevents accidental or malicious modifications.

### File tools

Files:

```
packages/agent/src/tools/readFile.ts
packages/agent/src/tools/writeFile.ts
```

These act as the MCP-style tool interface exposed to the agent loop.

### Trajectory logging

File:

```
packages/agent/src/trajectory.ts
```

Each run writes JSONL events such as:

```json
{
  "step": 1,
  "action": "run_test",
  "success": false
}
```

Separate trajectory files are generated per benchmark test.

## Evaluation harness

Entry point:

```
packages/agent/src/eval.ts
```

The harness executes all benchmark cases, records execution statistics, and writes:

```
evals/report.json
```

Metrics include:

* pass rate
* duration
* iterations
* tool calls
* files read
* approval rejections

## Safety model

The project intentionally includes a review gate before any file mutation.

Validation occurs prior to user approval so malformed or unsafe edits fail immediately.

A dedicated canary test verifies that approval bypass attempts are detected.

## Benchmark corpus

The benchmark corpus contains intentionally broken implementations of:

* math utilities
* string utilities
* validation
* path utilities
* token verification
* authentication logic
* configuration
* integration behavior

This provides a reproducible environment for measuring autonomous repair performance.

## Design tradeoffs

### Chosen

* deterministic planner
* explicit approval gate
* minimal dependencies
* reproducible benchmark corpus
* JSONL trajectories

### Not chosen

* unrestricted LLM editing
* arbitrary filesystem writes
* automatic approval
* network-dependent execution

The goal of the project is reliable evaluation rather than unrestricted autonomous coding.
