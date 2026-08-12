import path from "node:path";
import { execSync } from "node:child_process";
import { ROOT, MAX_STEPS } from "./config.js";
import { clearLog, log } from "./trajectory.js";
import { readFileTool } from "./tools/readFile.js";
import { writeFileTool } from "./tools/writeFile.js";
import { proposePatch } from "./planner.js";
import { requestApproval } from "./approval.js";

function runTest(test: string): { passed: boolean; output: string } {
    try {
        const output = execSync(
            `pnpm exec vitest run tests/${test}`,
            {
                cwd: ROOT,
                encoding: "utf8",
                stdio: "pipe"
            }
        );

        return { passed: true, output };
    } catch (e: any) {
        return {
            passed: false,
            output: e.stdout?.toString() || e.stderr?.toString() || String(e)
        };
    }
}

export async function runLoop(test: string) {
    await clearLog();

    console.log("=== AGENT LOOP START ===");

    for (let step = 1; step <= MAX_STEPS; step++) {
        console.log(`\nStep ${step}`);

        const result = runTest(test);

        await log({
            step,
            action: "run_test",
            success: result.passed
        });

        if (result.passed) {
            console.log("\nTest passed.");
            console.log("\n=== AGENT LOOP END ===");
            return;
        }

        console.log(result.output);
        console.log("\nInvestigating files...");

        const proposal = proposePatch(path.basename(test));

        if (!proposal) {
            console.log("No fix proposal found.");
            break;
        }

        const testPath = `tests/${test}`;
        const sourcePath = proposal.file;

        const testContent = await readFileTool(testPath);
        void testContent;

        await log({
            step,
            action: "read_file",
            file: testPath
        });

        const sourceContent = await readFileTool(sourcePath);

        await log({
            step,
            action: "read_file",
            file: sourcePath
        });

        await log({
            step,
            action: "propose_edit",
            file: sourcePath
        });

        const approved = await requestApproval(
            sourcePath,
            proposal.before,
            proposal.after,
            proposal.reason
        );

        if (!approved) {
            await log({
                step,
                action: "approval_rejected"
            });

            console.log("Patch rejected.");
            break;
        }

        const updated = sourceContent.replace(proposal.before, proposal.after);

        await writeFileTool(sourcePath, updated);

        await log({
            step,
            action: "patch_applied",
            file: sourcePath
        });

        console.log("Patch applied successfully.");
        console.log("\nRe-running test...");
    }

    console.log("\n=== AGENT LOOP END ===");
}