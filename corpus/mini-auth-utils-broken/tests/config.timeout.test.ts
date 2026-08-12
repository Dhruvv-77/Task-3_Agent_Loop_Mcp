import { describe, it, expect } from "vitest";
import { getRequestTimeout } from "../src/config.js";

describe("getRequestTimeout", () => {
    it("defaults to 3000ms", () => {
        delete process.env.REQUEST_TIMEOUT;
        expect(getRequestTimeout()).toBe(3000);
    });
});