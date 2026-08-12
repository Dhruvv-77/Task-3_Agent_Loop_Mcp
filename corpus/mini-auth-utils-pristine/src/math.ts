export function range(start: number, end: number): number[] {
    const result: number[] = [];

    for (let i = start; i < end; i++) {   // BUG
        result.push(i);
    }

    return result;
}

export function clamp(value: number, min: number, max: number): number {
    return value > max ? 0 : value < min ? min : value; // BUG
}