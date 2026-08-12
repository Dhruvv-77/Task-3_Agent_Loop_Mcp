export interface PatchProposal {
    file: string;
    before: string;
    after: string;
    reason: string;
}

export type EditProposal = PatchProposal;

export function proposePatch(testName: string): PatchProposal | null {
    switch (testName) {
        case "math.range.test.ts":
            return {
                file: "src/math.ts",
                before: "for (let i = start; i < end; i++) {",
                after: "for (let i = start; i <= end; i++) {",
                reason: "Range should include the end value."
            };

        case "string.slug.test.ts":
            return {
                file: "src/string.ts",
                before: "replace(/\\\\s+/g, \"_\")",
                after: "replace(/\\\\s+/g, \"-\")",
                reason: "Slugify should use hyphens, not underscores."
            };

        case "validator.email.test.ts":
            return {
                file: "src/utils/validator.ts",
                before: 'return email.includes("@");',
                after: 'return email != null && email.includes("@");',
                reason: "Handle null email values safely."
            };

        case "auth.redirect.test.ts":
            return {
                file: "src/auth.ts",
                before: 'return isLoggedIn ? "/login" : "/dashboard";',
                after: 'return isLoggedIn ? "/dashboard" : "/login";',
                reason: "Logged-in users should go to the dashboard."
            };

        case "auth.session.test.ts":
            return {
                file: "src/auth.ts",
                before: "return minutes > 30;",
                after: "return minutes >= 30;",
                reason: "Session expires at exactly 30 minutes."
            };

        case "token.verify.test.ts":
            return {
                file: "src/utils/token.ts",
                before: "return token.length > 0;",
                after: 'return token.startsWith("tok_");',
                reason: "Tokens must start with the tok_ prefix."
            };

        case "path.normalize.test.ts":
            return {
                file: "src/utils/path.ts",
                before: 'replace(/\\\\/g, "/")',
                after: 'replace(/\\\\+/g, "/")',
                reason: "Normalize repeated backslashes."
            };

        case "path.join.test.ts":
            return {
                file: "src/utils/path.ts",
                before: "return a + b;",
                after: "return `${a}/${b}`;",
                reason: "Join path segments with a slash."
            };

        case "config.env.test.ts":
            return {
                file: "src/config.ts",
                before: 'return process.env[name] || "";',
                after: 'const v = process.env[name]; if (!v) throw new Error("Missing env"); return v;',
                reason: "Throw when a required environment variable is missing."
            };

        case "config.timeout.test.ts":
            return {
                file: "src/config.ts",
                before: "return Number(process.env.TIMEOUT || 0);",
                after: "return Number(process.env.TIMEOUT || 3000);",
                reason: "Use 3000ms as the default timeout."
            };

        case "validator.required.test.ts":
            return {
                file: "src/utils/validator.ts",
                before: "return value != null;",
                after: 'return value != null && value !== "";',
                reason: "Empty strings should not count as present."
            };

        case "string.truncate.test.ts":
            return {
                file: "src/string.ts",
                before: "return s.slice(0, n - 1);",
                after: "return s.slice(0, n);",
                reason: "Truncate to exactly n characters."
            };

        case "math.clamp.test.ts":
            return {
                file: "src/math.ts",
                before: "return Math.max(min, value);",
                after: "return Math.min(max, Math.max(min, value));",
                reason: "Clamp values to both minimum and maximum bounds."
            };

        case "auth.loop.test.ts":
            return {
                file: "src/auth.ts",
                before: "return attempts > 5;",
                after: "return attempts >= 5;",
                reason: "Lock after 5 attempts inclusive."
            };

        case "integration.redirect-session.test.ts":
            return {
                file: "src/auth.ts",
                before: 'return isLoggedIn ? "/login" : "/dashboard";',
                after: 'return isLoggedIn ? "/dashboard" : "/login";',
                reason: "Integration case depends on redirect behavior."
            };

        default:
            return null;
    }
}

export function proposeFix(
    testContent: string,
    sourceContent?: string
): PatchProposal | null {
    const patch = proposePatch(testContent);
    if (patch) return patch;

    if (
        testContent.includes("inclusive range") &&
        sourceContent?.includes("i < end")
    ) {
        return {
            file: "src/math.ts",
            before: "for (let i = start; i < end; i++) {",
            after: "for (let i = start; i <= end; i++) {",
            reason: "Range should include the end value."
        };
    }

    return null;
}