export function normalizePath(p: string): string {
    // BUG: only replaces the first backslash
    return p.replace("\\\\", "/");
}

export function joinPath(a: string, b: string): string {
    // BUG: forgets the slash between segments
    return a + b;
}