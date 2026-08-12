import fs from "node:fs/promises";
import path from "node:path";

const DIR = path.resolve(
    process.cwd(),
    "packages/agent/trajectories"
);

let currentLog = path.join(DIR, "run.jsonl");

export function setTrajectoryFile(test: string) {
    currentLog = path.join(DIR, `${test}.jsonl`);
}

export async function clearLog() {
    await fs.mkdir(DIR, { recursive: true });
    await fs.writeFile(currentLog, "");
}

export async function log(entry: Record<string, unknown>) {
    await fs.appendFile(
        currentLog,
        JSON.stringify({
            timestamp: new Date().toISOString(),
            ...entry
        }) + "\n"
    );
}

export function getCurrentLogPath() {
    return currentLog;
}