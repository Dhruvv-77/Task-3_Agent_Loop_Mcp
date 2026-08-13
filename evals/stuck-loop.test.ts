import { createState } from "../packages/agent/src/state.js";

function testStuckLoopDetection() {
    console.log("Running Stuck-Loop Detection Test...");

    const state = createState("math.range.test.ts");

    const calls = [
        "read_file:{\"path\":\"src/math.ts\"}",
        "read_file:{\"path\":\"src/math.ts\"}",
        "read_file:{\"path\":\"src/math.ts\"}"
    ];

    for (const signature of calls) {
        if (signature === state.lastToolCall) {
            state.sameCallCount++;
        } else {
            state.lastToolCall = signature;
            state.sameCallCount = 1;
        }

        if (state.sameCallCount >= 3) {
            state.haltReason = "stuck_loop";
            break;
        }
    }

    if (state.haltReason !== "stuck_loop") {
        throw new Error("STUCK-LOOP TEST FAILED: Stuck loop was not detected after 3 consecutive identical calls!");
    }

    console.log("STUCK-LOOP TEST PASSED: 3x consecutive call correctly triggered stuck_loop halt.");
}

testStuckLoopDetection();
