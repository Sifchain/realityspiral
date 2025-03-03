import { elizaLogger } from "@elizaos/core";
import type {
	ReadableSpan,
	SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import pg from "pg";

// Get PostgreSQL connection string
const postgresUrl =
	process.env.POSTGRES_URL ||
	"postgresql://user@localhost:5432/tracing_database";

// PostgreSQL database connection
let pgClient: pg.Client | null = null;

// Initialize the PostgreSQL connection
try {
	pgClient = new pg.Client({
		connectionString: postgresUrl,
	});
	pgClient.connect();
	elizaLogger.info(`✅ Connected to PostgreSQL database at ${postgresUrl}`);
} catch (error) {
	elizaLogger.error(`❌ Failed to connect to PostgreSQL database: ${error}`);
	throw error;
}

// Create the traces table if it doesn't exist
async function createTracesTable(): Promise<void> {
	if (pgClient) {
		const createTableQuery = `
      CREATE TABLE IF NOT EXISTS traces (
        id SERIAL PRIMARY KEY,
        trace_id TEXT NOT NULL,
        span_id TEXT NOT NULL,
        parent_span_id TEXT,
        trace_state TEXT,
        span_name TEXT NOT NULL,
        span_kind INTEGER,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        duration_ms INTEGER NOT NULL,
        status_code INTEGER,
        status_message TEXT,
        attributes JSONB,
        events JSONB,
        links JSONB,
        resource JSONB,
        agent_id TEXT,
        session_id TEXT,
        environment TEXT,
        room_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(trace_id, span_id)
      );
    `;

		try {
			await pgClient.query(createTableQuery);
			elizaLogger.info("✅ PostgreSQL traces table created or already exists");
		} catch (error) {
			elizaLogger.error("❌ Error creating traces table in PostgreSQL:", error);
			throw error;
		}
	}
}

// Inserts a span record into the database
async function insertTrace(spanData: any): Promise<void> {
	if (pgClient) {
		const query = `
      INSERT INTO traces (
        trace_id,
        span_id,
        parent_span_id,
        trace_state,
        span_name,
        span_kind,
        start_time,
        end_time,
        duration_ms,
        status_code,
        status_message,
        attributes,
        events,
        links,
        resource,
        agent_id,
        session_id,
        environment,
        room_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      ON CONFLICT (trace_id, span_id) DO NOTHING;
    `;

		try {
			await pgClient.query(query, [
				spanData.trace_id,
				spanData.span_id,
				spanData.parent_span_id,
				spanData.trace_state,
				spanData.span_name,
				spanData.span_kind,
				spanData.start_time,
				spanData.end_time,
				spanData.duration_ms,
				spanData.status_code,
				spanData.status_message,
				JSON.stringify(spanData.attributes || {}),
				JSON.stringify(spanData.events || []),
				JSON.stringify(spanData.links || []),
				JSON.stringify(spanData.resource || {}),
				spanData.agent_id,
				spanData.session_id,
				spanData.environment,
				spanData.room_id,
			]);

			elizaLogger.info(
				"✅ Span inserted successfully into PostgreSQL:",
				spanData.span_name,
			);
		} catch (error) {
			elizaLogger.error("❌ Error inserting span into PostgreSQL DB:", error);
		}
	}
}

export class DBSpanProcessor implements SpanProcessor {
	constructor() {
		// Create the table when the processor is initialized
		createTracesTable();
	}

	onStart(span: ReadableSpan): void {
		// Optional: Log span start for debugging
		elizaLogger.debug("🟢 Span started:", span.name);
	}

	onEnd(span: ReadableSpan): void {
		const spanContext = span.spanContext();

		// Convert [seconds, nanoseconds] to milliseconds
		const startTimeMs = span.startTime[0] * 1000 + span.startTime[1] / 1e6;
		const endTimeMs = span.endTime[0] * 1000 + span.endTime[1] / 1e6;
		const durationMs = Math.floor(endTimeMs - startTimeMs);

		// Extract fields from attributes
		const attributes = span.attributes || {};
		const resource = span.resource?.attributes || {};

		const safeTrim = (value: unknown): string | null => {
			if (typeof value !== "string") return null;
			const trimmed = value.trim();
			return trimmed.length > 0 ? trimmed : null;
		};

		const spanData = {
			trace_id: spanContext.traceId,
			span_id: spanContext.spanId,
			parent_span_id: span.parentSpanId || null,
			span_name: span.name,
			span_kind: span.kind,
			start_time: new Date(startTimeMs).toISOString(),
			end_time: new Date(endTimeMs).toISOString(),
			duration_ms: durationMs,
			status_code: span.status.code,
			status_message: span.status.message || null,
			attributes: attributes,
			events: span.events || [],
			links: span.links || [],
			resource: resource,
			agent_id:
				safeTrim(attributes["agent.id"]) || safeTrim(attributes.agentId),
			session_id:
				safeTrim(attributes["session.id"]) || safeTrim(attributes.sessionId),
			environment:
				safeTrim(attributes.environment) ||
				safeTrim(resource["deployment.environment"]) ||
				process.env.NODE_ENV ||
				"development",
			room_id: safeTrim(attributes["room.id"]) || safeTrim(attributes.roomId),
		};

		// Add validation to skip spans without context IDs
		if (!spanData.agent_id && !spanData.session_id && !spanData.room_id) {
			elizaLogger.debug("⚠️ Skipping span with no context IDs:", span.name);
			return;
		}

		elizaLogger.debug("🟡 Span ended, inserting:", span.name);
		insertTrace(spanData);
	}

	shutdown(): Promise<void> {
		// Close the database connection
		if (pgClient) {
			pgClient.end();
			elizaLogger.info("PostgreSQL database connection closed");
		}
		return Promise.resolve();
	}

	forceFlush(): Promise<void> {
		return Promise.resolve();
	}
}
