export function verifyToken(token: string): boolean {
    // BUG: should require the token to start with "tok_"
    return token.length > 0;
}