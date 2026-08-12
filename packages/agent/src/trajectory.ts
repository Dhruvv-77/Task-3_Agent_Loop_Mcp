import fs from "node:fs/promises";
import path from "node:path";
import { TRAJECTORY } from "./config.js";

export async function clearLog() {
    await fs.mkdir(path.dirname(TRAJECTORY), {
        recursive: true
    });

    await fs.writeFile(TRAJECTORY, "");
}

export async function log(
    entry: Record<string, unknown>
) {
    await fs.appendFile(
        TRAJECTORY,
        JSON.stringify({
            timestamp: new Date().toISOString(),
            ...entry
        }) + "\n"
    );
}
