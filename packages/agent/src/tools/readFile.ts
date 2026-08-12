import fs from "node:fs/promises";
import path from "node:path";
import { ROOT } from "../config.js";

export async function readFileTool(relativePath: string) {
    const fullPath = path.join(ROOT, relativePath);
    return fs.readFile(fullPath, "utf8");
}