export interface AgentState {
    testFile: string;
    step: number;
    filesRead: string[];
    actions: string[];
    solved: boolean;
}

export function createState(testFile: string): AgentState {
    return {
        testFile,
        step: 0,
        filesRead: [],
        actions: [],
        solved: false
    };
}

export function hasReadFile(
    state: AgentState,
    file: string
): boolean {
    return state.filesRead.includes(file);
}

export function markFileRead(
    state: AgentState,
    file: string
): void {
    if (!hasReadFile(state, file)) {
        state.filesRead.push(file);
    }
}

export function recordAction(
    state: AgentState,
    action: string
): void {
    state.actions.push(action);
}