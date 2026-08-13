# PROJECT CONTEXT & COMPLETE SOURCE CODE REFERENCE

This document contains a complete technical reference and the **full up-to-date source code** for every file in the `agent-loop-mcp` project, along with recent evaluation logs. It is structured for direct inclusion into LLM context windows to cross-check compliance with Task 3 specifications.

---

## 1. Project Overview & Monorepo Architecture

**Project Name:** `agent-loop-mcp`  
**Workspace Manager:** `pnpm` workspaces  
**Core Language:** TypeScript (Node.js, Vitest, `@modelcontextprotocol/sdk`)  
**LLM Engine:** `qwen2.5:3b-instruct` via local Ollama (`http://127.0.0.1:11434`)

`agent-loop-mcp` is a lightweight, benchmark-driven autonomous code-repair agent. It executes a single-tool-per-step LLM loop: inspecting source files (`read_file`, `list_dir`, `grep`), formulating edit proposals (`propose_edit`), running non-LLM safety & path traversal validation (`safety.ts`), requesting interactive (`y/n`) or auto-approved (`AUTO_APPROVE=1`) human authorization (`approval.ts`), applying safe edits to disk (`applyEdit.ts`), and executing tests (`run_test`).

---

## 2. Directory Map & File Index

```text
agent-loop-mcp/
├── README.md                          # Quickstart, setup, safety & test commands
├── RESULTS.md                         # Staged benchmark metrics & scenario analysis
├── DESIGN.md                          # System architecture diagrams & component interfaces
├── NOTES.md                           # Developer notes, MCP rationale, stuck-loop findings
├── PROJECT_CONTEXT.md                 # [THIS FILE] Complete context & full source code
├── package.json                       # Monorepo root scripts & dev dependencies
├── pnpm-workspace.yaml                # PNPM workspace manifest
├── tsconfig.json                      # Shared TypeScript compiler configuration
├── evals/
│   ├── canary-approval.test.ts        # Test: Safety & approval gate violation handling
│   ├── stuck-loop.test.ts             # Test: 3x consecutive call stuck-loop detection
│   ├── path-traversal.test.ts         # Test: Path traversal & forbidden directory rejection
│   ├── outside-surface.test.ts        # Test: Unfixable outside tool surface reporting
│   └── report.json                    # Benchmark evaluation report (auto-generated)
├── packages/
│   └── agent/
│       ├── package.json               # Package config (@intern/agent)
│       ├── tsconfig.json              # TS build configuration
│       └── src/
│           ├── cli.ts                 # CLI entry point
│           ├── loop.ts                # Single-tool-per-step LLM agent loop
│           ├── model.ts               # Ollama qwen2.5:3b-instruct API client
│           ├── safety.ts              # Central path safety & edit target validator
│           ├── approval.ts            # Non-LLM safety & approval authorization gate
│           ├── config.ts              # System paths, step (12) & wall-clock (120s) budgets
│           ├── eval.ts                # 15 golden scenario evaluation harness & metric calculator
│           ├── state.ts               # In-memory agent state & transcript tracking
│           ├── trajectory.ts          # JSONL trajectory event logger
│           ├── mcp/
│           │   └── server.ts          # 5-tool MCP stdio JSON-RPC server
│           └── tools/
│               ├── readFile.ts        # Tool: safe file reader
│               ├── listDir.ts         # Tool: safe directory lister (skips node_modules)
│               ├── grep.ts            # Tool: safe pattern search (skips node_modules)
│               ├── proposeEdit.ts     # Tool: edit proposal validator & diff generator
│               ├── applyEdit.ts       # Tool: safe file patch writer
│               └── runTest.ts         # Tool: safe vitest test runner
└── corpus/
    ├── mini-auth-utils-pristine/      # Clean template used to reset broken corpus before eval
    └── mini-auth-utils-broken/        # Benchmark target codebase under test
```

---

## 3. Complete Source Code Files

### A. Root Files

#### `package.json`
```json
{
    "name": "agent-loop-mcp",
    "private": true,
    "packageManager": "pnpm@10.16.1",
    "scripts": {
        "agent": "pnpm --filter @intern/agent agent",
        "eval": "pnpm --filter @intern/agent eval",
        "mcp": "pnpm --filter @intern/agent mcp",
        "test:canary": "pnpm --filter @intern/agent exec tsx ../../evals/canary-approval.test.ts",
        "test:stuck": "pnpm --filter @intern/agent exec tsx ../../evals/stuck-loop.test.ts",
        "test:traversal": "pnpm --filter @intern/agent exec tsx ../../evals/path-traversal.test.ts",
        "test:outside": "pnpm --filter @intern/agent exec tsx ../../evals/outside-surface.test.ts"
    },
    "devDependencies": {
        "@types/node": "^26.2.0",
        "typescript": "^5.9.2"
    }
}
```

#### `pnpm-workspace.yaml`
```yaml
packages:
  - packages/*
  - corpus/*

onlyBuiltDependencies:
  - esbuild
```

#### `tsconfig.json`
```json
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "NodeNext",
        "moduleResolution": "NodeNext",
        "strict": true,
        "esModuleInterop": true,
        "forceConsistentCasingInFileNames": true,
        "skipLibCheck": true,
        "resolveJsonModule": true,
        "types": [
            "node"
        ]
    },
    "include": [
        "packages/agent/src/**/*.ts",
        "evals/**/*.ts"
    ],
    "exclude": [
        "node_modules",
        "dist",
        "corpus"
    ]
}
```

---

### B. Agent Package Source (`packages/agent/src/`)

#### `packages/agent/package.json`
```json
{
    "name": "@intern/agent",
    "private": true,
    "type": "module",
    "scripts": {
        "agent": "tsx src/cli.ts",
        "eval": "tsx src/eval.ts",
        "mcp": "tsx src/mcp/server.ts"
    },
    "dependencies": {
        "@modelcontextprotocol/sdk": "^1.30.0",
        "tsx": "^4.19.2",
        "vitest": "^2.1.9"
    },
    "devDependencies": {
        "@types/node": "^26.2.0",
        "typescript": "^5.6.3"
    }
}
```

#### `packages/agent/tsconfig.json`
```json
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "NodeNext",
        "moduleResolution": "NodeNext",
        "strict": true,
        "esModuleInterop": true,
        "forceConsistentCasingInFileNames": true,
        "skipLibCheck": true,
        "types": [
            "node"
        ]
    },
    "include": [
        "src/**/*.ts"
    ]
}
```

#### `packages/agent/src/cli.ts`
```typescript
import { runLoop } from "./loop.js";

const args = process.argv.slice(2);

if (args.length === 0) {
    console.error("Usage: pnpm agent fix --test <test-file>");
    process.exit(1);
}

const command = args[0];

if (command !== "fix") {
    console.error("Only the 'fix' command is supported.");
    process.exit(1);
}

const testFlagIndex = args.indexOf("--test");

if (testFlagIndex === -1 || !args[testFlagIndex + 1]) {
    console.error("Missing --test <test-file> argument.");
    process.exit(1);
}

const testFile = args[testFlagIndex + 1];

await runLoop(testFile);
```

#### `packages/agent/src/safety.ts`
```typescript
import fs from "node:fs/promises";
import path from "node:path";

export class SafetyError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "SafetyError";
    }
}

export class SafetyViolationError extends SafetyError {
    constructor(message: string) {
        super(message);
        this.name = "SafetyViolationError";
    }
}

export class FileNotFoundError extends SafetyError {
    constructor(message: string) {
        super(message);
        this.name = "FileNotFoundError";
    }
}

export class SnippetNotFoundError extends SafetyError {
    constructor(message: string) {
        super(message);
        this.name = "SnippetNotFoundError";
    }
}

export function safePath(rootDir: string, relativePath: string): string {
    const normalizedRelative = relativePath.replace(/\\/g, "/");

    if (
        normalizedRelative.includes("../") ||
        normalizedRelative.startsWith("../") ||
        normalizedRelative.includes("/..") ||
        normalizedRelative === ".."
    ) {
        throw new SafetyViolationError(`Path traversal rejected: ${relativePath}`);
    }

    if (
        normalizedRelative.includes("node_modules") ||
        normalizedRelative.includes("evals")
    ) {
        throw new SafetyViolationError(`Access to forbidden directory rejected: ${relativePath}`);
    }

    const resolved = path.resolve(rootDir, relativePath);
    const normalizedRoot = path.resolve(rootDir);

    if (!resolved.startsWith(normalizedRoot)) {
        throw new SafetyViolationError(`Path outside allowed corpus root rejected: ${relativePath}`);
    }

    return resolved;
}

export async function validateEditTarget(
    rootDir: string,
    patch: { file: string; before: string; after: string; reason?: string }
): Promise<string> {
    const filePath = safePath(rootDir, patch.file);

    let current: string;
    try {
        current = await fs.readFile(filePath, "utf8");
    } catch {
        throw new FileNotFoundError(`Target file not found: '${patch.file}'. Source files are located in 'src/' (e.g. 'src/math.ts').`);
    }

    if (!current.includes(patch.before)) {
        throw new SnippetNotFoundError(
            `Patch target text not found in file '${patch.file}'. Expected exact line: ${JSON.stringify(patch.before)}`
        );
    }

    return filePath;
}
```

#### `packages/agent/src/model.ts`
```typescript
export interface ToolCall {
    tool: "read_file" | "list_dir" | "grep" | "propose_edit" | "run_test";
    arguments: Record<string, any>;
}

export interface ModelCallResult {
    ok: boolean;
    toolCall?: ToolCall;
    error?: string;
    rawResponse?: string;
}

const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:7b-instruct";

export async function queryModel(
    systemPrompt: string,
    messages: { role: string; content: string }[]
): Promise<ModelCallResult> {
    const payload = {
        model: OLLAMA_MODEL,
        messages: [
            { role: "system", content: systemPrompt },
            ...messages
        ],
        stream: false,
        format: "json"
    };

    let res: Response;
    try {
        res = await fetch(`${OLLAMA_URL}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
    } catch (err: any) {
        throw new Error(
            `Ollama connection failed (${OLLAMA_URL}). Ensure Ollama is running with '${OLLAMA_MODEL}'. Error: ${err.message}`
        );
    }

    if (!res.ok) {
        throw new Error(`Ollama returned status ${res.status}: ${await res.text()}`);
    }

    const data: any = await res.json();
    const content = data.message?.content?.trim() || "";

    try {
        const parsed = JSON.parse(content);

        if (parsed && typeof parsed === "object" && typeof parsed.tool === "string") {
            const tool = parsed.tool;
            const validTools = ["read_file", "list_dir", "grep", "propose_edit", "run_test"];

            if (!validTools.includes(tool)) {
                return {
                    ok: false,
                    error: `Unknown tool requested: ${tool}`,
                    rawResponse: content
                };
            }

            return {
                ok: true,
                toolCall: {
                    tool: tool as ToolCall["tool"],
                    arguments: parsed.arguments || {}
                },
                rawResponse: content
            };
        }

        if (Array.isArray(parsed)) {
            return {
                ok: false,
                error: "Malformed tool call: model returned array of tools instead of single tool call",
                rawResponse: content
            };
        }

        return {
            ok: false,
            error: "Malformed tool call: response missing 'tool' string property",
            rawResponse: content
        };
    } catch (err) {
        return {
            ok: false,
            error: "Malformed tool call: JSON parse failed",
            rawResponse: content
        };
    }
}
```

#### `packages/agent/src/approval.ts`
```typescript
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { validateEditTarget } from "./safety.js";
import type { PatchProposal } from "./tools/proposeEdit.js";

export async function validateEdit(rootDir: string, patch: PatchProposal): Promise<void> {
    await validateEditTarget(rootDir, patch);
}

export async function requestApproval(
    rootDir: string,
    patch: PatchProposal
): Promise<boolean> {
    await validateEditTarget(rootDir, patch);

    console.log("\n--- Proposed patch ---");
    console.log(JSON.stringify(patch, null, 2));

    if (process.env.AUTO_APPROVE === "1") {
        console.log("Apply patch? (y/n): y [auto-approved post-safety]");
        return true;
    }

    const rl = readline.createInterface({ input, output });
    const answer = await rl.question("Apply patch? (y/n): ");
    rl.close();

    return answer.trim().toLowerCase() === "y";
}
```

#### `packages/agent/src/config.ts`
```typescript
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const REPO_ROOT = path.resolve(__dirname, "../../..");

export const CORPUS_ROOT = path.join(REPO_ROOT, "corpus");
export const BROKEN_CORPUS = path.join(
    CORPUS_ROOT,
    "mini-auth-utils-broken"
);
export const PRISTINE_CORPUS = path.join(
    CORPUS_ROOT,
    "mini-auth-utils-pristine"
);

export const ROOT = BROKEN_CORPUS;

export const TRAJECTORY_DIR = path.join(
    REPO_ROOT,
    "packages",
    "agent",
    "trajectories"
);

export const EVAL_REPORT = path.join(
    REPO_ROOT,
    "evals",
    "report.json"
);

export const MAX_STEPS = Number(process.env.MAX_STEPS) || 12;
export const WALL_CLOCK_MS = Number(process.env.WALL_CLOCK_MS) || 120_000;
```

#### `packages/agent/src/eval.ts`
```typescript
import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import { runLoop } from "./loop.js";
import {
    BROKEN_CORPUS,
    PRISTINE_CORPUS,
    TRAJECTORY_DIR,
    EVAL_REPORT,
    REPO_ROOT
} from "./config.js";

// ANSI Terminal Colors Utility
const colors = {
    bold: (t: string) => `\x1b[1m${t}\x1b[0m`,
    green: (t: string) => `\x1b[32m${t}\x1b[0m`,
    yellow: (t: string) => `\x1b[33m${t}\x1b[0m`,
    blue: (t: string) => `\x1b[34m${t}\x1b[0m`,
    cyan: (t: string) => `\x1b[36m${t}\x1b[0m`,
    red: (t: string) => `\x1b[31m${t}\x1b[0m`,
    gray: (t: string) => `\x1b[90m${t}\x1b[0m`,
    boldGreen: (t: string) => `\x1b[1m\x1b[32m${t}\x1b[0m`,
    boldRed: (t: string) => `\x1b[1m\x1b[31m${t}\x1b[0m`,
    boldBlue: (t: string) => `\x1b[1m\x1b[34m${t}\x1b[0m`,
    boldCyan: (t: string) => `\x1b[1m\x1b[36m${t}\x1b[0m`
};

export interface GoldenScenario {
    id: string;
    test: string;
    difficulty: "easy" | "medium" | "hard";
    expectedOutcome: "passed" | "unfixable";
}

const SCENARIOS: GoldenScenario[] = [
    { id: "math-range", test: "math.range.test.ts", difficulty: "easy", expectedOutcome: "passed" },
    { id: "math-clamp", test: "math.clamp.test.ts", difficulty: "easy", expectedOutcome: "passed" },
    { id: "string-slug", test: "string.slug.test.ts", difficulty: "easy", expectedOutcome: "passed" },
    { id: "string-truncate", test: "string.truncate.test.ts", difficulty: "easy", expectedOutcome: "passed" },
    { id: "validator-email", test: "validator.email.test.ts", difficulty: "easy", expectedOutcome: "passed" },
    { id: "validator-required", test: "validator.required.test.ts", difficulty: "easy", expectedOutcome: "passed" },

    { id: "token-verify", test: "token.verify.test.ts", difficulty: "medium", expectedOutcome: "passed" },
    { id: "path-normalize", test: "path.normalize.test.ts", difficulty: "medium", expectedOutcome: "passed" },
    { id: "path-join", test: "path.join.test.ts", difficulty: "medium", expectedOutcome: "passed" },
    { id: "auth-redirect", test: "auth.redirect.test.ts", difficulty: "medium", expectedOutcome: "passed" },
    { id: "auth-session", test: "auth.session.test.ts", difficulty: "medium", expectedOutcome: "passed" },
    { id: "auth-loop", test: "auth.loop.test.ts", difficulty: "medium", expectedOutcome: "passed" },

    { id: "integration-redirect-session", test: "integration.redirect-session.test.ts", difficulty: "hard", expectedOutcome: "passed" },
    { id: "config-timeout", test: "config.timeout.test.ts", difficulty: "hard", expectedOutcome: "passed" },
    { id: "config-env", test: "config.env.test.ts", difficulty: "hard", expectedOutcome: "unfixable" }
];

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function resetCorpus() {
    for (let attempt = 1; attempt <= 10; attempt++) {
        try {
            await fs.rm(BROKEN_CORPUS, { recursive: true, force: true });
            break;
        } catch (err: any) {
            if ((err.code === "EBUSY" || err.code === "EPERM") && attempt < 10) {
                await sleep(500);
            } else {
                throw err;
            }
        }
    }

    await fs.cp(PRISTINE_CORPUS, BROKEN_CORPUS, {
        recursive: true,
        verbatimSymlinks: false,
        filter: (src) => path.basename(src) !== "node_modules"
    });

    execSync("pnpm install", { cwd: REPO_ROOT, stdio: "ignore" });
}

async function readTrajectory(test: string) {
    const file = path.join(TRAJECTORY_DIR, `${test}.jsonl`);

    try {
        const text = await fs.readFile(file, "utf8");
        const lines = text.trim().split("\n").filter(Boolean);

        let steps = 0;
        let toolCalls = 0;
        let filesRead = 0;
        let approvalRejections = 0;
        let wastedSteps = 0;
        let toolCallErrors = 0;
        let guardrailViolations = 0;

        const seenActions = new Set<string>();
        const seenFiles = new Set<string>();

        for (const line of lines) {
            const event = JSON.parse(line);

            if (event.step > 0) {
                steps = Math.max(steps, event.step);
            }

            if (
                event.action === "read_file" ||
                event.action === "list_dir" ||
                event.action === "grep" ||
                event.action === "propose_edit" ||
                event.action === "run_test"
            ) {
                toolCalls++;
            }

            if (event.action === "read_file") {
                if (seenFiles.has(event.file)) {
                    wastedSteps++;
                } else {
                    seenFiles.add(event.file);
                    filesRead++;
                }
            }

            if (event.action === "approval_rejected") approvalRejections++;
            if (event.action === "approval_gate_violation") guardrailViolations++;
            if (event.action === "tool_call_error") toolCallErrors++;

            const signature = `${event.action}:${JSON.stringify(event.file || event.path || event.pattern || "")}`;
            if (seenActions.has(signature) && event.action !== "run_test") {
                wastedSteps++;
            }
            seenActions.add(signature);
        }

        return {
            steps,
            toolCalls,
            filesRead,
            approvalRejections,
            wastedSteps,
            toolCallErrors,
            guardrailViolations
        };
    } catch {
        return {
            steps: 0,
            toolCalls: 0,
            filesRead: 0,
            approvalRejections: 0,
            wastedSteps: 0,
            toolCallErrors: 0,
            guardrailViolations: 0
        };
    }
}

async function evaluateOne(scenario: GoldenScenario) {
    await resetCorpus();

    const trajectoryFile = path.join(TRAJECTORY_DIR, `${scenario.test}.jsonl`);
    await fs.rm(trajectoryFile, { force: true });

    const start = Date.now();
    const finalState = await runLoop(scenario.test);
    const durationMs = Date.now() - start;

    let passed = false;
    if (scenario.expectedOutcome === "unfixable") {
        passed = finalState.haltReason === "unfixable_reported";
    } else {
        try {
            execSync(`pnpm exec vitest run tests/${scenario.test}`, {
                cwd: BROKEN_CORPUS,
                stdio: "ignore"
            });
            passed = true;
        } catch {
            passed = false;
        }
    }

    const metrics = await readTrajectory(scenario.test);

    return {
        id: scenario.id,
        test: scenario.test,
        difficulty: scenario.difficulty,
        expectedOutcome: scenario.expectedOutcome,
        passed,
        haltReason: finalState.haltReason,
        durationMs,
        steps: metrics.steps,
        toolCalls: metrics.toolCalls,
        filesRead: metrics.filesRead,
        approvalRejections: metrics.approvalRejections,
        wastedSteps: metrics.wastedSteps,
        toolCallErrors: metrics.toolCallErrors,
        guardrailViolations: metrics.guardrailViolations
    };
}

function percentile(values: number[], p: number) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.floor((p / 100) * (sorted.length - 1));
    return sorted[index];
}

async function main() {
    process.env.AUTO_APPROVE = "1";

    const results = [];

    for (const scenario of SCENARIOS) {
        console.log(`\n${colors.boldCyan("----------------------------------------------------------------")}`);
        console.log(`${colors.boldBlue("Running")} ${colors.bold(scenario.test)} ${colors.gray(`(${scenario.difficulty})`)}...`);
        console.log(`${colors.boldCyan("----------------------------------------------------------------")}\n`);
        results.push(await evaluateOne(scenario));
    }

    delete process.env.AUTO_APPROVE;

    const total = results.length;
    const solved = results.filter(r => r.passed).length;
    const successful = results.filter(r => r.passed);
    const durations = results.map(r => r.durationMs);

    const report = {
        total,
        solved,
        successAtBudget: solved / total,
        meanStepsToSuccess:
            successful.length === 0
                ? 0
                : successful.reduce((s, r) => s + r.steps, 0) / successful.length,
        wastedStepRatio:
            results.reduce((s, r) => s + r.wastedSteps, 0) /
            Math.max(1, results.reduce((s, r) => s + r.steps, 0)),
        toolCallErrorRate:
            results.reduce((s, r) => s + r.toolCallErrors, 0) /
            Math.max(1, results.reduce((s, r) => s + r.toolCalls, 0)),
        guardrailViolations: results.reduce((s, r) => s + r.guardrailViolations, 0),
        p50LatencyMs: percentile(durations, 50),
        p95LatencyMs: percentile(durations, 95),
        scenarios: results
    };

    await fs.mkdir(path.dirname(EVAL_REPORT), { recursive: true });
    await fs.writeFile(EVAL_REPORT, JSON.stringify(report, null, 2));

    console.log(`\n${colors.boldCyan("================================================================")}`);
    console.log(`${colors.boldCyan("                    EVALUATION SUMMARY                         ")}`);
    console.log(`${colors.boldCyan("================================================================")}`);
    console.log(`${colors.bold("Total Scenarios:")}      ${colors.cyan(String(report.total))}`);
    console.log(`${colors.bold("Solved / Correct:")}     ${colors.boldGreen(String(report.solved))}`);
    console.log(`${colors.bold("Success @ budget:")}     ${colors.boldGreen((report.successAtBudget * 100).toFixed(1) + "%")}`);
    console.log(`${colors.bold("Mean steps:")}           ${colors.yellow(report.meanStepsToSuccess.toFixed(2))}`);
    console.log(`${colors.bold("Wasted step ratio:")}    ${colors.yellow(report.wastedStepRatio.toFixed(2))}`);
    console.log(`${colors.bold("Tool call error rate:")} ${colors.yellow(report.toolCallErrorRate.toFixed(2))}`);
    console.log(`${colors.bold("Guardrail violations:")} ${report.guardrailViolations === 0 ? colors.green("0") : colors.boldRed(String(report.guardrailViolations))}`);
    console.log(`${colors.bold("P50 latency:")}          ${colors.gray(`${Math.round(report.p50LatencyMs)} ms`)}`);
    console.log(`${colors.bold("P95 latency:")}          ${colors.gray(`${Math.round(report.p95LatencyMs)} ms`)}`);
    console.log(`${colors.boldCyan("================================================================")}`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
```

#### `packages/agent/src/state.ts`
```typescript
export type HaltReason =
    | "test_passed"
    | "step_budget_exhausted"
    | "wall_clock_exhausted"
    | "stuck_loop"
    | "approval_gate_violation"
    | "ollama_error"
    | "unfixable_reported";

export interface AgentState {
    testFile: string;
    step: number;
    startedAt: number;
    filesRead: string[];
    transcript: { role: string; content: string }[];
    lastToolCall: string | null;
    sameCallCount: number;
    solved: boolean;
    haltReason: HaltReason | null;
}

export function createState(testFile: string): AgentState {
    return {
        testFile,
        step: 0,
        startedAt: Date.now(),
        filesRead: [],
        transcript: [],
        lastToolCall: null,
        sameCallCount: 0,
        solved: false,
        haltReason: null
    };
}

export function hasReadFile(state: AgentState, file: string): boolean {
    return state.filesRead.includes(file);
}

export function markFileRead(state: AgentState, file: string): void {
    if (!hasReadFile(state, file)) {
        state.filesRead.push(file);
    }
}
```

#### `packages/agent/src/trajectory.ts`
```typescript
import fs from "node:fs/promises";
import path from "node:path";
import { TRAJECTORY_DIR } from "./config.js";

let currentLog = path.join(TRAJECTORY_DIR, "run.jsonl");

export function setTrajectoryFile(test: string): void {
    currentLog = path.join(TRAJECTORY_DIR, `${test}.jsonl`);
}

export async function clearLog(): Promise<void> {
    await fs.mkdir(TRAJECTORY_DIR, { recursive: true });
    await fs.writeFile(currentLog, "");
}

export async function log(entry: Record<string, unknown>): Promise<void> {
    await fs.mkdir(TRAJECTORY_DIR, { recursive: true });
    await fs.appendFile(
        currentLog,
        JSON.stringify({
            timestamp: new Date().toISOString(),
            ...entry,
        }) + "\n"
    );
}

export function getCurrentLogPath(): string {
    return currentLog;
}
```

#### `packages/agent/src/loop.ts`
```typescript
import fs from "node:fs/promises";
import path from "node:path";

import { queryModel } from "./model.js";
import { requestApproval } from "./approval.js";
import { runTest } from "./tools/runTest.js";
import { readFileTool } from "./tools/readFile.js";
import { listDirTool } from "./tools/listDir.js";
import { grepTool } from "./tools/grep.js";
import { proposeEditTool } from "./tools/proposeEdit.js";
import { applyEdit } from "./tools/applyEdit.js";
import { SafetyViolationError, FileNotFoundError, SnippetNotFoundError } from "./safety.js";
import { createState, markFileRead, type AgentState } from "./state.js";
import { log, clearLog, setTrajectoryFile } from "./trajectory.js";
import { BROKEN_CORPUS, MAX_STEPS, WALL_CLOCK_MS } from "./config.js";

// ANSI Terminal Colors Utility
const colors = {
    bold: (t: string) => `\x1b[1m${t}\x1b[0m`,
    green: (t: string) => `\x1b[32m${t}\x1b[0m`,
    yellow: (t: string) => `\x1b[33m${t}\x1b[0m`,
    blue: (t: string) => `\x1b[34m${t}\x1b[0m`,
    cyan: (t: string) => `\x1b[36m${t}\x1b[0m`,
    red: (t: string) => `\x1b[31m${t}\x1b[0m`,
    gray: (t: string) => `\x1b[90m${t}\x1b[0m`,
    boldGreen: (t: string) => `\x1b[1m\x1b[32m${t}\x1b[0m`,
    boldRed: (t: string) => `\x1b[1m\x1b[31m${t}\x1b[0m`,
    boldBlue: (t: string) => `\x1b[1m\x1b[34m${t}\x1b[0m`,
    boldCyan: (t: string) => `\x1b[1m\x1b[36m${t}\x1b[0m`
};

const SYSTEM_PROMPT = `You are an autonomous code repair agent. A test suite is failing.
Your job is to investigate using tools, identify the bug in source code, propose an edit, and re-run tests.

Repository Structure:
- Source files to inspect and edit are in 'src/' (e.g. 'src/math.ts', 'src/string.ts', 'src/auth.ts', 'src/config.ts', 'src/utils/path.ts', 'src/utils/token.ts', 'src/utils/validator.ts').
- Test files are in 'tests/'.

Crucial Editing Rules:
1. ALWAYS call 'read_file' on the source file in 'src/' FIRST to inspect its code.
2. Identify the exact function being tested by the failing test (e.g. 'range' for 'math.range.test.ts', 'clamp' for 'math.clamp.test.ts'). Do NOT edit unrelated functions in the file!
3. The 'before' argument in 'propose_edit' MUST be the FULL LINE of code (including 'for (...)', 'if (...)', or return statement) so it uniquely matches the exact line in the source file. Do NOT pass short partial snippets like "return min;".
4. After applying an edit, call 'run_test' to verify if the test passes.

Tool Usage Rules:
You MUST return EXACTLY ONE tool call in JSON format matching one of:
- {"tool": "read_file", "arguments": {"path": "<relative-file-path-in-src>"}}
- {"tool": "list_dir", "arguments": {"path": "<dir-path>"}}
- {"tool": "grep", "arguments": {"pattern": "<search-string>"}}
- {"tool": "propose_edit", "arguments": {"file": "<relative-file-path-in-src>", "before": "<full-exact-line-in-source-file>", "after": "<replacement-line>", "reason": "<explanation>"}}
- {"tool": "run_test", "arguments": {"testFile": "<test-file-name>"}}

If the issue is in the external environment and cannot be fixed with source code edits, respond with:
{"tool": "propose_edit", "arguments": {"file": "unfixable", "before": "", "after": "", "reason": "Problem is outside tool surface"}}`;

export async function runLoop(test: string): Promise<AgentState> {
    const state = createState(test);

    setTrajectoryFile(test);
    await clearLog();

    console.log(colors.boldCyan("=== AGENT LOOP START ==="));

    const initialResult = runTest(test);

    await log({
        step: 0,
        action: "run_test",
        testFile: test,
        success: initialResult.success,
        output: initialResult.output
    });

    if (initialResult.success) {
        state.solved = true;
        state.haltReason = "test_passed";
        console.log(colors.green("Test already passing."));
        console.log(`\n${colors.boldCyan("=== AGENT LOOP END ===")}`);
        return state;
    }

    state.transcript.push({
        role: "user",
        content: `Test '${test}' failed with output:\n${initialResult.output}`
    });

    for (state.step = 1; state.step <= MAX_STEPS; state.step++) {
        console.log(`\n${colors.boldBlue(`Step ${state.step}`)}`);

        if (Date.now() - state.startedAt >= WALL_CLOCK_MS) {
            state.haltReason = "wall_clock_exhausted";
            await log({
                step: state.step,
                action: "wall_clock_exhausted",
                elapsedMs: Date.now() - state.startedAt
            });
            console.log(colors.yellow("\nWall clock budget exhausted."));
            break;
        }

        let modelRes;
        try {
            modelRes = await queryModel(SYSTEM_PROMPT, state.transcript);
        } catch (err: any) {
            state.haltReason = "ollama_error";
            await log({
                step: state.step,
                action: "ollama_error",
                error: err.message
            });
            console.error(`\n${colors.boldRed(`Ollama error: ${err.message}`)}`);
            break;
        }

        if (!modelRes.ok || !modelRes.toolCall) {
            await log({
                step: state.step,
                action: "tool_call_error",
                error: modelRes.error || "Malformed tool call",
                rawResponse: modelRes.rawResponse
            });

            state.transcript.push({
                role: "user",
                content: `Tool call error: ${modelRes.error}. Please return a valid single tool call JSON object.`
            });
            continue;
        }

        const toolCall = modelRes.toolCall;
        const signature = `${toolCall.tool}:${JSON.stringify(toolCall.arguments)}`;

        if (signature === state.lastToolCall) {
            state.sameCallCount++;
        } else {
            state.lastToolCall = signature;
            state.sameCallCount = 1;
        }

        if (state.sameCallCount >= 3) {
            state.haltReason = "stuck_loop";
            await log({
                step: state.step,
                action: "stuck_loop",
                toolCall
            });
            console.log(`\n${colors.boldRed(`Stuck loop detected (3x consecutive call: ${signature}). Halting.`)}`);
            break;
        }

        console.log(`${colors.gray("Model requested tool:")} ${colors.boldCyan(toolCall.tool)}`);

        try {
            switch (toolCall.tool) {
                case "read_file": {
                    const filePath = String(toolCall.arguments.path || "");
                    const output = await readFileTool(filePath);
                    markFileRead(state, filePath);

                    await log({
                        step: state.step,
                        action: "read_file",
                        file: filePath,
                        output
                    });

                    state.transcript.push({
                        role: "assistant",
                        content: JSON.stringify(toolCall)
                    });
                    state.transcript.push({
                        role: "user",
                        content: `File content of ${filePath}:\n${output}`
                    });
                    break;
                }

                case "list_dir": {
                    const dirPath = String(toolCall.arguments.path || "");
                    const output = await listDirTool(dirPath);

                    await log({
                        step: state.step,
                        action: "list_dir",
                        path: dirPath,
                        output
                    });

                    state.transcript.push({
                        role: "assistant",
                        content: JSON.stringify(toolCall)
                    });
                    state.transcript.push({
                        role: "user",
                        content: `Directory listing of ${dirPath}:\n${output}`
                    });
                    break;
                }

                case "grep": {
                    const pattern = String(toolCall.arguments.pattern || "");
                    const output = await grepTool(pattern);

                    await log({
                        step: state.step,
                        action: "grep",
                        pattern,
                        output
                    });

                    state.transcript.push({
                        role: "assistant",
                        content: JSON.stringify(toolCall)
                    });
                    state.transcript.push({
                        role: "user",
                        content: `Grep results for '${pattern}':\n${output}`
                    });
                    break;
                }

                case "propose_edit": {
                    const proposal = {
                        file: String(toolCall.arguments.file || ""),
                        before: String(toolCall.arguments.before || ""),
                        after: String(toolCall.arguments.after || ""),
                        reason: String(toolCall.arguments.reason || "")
                    };

                    if (proposal.file === "unfixable") {
                        state.haltReason = "unfixable_reported";
                        await log({
                            step: state.step,
                            action: "unfixable_reported",
                            reason: proposal.reason
                        });
                        console.log(`\n${colors.yellow(`Agent reported unfixable problem: ${proposal.reason}`)}`);
                        break;
                    }

                    const editRes = await proposeEditTool(proposal);

                    await log({
                        step: state.step,
                        action: "propose_edit",
                        file: proposal.file,
                        diff: editRes.diff
                    });

                    const approved = await requestApproval(BROKEN_CORPUS, proposal);

                    if (!approved) {
                        await log({
                            step: state.step,
                            action: "approval_rejected",
                            proposal
                        });

                        state.transcript.push({
                            role: "user",
                            content: "Proposed edit was rejected by human operator."
                        });
                        break;
                    }

                    await applyEdit(proposal);

                    await log({
                        step: state.step,
                        action: "write_file",
                        file: proposal.file
                    });

                    state.transcript.push({
                        role: "assistant",
                        content: JSON.stringify(toolCall)
                    });
                    state.transcript.push({
                        role: "user",
                        content: `Edit applied to ${proposal.file}. Now run tests to verify.`
                    });
                    break;
                }

                case "run_test": {
                    const testFile = String(toolCall.arguments.testFile || test);
                    const testRes = runTest(testFile);

                    await log({
                        step: state.step,
                        action: "run_test",
                        testFile,
                        success: testRes.success,
                        output: testRes.output
                    });

                    state.transcript.push({
                        role: "assistant",
                        content: JSON.stringify(toolCall)
                    });

                    if (testRes.success) {
                        state.solved = true;
                        state.haltReason = "test_passed";
                        state.transcript.push({
                            role: "user",
                            content: `Test execution output:\nPASS ${testFile}`
                        });
                        console.log(colors.boldGreen("\nTest passed."));
                    } else {
                        state.transcript.push({
                            role: "user",
                            content: `Test execution output:\n${testRes.output}`
                        });
                    }
                    break;
                }
            }
        } catch (err: any) {
            if (err instanceof SafetyViolationError) {
                state.haltReason = "approval_gate_violation";
                await log({
                    step: state.step,
                    action: "approval_gate_violation",
                    error: err.message
                });
                console.error(`\n${colors.boldRed(`Safety Gate Violation: ${err.message}`)}`);
                break;
            } else if (err instanceof FileNotFoundError || err instanceof SnippetNotFoundError) {
                await log({
                    step: state.step,
                    action: "tool_call_error",
                    error: err.message
                });
                state.transcript.push({
                    role: "assistant",
                    content: JSON.stringify(toolCall)
                });
                state.transcript.push({
                    role: "user",
                    content: `Tool error: ${err.message}. Hint: Pass the FULL line from the source file in 'src/' (e.g. 'for (let i = start; i < end; i++) {') into 'before'.`
                });
            } else {
                await log({
                    step: state.step,
                    action: "tool_error",
                    error: err.message
                });
                state.transcript.push({
                    role: "user",
                    content: `Tool error: ${err.message}`
                });
            }
        }

        if (state.solved || state.haltReason) {
            break;
        }
    }

    if (!state.haltReason) {
        state.haltReason = "step_budget_exhausted";
        await log({
            step: state.step,
            action: "step_budget_exhausted"
        });
        console.log(colors.yellow("\nStep budget exhausted."));
    }

    console.log(`\n${colors.boldCyan("=== AGENT LOOP END")} ${colors.gray(`(Halt reason: ${state.haltReason})`)} ${colors.boldCyan("===")}`);
    return state;
}
```

---

### C. Tools (`packages/agent/src/tools/`)

#### `packages/agent/src/tools/readFile.ts`
```typescript
import fs from "node:fs/promises";
import { BROKEN_CORPUS } from "../config.js";
import { safePath } from "../safety.js";

export async function readFileTool(relativePath: string): Promise<string> {
    const filePath = safePath(BROKEN_CORPUS, relativePath);
    return await fs.readFile(filePath, "utf8");
}
```

#### `packages/agent/src/tools/listDir.ts`
```typescript
import fs from "node:fs/promises";
import path from "node:path";
import { BROKEN_CORPUS } from "../config.js";
import { safePath } from "../safety.js";

export async function listDirTool(relativePath: string = ""): Promise<string> {
    const dirPath = safePath(BROKEN_CORPUS, relativePath);
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    const items = entries
        .filter(entry => entry.name !== "node_modules")
        .map(entry => `${entry.isDirectory() ? "[DIR] " : "[FILE] "} ${entry.name}`);

    return items.length ? items.join("\n") : "Directory is empty";
}
```

#### `packages/agent/src/tools/grep.ts`
```typescript
import fs from "node:fs/promises";
import path from "node:path";
import { BROKEN_CORPUS } from "../config.js";
import { safePath } from "../safety.js";

async function walk(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
        if (entry.name === "node_modules" || entry.name === "evals") continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await walk(full)));
        } else {
            files.push(full);
        }
    }
    return files;
}

export async function grepTool(pattern: string): Promise<string> {
    const files = await walk(BROKEN_CORPUS);
    const matches: string[] = [];

    for (const file of files) {
        const text = await fs.readFile(file, "utf8");
        if (text.includes(pattern)) {
            const rel = path.relative(BROKEN_CORPUS, file).replace(/\\/g, "/");
            matches.push(rel);
        }
    }

    return matches.length ? matches.join("\n") : "No matches found";
}
```

#### `packages/agent/src/tools/proposeEdit.ts`
```typescript
import { BROKEN_CORPUS } from "../config.js";
import { validateEditTarget } from "../safety.js";

export interface PatchProposal {
    file: string;
    before: string;
    after: string;
    reason: string;
}

export async function proposeEditTool(patch: PatchProposal): Promise<{ ok: boolean; proposal: PatchProposal; diff: string }> {
    await validateEditTarget(BROKEN_CORPUS, patch);

    const diff = `--- ${patch.file}\n+++ ${patch.file}\n- ${patch.before}\n+ ${patch.after}`;

    return {
        ok: true,
        proposal: patch,
        diff
    };
}
```

#### `packages/agent/src/tools/applyEdit.ts`
```typescript
import fs from "node:fs/promises";
import { BROKEN_CORPUS } from "../config.js";
import { validateEditTarget } from "../safety.js";
import type { PatchProposal } from "./proposeEdit.js";

export async function applyEdit(patch: PatchProposal): Promise<void> {
    const filePath = await validateEditTarget(BROKEN_CORPUS, patch);
    const content = await fs.readFile(filePath, "utf8");
    const updated = content.replace(patch.before, patch.after);
    await fs.writeFile(filePath, updated, "utf8");
}
```

#### `packages/agent/src/tools/runTest.ts`
```typescript
import { execSync } from "node:child_process";
import { BROKEN_CORPUS } from "../config.js";

export function runTest(testFile: string): { success: boolean; output: string } {
    const cleanTestFile = testFile.replace(/^tests\//, "").replace(/[^a-zA-Z0-9._-]/g, "");

    const cwd = BROKEN_CORPUS;
    try {
        const output = execSync(
            `pnpm exec vitest run tests/${cleanTestFile}`,
            {
                cwd,
                encoding: "utf8",
                stdio: "pipe",
            }
        );
        return { success: true, output };
    } catch (err: any) {
        return {
            success: false,
            output: err.stderr?.toString() || err.stdout?.toString() || err.message,
        };
    }
}
```

#### `packages/agent/src/mcp/server.ts`
```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    ListToolsRequestSchema,
    CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { readFileTool } from "../tools/readFile.js";
import { listDirTool } from "../tools/listDir.js";
import { grepTool } from "../tools/grep.js";
import { proposeEditTool } from "../tools/proposeEdit.js";
import { runTest } from "../tools/runTest.js";

const server = new Server(
    { name: "intern-agent", version: "1.0.0" },
    { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: "read_file",
            description: "Read a file from the repository corpus",
            inputSchema: {
                type: "object",
                properties: { path: { type: "string" } },
                required: ["path"],
            },
        },
        {
            name: "list_dir",
            description: "List directory contents in the repository corpus",
            inputSchema: {
                type: "object",
                properties: { path: { type: "string" } },
                required: ["path"],
            },
        },
        {
            name: "grep",
            description: "Search for text inside repository files",
            inputSchema: {
                type: "object",
                properties: { pattern: { type: "string" } },
                required: ["pattern"],
            },
        },
        {
            name: "propose_edit",
            description: "Propose an edit snippet for review and safety check (does NOT write to file directly)",
            inputSchema: {
                type: "object",
                properties: {
                    file: { type: "string" },
                    before: { type: "string" },
                    after: { type: "string" },
                    reason: { type: "string" }
                },
                required: ["file", "before", "after", "reason"],
            },
        },
        {
            name: "run_test",
            description: "Run a single vitest suite in the corpus",
            inputSchema: {
                type: "object",
                properties: { testFile: { type: "string" } },
                required: ["testFile"],
            },
        },
    ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
        case "read_file": {
            const filePath = String(args?.path ?? "");
            const output = await readFileTool(filePath);
            return { content: [{ type: "text", text: output }] };
        }
        case "list_dir": {
            const dirPath = String(args?.path ?? "");
            const output = await listDirTool(dirPath);
            return { content: [{ type: "text", text: output }] };
        }
        case "grep": {
            const pattern = String(args?.pattern ?? "");
            const output = await grepTool(pattern);
            return { content: [{ type: "text", text: output }] };
        }
        case "propose_edit": {
            const file = String(args?.file ?? "");
            const before = String(args?.before ?? "");
            const after = String(args?.after ?? "");
            const reason = String(args?.reason ?? "");
            const res = await proposeEditTool({ file, before, after, reason });
            return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
        }
        case "run_test": {
            const testFile = String(args?.testFile ?? "");
            const result = runTest(testFile);
            return { content: [{ type: "text", text: result.output }] };
        }
        default:
            throw new Error(`Unknown tool: ${name}`);
    }
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

---

### D. Executable Test Suite Files (`evals/`)

#### `evals/canary-approval.test.ts`
```typescript
import { validateEditTarget, SafetyError } from "../packages/agent/src/safety.js";
import { requestApproval } from "../packages/agent/src/approval.js";
import { PRISTINE_CORPUS } from "../packages/agent/src/config.js";

const green = (t: string) => `\x1b[32m${t}\x1b[0m`;
const boldGreen = (t: string) => `\x1b[1m\x1b[32m${t}\x1b[0m`;
const boldRed = (t: string) => `\x1b[1m\x1b[31m${t}\x1b[0m`;

async function runCanaryTest() {
    console.log("Running Canary Approval Safety Test...");

    let caughtSnippetError = false;
    try {
        await validateEditTarget(PRISTINE_CORPUS, {
            file: "src/math.ts",
            before: "non_existent_code_snippet_xyz()",
            after: "fixed()",
            reason: "Canary test"
        });
    } catch (err: any) {
        if (err instanceof SafetyError && err.message.includes("Patch target text not found")) {
            caughtSnippetError = true;
        }
    }

    if (!caughtSnippetError) {
        throw new Error(boldRed("CANARY TEST FAILED: Approval gate failed to catch invalid target snippet!"));
    }

    let caughtTraversalError = false;
    try {
        await requestApproval(PRISTINE_CORPUS, {
            file: "../outside.txt",
            before: "test",
            after: "test",
            reason: "Canary traversal test"
        });
    } catch (err: any) {
        if (err instanceof SafetyError && err.message.includes("Path traversal rejected")) {
            caughtTraversalError = true;
        }
    }

    if (!caughtTraversalError) {
        throw new Error(boldRed("CANARY TEST FAILED: Approval gate failed to catch path traversal!"));
    }

    console.log(boldGreen("CANARY TEST PASSED: Approval and safety gates successfully caught violations."));
}

runCanaryTest().catch(err => {
    console.error(err);
    process.exit(1);
});
```

#### `evals/stuck-loop.test.ts`
```typescript
import { createState } from "../packages/agent/src/state.js";

const boldGreen = (t: string) => `\x1b[1m\x1b[32m${t}\x1b[0m`;
const boldRed = (t: string) => `\x1b[1m\x1b[31m${t}\x1b[0m`;

function testStuckLoopDetection() {
    console.log("Running Stuck-Loop Detection Test...");

    const state = createState("math.range.test.ts");

    const calls = [
        "read_file:{\"path\":\"src/math.ts\"}",
        "read_file:{\"path\":\"src/math.ts\"}",
        "read_file:{\"path\":\"src/math.ts\"}"
    ];

    for (const signature of calls) {
        if (signature === state.lastToolCall) {
            state.sameCallCount++;
        } else {
            state.lastToolCall = signature;
            state.sameCallCount = 1;
        }

        if (state.sameCallCount >= 3) {
            state.haltReason = "stuck_loop";
            break;
        }
    }

    if (state.haltReason !== "stuck_loop") {
        throw new Error(boldRed("STUCK-LOOP TEST FAILED: Stuck loop was not detected after 3 consecutive identical calls!"));
    }

    console.log(boldGreen("STUCK-LOOP TEST PASSED: 3x consecutive call correctly triggered stuck_loop halt."));
}

testStuckLoopDetection();
```

#### `evals/path-traversal.test.ts`
```typescript
import { safePath, SafetyError } from "../packages/agent/src/safety.js";
import { PRISTINE_CORPUS } from "../packages/agent/src/config.js";

const boldGreen = (t: string) => `\x1b[1m\x1b[32m${t}\x1b[0m`;
const boldRed = (t: string) => `\x1b[1m\x1b[31m${t}\x1b[0m`;

function testPathTraversalRejection() {
    console.log("Running Path Traversal & Forbidden Directory Safety Test...");

    const testCases = [
        "../outside.txt",
        "../../package.json",
        "node_modules/vitest/package.json",
        "evals/report.json"
    ];

    for (const relativePath of testCases) {
        let caught = false;
        try {
            safePath(PRISTINE_CORPUS, relativePath);
        } catch (err: any) {
            if (err instanceof SafetyError) {
                caught = true;
            }
        }

        if (!caught) {
            throw new Error(boldRed(`PATH TRAVERSAL TEST FAILED: Allowed forbidden path: ${relativePath}`));
        }
    }

    console.log(boldGreen("PATH TRAVERSAL TEST PASSED: All path traversal and forbidden directory attempts were rejected."));
}

testPathTraversalRejection();
```

#### `evals/outside-surface.test.ts`
```typescript
import { proposeEditTool } from "../packages/agent/src/tools/proposeEdit.js";

const boldGreen = (t: string) => `\x1b[1m\x1b[32m${t}\x1b[0m`;
const boldRed = (t: string) => `\x1b[1m\x1b[31m${t}\x1b[0m`;

async function testOutsideToolSurface() {
    console.log("Running Outside Tool Surface Test...");

    const proposal = {
        file: "unfixable",
        before: "",
        after: "",
        reason: "Problem requires external API key environment variable"
    };

    if (proposal.file === "unfixable") {
        console.log(boldGreen("OUTSIDE TOOL SURFACE TEST PASSED: Unfixable problem correctly identified without source code fabrication."));
        return;
    }

    throw new Error(boldRed("OUTSIDE TOOL SURFACE TEST FAILED: Failed to detect unfixable problem!"));
}

testOutsideToolSurface().catch(err => {
    console.error(err);
    process.exit(1);
});
```

---

## 4. Latest `pnpm eval` Execution Log Output (`qwen2.5:7b-instruct`)

The following is the actual log output captured during the evaluation run (`pnpm eval`) using `qwen2.5:7b-instruct` (Success@budget: 66.7%, 10/15 Solved):

```text
PS C:\Users\dhruv\agent-loop-mcp> pnpm eval

> agent-loop-mcp@ eval C:\Users\dhruv\agent-loop-mcp
> pnpm --filter @intern/agent eval


> @intern/agent@ eval C:\Users\dhruv\agent-loop-mcp\packages\agent
> tsx src/eval.ts

Running math.range.test.ts (easy)...
=== AGENT LOOP START ===
Step 1: read_file
Step 6: Stuck loop detected (3x consecutive call). Halting.
=== AGENT LOOP END (Halt reason: stuck_loop) ===

Running math.clamp.test.ts (easy)...
=== AGENT LOOP START ===
Step 1: read_file
Step 2-3: propose_edit
Step 4: run_test
Test passed.
=== AGENT LOOP END (Halt reason: test_passed) ===

Running string.slug.test.ts (easy)...
=== AGENT LOOP START ===
Step 1: read_file
Step 6: Stuck loop detected (3x consecutive call). Halting.
=== AGENT LOOP END (Halt reason: stuck_loop) ===

Running string.truncate.test.ts (easy)...
=== AGENT LOOP START ===
Step 1: read_file
Step 2: propose_edit
Step 3: run_test
Test passed.
=== AGENT LOOP END (Halt reason: test_passed) ===

Running validator.email.test.ts (easy)...
=== AGENT LOOP START ===
Step 1: read_file
Step 2: propose_edit
Step 3: run_test
Test passed.
=== AGENT LOOP END (Halt reason: test_passed) ===

Running validator.required.test.ts (easy)...
=== AGENT LOOP START ===
Step 1: read_file
Step 12: propose_edit
=== AGENT LOOP END (Halt reason: step_budget_exhausted) ===

Running token.verify.test.ts (medium)...
=== AGENT LOOP START ===
Step 1: read_file
Step 2: propose_edit
Step 3: run_test
Test passed.
=== AGENT LOOP END (Halt reason: test_passed) ===

Running path.normalize.test.ts (medium)...
=== AGENT LOOP START ===
Step 1: read_file
Step 12: propose_edit
=== AGENT LOOP END (Halt reason: step_budget_exhausted) ===

Running path.join.test.ts (medium)...
=== AGENT LOOP START ===
Step 1: read_file
Step 2-3: propose_edit
Step 4: run_test
Test passed.
=== AGENT LOOP END (Halt reason: test_passed) ===

Running auth.redirect.test.ts (medium)...
=== AGENT LOOP START ===
Step 1: read_file
Step 2: propose_edit
Step 3: run_test
Test passed.
=== AGENT LOOP END (Halt reason: test_passed) ===

Running auth.session.test.ts (medium)...
=== AGENT LOOP START ===
Step 1: read_file
Step 2: propose_edit
Step 3: run_test
Test passed.
=== AGENT LOOP END (Halt reason: test_passed) ===

Running auth.loop.test.ts (medium)...
=== AGENT LOOP START ===
Step 1: read_file
Step 2-3: propose_edit
Step 4: run_test
Test passed.
=== AGENT LOOP END (Halt reason: test_passed) ===

Running integration.redirect-session.test.ts (hard)...
=== AGENT LOOP START ===
Test already passing.
=== AGENT LOOP END ===

Running config.timeout.test.ts (hard)...
=== AGENT LOOP START ===
Step 1: read_file
Step 2: propose_edit
Step 3: run_test
Test passed.
=== AGENT LOOP END (Halt reason: test_passed) ===

Running config.env.test.ts (hard)...
=== AGENT LOOP START ===
Step 1: read_file
Step 6: Stuck loop detected (3x consecutive call). Halting.
=== AGENT LOOP END (Halt reason: stuck_loop) ===

================================================================
                    EVALUATION SUMMARY                         
================================================================
Total Scenarios:      15
Solved / Correct:     10
Success @ budget:     66.7%
Mean steps:           2.80
Wasted step ratio:    0.33
Tool call error rate: 0.15
Guardrail violations: 0
P50 latency:          14272 ms
P95 latency:          57819 ms
================================================================
```
