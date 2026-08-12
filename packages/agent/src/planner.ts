export type PatchProposal = {
    file: string;
    before: string;
    after: string;
    reason: string;
};

export function proposeFix(test: string): PatchProposal | null {
    switch (test) {
        case "math.range.test.ts":
            return {
                file: "src/math.ts",
                before: `for (let i = start; i < end; i++) {`,
                after: `for (let i = start; i <= end; i++) {`,
                reason: "Range should be inclusive.",
            };


        case "math.clamp.test.ts":
            return {
                file: "src/math.ts",
                before: `if (value > max) return min; `,
                after: `if (value > max) return max; `,
                reason: "Clamp should cap values at the maximum.",
            };

        case "string.slug.test.ts":
            return {
                file: "src/string.ts",
                before: `replace(/\\s+/g, "_")`,
                after: `replace(/\\s+/g, "-")`,
                reason: "Slugify should use hyphens, not underscores.",
            };

        case "string.truncate.test.ts":
            return {
                file: "src/string.ts",
                before: `return input.slice(0, length + 1); `,
                after: `return input.slice(0, length); `,
                reason: "Truncate should return exactly the requested length.",
            };

        case "validator.email.test.ts":
            return {
                file: "src/utils/validator.ts",
                before: `return email!.includes("@"); `,
                after: `return !!email && email.includes("@"); `,
                reason: "Handle null safely.",
            };

        case "validator.required.test.ts":
            return {
                file: "src/utils/validator.ts",
                before: `return value.length >= 0; `,
                after: `return value.trim().length > 0; `,
                reason: "Empty strings should not be considered required.",
            };

        case "token.verify.test.ts":
            return {
                file: "src/utils/token.ts",
                before: `return token.length > 0; `,
                after: `return token.startsWith("tok_"); `,
                reason: "Only tokens with the tok_ prefix should be valid.",
            };

        case "path.normalize.test.ts":
            return {
                file: "src/utils/path.ts",
                before: `return p.replace("\\\\", "/");`,
                after: `return p.replace(/\\\\/g, "/");`,
                reason: "Replace all backslashes with forward slashes.",
            };

        case "path.join.test.ts":
            return {
                file: "src/utils/path.ts",
                before: `return a + b;`,
                after: `return a.replace(/\\/$/, "") + "/" + b.replace(/^\\//, "");`,
                reason: "Join path segments with exactly one slash.",
            };

        case "config.env.test.ts":
            return {
                file: "src/config.ts",
                before: `return process.env.API_URL ?? "http://localhost:3000"; `,
                after: `if (!process.env.API_URL) throw new Error("API_URL missing");
            

                return process.env.API_URL;`,
                reason: "Throw when API_URL is missing.",
            };


        case "config.timeout.test.ts":
            return {
                file: "src/config.ts",
                before: `return Number(process.env.REQUEST_TIMEOUT ?? 0); `,
                after: `return Number(process.env.REQUEST_TIMEOUT ?? 3000); `,
                reason: "Default timeout should be 3000ms.",
            };

        case "auth.redirect.test.ts":
            return {
                file: "src/auth.ts",
                before: `return loggedIn ? "/login" : "/dashboard"; `,
                after: `return loggedIn ? "/dashboard" : "/login"; `,
                reason: "Redirect logic is reversed.",
            };

        case "auth.session.test.ts":
            return {
                file: "src/auth.ts",
                before: `return minutes > 30; `,
                after: `return minutes >= 30; `,
                reason: "Session should expire at exactly 30 minutes.",
            };

        case "auth.loop.test.ts":
            return {
                file: "src/auth.ts",
                before: `return attempts > 5; `,
                after: `return attempts >= 5; `,
                reason: "Retry limit should trigger at 5 attempts.",
            };

        case "integration.redirect-session.test.ts":
            return {
                file: "src/auth.ts",
                before: `return loggedIn ? "/login" : "/dashboard"; `,
                after: `return loggedIn ? "/dashboard" : "/login"; `,
                reason: "Expired sessions should redirect to login.",
            };

        default:
            return null;

    }
}
// Backward-compatible alias so loop.ts can keep importing proposePatch
export const proposePatch = proposeFix;
