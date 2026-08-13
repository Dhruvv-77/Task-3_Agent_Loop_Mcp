export function getApiUrl(): string {
    throw new Error("API_URL not set"); // BUG
}

export function getTimeout(): number {
    return Number(process.env.REQUEST_TIMEOUT ?? 0); // BUG
}
