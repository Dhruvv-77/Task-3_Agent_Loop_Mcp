import fs from "node:fs/promises";
import path from "node:path";
import { BROKEN_CORPUS } from "../config.js";

export async function readFileTool(relativePath: string): Promise<string> {
    const filePath = path.join(BROKEN_CORPUS, relativePath);
    return await fs.readFile(filePath, "utf8");
}
