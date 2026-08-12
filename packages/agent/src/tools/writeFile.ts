import fs from "node:fs/promises";
import path from "node:path";
import { ROOT } from "../config.js";

export async function writeFileTool(
    relPath: string,
    content: string
) {
    const full = path.join(ROOT, relPath);

    await fs.writeFile(full, content, "utf8");
}
