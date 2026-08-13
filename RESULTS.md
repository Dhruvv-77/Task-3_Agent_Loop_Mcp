# RESULTS — Evaluation Metrics & Benchmark Report

## Evaluation Summary

`agent-loop-mcp` evaluates autonomous code repair across a golden evaluation set of 15 scenarios (6 Easy, 6 Medium, 3 Hard). The system executes an LLM agent loop (`qwen2.5:7b-instruct` via local Ollama) interacting with 5 core MCP tools (`read_file`, `list_dir`, `grep`, `propose_edit`, `run_test`), bounded by safety guardrails, step/wall-clock budgets, and 3x consecutive identical call stuck-loop detection.

### Staged Architectural Comparison Table

| Configuration | Success@budget | Mean steps | Wasted-step ratio | Tool-call error rate | Guardrail violations | P50 Latency | P95 Latency |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. Deterministic Baseline** | 100.0% | 1.00 | 0.00 | 0.00 | 0 | 6 700 ms | 7 500 ms |
| **2. LLM Loop (`qwen2.5:3b-instruct`)** | 33.3% | 3.60 | 0.64 | 0.32 | 0 | 20 306 ms | 39 863 ms |
| **3. LLM Loop (`qwen2.5:7b-instruct`)** | **66.7%** | **2.80** | **0.33** | **0.15** | **0** | **14 272 ms** | **57 819 ms** |

---

## Detailed Scenario Metric Breakdowns (`evals/report.json`)

```json
{
  "total": 15,
  "solved": 10,
  "successAtBudget": 0.6666666666666666,
  "meanStepsToSuccess": 2.8,
  "wastedStepRatio": 0.3287671232876712,
  "toolCallErrorRate": 0.1527777777777778,
  "guardrailViolations": 0,
  "p50LatencyMs": 14272,
  "p95LatencyMs": 57819
}
```

### Individual Scenario Results (`qwen2.5:7b-instruct`)

| Scenario ID | Test Suite | Difficulty | Halt Reason | Passed | Steps | Duration (ms) |
| :--- | :--- | :---: | :--- | :---: | :---: | :---: |
| `math-range` | `math.range.test.ts` | Easy | `stuck_loop` | ❌ | 6 | 38 630 |
| `math-clamp` | `math.clamp.test.ts` | Easy | `test_passed` | ✅ | 4 | 17 445 |
| `string-slug` | `string.slug.test.ts` | Easy | `stuck_loop` | ❌ | 7 | 30 513 |
| `string-truncate` | `string.truncate.test.ts` | Easy | `test_passed` | ✅ | 3 | 14 165 |
| `validator-email` | `validator.email.test.ts` | Easy | `test_passed` | ✅ | 3 | 14 254 |
| `validator-required` | `validator.required.test.ts` | Easy | `step_budget_exhausted` | ❌ | 13 | 57 819 |
| `token-verify` | `token.verify.test.ts` | Medium | `test_passed` | ✅ | 3 | 13 819 |
| `path-normalize` | `path.normalize.test.ts` | Medium | `step_budget_exhausted` | ❌ | 13 | 74 747 |
| `path-join` | `path.join.test.ts` | Medium | `test_passed` | ✅ | 3 | 13 063 |
| `auth-redirect` | `auth.redirect.test.ts` | Medium | `test_passed` | ✅ | 3 | 14 208 |
| `auth-session` | `auth.session.test.ts` | Medium | `test_passed` | ✅ | 3 | 13 310 |
| `auth-loop` | `auth.loop.test.ts` | Medium | `test_passed` | ✅ | 3 | 14 272 |
| `integration-redirect-session` | `integration.redirect-session.test.ts` | Hard | `test_passed` | ✅ | 0 | 3 709 |
| `config-timeout` | `config.timeout.test.ts` | Hard | `test_passed` | ✅ | 3 | 14 921 |
| `config-env` | `config.env.test.ts` | Hard | `stuck_loop` | ❌ | 6 | 26 002 |

---

## Comparative Analysis: 3B vs. 7B Model Performance

1. **Success@budget (+100% Improvement)**:
   - Increasing model capacity from `3b-instruct` to `7b-instruct` boosted autonomous repair success rate from **33.3% (5/15)** to **66.7% (10/15)**.
   - Newly passing suites include `math.clamp`, `string.truncate`, `token.verify`, `path.join`, `auth.redirect`, `auth.session`, `auth.loop`, and `config.timeout`.

2. **Tool-Call Error Rate (Cut in Half from 0.32 to 0.15)**:
   - The 7B model is significantly better at formatting exact `before` lines from source files, preventing `SnippetNotFoundError` tool errors.

3. **Wasted-Step Ratio (Reduced from 0.64 to 0.33)**:
   - 7B required fewer trial-and-error turns, completing successful fixes in an average of **2.80 steps** (down from 3.60 steps).

4. **Guardrail Violations (Maintained at 0)**:
   - 0 path traversal or forbidden directory violations occurred across all evaluations.

---

## Reproduction Instructions

1. Ensure local Ollama is running with `qwen2.5:7b-instruct`:
   ```bash
   ollama pull qwen2.5:7b-instruct
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Run TypeScript typecheck:
   ```bash
   pnpm exec tsc --noEmit
   ```

4. Run executable safety & canary tests:
   ```bash
   pnpm test
   ```

5. Run full evaluation harness:
   ```bash
   pnpm eval
   ```
