import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const REPO_ROOT = path.resolve(process.cwd(), "../..");

const CORPUS_ROOT = path.join(
    REPO_ROOT,
    "corpus",
    "mini-auth-utils-broken"
);

async function validateEdit(
    file: string,
    before: string
) {
    const target = path.join(CORPUS_ROOT, file);

    const content = await fs.readFile(target, "utf8");

    if (!content.includes(before)) {
        throw new Error(
            "Approval violation: expected text not found in file"
        );
    }
}

export async function requestApproval(
    file: string,
    before: string,
    after: string,
    reason: string
): Promise<boolean> {
    await validateEdit(file, before);

    console.log("\n--- Proposed patch ---");
    console.log(
        JSON.stringify(
            { file, before, after, reason },
            null,
            2
        )
    );

    const rl = readline.createInterface({
        input: stdin,
        output: stdout,
    });

    const answer = (
        await rl.question(
            "Apply patch? (y/n): "
        )
    )
        .trim()
        .toLowerCase();

    rl.close();

    return answer === "y";
}
