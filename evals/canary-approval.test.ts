import { validateEditTarget, SafetyError } from "../packages/agent/src/safety.js";
import { requestApproval } from "../packages/agent/src/approval.js";
import { PRISTINE_CORPUS } from "../packages/agent/src/config.js";

async function runCanaryTest() {
    console.log("Running Canary Approval Safety Test...");

    // Test 1: Invalid target snippet
    let caughtSnippetError = false;
    try {
        await validateEditTarget(PRISTINE_CORPUS, {
            file: "src/math.ts",
            before: "non_existent_code_snippet_xyz()",
            after: "fixed()",
            reason: "Canary test"
        });
    } catch (err: any) {
        if (err instanceof SafetyError && err.message.includes("Patch target text not found")) {
            caughtSnippetError = true;
        }
    }

    if (!caughtSnippetError) {
        throw new Error("CANARY TEST FAILED: Approval gate failed to catch invalid target snippet!");
    }

    // Test 2: Path traversal attempt
    let caughtTraversalError = false;
    try {
        await requestApproval(PRISTINE_CORPUS, {
            file: "../outside.txt",
            before: "test",
            after: "test",
            reason: "Canary traversal test"
        });
    } catch (err: any) {
        if (err instanceof SafetyError && err.message.includes("Path traversal rejected")) {
            caughtTraversalError = true;
        }
    }

    if (!caughtTraversalError) {
        throw new Error("CANARY TEST FAILED: Approval gate failed to catch path traversal!");
    }

    console.log("CANARY TEST PASSED: Approval and safety gates successfully caught violations.");
}

runCanaryTest().catch(err => {
    console.error(err);
    process.exit(1);
});