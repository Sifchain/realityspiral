import {
	type Memory,
	type State,
	type TemplateType,
	elizaLogger,
	composeContext as originalComposeContext,
} from "@elizaos/core";
import { v4 as uuidv4 } from "uuid";
import { Instrumentation } from "./instrumentation";

// Define our own simplified interface for AgentRuntime
interface RuntimeLike {
	agentId: string;
	character?: { name?: string };
	actions:
		| Array<Record<string, unknown>>
		| Array<{ name: string; [key: string]: unknown }>;

	initialize: (...args: unknown[]) => Promise<unknown>;
	evaluate: (
		message: Record<string, unknown>,
		state: Record<string, unknown>,
		didRespond?: boolean,
		callback?: (response: unknown) => void,
	) => Promise<unknown>;
	processActions: (
		message: Record<string, unknown>,
		responses: Array<Record<string, unknown>>,
		state?: Record<string, unknown>,
		callback?: (response: unknown) => void,
	) => Promise<unknown>;
	stop: () => Promise<unknown>;
	composeState: (
		message: Memory,
		additionalKeys: { [key: string]: unknown },
	) => Promise<unknown>;
	updateRecentMessageState: (state: State) => Promise<State>;
	composeContext: ({
		state,
		template,
		templatingEngine,
	}: {
		state: State;
		template: TemplateType;
		templatingEngine?: "handlebars";
	}) => string;

	// We'll add a session ID if not present
	sessionId?: string;
}

// Export the RuntimeLike interface for use in other files
export type { RuntimeLike };

/**
 * RuntimeInstrumentation wraps the AgentRuntime events with our instrumentation system
 * to capture real-time data about agent operations.
 */
export class RuntimeInstrumentation {
	private static instance: RuntimeInstrumentation;
	private instrumentation: Instrumentation;
	private trackedRuntimes: Map<string, RuntimeLike> = new Map();

	private constructor() {
		this.instrumentation = Instrumentation.getInstance();
		elizaLogger.info("🔄 Runtime instrumentation initialized");
	}

	/**
	 * Get the singleton instance of RuntimeInstrumentation
	 */
	public static getInstance(): RuntimeInstrumentation {
		if (!RuntimeInstrumentation.instance) {
			RuntimeInstrumentation.instance = new RuntimeInstrumentation();
		}
		return RuntimeInstrumentation.instance;
	}

	/**
	 * Attach instrumentation to an AgentRuntime instance to track its events
	 * @param runtime The AgentRuntime instance to track
	 */
	public attachToRuntime(runtime: RuntimeLike): void {
		const agentId = runtime.agentId;

		// Ensure there's a session ID
		if (!runtime.sessionId) {
			runtime.sessionId = uuidv4();
		}
		const sessionId = runtime.sessionId;

		if (this.trackedRuntimes.has(agentId)) {
			elizaLogger.info(`Runtime for agent ${agentId} is already being tracked`);
			return;
		}

		// Store the runtime for later reference
		this.trackedRuntimes.set(agentId, runtime);

		// Log the runtime initialization
		this.instrumentation.sessionStart({
			sessionId,
			agentId,
			roomId: "unknown", // We might need to extract this from runtime context
			characterName: runtime.character?.name || "Unknown Character",
			environment: process.env.NODE_ENV || "development",
			platform: "agent-runtime",
		});

		elizaLogger.info(
			`🔄 Instrumentation attached to runtime for agent ${agentId}`,
		);

		// Wrap runtime methods to track events
		this.wrapRuntimeMethods(runtime);
	}

	/**
	 * Wrap key methods of the AgentRuntime to capture events
	 * @param runtime The AgentRuntime instance to wrap
	 */
	private wrapRuntimeMethods(runtime: RuntimeLike): void {
		const originalInitialize = runtime.initialize.bind(runtime);
		runtime.initialize = async (...args: unknown[]) => {
			const startTime = Date.now();
			try {
				// Call the original method
				const result = await originalInitialize(...args);

				// Log the successful initialization
				this.instrumentation.logEvent({
					stage: "Initialization",
					subStage: "Runtime",
					event: "runtime_initialized",
					data: {
						agentId: runtime.agentId,
						sessionId: runtime.sessionId ?? "",
						duration: Date.now() - startTime,
						success: true,
					},
				});

				return result;
			} catch (error) {
				// Log the failed initialization
				this.instrumentation.logEvent({
					stage: "Initialization",
					subStage: "Runtime",
					event: "runtime_initialization_failed",
					data: {
						agentId: runtime.agentId,
						sessionId: runtime.sessionId ?? "",
						duration: Date.now() - startTime,
						error: (error as Error).message,
					},
				});
				throw error;
			}
		};

		// Wrap the evaluate method to track message processing
		const originalEvaluate = runtime.evaluate.bind(runtime);
		runtime.evaluate = async (message, state, didRespond, callback) => {
			const messageId = message.id || `msg-${Date.now()}`;
			const startTime = Date.now();

			// Log message received
			this.instrumentation.messageReceived({
				message:
					typeof message.content === "string"
						? message.content
						: JSON.stringify(message.content),
				sessionId: runtime.sessionId ?? "",
				agentId: runtime.agentId,
				roomId: (message.roomId as string) || "unknown",
			});

			try {
				// Call the original method
				const result = await originalEvaluate(
					message,
					state as Record<string, unknown>,
					didRespond,
					callback,
				);

				// Log message processed
				this.instrumentation.messageProcessed({
					messageId: messageId as string,
					sessionId: runtime.sessionId ?? "",
					agentId: runtime.agentId,
					processingTime: Date.now() - startTime,
				});

				return result;
			} catch (error) {
				// Log processing error
				this.instrumentation.logEvent({
					stage: "Process",
					subStage: "Error",
					event: "message_processing_error",
					data: {
						messageId,
						sessionId: runtime.sessionId ?? "",
						agentId: runtime.agentId,
						error: (error as Error).message,
						processingTime: Date.now() - startTime,
					},
				});
				throw error;
			}
		};

		// Wrap processActions to track action execution
		const originalProcessActions = runtime.processActions.bind(runtime);
		runtime.processActions = async (message, responses, state, callback) => {
			const startTime = Date.now();
			const actionStartEvent = {
				stage: "Action",
				subStage: "Execution",
				event: "actions_processing_started",
				data: {
					messageId: message.id || uuidv4(),
					sessionId: runtime.sessionId ?? "",
					agentId: runtime.agentId,
					actionsCount: runtime.actions.length,
				},
			};

			this.instrumentation.logEvent(actionStartEvent);

			try {
				// Call the original method
				const result = await originalProcessActions(
					message,
					responses,
					state as Record<string, unknown>,
					callback,
				);

				// Log successful action processing
				this.instrumentation.logEvent({
					stage: "Action",
					subStage: "Execution",
					event: "actions_processing_completed",
					data: {
						messageId: message.id || uuidv4(),
						sessionId: runtime.sessionId ?? "",
						agentId: runtime.agentId,
						processingTime: Date.now() - startTime,
						responseCount: responses.length,
					},
				});

				return result;
			} catch (error) {
				// Log action processing error
				this.instrumentation.logEvent({
					stage: "Action",
					subStage: "Error",
					event: "actions_processing_error",
					data: {
						messageId: message.id || uuidv4(),
						sessionId: runtime.sessionId ?? "",
						agentId: runtime.agentId,
						error: (error as Error).message,
						processingTime: Date.now() - startTime,
					},
				});
				throw error;
			}
		};

		// Track when runtime is stopped
		const originalStop = runtime.stop.bind(runtime);
		runtime.stop = async () => {
			try {
				// Call the original method
				const result = await originalStop();

				// Log runtime stopped
				this.instrumentation.logEvent({
					stage: "Shutdown",
					subStage: "Runtime",
					event: "runtime_stopped",
					data: {
						agentId: runtime.agentId,
						sessionId: runtime.sessionId ?? "",
					},
				});

				// Remove from tracked runtimes
				this.trackedRuntimes.delete(runtime.agentId);

				return result;
			} catch (error) {
				// Log stop error
				this.instrumentation.logEvent({
					stage: "Shutdown",
					subStage: "Error",
					event: "runtime_stop_error",
					data: {
						agentId: runtime.agentId,
						sessionId: runtime.sessionId ?? "",
						error: (error as Error).message,
					},
				});
				throw error;
			}
		};

		// Wrap the composeState method to track state composition
		const originalComposeState = runtime.composeState.bind(runtime);
		runtime.composeState = async (message, additionalKeys) => {
			const startTime = Date.now();
			try {
				// Call the original method
				const outputState = (await originalComposeState(
					message,
					additionalKeys,
				)) as State;

				// Log state composition
				this.instrumentation.logEvent({
					stage: "State",
					subStage: "Composition",
					event: "state_composition_completed",
					data: {
						sessionId: runtime.sessionId ?? "",
						agentId: runtime.agentId,
						processingTime: Date.now() - startTime,
						messageId: message.id || uuidv4(),
						roomId: (message.roomId as string) || "unknown",
						inputMessage: JSON.stringify(message),
						outputState: JSON.stringify(outputState),
					},
				});

				return outputState;
			} catch (error) {
				// Log state composition error
				this.instrumentation.logEvent({
					stage: "State",
					subStage: "Error",
					event: "state_composition_error",
					data: {
						sessionId: runtime.sessionId ?? "",
						agentId: runtime.agentId,
						error: (error as Error).message,
						processingTime: Date.now() - startTime,
						messageId: message.id || uuidv4(),
						roomId: (message.roomId as string) || "unknown",
						inputMessage: JSON.stringify(message),
					},
				});
				throw error;
			}
		};

		// Wrap the updateRecentMessageState method to track state composition
		const originalUpdateRecentMessageState =
			runtime.updateRecentMessageState.bind(runtime);
		runtime.updateRecentMessageState = async (state) => {
			const startTime = Date.now();
			try {
				// Call the original method
				const outputState = (await originalUpdateRecentMessageState(
					state,
				)) as State;

				// Log state composition
				this.instrumentation.logEvent({
					stage: "State",
					subStage: "Composition",
					event: "state_composition_updated",
					data: {
						sessionId: runtime.sessionId ?? "",
						agentId: runtime.agentId,
						processingTime: Date.now() - startTime,
						roomId: (state.roomId as string) || "unknown",
						inputState: JSON.stringify(state),
						outputState: JSON.stringify(outputState),
					},
				});

				return outputState;
			} catch (error) {
				// Log state composition error
				this.instrumentation.logEvent({
					stage: "State",
					subStage: "Error",
					event: "state_composition_error",
					data: {
						sessionId: runtime.sessionId ?? "",
						agentId: runtime.agentId,
						error: (error as Error).message,
						processingTime: Date.now() - startTime,
						roomId: (state.roomId as string) || "unknown",
						inputState: JSON.stringify(state),
					},
				});
				throw error;
			}
		};
	}

	/**
	 * Detach instrumentation from an AgentRuntime instance
	 * @param agentId The ID of the agent to detach
	 */
	public detachFromRuntime(agentId: string): void {
		const runtime = this.trackedRuntimes.get(agentId);
		if (!runtime) {
			elizaLogger.warn(
				`Attempted to detach instrumentation from untracked runtime: ${agentId}`,
			);
			return;
		}

		// TODO: Restore original methods if needed

		// Remove from tracked runtimes
		this.trackedRuntimes.delete(agentId);

		elizaLogger.info(
			`🔄 Instrumentation detached from runtime for agent ${agentId}`,
		);
	}
}

// Export a singleton instance getter
export const getRuntimeInstrumentation = () =>
	RuntimeInstrumentation.getInstance();
