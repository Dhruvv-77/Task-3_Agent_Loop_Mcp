export function getApiUrl(): string {
    return process.env.API_URL || ""; // BUG
}

export function getRequestTimeout(): number {
    return Number(process.env.REQUEST_TIMEOUT || 0); // BUG
}