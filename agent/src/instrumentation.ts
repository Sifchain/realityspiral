import { v4 as uuidv4 } from 'uuid';
import { elizaLogger } from '@elizaos/core';
import { trace, Span, SpanStatusCode } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { DBSpanProcessor } from './dbSpanProcessor';

// Simplify the logger type definition
interface Logger {
  logMessageReceived: (data: Record<string, any>) => void;
  logMessageProcessed: (data: Record<string, any>) => void;
  logAgentCreated: (data: Record<string, any>) => void;
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
    model: string = 'gpt-4'
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
    model: string = 'gpt-4'
  ): Logger {
    const existingLogger = this.loggers.get(agentId);
    if (existingLogger) {
      return existingLogger;
    }
    
    return this.createLogger(agentId, sessionId, roomId, model);
  }
}

// Singleton instance
const agentInstrumentation = AgentInstrumentation.getInstance();

/**
 * Helper function to get or create a logger for an agent
 */
export function getAgentLogger(
  agentId: string,
  sessionId?: string,
  roomId?: string,
  model: string = 'gpt-4'
): Logger {
  return {
    logMessageReceived: (data) => console.log('Message received:', data),
    logMessageProcessed: (data) => console.log('Message processed:', data),
    logAgentCreated: (data) => console.log('Agent created:', data),
  };
}

export interface InstrumentationEvent {
  stage: string;
  subStage: string;
  event: string;
  data: Record<string, any>;
  timestamp?: number;
}

export class Instrumentation {
  private static instance: Instrumentation;
  private tracer: ReturnType<typeof trace.getTracer>;

  private constructor() {
    const provider = new NodeTracerProvider({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: 'realityspiral-agent',
      }),
    });

    // Add the BatchSpanProcessor with OTLP exporter if an endpoint is configured
    if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
      provider.addSpanProcessor(
        new BatchSpanProcessor(
          new OTLPTraceExporter({
            url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
          })
        )
      );
    }

    // Add our custom DBSpanProcessor to store spans in the database
    provider.addSpanProcessor(new DBSpanProcessor());

    provider.register();
    this.tracer = trace.getTracer('realityspiral-agent');
    
    elizaLogger.info('📊 Instrumentation initialized with DB span processor');
  }

  public static getInstance(): Instrumentation {
    if (!Instrumentation.instance) {
      Instrumentation.instance = new Instrumentation();
    }
    return Instrumentation.instance;
  }

  public logEvent(event: InstrumentationEvent): void {
    const { sessionId, agentId, roomId } = event.data;
    const hasRequiredIds = sessionId || agentId || roomId;
    
    if (!hasRequiredIds) {
      console.warn('⚠️ Skipping event without context IDs:', event.event);
      return;
    }

    const span = this.tracer.startSpan(event.event, {
      attributes: {
        ...(sessionId && { 'session.id': sessionId }),
        ...(agentId && { 'agent.id': agentId }),
        ...(roomId && { 'room.id': roomId }),
        'event.stage': event.stage,
        'event.sub_stage': event.subStage,
        'event.timestamp': event.timestamp || Date.now(),
        'environment': process.env.NODE_ENV || 'development',
        ...event.data
      },
    });

    try {
      console.log(JSON.stringify(event));
      span.setStatus({ code: SpanStatusCode.OK });
    } finally {
      span.end();
    }
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
      stage: 'Initialization',
      subStage: 'Runtime Boot',
      event: 'session_start',
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
    roomId: string 
  }) {
    this.logEvent({
      stage: 'Observe',
      subStage: 'Input Reception',
      event: 'message_received',
      data: {
        message: data.message,
        sessionId: data.sessionId,
        agentId: data.agentId,
        roomId: data.roomId,
        timestamp: Date.now()
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
      stage: 'Process',
      subStage: 'Complete',
      event: 'message_processed',
      data: {
        messageId: data.messageId,
        sessionId: data.sessionId,
        agentId: data.agentId,
        processingTime: data.processingTime,
        timestamp: Date.now()
      },
    });
  }
}

export const instrument = Instrumentation.getInstance(); 