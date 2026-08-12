import { runLoop } from "./loop.js";

const args = process.argv.slice(2);

if (args[0] !== "fix") {
    console.error(
        "Usage: pnpm agent fix --test <test-file>"
    );
    process.exit(1);
}

const testIndex = args.indexOf("--test");

if (testIndex === -1 || !args[testIndex + 1]) {
    console.error("Missing --test argument");
    process.exit(1);
}

await runLoop(args[testIndex + 1]);