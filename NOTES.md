# NOTES — agent-loop-mcp

## 1. Why MCP over Ad-Hoc JSON Function Calling
The Model Context Protocol (MCP) provides a standardized, schema-driven tool interface over stdio JSON-RPC. Using MCP decouples tool execution and path safety from agent logic, allowing tools (`read_file`, `list_dir`, `grep`, `propose_edit`, `run_test`) to be exposed securely to any LLM client or IDE integration without giving arbitrary shell permissions.

## 2. Stuck-Loop Detector Findings
In early evaluation runs with small local models like `qwen2.5:3b-instruct`, models occasionally enter repetitive loops (e.g. repeatedly calling `read_file` on the same file when uncertain how to proceed). The 3-consecutive-identical-call detector (`sameCallCount >= 3`) catches this behavior early, triggering a clean `stuck_loop` halt at step 3 instead of wasting the full 12-step budget.

## 3. Groq API `llama-3.3-70b-versatile` Reliability
- **Tool Calling**: The Groq API performs well when system prompts strictly enforce single tool call JSON output formatting. Enabling JSON Mode (`response_format: { type: "json_object" }`) ensures valid JSON structure.

## 4. Safety Guardrails & Canary Tests
The approval gate in `approval.ts` relies on `safety.ts` to enforce non-LLM safety checks before prompting or auto-approving:
- Path traversal (`../`, `../../`) and forbidden directories (`node_modules`, `evals`) are rejected immediately.
- Edit proposals must contain exact `before` snippet matches; missing snippets trigger `SafetyError` and log `approval_gate_violation`.
- `evals/canary-approval.test.ts` programmatically verifies that safety violations abort execution.

## 5. Outside-Tool-Surface Scenarios
For hard scenarios where the root cause lies outside the tool surface (e.g. missing environment variables in `config.env.test.ts`), the agent is instructed to report `unfixable_reported` rather than fabricating invalid source edits.
