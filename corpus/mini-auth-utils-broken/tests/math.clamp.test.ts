import { describe, it, expect } from "vitest";
import { clamp } from "../src/math.js";

describe("clamp", () => {
    it("caps values above max", () => {
        expect(clamp(15, 0, 10)).toBe(10);
    });
});