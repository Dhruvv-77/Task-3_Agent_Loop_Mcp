import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

export async function requestApproval(
    file: string,
    before: string,
    after: string,
    reason: string
): Promise<boolean> {
    console.log("\n--- Proposed patch ---");
    console.log({
        file,
        before,
        after,
        reason
    });

    const rl = readline.createInterface({
        input: stdin,
        output: stdout
    });

    const answer = await rl.question(
        "Apply patch? (y/n): "
    );

    rl.close();

    return answer.trim().toLowerCase() === "y";
}
