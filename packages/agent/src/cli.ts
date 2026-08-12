import { runLoop } from "./loop.js";

const [, , command, flag, test] = process.argv;

if (command !== "fix" || flag !== "--test" || !test) {
    console.log(
        "Usage: pnpm agent fix --test <test-file>"
    );
    process.exit(1);
}

await runLoop(test);
