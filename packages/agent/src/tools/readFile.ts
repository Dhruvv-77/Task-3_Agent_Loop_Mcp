import fs from "node:fs/promises";
import path from "node:path";
import { ROOT } from "../config.js";

export async function readFileTool(relPath: string) {
    const full = path.join(ROOT, relPath);

    return await fs.readFile(full, "utf8");
}
