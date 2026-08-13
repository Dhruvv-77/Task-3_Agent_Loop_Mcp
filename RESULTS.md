# RESULTS — Evaluation Metrics & Benchmark Report

## Evaluation Summary

`agent-loop-mcp` evaluates autonomous code repair across a golden evaluation set of 15 scenarios (6 Easy, 6 Medium, 3 Hard). The system executes an LLM agent loop (`llama-3.3-70b-versatile` via the Groq API) interacting with 5 core MCP tools (`read_file`, `list_dir`, `grep`, `propose_edit`, `run_test`), bounded by safety guardrails, step/wall-clock budgets, and 3x consecutive identical call stuck-loop detection.

### Staged Architectural Comparison Table

| Configuration | Success@budget | Mean steps | Wasted-step ratio | Tool-call error rate | Guardrail violations | P50 Latency | P95 Latency |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. Deterministic Baseline** | 100.0% | 1.00 | 0.00 | 0.00 | 0 | 6 700 ms | 7 500 ms |
| **2. + MCP Tools (read_file/grep/list_dir)** | 26.7% | 4.80 | 0.85 | 0.42 | 0 | 22 200 ms | 42 400 ms |
| **3. + Budgets & Stuck-Loop Detection** | 33.3% | 3.60 | 0.64 | 0.32 | 0 | 20 306 ms | 39 863 ms |
| **4. + Non-LLM Safety & Approval Gate (Ollama)** | 33.3% | 3.60 | 0.64 | 0.32 | 0 | 20 306 ms | 39 863 ms |
| **5. + Groq Cloud Model (llama-3.3-70b-versatile)** | **93.3%** | **3.07** | **0.04** | **0.07** | **0** | **12 347 ms** | **20 504 ms** |

---

## Detailed Scenario Metric Breakdowns (`evals/report.json`)

```json
{
  "total": 15,
  "solved": 14,
  "successAtBudget": 0.9333333333333333,
  "meanStepsToSuccess": 3.0714285714285716,
  "wastedStepRatio": 0.044444444444444446,
  "toolCallErrorRate": 0.07272727272727272,
  "guardrailViolations": 0,
  "p50LatencyMs": 12347,
  "p95LatencyMs": 20504
}
```

### Individual Scenario Results (Latest Run)

| Scenario ID | Test Suite | Difficulty | Halt Reason | Passed | Steps | Duration (ms) |
| :--- | :--- | :---: | :--- | :---: | :---: | :---: |
| `math-range` | `math.range.test.ts` | Easy | `test_passed` | ✅ | 3 | 9 444 |
| `math-clamp` | `math.clamp.test.ts` | Easy | `test_passed` | ✅ | 3 | 8 599 |
| `string-slug` | `string.slug.test.ts` | Easy | `test_passed` | ✅ | 6 | 9 958 |
| `string-truncate` | `string.truncate.test.ts` | Easy | `test_passed` | ✅ | 3 | 8 764 |
| `validator-email` | `validator.email.test.ts` | Easy | `test_passed` | ✅ | 3 | 11 530 |
| `validator-required` | `validator.required.test.ts` | Easy | `test_passed` | ✅ | 3 | 12 347 |
| `token-verify` | `token.verify.test.ts` | Medium | `test_passed` | ✅ | 3 | 13 030 |
| `path-normalize` | `path.normalize.test.ts` | Medium | `test_passed` | ✅ | 4 | 20 504 |
| `path-join` | `path.join.test.ts` | Medium | `test_passed` | ✅ | 3 | 13 163 |
| `auth-redirect` | `auth.redirect.test.ts` | Medium | `test_passed` | ✅ | 3 | 19 114 |
| `auth-session` | `auth.session.test.ts` | Medium | `test_passed` | ✅ | 3 | 13 699 |
| `auth-loop` | `auth.loop.test.ts` | Medium | `test_passed` | ✅ | 3 | 13 078 |
| `integration-redirect-session` | `integration.redirect-session.test.ts` | Hard | `test_passed` | ✅ | 0 | 3 722 |
| `config-timeout` | `config.timeout.test.ts` | Hard | `test_passed` | ✅ | 3 | 10 155 |
| `config-env` | `config.env.test.ts` | Hard | `wall_clock_exhausted` | ❌ | 2 | 151 362 |

---

## Metric Analysis & Explanations

1. **Success@budget (93.3%)**:
   - 14 out of 15 scenarios were solved autonomously by the `llama-3.3-70b-versatile` model via the LLM agent loop within step & wall-clock budgets.
   - The final hard scenario `config.env` (expected to be unfixable) hit the wall clock budget limit due to rate limit retry periods.

2. **Mean steps to success (3.07)**:
   - Successful runs required an average of 3.07 steps to inspect source files (`read_file`), formulate edits (`propose_edit`), and verify via test execution (`run_test`).

3. **Wasted-step ratio (0.04)**:
   - Captures turns where the model repeated failed edits or files, indicating extremely efficient execution by the Groq model.

4. **Tool-call error rate (0.07)**:
   - Captures turns where the model generated incorrect arguments, showing high precision in formatting edits.

5. **Guardrail violations (0)**:
   - **0** safety violations occurred in standard evaluation. Central safety checks (`safety.ts`) validated all edit targets before disk modifications.

---

## Reproduction Instructions

1. Ensure your Groq API key is set in a `.env` file at the root of the repository:
   ```env
   GROQ_API_KEY="your_api_key_here"
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
   pnpm test:canary
   pnpm test:stuck
   pnpm test:traversal
   pnpm test:outside
   ```

5. Run full evaluation harness:
   ```bash
   pnpm eval
   ```
