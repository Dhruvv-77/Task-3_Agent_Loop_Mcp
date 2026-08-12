import { describe, it, expect } from "vitest";
import { isEmail } from "../src/utils/validator.js";

describe("isEmail", () => {
    it("returns false for null", () => {
        expect(isEmail(null)).toBe(false);
    });

    it("returns true for a valid email", () => {
        expect(isEmail("a@b.com")).toBe(true);
    });
});