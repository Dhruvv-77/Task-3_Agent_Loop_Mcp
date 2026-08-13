import { execSync } from "node:child_process";
import { BROKEN_CORPUS } from "../config.js";

export function runTest(testFile: string): { success: boolean; output: string } {
    const cwd = BROKEN_CORPUS; try {
        const output = execSync(
            `pnpm exec vitest run tests/${testFile}`,
            {
                cwd,
                encoding: "utf8",
                stdio: "pipe",
            }
        );


        return { success: true, output };


    } catch (err: any) {
        return {
            success: false,
            output: err.stderr?.toString() || err.stdout?.toString() || err.message,
        };
    }
}
