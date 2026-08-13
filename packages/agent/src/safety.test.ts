import { describe, it, expect, vi } from "vitest";
import { safePath, validateEditTarget, SafetyViolationError, FileNotFoundError, SnippetNotFoundError } from "./safety.js";
import path from "node:path";
import fs from "node:fs/promises";

vi.mock("node:fs/promises");

describe("Safety Utilities", () => {
    describe("safePath", () => {
        const mockRootDir = path.resolve("/mock/root");

        it("resolves valid relative paths inside the root directory", () => {
            const result = safePath(mockRootDir, "src/math.ts");
            expect(result).toBe(path.resolve(mockRootDir, "src/math.ts"));
        });

        it("rejects relative paths containing path traversal segments (../)", () => {
            expect(() => safePath(mockRootDir, "../outside.ts")).toThrow(SafetyViolationError);
            expect(() => safePath(mockRootDir, "src/../../outside.ts")).toThrow(SafetyViolationError);
            expect(() => safePath(mockRootDir, "..")).toThrow(SafetyViolationError);
        });

        it("rejects path traversal regardless of separators", () => {
            expect(() => safePath(mockRootDir, "..\\outside.ts")).toThrow(SafetyViolationError);
        });

        it("rejects access to forbidden directories (node_modules, evals)", () => {
            expect(() => safePath(mockRootDir, "node_modules/dotenv/config")).toThrow(SafetyViolationError);
            expect(() => safePath(mockRootDir, "evals/report.json")).toThrow(SafetyViolationError);
        });

        it("rejects resolved paths that escape the root directory", () => {
            // Under Windows or Linux, path.resolve with a root / relative path might behave differently.
            // Let's pass an absolute path or path resolved outside mockRootDir.
            const absoluteOutside = path.resolve(mockRootDir, "../outside");
            expect(() => safePath(mockRootDir, absoluteOutside)).toThrow(SafetyViolationError);
        });
    });

    describe("validateEditTarget", () => {
        const mockRootDir = path.resolve("/mock/root");

        it("throws FileNotFoundError when target file doesn't exist", async () => {
            vi.mocked(fs.readFile).mockRejectedValueOnce(new Error("File not found"));

            await expect(
                validateEditTarget(mockRootDir, {
                    file: "src/missing.ts",
                    before: "code",
                    after: "new code"
                })
            ).rejects.toThrow(FileNotFoundError);
        });

        it("throws SnippetNotFoundError when before snippet is not in target file", async () => {
            vi.mocked(fs.readFile).mockResolvedValueOnce("function test() {\n  return 1;\n}\n");

            await expect(
                validateEditTarget(mockRootDir, {
                    file: "src/math.ts",
                    before: "return 2;",
                    after: "return 3;"
                })
            ).rejects.toThrow(SnippetNotFoundError);
        });

        it("resolves and returns file path when file exists and contains before snippet", async () => {
            vi.mocked(fs.readFile).mockResolvedValueOnce("function test() {\n  return 1;\n}\n");

            const result = await validateEditTarget(mockRootDir, {
                file: "src/math.ts",
                before: "return 1;",
                after: "return 2;"
            });

            expect(result).toBe(path.resolve(mockRootDir, "src/math.ts"));
        });
    });
});
