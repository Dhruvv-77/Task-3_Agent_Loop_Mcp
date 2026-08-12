import { execSync } from "node:child_process";
import path from "node:path";

export function runTest(testName: string) {
    const cwd = path.resolve(process.cwd(), "corpus/mini-auth-utils-broken");

    try {
        const output = execSync(
            `pnpm test -- ${testName}`,
            {
                cwd,
                encoding: "utf8",
                stdio: "pipe"
            }
        );

        return { success: true, output };
    } catch (err: any) {
        return {
            success: false,
            output: err.stdout?.toString() ?? err.message
        };
    }
}