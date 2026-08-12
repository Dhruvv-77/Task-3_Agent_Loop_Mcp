import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// packages/agent/src  →  packages/agent  →  packages  →  repo root
export const REPO_ROOT = path.resolve(__dirname, "../../..");

export const ROOT = path.join(
    REPO_ROOT,
    "corpus",
    "mini-auth-utils-broken"
);

export const MAX_STEPS = 12;
export const WALL_CLOCK_MS = 30_000;