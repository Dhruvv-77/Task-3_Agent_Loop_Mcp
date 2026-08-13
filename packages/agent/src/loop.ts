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

const ESC = "\u001b";
const RESET = `${ESC}[0m`;
const BOLD = `${ESC}[1m`;
const DIM = `${ESC}[2m`;
const ITALIC = `${ESC}[3m`;

const RED = `${ESC}[31m`;
const GREEN = `${ESC}[32m`;
const YELLOW = `${ESC}[33m`;
const BLUE = `${ESC}[34m`;
const MAGENTA = `${ESC}[35m`;
const CYAN = `${ESC}[36m`;
const WHITE = `${ESC}[37m`;

const BRIGHT_RED = `${ESC}[91m`;
const BRIGHT_GREEN = `${ESC}[92m`;
const BRIGHT_YELLOW = `${ESC}[93m`;
const BRIGHT_BLUE = `${ESC}[94m`;
const BRIGHT_MAGENTA = `${ESC}[95m`;
const BRIGHT_CYAN = `${ESC}[96m`;

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

    console.log(`\n${BOLD}${CYAN}╔══════════════════════════════════════════════════════════════════════╗${RESET}`);
    console.log(`${BOLD}${CYAN}║                    🤖 MCP AUTONOMOUS REPAIR AGENT                    ║${RESET}`);
    console.log(`${BOLD}${CYAN}╚══════════════════════════════════════════════════════════════════════╝${RESET}`);
    console.log(`${BOLD}${WHITE}Target Test:${RESET} ${YELLOW}${test}${RESET}\n`);

    // Run initial test
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
        console.log(`${BOLD}${GREEN}✔ Test already passing!${RESET}`);
        console.log(`\n${BOLD}${CYAN}╔══════════════════════════════════════════════════════════════════════╗${RESET}`);
        console.log(`${BOLD}${GREEN}║ 🎉 SUCCESS: The test suite passed successfully!                      ║${RESET}`);
        console.log(`${BOLD}${CYAN}╚══════════════════════════════════════════════════════════════════════╝${RESET}\n`);
        return state;
    }

    state.transcript.push({
        role: "user",
        content: `Test '${test}' failed with output:\n${initialResult.output}`
    });

    for (state.step = 1; state.step <= MAX_STEPS; state.step++) {
        console.log(`\n${BOLD}${MAGENTA}┌─── Step ${state.step} ───────────────────────────────────────────────────────────┐${RESET}`);

        // 1. Check Wall-Clock Budget
        if (Date.now() - state.startedAt >= WALL_CLOCK_MS) {
            state.haltReason = "wall_clock_exhausted";
            await log({
                step: state.step,
                action: "wall_clock_exhausted",
                elapsedMs: Date.now() - state.startedAt
            });
            console.log(`│ ${BOLD}${RED}✘ Wall clock budget exhausted.${RESET}`);
            console.log(`${BOLD}${MAGENTA}└──────────────────────────────────────────────────────────────────────┘${RESET}`);
            break;
        }

        // 2. Query LLM Model
        let modelRes;
        try {
            modelRes = await queryModel(SYSTEM_PROMPT, state.transcript);
        } catch (err: any) {
            state.haltReason = "api_error";
            await log({
                step: state.step,
                action: "api_error",
                error: err.message
            });
            console.error(`│ ${BOLD}${RED}✘ API error: ${err.message}${RESET}`);
            console.log(`${BOLD}${MAGENTA}└──────────────────────────────────────────────────────────────────────┘${RESET}`);
            break;
        }

        if (!modelRes.ok || !modelRes.toolCall) {
            await log({
                step: state.step,
                action: "tool_call_error",
                error: modelRes.error || "Malformed tool call",
                rawResponse: modelRes.rawResponse
            });

            console.error(`│ ${BOLD}${YELLOW}⚠ Tool call error: ${modelRes.error || "Malformed tool call"}${RESET}`);
            console.log(`${BOLD}${MAGENTA}└──────────────────────────────────────────────────────────────────────┘${RESET}`);

            state.transcript.push({
                role: "user",
                content: `Tool call error: ${modelRes.error}. Please return a valid single tool call JSON object.`
            });
            continue;
        }

        const toolCall = modelRes.toolCall;
        const signature = `${toolCall.tool}:${JSON.stringify(toolCall.arguments)}`;

        // 3. Detect Stuck Loop (3x consecutive identical tool call)
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
            console.log(`│ ${BOLD}${RED}✘ Stuck loop detected (3x consecutive identical calls). Halting.${RESET}`);
            console.log(`${BOLD}${MAGENTA}└──────────────────────────────────────────────────────────────────────┘${RESET}`);
            break;
        }

        // 4. Execute Selected Tool
        console.log(`│ ${BOLD}${BLUE}🤖 Model Action:${RESET} ${WHITE}${toolCall.tool}${RESET}`);
        if (toolCall.tool === "read_file") {
            console.log(`│   ${DIM}Reading path:${RESET} ${toolCall.arguments.path}`);
        } else if (toolCall.tool === "grep") {
            console.log(`│   ${DIM}Searching for:${RESET} "${toolCall.arguments.pattern}"`);
        } else if (toolCall.tool === "propose_edit") {
            console.log(`│   ${DIM}Editing file:${RESET} ${toolCall.arguments.file}`);
            console.log(`│   ${DIM}Reason:${RESET} ${ITALIC}${toolCall.arguments.reason}${RESET}`);
        } else if (toolCall.tool === "run_test") {
            console.log(`│   ${DIM}Running test:${RESET} ${toolCall.arguments.testFile || test}`);
        }
        console.log(`${BOLD}${MAGENTA}└──────────────────────────────────────────────────────────────────────┘${RESET}`);

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
                        console.log(`\nAgent reported unfixable problem: ${proposal.reason}`);
                        break;
                    }

                    const editRes = await proposeEditTool(proposal);

                    await log({
                        step: state.step,
                        action: "propose_edit",
                        file: proposal.file,
                        diff: editRes.diff
                    });

                    // Request approval (runs safety check first)
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

                    // Apply edit after safety + approval
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
                        console.log(`\n${BOLD}${GREEN}✔ Test passed!${RESET}`);
                    } else {
                        console.log(`\n${BOLD}${RED}✘ Test failed!${RESET}`);
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
                console.error(`\n${BOLD}${RED}✘ Safety Gate Violation: ${err.message}${RESET}`);
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
        console.log(`\n${BOLD}${RED}✘ Step budget exhausted.${RESET}`);
    }

    console.log(`\n${BOLD}${CYAN}╔══════════════════════════════════════════════════════════════════════╗${RESET}`);
    if (state.haltReason === "test_passed") {
        console.log(`${BOLD}${GREEN}║ 🎉 SUCCESS: The test suite passed successfully!                      ║${RESET}`);
    } else if (state.haltReason === "unfixable_reported") {
        console.log(`${BOLD}${YELLOW}║ ⚠️ UNFIXABLE: The agent identified the issue as outside tool surface. ║${RESET}`);
    } else {
        console.log(`${BOLD}${RED}║ ❌ HALTED: Reason: ${state.haltReason.toUpperCase().padEnd(50)} ║${RESET}`);
    }
    console.log(`${BOLD}${CYAN}╚══════════════════════════════════════════════════════════════════════╝${RESET}\n`);

    return state;
}
