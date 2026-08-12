import { describe, it, expect } from "vitest";
import { slugify } from "../src/string.js";

describe("slugify", () => {
    it("converts spaces to hyphens", () => {
        expect(slugify("Hello World")).toBe("hello-world");
    });
});