import { describe, it, expect } from "vitest";
import { verifyToken } from "../src/utils/token.js";

describe("verifyToken", () => {
    it("accepts tokens starting with tok_", () => {
        expect(verifyToken("tok_abc123")).toBe(true);
    });

    it("rejects tokens without tok_ prefix", () => {
        expect(verifyToken("abc123")).toBe(false);
    });
});