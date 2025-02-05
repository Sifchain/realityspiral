import { Action, IAgentRuntime, Memory, UUID } from "@elizaos/core";

export const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

export function registerActions(runtime: IAgentRuntime, actions: Action[]) {
    for (const action of actions) {
        runtime.registerAction(action);
    }
}

export function unregisterActions(runtime: IAgentRuntime, actions: Action[]) {
    runtime.actions = runtime.actions.filter(
        (action) => !actions.map((a) => a.name).includes(action.name),
    );
}

export async function getMemories(
    runtime: IAgentRuntime,
    roomId: UUID,
): Promise<Memory[]> {
    const memories = await runtime.messageManager.getMemories({
        roomId,
        unique: false,
    });
    return memories;
}

export async function getLastMemory(
    runtime: IAgentRuntime,
    roomId: UUID,
): Promise<Memory | null> {
    const memories = await getMemories(runtime, roomId);
    if (memories.length === 0) {
        return null;
    }
    return memories[0];
}
