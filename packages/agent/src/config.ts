import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// packages/agent/src -> packages/agent
const AGENT_ROOT = path.resolve(__dirname, "..");

// packages/agent -> repository root
const REPO_ROOT = path.resolve(AGENT_ROOT, "..", "..");

export const ROOT = path.resolve(
    REPO_ROOT,
    "corpus/mini-auth-utils-broken"
);

export const TRAJECTORY = path.resolve(
    AGENT_ROOT,
    "trajectories/run.jsonl"
);

export const MAX_STEPS = 5;
