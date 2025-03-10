import { elizaLogger } from "@elizaos/core";
import {
	type AttributeValue,
	Attributes,
	Span,
	SpanStatusCode,
	trace,
} from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { v4 as uuidv4 } from "uuid";
import { DBSpanProcessor } from "./dbSpanProcessor";

// Simplify the logger type definition
interface Logger {
	/**
	 * Logs when a message is received by the agent.
	 * @param data - The details of the received message.
	 */
	logMessageReceived: (data: {
		message: string;
		sessionId: string;
		agentId: string;
		roomId: string;
	}) => void;

	/**
	 * Logs when a message has been processed by the agent.
	 * @param data - The details of the processed message.
	 */
	logMessageProcessed: (data: {
		messageId: string;
		sessionId: string;
		agentId: string;
		processingTime: number;
	}) => void;

	/**
	 * Logs when a new agent is created.
	 * @param data - The details of the agent creation.
	 */
	logAgentCreated: (data: {
		agentId: string;
		sessionId: string;
		roomId: string;
		model?: string;
	}) => void;
}

/**
 * AgentInstrumentation provides a singleton interface for managing agent loggers.
 */
export class AgentInstrumentation {
	private static instance: AgentInstrumentation;
	private loggers: Map<string, Logger> = new Map();

	private constructor() {}

	/**
	 * Get the singleton instance of AgentInstrumentation
	 */
	public static getInstance(): AgentInstrumentation {
		if (!AgentInstrumentation.instance) {
			AgentInstrumentation.instance = new AgentInstrumentation();
		}
		return AgentInstrumentation.instance;
	}

	/**
	 * Create a logger for an agent
	 *
	 * @param agentId - Optional agent ID (will generate UUID if not provided)
	 * @param sessionId - Optional session ID (will generate UUID if not provided)
	 * @param roomId - Optional room ID (will generate UUID if not provided)
	 * @param model - Optional model name (defaults to 'gpt-4')
	 * @returns The created AgentLogger
	 */
	createLogger(
		agentId: string = uuidv4(),
		sessionId: string = uuidv4(),
		roomId: string = uuidv4(),
		model = "gpt-4",
	): Logger {
		const logger = getAgentLogger(agentId, sessionId, roomId, model) as Logger;
		this.loggers.set(agentId, logger);

		// Log to the Eliza logger as well
		elizaLogger.info(`Created instrumentation logger for agent ${agentId}`);

		return logger;
	}

	/**
	 * Get a logger for an agent
	 *
	 * @param agentId - The agent ID
	 * @returns The AgentLogger or undefined if not found
	 */
	getLogger(agentId: string): Logger | undefined {
		return this.loggers.get(agentId);
	}

	/**
	 * Get or create a logger for an agent
	 *
	 * @param agentId - The agent ID
	 * @param sessionId - The session ID (used only if creating a new logger)
	 * @param roomId - The room ID (used only if creating a new logger)
	 * @param model - The model being used (used only if creating a new logger)
	 * @returns The AgentLogger
	 */
	getOrCreateLogger(
		agentId: string,
		sessionId: string = uuidv4(),
		roomId: string = uuidv4(),
		model = "gpt-4",
	): Logger {
		const existingLogger = this.loggers.get(agentId);
		if (existingLogger) {
			return existingLogger;
		}

		return this.createLogger(agentId, sessionId, roomId, model);
	}
}

// Singleton instance
const _agentInstrumentation = AgentInstrumentation.getInstance();

/**
 * Helper function to get or create a logger for an agent
 */
export function getAgentLogger(
	_agentId: string,
	_sessionId?: string,
	_roomId?: string,
	_model = "gpt-4",
): Logger {
	return {
		logMessageReceived: (data) => console.log("Message received:", data),
		logMessageProcessed: (data) => console.log("Message processed:", data),
		logAgentCreated: (data) => console.log("Agent created:", data),
	};
}

export interface InstrumentationEvent {
	stage: string;
	subStage: string;
	event: string;
	data: Record<string, unknown>;
	timestamp?: number;
}

export class Instrumentation {
	private static instance: Instrumentation;
	private tracer: ReturnType<typeof trace.getTracer>;
	private enabled = true; // Enable instrumentation by default
	private provider: NodeTracerProvider;

	private constructor() {
		const provider = new NodeTracerProvider({
			resource: new Resource({
				[SemanticResourceAttributes.SERVICE_NAME]: "realityspiral-agent",
			}),
		});

		// Add the BatchSpanProcessor with OTLP exporter if an endpoint is configured
		if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
			provider.addSpanProcessor(
				new BatchSpanProcessor(
					new OTLPTraceExporter({
						url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
					}),
				),
			);
		}

		// Add our custom DBSpanProcessor to store spans in the database
		provider.addSpanProcessor(new DBSpanProcessor());

		provider.register();
		this.tracer = trace.getTracer("realityspiral-agent");

		elizaLogger.info("📊 Instrumentation initialized with DB span processor");
	}

	public static getInstance(): Instrumentation {
		if (!Instrumentation.instance) {
			Instrumentation.instance = new Instrumentation();
		}
		return Instrumentation.instance;
	}

	public logEvent(event: InstrumentationEvent): void {
		if (!this.enabled) {
			return; // Skip logging if instrumentation is disabled
		}

		const span = this.tracer.startSpan(
			`${event.stage}/${event.subStage}/${event.event}`,
		);

		// Convert to proper attribute format
		const attributes: Record<string, AttributeValue> = {
			stage: event.stage,
			subStage: event.subStage,
			event: event.event,
		};

		// Add data properties as attributes
		for (const [key, value] of Object.entries(event.data)) {
			// Only add values that can be converted to AttributeValue
			if (
				typeof value === "string" ||
				typeof value === "number" ||
				typeof value === "boolean" ||
				Array.isArray(value)
			) {
				attributes[key] = value as AttributeValue;
			}
		}

		span.setAttributes(attributes);
		span.setStatus({ code: SpanStatusCode.OK });
		span.end();
	}

	public sessionStart(data: {
		sessionId: string;
		agentId: string;
		roomId: string;
		characterName: string;
		environment: string;
		platform: string;
	}) {
		this.logEvent({
			stage: "Initialization",
			subStage: "Runtime Boot",
			event: "session_start",
			data: {
				sessionId: data.sessionId,
				agentId: data.agentId,
				roomId: data.roomId,
				characterName: data.characterName,
				environment: data.environment,
				platform: data.platform,
			},
		});
	}

	public messageReceived(data: {
		message: string;
		sessionId: string;
		agentId: string;
		roomId: string;
	}) {
		this.logEvent({
			stage: "Observe",
			subStage: "Input Reception",
			event: "message_received",
			data: {
				message: data.message,
				sessionId: data.sessionId,
				agentId: data.agentId,
				roomId: data.roomId,
				timestamp: Date.now(),
			},
		});
	}

	public messageProcessed(data: {
		messageId: string;
		sessionId: string;
		agentId: string;
		processingTime: number;
	}) {
		this.logEvent({
			stage: "Process",
			subStage: "Complete",
			event: "message_processed",
			data: {
				messageId: data.messageId,
				sessionId: data.sessionId,
				agentId: data.agentId,
				processingTime: data.processingTime,
				timestamp: Date.now(),
			},
		});
	}
}

export const instrument = Instrumentation.getInstance();
