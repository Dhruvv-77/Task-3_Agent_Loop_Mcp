import { describe, it, expect } from "vitest";
import { getRedirectPath, isSessionExpired } from "../src/auth.js";

describe("redirect after session expiry", () => {
    it("expired session goes to login", () => {
        const expired = isSessionExpired(45);
        expect(getRedirectPath(!expired)).toBe("/login");
    });
});