import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// packages/agent/src -> packages/agent -> packages -> repo root
export const REPO_ROOT = path.resolve(__dirname, "../../..");

// Corpus directories
export const CORPUS_ROOT = path.join(REPO_ROOT, "corpus");
export const BROKEN_CORPUS = path.join(
    CORPUS_ROOT,
    "mini-auth-utils-broken"
);
export const PRISTINE_CORPUS = path.join(
    CORPUS_ROOT,
    "mini-auth-utils-pristine"
);

// Keep ROOT for compatibility with the rest of the project
export const ROOT = BROKEN_CORPUS;

// Output locations
export const TRAJECTORY_DIR = path.join(
    REPO_ROOT,
    "packages",
    "agent",
    "trajectories"
);

export const EVAL_REPORT = path.join(
    REPO_ROOT,
    "evals",
    "report.json"
);

// Budgets
export const MAX_STEPS = 12;
export const WALL_CLOCK_MS = 30_000;
