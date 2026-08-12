import fs from "node:fs/promises";
import path from "node:path";
import { ROOT } from "../config.js";

async function walk(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, {
        withFileTypes: true
    });

    const files: string[] = [];

    for (const e of entries) {
        const full = path.join(dir, e.name);


        if (e.isDirectory()) {
            files.push(...(await walk(full)));
        } else {
            files.push(full);
        }


    }

    return files;
}

export async function grepTool(pattern: string) {
    const files = await walk(ROOT);

    const matches: string[] = [];

    for (const file of files) {
        const text = await fs.readFile(file, "utf8");

        if (text.includes(pattern)) {
            matches.push(path.relative(ROOT, file));
        }


    }

    return matches;
}
