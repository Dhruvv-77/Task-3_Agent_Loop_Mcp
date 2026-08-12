import path from "node:path";
import { execSync } from "node:child_process";
import {
    ROOT,
    MAX_STEPS,
    WALL_CLOCK_MS
} from "./config.js";
import { readFileTool } from "./tools/readFile.js";
import { writeFileTool } from "./tools/writeFile.js";
import { proposePatch } from "./planner.js";
import { requestApproval } from "./approval.js";
import { clearLog, log, setTrajectoryFile } from "./trajectory.js";

function runTest(test: string) {
    try {
        const output = execSync(
            `npx vitest run tests/${test}`,
            {
                cwd: ROOT,
                encoding: "utf8",
                stdio: ["ignore", "pipe", "pipe"]
            }
        );

        return {
            passed: true,
            output
        };
    } catch (e: any) {
        return {
            passed: false,
            output:
                e.stdout ||
                e.stderr ||
                String(e)
        };
    }
}

export async function runLoop(test: string) {
    setTrajectoryFile(test);
    await clearLog();

    console.log("=== AGENT LOOP START ===");


    const startTime = Date.now();

    let lastProposal = "";
    let duplicateCount = 0;

    for (
        let step = 1;
        step <= MAX_STEPS;
        step++
    ) {
        if (
            Date.now() - startTime >
            WALL_CLOCK_MS
        ) {
            console.log(
                "Wall-clock budget exceeded."
            );
            break;
        }

        console.log(`\nStep ${step}`);

        const result = runTest(test);

        await log({
            step,
            action: "run_test",
            success: result.passed
        });

        if (result.passed) {
            console.log(
                "\nTest passed."
            );
            console.log(
                "\n=== AGENT LOOP END ==="
            );
            return;
        }

        console.log(result.output);

        console.log(
            "\nInvestigating files..."
        );

        await readFileTool(
            `tests/${test}`
        );

        await log({
            step,
            action: "read_file",
            file: `tests/${test}`
        });

        const requestedTest =
            path.basename(test);

        const proposal =
            proposePatch(requestedTest);

        if (!proposal) {
            console.log(
                "No fix proposal found."
            );
            break;
        }

        const proposalKey =
            JSON.stringify(proposal);

        if (proposalKey === lastProposal) {
            duplicateCount++;
        } else {
            duplicateCount = 1;
            lastProposal = proposalKey;
        }

        if (duplicateCount >= 3) {
            await log({
                step,
                action: "stuck_loop_halt"
            });

            console.log(
                "Stuck loop detected."
            );
            break;
        }

        await log({
            step,
            action: "propose_edit",
            file: proposal.file
        });

        const sourceContent =
            await readFileTool(
                proposal.file
            );

        const approved =
            await requestApproval(
                proposal.file,
                proposal.before,
                proposal.after,
                proposal.reason
            );

        if (!approved) {
            await log({
                step,
                action: "approval_rejected"
            });

            console.log(
                "Patch rejected."
            );
            break;
        }

        const updated =
            sourceContent.replace(
                proposal.before,
                proposal.after
            );

        await writeFileTool(
            proposal.file,
            updated
        );

        await log({
            step,
            action: "patch_applied",
            file: proposal.file
        });

        console.log(
            "Patch applied successfully."
        );

        console.log(
            "\nRe-running test..."
        );
    }

    console.log(
        "\n=== AGENT LOOP END ==="
    );
}