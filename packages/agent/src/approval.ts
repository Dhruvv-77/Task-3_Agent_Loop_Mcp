import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { validateEditTarget } from "./safety.js";
import type { PatchProposal } from "./tools/proposeEdit.js";

const ESC = "\u001b";
const RESET = `${ESC}[0m`;
const BOLD = `${ESC}[1m`;
const DIM = `${ESC}[2m`;
const ITALIC = `${ESC}[3m`;

const RED = `${ESC}[31m`;
const GREEN = `${ESC}[32m`;
const YELLOW = `${ESC}[33m`;
const WHITE = `${ESC}[37m`;

export async function validateEdit(rootDir: string, patch: PatchProposal): Promise<void> {
    // Delegates central path & target validation to safety.ts
    await validateEditTarget(rootDir, patch);
}

export async function requestApproval(
    rootDir: string,
    patch: PatchProposal
): Promise<boolean> {
    // Safety gate MUST run before any approval step (interactive or auto-approve)
    await validateEditTarget(rootDir, patch);

    console.log(`\n${BOLD}${YELLOW}┌── Proposed Patch ────────────────────────────────────────────────────┐${RESET}`);
    console.log(`│ ${BOLD}File:${RESET}   ${WHITE}${patch.file}${RESET}`);
    console.log(`│ ${BOLD}Reason:${RESET} ${ITALIC}${patch.reason || "None provided"}${RESET}`);
    console.log(`${BOLD}${YELLOW}├── Original line ─────────────────────────────────────────────────────┤${RESET}`);
    console.log(`${RED}- ${patch.before}${RESET}`);
    console.log(`${BOLD}${YELLOW}├── Replacement line ──────────────────────────────────────────────────┤${RESET}`);
    console.log(`${GREEN}+ ${patch.after}${RESET}`);
    console.log(`${BOLD}${YELLOW}└──────────────────────────────────────────────────────────────────────┘${RESET}`);

    // Auto-approve mode: used by the evaluation harness (pnpm eval).
    // Triggers ONLY after safety validation has passed.
    if (process.env.AUTO_APPROVE === "1") {
        console.log(`Apply patch? (y/n): ${BOLD}${GREEN}y [auto-approved post-safety]${RESET}`);
        return true;
    }

    const rl = readline.createInterface({ input, output });
    const answer = await rl.question(`Apply patch? (${BOLD}y/n${RESET}): `);
    rl.close();

    return answer.trim().toLowerCase() === "y";
}
