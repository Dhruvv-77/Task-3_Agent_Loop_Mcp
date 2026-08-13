import { runLoop } from "./loop.js";

const args = process.argv.slice(2);

if (args.length === 0) {
    console.error("Usage: pnpm agent fix --test <test-file>");
    process.exit(1);
}

const command = args[0];

if (command !== "fix") {
    console.error("Only the 'fix' command is supported.");
    process.exit(1);
}

const testFlagIndex = args.indexOf("--test");

if (testFlagIndex === -1 || !args[testFlagIndex + 1]) {
    console.error("Missing --test <test-file> argument.");
    process.exit(1);
}

const testFile = args[testFlagIndex + 1];

await runLoop(testFile);
