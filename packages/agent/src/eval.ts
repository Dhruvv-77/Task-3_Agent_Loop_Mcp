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

const TESTS = [
    "math.range.test.ts",
    "string.slug.test.ts",
    "validator.email.test.ts",
    "auth.redirect.test.ts",
    "auth.session.test.ts",
    "token.verify.test.ts",
    "path.normalize.test.ts",
    "config.env.test.ts",
    "auth.loop.test.ts",
    "integration.redirect-session.test.ts",
    "math.clamp.test.ts",
    "string.truncate.test.ts",
    "validator.required.test.ts",
    "config.timeout.test.ts",
    "path.join.test.ts"
];

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function resetCorpus() {
    // On Windows, vitest may hold file handles briefly after exit.
    // Retry the rm up to 10 times with a 500ms delay on EBUSY.
    for (let attempt = 1; attempt <= 10; attempt++) {
        try {
            await fs.rm(BROKEN_CORPUS, {
                recursive: true,
                force: true
            });
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
        filter: (src) => {
            const name = path.basename(src);
            return name !== "node_modules";
        }
    });

    execSync("pnpm install", {
        cwd: REPO_ROOT,
        stdio: "ignore"
    });
}


async function readTrajectory(test: string) {
    const file = path.join(
        TRAJECTORY_DIR,
        `${test}.jsonl`
    );


    try {
        const text = await fs.readFile(file, "utf8");

        const lines = text
            .trim()
            .split("\n")
            .filter(Boolean);

        let steps = 0;
        let toolCalls = 0;
        let filesRead = 0;
        let approvalRejections = 0;
        let wastedSteps = 0;
        let toolCallErrors = 0;
        let guardrailViolations = 0;

        const seenActions = new Set<string>();

        for (const line of lines) {
            const event = JSON.parse(line);

            steps++;

            if (
                event.action === "write_file" ||
                event.action === "run_test" ||
                event.action === "propose_edit"
            ) {
                toolCalls++;
            }

            if (event.action === "read_file") {
                filesRead++;
            }

            if (event.action === "approval_rejected") {
                approvalRejections++;
            }

            if (event.action === "approval_gate_violation") {
                guardrailViolations++;
            }

            if (event.action === "tool_call_error") {
                toolCallErrors++;
            }

            const signature = `${event.action}:${JSON.stringify(event.output ?? "")} `;

            if (seenActions.has(signature)) {
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

async function evaluateOne(test: string) {
    await resetCorpus();


    const trajectoryFile = path.join(
        TRAJECTORY_DIR,
        `${test}.jsonl`
    );

    await fs.rm(trajectoryFile, {
        force: true
    });

    const start = Date.now();

    await runLoop(test);

    const durationMs = Date.now() - start;

    let passed = false;

    try {
        execSync(
            `pnpm exec vitest run tests/${test}`,
            {
                cwd: BROKEN_CORPUS,
                stdio: "ignore"
            }
        );

        passed = true;
    } catch {
        passed = false;
    }

    const metrics = await readTrajectory(test);

    return {
        id: test.replace(".test.ts", ""),
        test,
        passed,
        durationMs,
        steps: metrics.steps,
        toolCalls: metrics.toolCalls,
        filesRead: metrics.filesRead,
        approvalRejections: metrics.approvalRejections,
        wastedSteps: metrics.wastedSteps,
        toolCallErrors: metrics.toolCallErrors,
        guardrailViolations:
            metrics.guardrailViolations
    };


}

function percentile(values: number[], p: number) {
    if (values.length === 0) return 0;


    const sorted = [...values].sort(
        (a, b) => a - b
    );

    const index = Math.floor(
        (p / 100) * (sorted.length - 1)
    );

    return sorted[index];


}

async function main() {
    // Enable non-interactive approval for the evaluation harness.
    // pnpm agent fix --test ... does NOT set this, so it stays interactive.
    process.env.AUTO_APPROVE = "1";

    const results = [];

    for (const test of TESTS) {
        console.log(`Running ${test}...`);
        results.push(await evaluateOne(test));
    }

    // Clean up so the env var does not persist if this module is re-imported.
    delete process.env.AUTO_APPROVE;

    const total = results.length;

    const solved = results.filter(
        r => r.passed
    ).length;

    const successful = results.filter(
        r => r.passed
    );

    const durations = results.map(
        r => r.durationMs
    );

    const report = {
        total,
        solved,
        successAtBudget: solved / total,
        meanStepsToSuccess:
            successful.length === 0
                ? 0
                : successful.reduce(
                    (s, r) => s + r.steps,
                    0
                ) / successful.length,
        wastedStepRatio:
            results.reduce(
                (s, r) => s + r.wastedSteps,
                0
            ) /
            Math.max(
                1,
                results.reduce(
                    (s, r) => s + r.steps,
                    0
                )
            ),
        toolCallErrorRate:
            results.reduce(
                (s, r) => s + r.toolCallErrors,
                0
            ) /
            Math.max(
                1,
                results.reduce(
                    (s, r) => s + r.toolCalls,
                    0
                )
            ),
        guardrailViolations:
            results.reduce(
                (s, r) =>
                    s + r.guardrailViolations,
                0
            ),
        p50LatencyMs: percentile(durations, 50),
        p95LatencyMs: percentile(durations, 95),
        results
    };

    await fs.mkdir(path.dirname(EVAL_REPORT), {
        recursive: true
    });

    await fs.writeFile(
        EVAL_REPORT,
        JSON.stringify(report, null, 2)
    );

    console.log("\n=== Evaluation Summary ===");
    console.log(`Total: ${report.total} `);
    console.log(`Solved: ${report.solved} `);
    console.log(
        `Success @budget: ${(report.successAtBudget * 100).toFixed(1)}% `
    );
    console.log(
        `Mean steps: ${report.meanStepsToSuccess.toFixed(2)} `
    );
    console.log(
        `Wasted - step ratio: ${report.wastedStepRatio.toFixed(2)} `
    );
    console.log(
        `Tool - call error rate: ${report.toolCallErrorRate.toFixed(2)} `
    );
    console.log(
        `Guardrail violations: ${report.guardrailViolations} `
    );
    console.log(
        `P50 latency: ${Math.round(report.p50LatencyMs)} ms`
    );
    console.log(
        `P95 latency: ${Math.round(report.p95LatencyMs)} ms`
    );


}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
