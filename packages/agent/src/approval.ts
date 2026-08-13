import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { Patch } from "./planner.js";

export async function validateEdit(rootDir: string, patch: Patch): Promise<void> {
    const filePath = path.join(rootDir, patch.file);
    const current = await fs.readFile(filePath, "utf8");

    if (!current.includes(patch.before)) {
        throw new Error(
            `Approval violation: expected text not found in file\nTARGET: ${filePath}\nBEFORE: ${JSON.stringify(patch.before)}\nFILE CONTAINS: ${JSON.stringify(current)}`
        );
    }
}

export async function requestApproval(
    rootDir: string,
    patch: Patch
): Promise<boolean> {
    await validateEdit(rootDir, patch);

    console.log("\n--- Proposed patch ---");
    console.log(JSON.stringify(patch, null, 2));

    // Auto-approve mode: used by the evaluation harness (pnpm eval).
    // When AUTO_APPROVE=1, patches are applied without interactive prompts.
    // pnpm agent fix --test ... always runs interactively.
    if (process.env.AUTO_APPROVE === "1") {
        console.log("Apply patch? (y/n): y [auto-approved]");
        return true;
    }

    const rl = readline.createInterface({ input, output });
    const answer = await rl.question("Apply patch? (y/n): ");
    rl.close();

    return answer.trim().toLowerCase() === "y";
}
