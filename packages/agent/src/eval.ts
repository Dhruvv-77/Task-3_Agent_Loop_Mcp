import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import { runLoop } from "./loop.js";

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
    "path.join.test.ts",
];

const REPO_ROOT = path.resolve(process.cwd(), "../..");

const PRISTINE_DIR = path.join(
    REPO_ROOT,
    "corpus",
    "mini-auth-utils-pristine"
);

const BROKEN_DIR = path.join(
    REPO_ROOT,
    "corpus",
    "mini-auth-utils-broken"
);

const TRAJECTORY_DIR = path.join(
    REPO_ROOT,
    "packages",
    "agent",
    "trajectories"
);

const REPORT_PATH = path.join(REPO_ROOT, "evals", "report.json");

async function resetCorpus() {
    await fs.rm(BROKEN_DIR, {
        recursive: true,
        force: true,
    });

    await fs.mkdir(BROKEN_DIR, {
        recursive: true,
    });

    const entries = await fs.readdir(PRISTINE_DIR);

    for (const entry of entries) {
        if (entry === "node_modules") continue;

        await fs.cp(
            path.join(PRISTINE_DIR, entry),
            path.join(BROKEN_DIR, entry),
            {
                recursive: true,
            }
        );
    }

    execSync("pnpm install", {
        cwd: BROKEN_DIR,
        stdio: "ignore",
    });
}

async function readTrajectory(test: string) {
    const file = path.join(TRAJECTORY_DIR, `${test}.jsonl`);

    try {
        const raw = await fs.readFile(file, "utf8");

        return raw
            .trim()
            .split("\\n")
            .filter(Boolean)
            .map((line) => JSON.parse(line));
    } catch {
        return [];
    }
}

async function evaluateOne(test: string) {
    console.log(`Running ${test}...`);

    await resetCorpus();

    const start = Date.now();

    await runLoop(test);

    const durationMs = Date.now() - start;

    const events = await readTrajectory(test);

    const iterations = events.filter(
        (e: any) => e.action === "run_test"
    ).length;

    const toolCalls = events.filter(
        (e: any) => e.action === "read_file" || e.action === "write_file"
    ).length;

    const filesRead = events.filter(
        (e: any) => e.action === "read_file"
    ).length;

    const approvalRejections = events.filter(
        (e: any) => e.action === "approval_rejected"
    ).length;

    const passed =
        events.length > 0
            ? events[events.length - 1].success === true
            : false;

    return {
        id: test.replace(".test.ts", "").replace(/\\./g, "-"),
        test,
        passed,
        durationMs,
        iterations,
        toolCalls,
        filesRead,
        approvalRejections,
    };
}

async function main() {
    const results = [];

    for (const test of TESTS) {
        results.push(await evaluateOne(test));
    }

    const total = results.length;
    const solved = results.filter((r) => r.passed).length;
    const passRate = solved / total;

    const averageDurationMs =
        results.reduce((a, r) => a + r.durationMs, 0) / total;

    const averageIterations =
        results.reduce((a, r) => a + r.iterations, 0) / total;

    const averageToolCalls =
        results.reduce((a, r) => a + r.toolCalls, 0) / total;

    const averageFilesRead =
        results.reduce((a, r) => a + r.filesRead, 0) / total;

    const totalApprovalRejections =
        results.reduce((a, r) => a + r.approvalRejections, 0);

    const report = {
        total,
        solved,
        passRate,
        averageDurationMs,
        averageIterations,
        averageToolCalls,
        averageFilesRead,
        totalApprovalRejections,
        results,
    };

    await fs.mkdir(path.dirname(REPORT_PATH), {
        recursive: true,
    });

    await fs.writeFile(
        REPORT_PATH,
        JSON.stringify(report, null, 2)
    );

    console.log("\\n=== Evaluation Summary ===");
    console.log(`Total: ${total}`);
    console.log(`Solved: ${solved}`);
    console.log(`Pass rate: ${(passRate * 100).toFixed(1)}%`);
    console.log(
        `Average iterations: ${averageIterations.toFixed(2)}`
    );
    console.log(
        `Average tool calls: ${averageToolCalls.toFixed(2)}`
    );
    console.log(
        `Average files read: ${averageFilesRead.toFixed(2)}`
    );
    console.log(
        `Average duration: ${averageDurationMs.toFixed(0)} ms`
    );
    console.log(
        `Approval rejections: ${totalApprovalRejections}`
    );
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});