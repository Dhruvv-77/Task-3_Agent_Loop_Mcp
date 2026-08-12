# NOTES

## What this project demonstrates

This project was built as a compact benchmark for an autonomous code-repair loop rather than a production-grade coding agent.

The implementation intentionally focuses on:

* deterministic behavior
* reproducible evaluation
* explicit human approval
* safe file modification
* trajectory logging
* measurable benchmark results

The benchmark corpus consists of intentionally broken utilities and authentication helpers that can be repaired through small source-level edits.

## Current limitations

### Deterministic planner

The planner currently maps known benchmark tests to predefined edits.

This makes evaluation reproducible and avoids nondeterminism from LLM output, but it does not generalize to arbitrary codebases.

### Limited file discovery

The loop reads the failing test and a small set of related source files.

A production agent would perform broader dependency discovery and semantic search across the repository.

### No automatic corpus reset

The benchmark corpus remains modified after successful repair.

A stronger evaluation harness would restore a fresh broken copy before each benchmark run so repair metrics remain comparable across repeated executions.

### Minimal patch synthesis

Edits are currently generated from explicit before/after patterns.

A more advanced version could generate patches from:

* AST transformations
* symbolic analysis
* static diagnostics
* LLM reasoning

### Single-agent architecture

The project uses one repair loop.

Possible extensions include:

* planner agent
* code search agent
* patch generation agent
* verification agent
* reviewer agent

## Safety properties

The approval gate intentionally prevents several classes of unsafe behavior.

Rejected automatically:

* edits outside the project root
* path traversal attempts
* patches whose expected text is not present
* malformed file modifications

This provides a simple but useful guardrail before any filesystem write occurs.

## Future improvements

### Semantic retrieval

Index the repository and retrieve relevant files using embeddings rather than deterministic mappings.

### AST-aware editing

Modify syntax trees directly instead of string replacement.

### Better metrics

Record:

* patch size
* token usage
* edit distance
* retry causes
* approval latency

### Parallel investigation

Allow multiple candidate patches to be generated and verified concurrently.

### Automatic benchmark reset

Restore the broken corpus before every evaluation run to obtain meaningful repair iterations and tool-call statistics.

## Repository structure

```text
packages/
  agent/
    src/
      cli.ts
      loop.ts
      planner.ts
      approval.ts
      trajectory.ts
      eval.ts
      tools/
    trajectories/

corpus/
  mini-auth-utils-broken/

evals/
  report.json
```

## Final benchmark result

Latest evaluation:

* **15 / 15 benchmark cases solved**
* **100% pass rate**

The repository is intentionally small enough to understand end-to-end while still demonstrating the complete repair pipeline: test execution, diagnosis, file inspection, approval, patch application, verification, trajectory logging, and evaluation.
