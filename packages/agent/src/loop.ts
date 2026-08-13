import fs from "node:fs/promises";
import path from "node:path";

import { proposePatch } from "./planner.js";
import { requestApproval } from "./approval.js";
import { runTest } from "./tools/runTest.js";
import { readFileTool } from "./tools/readFile.js";
import { createState, markFileRead } from "./state.js";
import { log, clearLog, setTrajectoryFile } from "./trajectory.js";
import { BROKEN_CORPUS, MAX_STEPS } from "./config.js";

export async function runLoop(test: string): Promise<void> {
    const state = createState(test);


    setTrajectoryFile(test);
    await clearLog();

    console.log("=== AGENT LOOP START ===");

    for (
        state.step = 1;
        state.step <= MAX_STEPS;
        state.step++
    ) {
        console.log(`\nStep ${state.step} `);

        // Tool 1: run_test
        const testResult = runTest(test);

        await log({
            step: state.step,
            action: "run_test",
            success: testResult.success,
        });

        if (testResult.success) {
            state.solved = true;
            console.log("\nTest passed.");
            console.log("\n=== AGENT LOOP END ===");
            return;
        }

        console.log("\nInvestigating files...");

        const patch = proposePatch(test);

        if (!patch) {
            throw new Error(
                `No patch proposal available for ${test}`
            );
        }

        // Tool 2: read_file
        const fileText = await readFileTool(patch.file);

        markFileRead(state, patch.file);

        await log({
            step: state.step,
            action: "read_file",
            file: patch.file,
        });

        // Rebuild the expected snippet from the actual file so approval
        // validation cannot drift after previous edits.
        const searchText = patch.before
            .replace(/\\\\/g, "\\")
            .replace(/\/\/.*$/, "")
            .trim();

        const beforeLine =
            fileText
                .split(/\r?\n/)
                .find(line => line.includes(searchText))
            ?? searchText;


        const approved = await requestApproval(
            BROKEN_CORPUS,
            {
                ...patch,
                before: beforeLine,
            }
        );

        if (!approved) {
            await log({
                step: state.step,
                action: "approval_rejected",
            });

            console.log("Patch rejected.");
            console.log("\n=== AGENT LOOP END ===");
            return;
        }

        const filePath = path.join(
            BROKEN_CORPUS,
            patch.file
        );

        const current = await fs.readFile(
            filePath,
            "utf8"
        );

        const updated = current.replace(
            beforeLine,
            patch.after
        );

        await fs.writeFile(filePath, updated);
        await log({
            step: state.step,
            action: "write_file",
            file: patch.file,
        });
        const final = runTest(test);

        await log({
            step: state.step,
            action: "run_test",
            success: final.success,
        });

        if (final.success) {
            state.solved = true;
            console.log("\nTest passed.");
            console.log("\n=== AGENT LOOP END ===");
            return;
        } else {
            console.log("\nTest execution output:\n", final.output);
        }
    }

    await log({
        step: state.step,
        action: "stuck_loop",
    });

    console.log("\nReached step budget.");
    console.log("\n=== AGENT LOOP END ===");


}
